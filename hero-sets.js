/*
 * 首页拼贴的预制图组。由 scripts/build_hero_sets.py 从
 * scripts/hero_manifest.json 生成，请勿手改。
 *
 * 每组 6 张，顺序对应 .collage 的六个格子（下标 0/2/4 在左列、1/3/5 在右列）。
 * src 指向 assets/hero/ 下 960px 长边的小图，只给首页拼贴用；
 * 作品集与灯箱读的是 photo-data.js 里的原片，两者互不影响。
 *
 * 重新生成：python scripts/build_hero_sets.py --write
 */
window.HERO_SETS = [
  {
    "id": "set-1",
    "title": "山野与街巷",
    "images": [
      {
        "src": "assets/hero/set-1-01.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0295.jpg"
      },
      {
        "src": "assets/hero/set-1-02.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/_DSC1978.jpg"
      },
      {
        "src": "assets/hero/set-1-03.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0504.jpg"
      },
      {
        "src": "assets/hero/set-1-04.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/_DSC1984.jpg"
      },
      {
        "src": "assets/hero/set-1-05.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0927.jpg"
      },
      {
        "src": "assets/hero/set-1-06.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/_DSC2322.jpg"
      }
    ]
  },
  {
    "id": "set-2",
    "title": "水域与天际",
    "images": [
      {
        "src": "assets/hero/set-2-01.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0680.jpg"
      },
      {
        "src": "assets/hero/set-2-02.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/_DSC2325.jpg"
      },
      {
        "src": "assets/hero/set-2-03.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC6134.jpg"
      },
      {
        "src": "assets/hero/set-2-04.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC01245.jpg"
      },
      {
        "src": "assets/hero/set-2-05.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/DJI_0295-HDR.jpg"
      },
      {
        "src": "assets/hero/set-2-06.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC01816.jpg"
      }
    ]
  },
  {
    "id": "set-3",
    "title": "远行与俯瞰",
    "images": [
      {
        "src": "assets/hero/set-3-01.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0432.jpg"
      },
      {
        "src": "assets/hero/set-3-02.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DJI_0128.jpg"
      },
      {
        "src": "assets/hero/set-3-03.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC1969.jpg"
      },
      {
        "src": "assets/hero/set-3-04.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC04747.jpg"
      },
      {
        "src": "assets/hero/set-3-05.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC9343.jpg"
      },
      {
        "src": "assets/hero/set-3-06.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC05895.jpg"
      }
    ]
  },
  {
    "id": "set-4",
    "title": "光线与秩序",
    "images": [
      {
        "src": "assets/hero/set-4-01.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC0704.jpg"
      },
      {
        "src": "assets/hero/set-4-02.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC00226.jpg"
      },
      {
        "src": "assets/hero/set-4-03.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC2083.jpg"
      },
      {
        "src": "assets/hero/set-4-04.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC06814.jpg"
      },
      {
        "src": "assets/hero/set-4-05.webp",
        "alt": "",
        "source": "assets/opt/topics/自然风光/_DSC3911.jpg"
      },
      {
        "src": "assets/hero/set-4-06.webp",
        "alt": "",
        "source": "assets/opt/topics/城市脉动/DSC09444.jpg"
      }
    ]
  }
];
