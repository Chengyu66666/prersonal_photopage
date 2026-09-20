#!/usr/bin/env python3
"""Rebind photo-data.js to the full-resolution files that are actually deployed.

Why this exists
---------------
This site publishes the camera originals themselves -- no downscaled or
re-encoded derivatives -- so ``assets/opt/`` holds the exported JPEGs under::

    assets/opt/topics/<主题>/<文件名>.jpg
    assets/opt/projects/<项目>/[<章节>/]<文件名>.jpg

``photo-data.js`` is generated data: every photo entry carries ``thumb``,
``large`` and ``master``, and on this site all three name **the same original
file**. There is no smaller variant anywhere, so the grid, the lightbox and the
hero collage all serve full quality.

Whenever files in ``assets/opt/`` are renamed, moved between albums or added,
the paths in ``photo-data.js`` go stale and the site silently 404s every image.
Run this script to rebind them.

An earlier revision of this project generated 800 px / 1600 px WebP derivatives
and pointed ``thumb``/``large`` at those. That pipeline is gone: Cloudflare
serves the originals fine as long as no single file exceeds 25 MiB, and the
photo metadata below is preserved verbatim rather than re-derived.

Usage
-----
    python scripts/build_photo_data.py            # dry run: report only
    python scripts/build_photo_data.py --write    # rewrite photo-data.js
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "photo-data.js"
OPT_ROOT = ROOT / "assets" / "opt"
LIBRARY_PREFIX = "window.PHOTO_LIBRARY ="
# Cloudflare rejects any single asset above 25 MiB, so it must never be deployed.
CF_FILE_LIMIT = 25 * 1024 * 1024

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def collect_files() -> list[str]:
    return sorted(rel(p) for p in OPT_ROOT.rglob("*") if p.is_file())


def stem(p: str) -> str:
    return Path(p).stem


def load_library():
    raw = DATA_FILE.read_text(encoding="utf-8")
    i, j = raw.find("{"), raw.rfind("}")
    return raw[:i], json.loads(raw[i:j + 1]), raw[j + 1:]


def build_resolvers(files: list[str]):
    """Return (resolve_topic, resolve_project) closures bound to the file list."""
    topic_dirs = sorted(
        d.name for d in (OPT_ROOT / "topics").iterdir() if d.is_dir()
    ) if (OPT_ROOT / "topics").is_dir() else []
    project_dirs = sorted(
        d.name for d in (OPT_ROOT / "projects").iterdir() if d.is_dir()
    ) if (OPT_ROOT / "projects").is_dir() else []

    by_topic: dict[str, dict[str, list[str]]] = {}
    for d in topic_dirs:
        by_topic[d] = {}
    for f in files:
        # Paths are assets/opt/topics/<主题>/<文件>, so the album sits at index 3.
        parts = f.split("/")
        if len(parts) >= 5 and parts[2] == "topics":
            by_topic.setdefault(parts[3], {}).setdefault(stem(f), []).append(f)

    def resolve_topic(label: str, filename: str) -> str | None:
        hits = by_topic.get(label, {}).get(stem(filename), [])
        return hits[0] if len(hits) == 1 else None

    def resolve_project(chapter: str | None, filename: str) -> str | None:
        """The album directory is matched by chapter name where there is one.

        Project titles do not always equal their folder name (``大美秦岭`` lives
        in ``秦岭七十二峪/``), so the chapter -- unique inside an album -- is the
        reliable key; an album without sub-albums falls back to a plain match.
        """
        want = stem(filename)
        exact: list[str] = []
        loose: list[str] = []
        for d in project_dirs:
            base = f"assets/opt/projects/{d}/"
            for f in files:
                if not f.startswith(base) or stem(f) != want:
                    continue
                rest = f[len(base):]
                if chapter and rest.startswith(chapter + "/"):
                    exact.append(f)
                else:
                    loose.append(f)
        if len(exact) == 1:
            return exact[0]
        if not exact and len(loose) == 1:
            return loose[0]
        return None

    return resolve_topic, resolve_project


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="rewrite photo-data.js in place")
    args = ap.parse_args()

    head, data, tail = load_library()
    # The generator renamed once; keep the banner pointing at the live script
    # instead of the retired optimize_images.py pipeline.
    head = head.replace("scripts/optimize_images.py", "scripts/build_photo_data.py")
    files = collect_files()
    files_set = set(files)
    print(f"assets/opt: {len(files)} 个文件, "
          f"{sum(os.path.getsize(ROOT / f) for f in files) / 1073741824:.2f} GB")

    resolve_topic, resolve_project = build_resolvers(files)

    # Topic key -> Chinese album folder name. The label lives on each photo
    # (`categoryLabel`), not on the topic node, so read it from the entries --
    # that keeps the mapping tied to what is actually on disk rather than to a
    # title that someone may have reworded.
    cat_label: dict[str, str] = {}
    for k, v in data["topics"].items():
        labels = {p.get("categoryLabel") for p in (v.get("photos") or []) if p.get("categoryLabel")}
        cat_label[k] = labels.pop() if len(labels) == 1 else v.get("label")

    remap: dict[str, str] = {}
    unresolved: list[tuple[str, str]] = []
    total = 0

    for key, topic in data["topics"].items():
        label = cat_label.get(key) or topic.get("label")
        for p in topic["photos"]:
            total += 1
            new = resolve_topic(label, p["filename"])
            if new is None:
                unresolved.append((key, p["filename"]))
                continue
            remap[p["thumb"]] = remap[p["large"]] = new
            p["thumb"] = p["large"] = p["master"] = new

    for key, proj in data["projects"].items():
        for p in proj["photos"]:
            total += 1
            new = resolve_project(p.get("chapter"), p["filename"])
            if new is None:
                unresolved.append((key, p["filename"]))
                continue
            remap[p["thumb"]] = remap[p["large"]] = new
            p["thumb"] = p["large"] = p["master"] = new

    # Covers and any other stored path follow the same mapping.
    def walk(o) -> int:
        n = 0
        items = o.items() if isinstance(o, dict) else enumerate(o) if isinstance(o, list) else []
        for k, v in list(items):
            if isinstance(v, str):
                if v in remap:
                    o[k] = remap[v]
                    n += 1
            else:
                n += walk(v)
        return n

    print(f"重写封面等引用 {walk(data)} 处")

    if unresolved:
        print(f"\n无法解析 {len(unresolved)} 条 —— 文件是否被移动或改名？")
        for key, fn in unresolved[:20]:
            print("   ", key, fn)
        return 1

    blob = json.dumps(data, ensure_ascii=False)
    stale = sorted({s for s in blob.split('"')
                    if s.startswith("assets/opt/") and s not in files_set})
    if stale:
        print(f"\n仍有 {len(stale)} 处引用不落地：{stale[:5]}")
        return 1

    used = {p["thumb"] for t in data["topics"].values() for p in t["photos"]}
    used |= {p["thumb"] for pr in data["projects"].values() for p in pr["photos"]}
    orphan = sorted(files_set - used)
    over = sorted(f for f in files if os.path.getsize(ROOT / f) > CF_FILE_LIMIT)

    print(f"条目 {total} 条，引用文件 {len(used)} 个")
    if orphan:
        print(f"\n未被任何条目引用的文件 {len(orphan)} 个（照片没进清单？）：")
        for f in orphan[:20]:
            print("   ", f)
    if over:
        print(f"\n超过 Cloudflare 25 MiB 上限的文件 {len(over)} 个 —— 部署会失败：")
        for f in over:
            print(f"    {os.path.getsize(ROOT / f) / 1048576:.2f} MiB  {f}")
    if not over:
        print("全部文件均在 25 MiB 以内")

    if not args.write:
        print("\n[dry run] 未写入。加 --write 应用。")
        return 1 if (unresolved or stale or orphan or over) else 0

    if orphan or over:
        print("\n有孤立文件或超限文件，已中止写入。先处理上面列出的问题。")
        return 1

    import time
    data["generatedAt"] = time.strftime("%Y-%m-%d %H:%M:%S")
    out = head + json.dumps(data, ensure_ascii=False, indent=2) + tail
    DATA_FILE.write_text(out, encoding="utf-8", newline="")
    print(f"\n已写入 photo-data.js（{len(out)} 字节）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
