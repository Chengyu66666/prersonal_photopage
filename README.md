# 承瑀摄影 Thomas pics

个人摄影作品集网站。零构建的纯静态站点：原生 HTML / CSS / JavaScript，没有任何框架、打包器或运行时依赖，直接部署即可访问。

- **首页** `index.html` — 拼贴式 hero（自动换图）、四个摄影专题入口、沉浸式作品集、西安生活地图入口与想法收集表单、拍摄套餐、预约联系方式
- **作品浏览** `portfolio.html` — 专题 / 项目两种视图的瀑布流，灯箱支持全屏、局部放大与拖拽平移，访客可对单张照片打分
- **西安生活地图** `xian-city-wall-map.html` — 环城墙十个生活点位的拍摄窗口、光线特征、四条路线与城墙样张

## 目录结构

```
index.html                  首页
portfolio.html              作品浏览
xian-city-wall-map.html     西安生活地图
styles.css                  全站样式（唯一样式表）
script.js                   首页交互
portfolio-page.js           作品浏览交互
xian-map.js                 西安生活地图交互（含手绘 SVG 示意图）
photo-data.js               照片数据（自动生成，勿手改）
scripts/optimize_images.py  图片优化 + 数据生成脚本
netlify.toml                Netlify 部署与缓存头
assets/
  photos/                   相机原图（母版，保留归档）
  opt/                      网页用的 WebP 派生图（自动生成）
  wechat-qr.png             微信预约二维码（已裁净白边，PNG 便于保存后再扫）
  *.svg                     Logo 与头像
```

## 数据层

`photo-data.js` 暴露一个全局对象 `window.PHOTO_LIBRARY`，是全站唯一的数据源：

- `topics` — 按题材分的四组：自然风光 / 城市脉动 / 人像纪实 / 会议集会
- `projects` — 三个沉浸式项目：与相机的冒险之旅 / 城墙下的秦人 / 大美秦岭

每张照片记录宽高、长宽比、文件夹名、拍摄时间与完整 EXIF（机身、光圈、快门、ISO、焦段），以及三个图片字段：

| 字段 | 用途 |
|---|---|
| `src` | 相机原图，母版，页面不直接使用 |
| `thumb` | 宽 ≤800px 的 WebP，用于 hero、专题卡片与网格 |
| `large` | 宽 ≤1600px 的 WebP，用于灯箱 |

**这个文件由脚本生成，不要手工编辑。** 新增或删除照片后重新运行生成脚本即可，脚本会自动重算每组数量。

## 图片优化流程

仓库里的原图有两种来源：修图软件直接导出的相机母版（单张 4–33 MB），以及本身已经压过的小图（200–700 KB）。页面直接加载母版会导致首屏拉几十兆，因此有 `scripts/optimize_images.py`。

它会为每张原图按需生成两档 WebP，**只在确实比原图更小时才保留**：已经够小、够窄的原图不会生成派生图，前端自动回退到原图，图库不会因为处理过而变大。生成时顺带剥离 EXIF（含 GPS）——可读的拍摄参数已经存在 `photo-data.js` 里，保留二进制 EXIF 只会增大体积并泄露拍摄地点。

```bash
# 需要 Pillow
pip install pillow

python scripts/optimize_images.py            # 生成派生图并重写 photo-data.js
python scripts/optimize_images.py --report    # 只报告待处理项，不写文件
python scripts/optimize_images.py --data-only # 只重写数据文件
python scripts/optimize_images.py --prune     # 顺带清理不再需要的派生图
```

派生图输出到 `assets/opt/`，目录结构与 `assets/photos/` 一致。脚本可重复执行：已经是最新的文件会跳过。

> 当前状态：347 张原图（约 712 MB）生成 604 个派生文件、约 75 MB。约 20% 的照片没有 `large` 派生图，因为原图本身就已经足够小，前端会自动使用原图。

## 本地预览

站点的图片路径是相对路径，但直接用 `file://` 打开会让表单提交失效，建议起一个本地静态服务：

```bash
python -m http.server 8899
# 打开 http://127.0.0.1:8899/
```

## 部署

站点托管在 Netlify，`netlify.toml` 里已配置发布目录与缓存策略：`/assets/opt/*` 与 `/assets/photos/*` 一年强缓存（派生图按文件名重新生成，不会就地改写），HTML 不缓存以便改动即时生效。

首页的想法收集表单走 Netlify Forms（`data-netlify="true"`，表单名 `city-map-ideas`），只写静态文件不会生效，需要在 Netlify 后台能看到该表单提交。

## 一些约定

- **西安生活地图不使用任何在线地图服务。** 底图是 `xian-map.js` 里手绘的 SVG 示意图，只表达点位的相对方位与路线顺序，不含坐标数据，页面上也标注了「不按测绘比例」。这样做既避免了在纯静态站的前端暴露地图密钥，也不需要引入第三方地图 SDK。如需真实导航，请用合规的地图服务（腾讯地图 / 高德 / 百度 / 天地图）自行查询点位名称。
- **照片评分只记录访客自己的分数**，存在浏览器 `localStorage`，不展示任何聚合均分。不要往这里加伪造的「多少人评价」数字。
- **联系方式只在 `script.js` 的 `rebuildContactSection()` 里维护**。首页的联系区块是脚本注入的，改微信二维码、邮箱、社交媒体账号都只改这一处；三个页面共用 `styles.css` 里的 `.contact-*` 样式。
- **照片版权说明分两处，改动时要一起看**：页面页脚（`.footer-credit`，三页都有）和灯箱内的 `.lightbox-credit`（三页的灯箱都有）。新增使用照片的界面时也要带上这一行。
- 图片尺寸约定：网格与 hero 用 `thumb`，灯箱用 `large`。新增使用照片的地方请沿用一个规则，不要直接引用 `src`。
- 页面不依赖 `photo-data.js` 时必须优雅降级：缺少数据时显示提示文案，而不是退回示例项目或占位图。
