#!/usr/bin/env python3
"""Build the homepage collage's preset image sets.

Reads ``scripts/hero_manifest.json`` (which original goes into which set) and
produces two things:

  1. ``assets/hero/set<N>-<M>.webp`` -- downscaled copies for the collage tiles
  2. ``hero-sets.js``                 -- ``window.HERO_SETS`` consumed by script.js

Why derivatives exist at all
----------------------------
The collage tiles render at most 456x257 CSS px, but the deployed originals are
6000x4000 (24 MP). That is roughly 51x more pixels than the layout can show.
Serving originals there cost ~45 MB of download and ~576 MB of decoded bitmaps
per swap, every 2 seconds -- which is exactly why the old hero felt stuck.

The *works* still ship the untouched originals: portfolio grid, lightbox and
every topic page read ``photo-data.js`` and are not touched by this script.
Only this decorative strip is downsized.

Every output is ~60-150 KB, far under Cloudflare's 25 MiB per-asset cap, and
adds 24 files to the upload set (limit is 20,000).

Usage
-----
    python scripts/build_hero_sets.py            # dry run: report only
    python scripts/build_hero_sets.py --write    # write webp files + hero-sets.js

Exit code is non-zero if anything is wrong, so a dry run doubles as a gate.
"""

import argparse
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('需要 Pillow：pip install Pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, 'scripts', 'hero_manifest.json')
OUTPUT_JS = os.path.join(ROOT, 'hero-sets.js')
SLOTS = 6  # the collage has exactly six tiles
MIB = 1048576


def load_manifest():
    with open(MANIFEST, encoding='utf-8') as handle:
        return json.load(handle)


def check(manifest):
    """Validate the manifest before touching anything. Returns (problems, entries)."""
    problems = []
    output = manifest.get('output', {})
    long_side = output.get('longSide', 960)
    quality = output.get('quality', 82)
    fmt = output.get('format', 'webp').lower()
    out_dir = output.get('dir', 'assets/hero')

    if fmt != 'webp':
        problems.append('output.format 只支持 webp，当前是 %r' % fmt)
    if not (1 <= quality <= 100):
        problems.append('output.quality 必须在 1-100 之间，当前是 %r' % quality)

    sets = manifest.get('sets') or []
    if not sets:
        problems.append('manifest 里没有任何组')

    entries = []
    seen_sources = {}
    for set_index, group in enumerate(sets, start=1):
        images = group.get('images') or []
        if len(images) != SLOTS:
            problems.append(
                '第 %d 组（%s）有 %d 张，必须是 %d 张'
                % (set_index, group.get('id', '?'), len(images), SLOTS)
            )

        for slot, source in enumerate(images, start=1):
            source_path = os.path.join(ROOT, source)
            if not os.path.isfile(source_path):
                problems.append('第 %d 组第 %d 张源片不存在：%s' % (set_index, slot, source))
                continue

            seen_sources.setdefault(source, []).append((set_index, slot))

            stem = '%s-%02d' % (group.get('id', 'set-%d' % set_index), slot)
            target = '%s/%s.%s' % (out_dir.rstrip('/'), stem, fmt)
            entries.append(
                {
                    'set_index': set_index,
                    'slot': slot,
                    'set_id': group.get('id', 'set-%d' % set_index),
                    'source': source,
                    'source_path': source_path,
                    'target': target,
                    'target_path': os.path.join(ROOT, target),
                    'source_size': os.path.getsize(source_path),
                }
            )

    # A source repeated across sets wastes a download; inside the same set it
    # would put the same picture in two tiles.
    for source, places in sorted(seen_sources.items()):
        if len(places) > 1:
            where = '、'.join('第%d组第%d张' % place for place in places)
            problems.append('同一张原片被用了多次（%s）：%s' % (where, source))

    return problems, entries, long_side, quality, out_dir


def render(entry, long_side, quality):
    """Downscale one original, preserving aspect ratio; the long side becomes long_side."""
    with Image.open(entry['source_path']) as image:
        image = image.convert('RGB')
        width, height = image.size
        scale = long_side / float(max(width, height))
        target_size = (max(1, round(width * scale)), max(1, round(height * scale)))

        # Shrinking benefits from a good filter; never upscale.
        resized = image.resize(target_size, Image.LANCZOS) if scale < 1 else image

        os.makedirs(os.path.dirname(entry['target_path']), exist_ok=True)
        resized.save(
            entry['target_path'],
            'WEBP',
            quality=quality,
            method=6,
            icc_profile=image.info.get('icc_profile'),
        )
        return target_size


def js_payload(manifest, entries):
    """Serialise the runtime config: only what the browser needs."""
    sets = []
    for group in manifest['sets']:
        sets.append({'id': group.get('id'), 'title': group.get('title', ''), 'images': []})

    for entry in entries:
        sets[entry['set_index'] - 1]['images'].append(
            {'src': entry['target'], 'alt': '', 'source': entry['source']}
        )

    lines = [
        '/*',
        ' * 首页拼贴的预制图组。由 scripts/build_hero_sets.py 从',
        ' * scripts/hero_manifest.json 生成，请勿手改。',
        ' *',
        ' * 每组 6 张，顺序对应 .collage 的六个格子（下标 0/2/4 在左列、1/3/5 在右列）。',
        ' * src 指向 assets/hero/ 下 960px 长边的小图，只给首页拼贴用；',
        ' * 作品集与灯箱读的是 photo-data.js 里的原片，两者互不影响。',
        ' *',
        ' * 重新生成：python scripts/build_hero_sets.py --write',
        ' */',
        'window.HERO_SETS = ' + json.dumps(sets, ensure_ascii=False, indent=2) + ';',
        '',
    ]
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='生成首页拼贴的预制图组')
    parser.add_argument('--write', action='store_true', help='真正写入图片与 hero-sets.js')
    args = parser.parse_args()

    if not os.path.isfile(MANIFEST):
        sys.exit('找不到清单文件：%s' % MANIFEST)

    manifest = load_manifest()
    problems, entries, long_side, quality, out_dir = check(manifest)

    print('清单：%s' % os.path.relpath(MANIFEST, ROOT))
    print('输出：%s/（长边 %d px，q%d webp）' % (out_dir, long_side, quality))

    if problems:
        print('\n清单有问题，先修掉再说：')
        for item in problems:
            print('  - %s' % item)
        return 1

    groups = len(manifest['sets'])
    print('共 %d 组 × %d 张 = %d 张\n' % (groups, SLOTS, len(entries)))

    if not args.write:
        total_in = sum(entry['source_size'] for entry in entries)
        print('%-10s %-4s %-42s %10s' % ('组', '格', '源片', '源片体积'))
        for entry in entries:
            print(
                '%-10s %-4d %-42s %9.2f MB'
                % (entry['set_id'], entry['slot'], os.path.basename(entry['source']),
                   entry['source_size'] / MIB)
            )
        print('\n源片合计 %.1f MB —— 如果拼贴直接用原片，这就是首屏与每次切换要下的量。' % (total_in / MIB))
        print('现在上线的是 --write 生成的 960px 小图，不是这些原片。')
        print('\n[dry run] 未写入。加 --write 生成小图与 hero-sets.js。')
        return 0

    # ---- write ----
    total_out = 0
    rendered = []
    for entry in entries:
        size = render(entry, long_side, quality)
        out_bytes = os.path.getsize(entry['target_path'])
        total_out += out_bytes
        rendered.append(
            (entry['set_id'], entry['slot'], os.path.basename(entry['source']),
             entry['source_size'], out_bytes, size)
        )

    with open(OUTPUT_JS, 'w', encoding='utf-8') as handle:
        handle.write(js_payload(manifest, entries))

    print('%-10s %-4s %-38s %9s %10s %8s %s'
          % ('组', '格', '源片', '源片', '小图', '压缩比', '尺寸'))

    worst = 0
    for set_id, slot, name, src_bytes, out_bytes, size in rendered:
        worst = max(worst, out_bytes)
        print(
            '%-10s %-4d %-38s %8.2fMB %9.0fKB %7.0f%% %dx%d'
            % (set_id, slot, name, src_bytes / MIB, out_bytes / 1024,
               out_bytes / src_bytes * 100, size[0], size[1])
        )

    total_in = sum(entry['source_size'] for entry in entries)
    print('\n源片合计 %.1f MB → 小图合计 %.2f MB（为原来的 %.1f%%）'
          % (total_in / MIB, total_out / MIB, total_out / total_in * 100))
    print('单张最大 %.0f KB，占 Cloudflare 25 MiB 单文件上限的 %.4f%%'
          % (worst / 1024, worst / (25 * MIB) * 100))
    print('新增 %d 个文件到上传集合（上限 20,000）' % len(entries))
    print('\n已写入 %s' % os.path.relpath(OUTPUT_JS, ROOT))

    if worst > 25 * MIB:
        print('\nFAIL 有文件超过 25 MiB，Cloudflare 会拒绝部署')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
