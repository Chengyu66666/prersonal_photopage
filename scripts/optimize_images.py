#!/usr/bin/env python3
"""Generate web-optimised WebP derivatives for the Thomas pics photo library.

Why this exists
---------------
The originals under ``assets/photos/`` are a mix of two very different things:

* camera masters exported straight from Lightroom (4-33 MB each)
* already-compressed small JPEGs (~200-700 KB, ~1200-1800 px)

Serving them raw means a 30 MB hero image on first paint. This script produces
WebP derivatives on demand, and only when the derivative is actually smaller
than the original:

* ``thumb``  max width  800 px, q 74  -> hero collage, collection tiles, grids
* ``large``  max width 1600 px, q 78  -> lightbox / full-screen viewing

For a source that is already small and already narrower than the target width,
no derivative is produced and the front end falls back to the original file --
so the library never gets *bigger* just because it was processed.

Output goes to ``assets/opt/`` mirroring the source tree. EXIF (including GPS)
is stripped: the readable camera metadata already lives in ``photo-data.js``,
so keeping binary EXIF would only bloat files and leak shooting locations.

The script then rewrites ``photo-data.js``, adding ``thumb`` / ``large`` fields
to every photo entry while leaving ``src`` untouched, so the masters remain the
single source of truth.

Usage
-----
    python scripts/optimize_images.py               # generate + rewrite data file
    python scripts/optimize_images.py --report      # report only, no writes
    python scripts/optimize_images.py --data-only   # regenerate data file only
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = ROOT / "assets" / "photos"
OUT_ROOT = ROOT / "assets" / "opt"
DATA_FILE = ROOT / "photo-data.js"
LIBRARY_PREFIX = "window.PHOTO_LIBRARY ="
SRC_PREFIX = "assets/photos/"
DERIVED_PREFIX = "assets/opt/"

# (name, max width in px, webp quality)
VARIANTS = (("thumb", 800, 74), ("large", 1600, 78))
# Recompress even when the source is already narrow enough, as long as it is
# this heavy -- a 600 KB 1200 px JPEG still gets meaningfully smaller as WebP.
HEAVY_BYTES = 1_200_000
WEBP_METHOD = 5  # 0-6, higher is slower but produces smaller files
JPEG_SUFFIXES = (".jpg", ".jpeg", ".JPG", ".JPEG")

# Hand-written copy for collections. Kept here rather than in photo-data.js so
# the data file stays fully generated -- edit the wording here, then re-run.
CURATED = {
    "topics": {
        "nature": "山野、海岸、湖泊与季节光线构成的自然影像档案。",
        "city": "街道、建筑、灯光与人群移动之间的城市节奏。",
        "people": "人物、现场与真实关系共同组成的纪实肖像。",
        "events": "活动、会议与集体现场中的秩序、表情和瞬间。",
    },
    "projects": {
        "project-01": "把相机带上高海拔徒步路线，收录「贡嘎小环自组」与「长穿毕自组」两段行程中的光线、路况与同行者。",
        "project-02": "以西安城墙为线索，记录城门、顺城巷与城墙根下日常生活的秩序与表情。",
        "project-03": "沿秦岭十个峪口与山口行走，从北阳山到终南草甸，收录不同季节的植被、云海与山脊线。",
    },
}


def variant_path(rel: Path, name: str) -> Path:
    """assets/photos/nature/x.jpg -> assets/opt/nature/x-<name>.webp"""
    return OUT_ROOT / rel.parent / f"{rel.stem}-{name}.webp"


def planned_variants(width: int, nbytes: int) -> list[tuple[str, int, int]]:
    """Only build a derivative when it can actually beat the source."""
    planned = []
    for name, max_width, quality in VARIANTS:
        if width > max_width or nbytes > HEAVY_BYTES:
            planned.append((name, max_width, quality))
    return planned


def process_one(rel: Path, prune: bool = False) -> tuple[str, int, bool]:
    """Render the planned derivatives for one source image."""
    source = SRC_ROOT / rel
    nbytes = source.stat().st_size
    mtime = source.stat().st_mtime

    with Image.open(source) as probe:
        width, height = probe.size
    planned = planned_variants(width, nbytes)
    planned_names = {name for name, _, _ in planned}

    # Drop derivatives that are no longer wanted for this source. Opt-in only:
    # unlinks are best-effort and never worth failing a batch over.
    if prune:
        for name, _, _ in VARIANTS:
            stale = variant_path(rel, name)
            if name in planned_names or not stale.exists():
                continue
            try:
                stale.unlink()
            except OSError:
                pass

    changed = False
    for name, max_width, quality in planned:
        target = variant_path(rel, name)
        if target.exists() and target.stat().st_mtime >= mtime:
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            # draft() lets libjpeg decode at reduced scale: a big speed win.
            image.draft("RGB", (max_width, max_width))
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "L"):
                image = image.convert("RGB")
            if image.width > max_width:
                resized_height = round(image.height * max_width / image.width)
                image = image.resize((max_width, resized_height), Image.LANCZOS)
            # No exif= argument -> metadata is dropped on purpose.
            image.save(target, "WEBP", quality=quality, method=WEBP_METHOD)

        # A derivative that grew is worse than useless: remove it. The data
        # writer independently refuses to link such a file, so this is only
        # housekeeping -- hence best-effort.
        if target.stat().st_size >= nbytes:
            try:
                target.unlink()
            except OSError:
                pass
        else:
            changed = True

    return str(rel), nbytes, changed


def collect_sources() -> list[Path]:
    if not SRC_ROOT.is_dir():
        sys.exit(f"source photo directory not found: {SRC_ROOT}")
    found = [
        path.relative_to(SRC_ROOT)
        for path in SRC_ROOT.rglob("*")
        if path.is_file() and path.suffix in JPEG_SUFFIXES
    ]
    return sorted(found)


def prune_orphans(known: set[str]) -> int:
    """Delete derivatives whose source image is gone."""
    if not OUT_ROOT.is_dir():
        return 0
    removed = 0
    for path in OUT_ROOT.rglob("*.webp"):
        rel = path.relative_to(OUT_ROOT)
        stem = rel.name[: -len(".webp")]
        for name, _, _ in VARIANTS:
            suffix = f"-{name}"
            if stem.endswith(suffix):
                stem = stem[: -len(suffix)]
                break
        if f"{rel.parent / stem}" not in known:
            try:
                path.unlink()
                removed += 1
            except OSError:
                pass
    return removed


def load_library() -> dict:
    raw = DATA_FILE.read_text(encoding="utf-8-sig").strip()
    if not raw.startswith(LIBRARY_PREFIX):
        sys.exit(f"unexpected format in {DATA_FILE.name}")
    return json.loads(raw[len(LIBRARY_PREFIX):].rstrip(";").strip())


def iter_photos(library: dict):
    """Yield every photo dict in topics and projects."""
    for topic in library.get("topics", {}).values():
        yield from topic.get("photos", [])
    for project in library.get("projects", {}).values():
        yield from project.get("photos", [])


def best_source(photo: dict, name: str) -> str | None:
    """Prefer the derivative, but never when it is heavier than the original."""
    src = photo.get("src")
    if not src or not src.startswith(SRC_PREFIX):
        return None
    derivative = ROOT / DERIVED_PREFIX / Path(src[len(SRC_PREFIX):])
    derivative = derivative.parent / f"{derivative.stem}-{name}.webp"
    original = ROOT / src
    if not derivative.exists():
        return None
    if original.exists() and derivative.stat().st_size >= original.stat().st_size:
        return None
    return derivative.relative_to(ROOT).as_posix()


def patch_library(library: dict) -> tuple[int, int, int]:
    """Attach thumb/large paths and recompute counts. Returns (patched, orig, missing)."""
    patched = fallback = missing = 0
    for photo in iter_photos(library):
        for name, _, _ in VARIANTS:
            chosen = best_source(photo, name)
            if chosen:
                photo[name] = chosen
            else:
                photo.pop(name, None)

        thumb = photo.get("thumb")
        if not thumb:
            missing += 1
        elif thumb.startswith(DERIVED_PREFIX):
            patched += 1
        else:
            fallback += 1

    for topic in library.get("topics", {}).values():
        topic["count"] = len(topic.get("photos", []))
        if copy := CURATED["topics"].get(topic.get("key")):
            topic["intro"] = copy
    for project in library.get("projects", {}).values():
        project["count"] = len(project.get("photos", []))
        if copy := CURATED["projects"].get(project.get("key")):
            project["intro"] = copy

    return patched, fallback, missing


def write_library(library: dict) -> None:
    body = json.dumps(library, ensure_ascii=False, indent=2)
    DATA_FILE.write_text(
        f"/* Generated by scripts/optimize_images.py -- do not edit by hand. */\n"
        f"{LIBRARY_PREFIX} {body};\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", action="store_true", help="report only, no writes")
    parser.add_argument("--data-only", action="store_true", help="skip image generation")
    parser.add_argument("--jobs", type=int, default=min(8, os.cpu_count() or 4))
    parser.add_argument(
        "--prune",
        action="store_true",
        help="delete derivative files that are no longer wanted (best-effort)",
    )
    args = parser.parse_args()

    sources = collect_sources()
    print(f"source images: {len(sources)}")

    if args.report:
        pending = [
            rel
            for rel in sources
            if any(
                not variant_path(rel, name).exists()
                for name, _, _ in planned_variants(*_probe(rel))
            )
        ]
        print(f"derivatives up to date for {len(sources) - len(pending)}, pending: {len(pending)}")
        for rel in pending[:20]:
            print("  pending:", rel)
        return

    total_bytes = 0
    changed = 0
    if not args.data_only:
        started = time.time()
        with ProcessPoolExecutor(max_workers=args.jobs) as pool:
            futures = {pool.submit(process_one, rel, args.prune): rel for rel in sources}
            for done, future in enumerate(as_completed(futures), start=1):
                _, nbytes, did_change = future.result()
                total_bytes += nbytes
                changed += 1 if did_change else 0
                if done % 25 == 0 or done == len(sources):
                    print(
                        f"[{done}/{len(sources)}] {time.time() - started:6.1f}s  "
                        f"scanned {total_bytes / 1_048_576:.0f} MB of masters",
                        flush=True,
                    )

        removed = prune_orphans({str(rel) for rel in sources}) if args.prune else 0
        derived = sum(p.stat().st_size for p in OUT_ROOT.rglob("*.webp")) if OUT_ROOT.is_dir() else 0
        print(
            f"processed {len(sources)} masters ({changed} rebuilt); "
            f"derivatives now {derived / 1_048_576:.1f} MB, "
            f"orphans removed {removed}"
        )

    library = load_library()
    patched, fallback, missing = patch_library(library)
    write_library(library)
    print(
        f"photo-data.js rewritten: {patched} entries use WebP derivatives, "
        f"{fallback} fall back to the original, {missing} have no thumb at all"
    )


def _probe(rel: Path) -> tuple[int, int]:
    source = SRC_ROOT / rel
    with Image.open(source) as image:
        width, _ = image.size
    return width, source.stat().st_size


if __name__ == "__main__":
    main()
