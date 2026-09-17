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
.assetsignore               Cloudflare 上传排除规则
assets/
  opt/                      网页实际使用的 WebP 派生图（自动生成，需要部署）
  wechat-qr.png             微信预约二维码（已裁净白边，PNG 便于保存后再扫）
  *.svg                     Logo 与头像
  photos/                   相机原图（仅归档，见下节，不部署、不进 git）
```

## 相机母版不参与部署

`assets/photos/` 是修图软件导出的相机母版，单张 4–33 MiB。它们**既不在 git 里，也不在部署产物里**，原因很直接：

- 静态托管对单个文件有硬上限 —— Cloudflare 与 Netlify 都是 **25 MiB**，而 `city-056-DSC07780.jpg` 是 31.8 MiB，构建会直接失败；
- 站点根本不需要它们：每张照片的 `thumb` 与 `large` 都已在 `assets/opt/` 里，`master` 字段只作为「这张图原来来自哪个文件」的记录。

母版仍留在本地磁盘上，并且在 git 历史里可以完整找回：

```bash
git log --diff-filter=D -- assets/photos | head      # 找到移除它的那个提交
git checkout <sha>^ -- assets/photos                 # 把它恢复到工作区
```

> 如果你打算把母版作为异地备份，请在别处单独保存（网盘 / 移动硬盘 / 对象存储），不要再提交回这个仓库 —— 一提交就会让 Cloudflare 构建重新失败。


## 数据层

`photo-data.js` 暴露一个全局对象 `window.PHOTO_LIBRARY`，是全站唯一的数据源：

- `topics` — 按题材分的四组：自然风光 / 城市脉动 / 人像纪实 / 会议集会
- `projects` — 三个沉浸式项目：与相机的冒险之旅 / 城墙下的秦人 / 大美秦岭

每张照片记录宽高、长宽比、文件夹名、拍摄时间与完整 EXIF（机身、光圈、快门、ISO、焦段），以及三个图片字段：

| 字段 | 用途 |
|---|---|
| `master` | 母版路径，**只是来源记录，不是可用的图片地址**（母版不部署） |
| `thumb` | 宽 ≤800px 的 WebP，用于 hero、专题卡片与网格 |
| `large` | 宽 ≤1600px 的 WebP，用于灯箱 |

`thumb` 与 `large` 对每张照片**都必须存在**，页面只能使用这两个字段。字段名刻意从 `src` 改成了 `master`，就是为了让「误把它当成图片地址」这件事一眼看得出不对。

项目的 `cover` 字段是派生图 URL，`coverId` 是用于定位封面照片的 id；前端按 id 匹配，不要按路径匹配。

**这个文件由脚本生成，不要手工编辑。** 新增或删除照片后重新运行生成脚本即可，脚本会自动重算每组数量。

## 图片优化流程

页面直接加载母版会让首屏拉几十兆，而且母版超过托管商的单文件上限，所以有 `scripts/optimize_images.py`。它为每张母版生成两档 WebP：

- `thumb` 宽 ≤800px、q74 —— hero 拼贴、专题卡片、网格
- `large` 宽 ≤1600px、q78 —— 灯箱 / 全屏

**两档对每张图都无条件生成。** 早期版本会在母版已经够小时跳过派生图、让前端回退到原图，结果整个站点都依赖母版 —— 母版一旦不能部署，页面就会出现坏图。所以现在宁可对少数本来就小的图重新编码一次。生成过程不做放大：源图窄于目标宽度时，按自身尺寸重新编码。

生成过程会剥离 EXIF（含 GPS）：可读的拍摄参数已经存在 `photo-data.js` 里，保留二进制 EXIF 只会增大体积并泄露拍摄地点。

```bash
# 需要 Pillow
pip install pillow

python scripts/optimize_images.py             # 生成派生图并重写 photo-data.js
python scripts/optimize_images.py --verify     # 校验每一张都能被托管商正常服务
python scripts/optimize_images.py --report     # 只报告待处理项，不写文件
python scripts/optimize_images.py --data-only  # 只重写数据文件
python scripts/optimize_images.py --prune      # 顺带清理不再需要的派生图
```

派生图输出到 `assets/opt/`，目录结构与 `assets/photos/` 一致。脚本可重复执行：已经是最新的文件会跳过。

> 改名或新增母版后，先跑 `--verify` 再提交。它会检查：每张照片是否都有 `thumb` 和 `large`、引用的文件是否真的存在、有没有哪一张指向母版、有没有单文件超过 25 MiB。

## 本地预览

站点的图片路径是相对路径，但直接用 `file://` 打开会让表单提交失效，建议起一个本地静态服务：

```bash
python -m http.server 8899
# 打开 http://127.0.0.1:8899/
```

## 部署

发布目录就是仓库根目录，所以**仓库里任何文件都会成为线上资源** —— 这也是母版必须移出仓库的原因之一。

- **Cloudflare**：仓库根的 `.assetsignore` 会排除 `assets/photos` 与 `scripts`，即便母版哪天又被提交进去，也不会把构建搞失败。
- **Netlify**：`netlify.toml` 已配置发布目录与缓存策略 —— `/assets/opt/*`、`/assets/photos/*` 一年强缓存（派生图按文件名重新生成，不会就地改写），HTML 不缓存以便改动即时生效。

**部署前自查**（两个平台都是 25 MiB / 单文件的硬上限）：

```bash
python scripts/optimize_images.py --verify
```

它会报告部署图片的总数与最大单文件大小。当前基线：347 张照片 → 694 个 WebP，约 85 MB，最大单文件约 0.9 MiB。

首页的想法收集表单走 Netlify Forms（`data-netlify="true"`，表单名 `city-map-ideas`）。这一项**只在 Netlify 上有效**，Cloudflare 不会处理这个表单，部署到 Cloudflare 时提交按钮不会有后端接收。

## 一些约定

- **不要把相机母版提交回仓库。** 会被 `.gitignore` 拦下，而且会让 Cloudflare 构建因单文件超过 25 MiB 直接失败。
- **不要用 `master` 字段拼图片地址。** 它是归档记录，线上不存在这个文件；网格用 `thumb`，灯箱用 `large`。
- **西安生活地图不使用任何在线地图服务。** 底图是 `xian-map.js` 里手绘的 SVG 示意图，只表达点位的相对方位与路线顺序，不含坐标数据，页面上也标注了「不按测绘比例」。这样做既避免了在纯静态站的前端暴露地图密钥，也不需要引入第三方地图 SDK。如需真实导航，请用合规的地图服务（腾讯地图 / 高德 / 百度 / 天地图）自行查询点位名称。
- **照片评分只记录访客自己的分数**，存在浏览器 `localStorage`，不展示任何聚合均分。不要往这里加伪造的「多少人评价」数字。
- **联系方式只在 `script.js` 的 `rebuildContactSection()` 里维护**。首页的联系区块是脚本注入的，改微信二维码、邮箱、社交媒体账号都只改这一处；三个页面共用 `styles.css` 里的 `.contact-*` 样式。
- **照片版权说明分两处，改动时要一起看**：页面页脚（`.footer-credit`，三页都有）和灯箱内的 `.lightbox-credit`（三页的灯箱都有）。新增使用照片的界面时也要带上这一行。
- 页面不依赖 `photo-data.js` 时必须优雅降级：缺少数据时显示提示文案，而不是退回示例项目或占位图。
- 仓库统一使用 **LF** 行尾。用 `core.autocrlf=true` 的 Windows 检出会得到 CRLF 工作区，`git add` 会归一化，这是正常的。

