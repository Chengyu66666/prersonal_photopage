# 承瑀摄影 Thomas pics

个人摄影作品集网站。零构建的纯静态站点：原生 HTML / CSS / JavaScript，没有任何框架、打包器或运行时依赖。

- **首页** `index.html` — 拼贴式 hero（4 组预制小图，左列风景右列城市，每 5 秒切换）、四个摄影专题入口、沉浸式作品集、西安生活地图入口与想法收集表单、拍摄套餐、预约联系方式
- **作品浏览** `portfolio.html` — 专题 / 项目两种视图的瀑布流，灯箱支持全屏、局部放大与拖拽平移，访客可对单张照片打分
- **西安生活地图** `xian-city-wall-map.html` — 环城墙十个生活点位的拍摄窗口、光线特征、四条路线与城墙样张

## 目录结构

```
index.html                     首页
portfolio.html                 作品浏览
xian-city-wall-map.html        西安生活地图
styles.css                     全站样式（唯一样式表）
script.js                      首页交互
portfolio-page.js              作品浏览交互
xian-map.js                    西安生活地图交互（含手绘 SVG 示意图）
photo-data.js                  照片数据（自动生成，勿手改）
hero-sets.js                   首页拼贴的预制图组（自动生成，勿手改）
image-guard.js                 图片保存防护
_headers                       Cloudflare Pages 缓存头（需要发布）
scripts/build_site.sh          Cloudflare Pages 的构建步骤：把站点暂存到 dist/（不发布）
scripts/build_webp_variants.py 从原图生成 WebP 派生图（不发布）
scripts/build_photo_data.py    清单生成与校验脚本（不发布）
scripts/build_hero_sets.py     首页拼贴小图生成脚本（不发布）
scripts/hero_manifest.json     首页拼贴的编组清单（手工维护，不发布）
netlify.toml                   Netlify 备用部署的缓存头（不发布；Pages 不读它）
.assetsignore                  仅 wrangler / Workers 本地上传时生效（不发布）
assets/
  opt/topics/<主题>/           四个摄影专题，每张原图配 thumb + large 两个 WebP 派生图
  opt/projects/<项目>/         三个项目，可再分章节子目录，形态同上
  hero/set<N>-<M>.webp         首页拼贴专用的 960px 小图，24 张
  wechat-qr.png                微信预约二维码（已裁净白边，PNG 便于保存后再扫）
  *.svg                        Logo 与头像
```

## 部署架构：仓库就是发布产物

**Cloudflare Pages 从本仓库构建并发布，所以仓库里的字节，就是访客下载的字节。** 这是本项目唯一需要记住的架构事实，其余取舍都由它推出来。

```
GitHub 仓库 main ──push──▶ Cloudflare Pages 构建 ──▶ 全球边缘节点 ──▶ 访客
                          bash scripts/build_site.sh
                          （暂存到 dist/，约 200 MB）
```

构建设置（在 Cloudflare 后台填写）：

| 项 | 值 |
|---|---|
| 生产分支 | `main` |
| 构建命令 | `bash scripts/build_site.sh` |
| 构建输出目录 | `dist` |

`build_site.sh` 只把站点文件拷进 `dist/`，所以 `README.md`、`scripts/`、`netlify.toml`、`.gitignore` 都不会变成线上资源。**不设构建步骤、直接把输出目录指到仓库根也能跑**，代价是这些东西会一并公开。

### 为什么要有构建步骤

Pages 支持"输出目录 = 仓库根"，那样最省事但会把开发文件一起发布。多一个 10 行的脚本换来干净的公开面，只有在脚本本身出错时才有额外失败风险 —— 所以脚本对每个必需文件都做了存在性检查，缺一个就直接失败，不会静默发布半个站点。

### 原图为什么不入库

`assets/opt/` 下的原图是 346 张相机直出 JPEG，共 **2.1 GB**。它们不进版本库，有三个各自独立的理由：

- **推不动。** 实测本链路约 100 KB/s，88 MB 已经要推 14 分 40 秒；2 GB 要按小时算，中途断掉就得从头再来。
- **存不住。** JPEG 已经压缩过，git 的 delta 编码在它身上没有收益 —— 每次重新导出都会再存一份全量副本，`.git` 只增不减。
- **会打死构建。** 2026-09-17 那次 Cloudflare Workers 部署失败，报的是 `Asset too large`，罪魁是一个 82.6 MiB 的 `.git` packfile。单文件上限是 25 MiB，原图进历史就会把 packfile 永久顶到 GB 级。

所以仓库里存的是派生图，原图保存在本地部署目录（`cloudflare-deploy/`）与原始素材盘，随时可取回。

## 图片策略：两档 WebP，仓库即线上

每张原图配两个 WebP 派生图，规格与前端取值一一对应：

| 名字 | 长边 | 质量 | 单张均值 | 单张最大 | 前端用途 |
|---|---|---|---|---|---|
| `thumb` | 800 px | 74 | 55 KB | 0.29 MB | 网格、专题卡片 |
| `large` | 2560 px | 82 | 532 KB | 2.44 MB | 灯箱 / 全屏 |

| | 数量 | 总体积 | 单张最大 |
|---|---|---|---|
| 原图（本地部署目录，不入库） | 346 | 2.1 GB | 22.97 MiB |
| 派生图（仓库，即线上） | 692 | **198.5 MB** | **2.44 MB** |
| 构建产物 `dist/` | 730 | 203 MB | 2.44 MB |

`large` 取 2560 px 是核算过的，不是折中：

- 2560 px 在 1:1 下覆盖 2560 宽的视口，笔记本 / 平板 / 手机满屏都在这个范围内 —— 这是摄影站该给到的一档。
- 六张跨专题与原片的抽样实测：原图平均 6–7 MB，2560 px q82 平均约 590 KB，**屏幕上分辨不出差别**。
- 原图是 6000×4000（24 MP）。没有哪块屏幕能显示 24 MP，把它们原样发出去，只是让访客等 6 MB 换一个看不见的差别。

两个尺寸都**不做放大**：源图比目标窄时按自己的宽度重编码。EXIF 有意丢弃 —— 可读的拍摄参数已经存在 `photo-data.js` 里，留着二进制块只会让文件更大并泄露拍摄地点。

重新生成（源目录默认为同级的部署目录，可用 `--source` 指定别处）：

```bash
python scripts/build_webp_variants.py --report     # 干跑：哪些要重建、要重绑几条
python scripts/build_webp_variants.py --write      # 生成派生图并重写 photo-data.js
python scripts/build_webp_variants.py --write --force   # 忽略缓存，全部重编码
```

> 派生图是否"够新"由**分辨率**判定，不只看时间戳 —— 否则改了长边或质量会被静默跳过，旧规格一直留着。改 `VARIANTS` 就足以触发重编码。

### 首页拼贴为什么单独用 960px 小图

拼贴每格最多显示 **456×257 CSS px**（栅格宽 930px、两栏、16:9），而原片是 6000×4000 —— **像素多出约 51 倍**。用原片做轮播的实际代价：

| | 用原片（旧实现） | 用 960px 小图（现在） |
|---|---|---|
| 单次切换下载量 | 约 **45 MB** | 首次之后 **0** |
| 解码位图（单张 24 MP ≈ 96 MB） | 每 2 秒约 **576 MB** | 每张约 2 MB |
| 24 格素材总量 | 141.8 MB | **2.26 MB** |
| 轮播池 | 全部 56 张自然风光（419 MB） | 固定 4 组 × 6 张 |

这是首页「非常卡」的根源：不是动画写得不好，是拿 24 MP 的图去填 456px 的格子。

`hero-sets.js` 里是 4 组预制图，每 5 秒按顺序切换一次，切换前先把整组解码完再换图（所以不会闪），首屏之后趁空闲预热其余三组。拼贴滚出视口会自动停止换图。

> 首页拼贴**不读** `photo-data.js`，它读 `hero-sets.js` 里的 `window.HERO_SETS`。这个位置连 2560 px 都嫌大。

### 托管商的硬约束

Cloudflare（Pages 与 Workers 一致）限两件事：

| 限制 | 值 | 当前 |
|---|---|---|
| 单个文件大小 | 25 MiB | 最大 2.44 MB（占 10%） |
| 文件数 | 20,000 | 730 |

**这两条现在都够不着了。** 派生图最大 2.44 MB，离上限差一个数量级。以前那套「原图直出、必须逐张盯单文件大小」的紧张感，随着图片改成派生图入库而一起消失。

### 曾因 25 MiB 被撤下的一张

`DSC07780.jpg` 是 **6000×4000、31.77 MiB**，超出 25 MiB 上限 6.77 MiB —— 只要原图在发布产物里，构建必定失败（曾因此报 `Asset too large`），所以当时把它从网站上撤了下来。

**改用派生图入库后这个障碍不存在了**：它转成 `large` 会是几百 KB 的正常文件。原始素材还留着：

```
F:\codex项目\摄影网站\topics\城市脉动\DSC07780.jpg      （源图）
<工作区>\_work\excluded\DSC07780.jpg                   （部署包撤下的那份）
```

要让它重新上线：把原图放回部署目录，跑一次 `build_photo_data.py --write` 与 `build_webp_variants.py --write`，再跑一次 `build_hero_sets.py`（如果编组用到它）。**这一步需要单独确认**，因为它会改变作品集的照片数量。

## 数据层

`photo-data.js` 暴露一个全局对象 `window.PHOTO_LIBRARY`，是全站唯一的数据源：

- `topics` — 按题材分的四组：自然风光 / 城市脉动 / 人像纪实 / 会议集会
- `projects` — 三个沉浸式项目：与相机的冒险之旅 / 城墙下的秦人 / 大美秦岭

每张照片记录宽高、长宽比、拍摄时间与完整 EXIF（机身、光圈、快门、ISO、焦段），以及三个图片字段：

| 字段 | 用途 |
|---|---|
| `thumb` | 网格、专题卡片 |
| `large` | 灯箱 / 全屏 |
| `master` | 原图路径，**纯来源记录** |

**在本仓库里，`thumb` / `large` 指向派生图，而 `master` 指向的那个原图文件不存在** —— 原图不在版本库里。前端只读 `thumb` / `large`（`xian-map.js` 顶部注释也写明了 `master` 会被跳过），所以原图缺失不影响任何页面。`master` 的作用是让人能顺着它找回原始素材。

项目的 `cover` 是封面图 URL，`coverId` 是用于定位封面照片的 id；前端按 id 匹配，不要按路径匹配。

**这个文件由脚本生成，不要手工编辑。**

## 清单生成

`scripts/build_photo_data.py` 针对**部署目录**（原图形态）生成清单；本仓库的 `photo-data.js` 由 `scripts/build_webp_variants.py` 生成。两者不要混用：在本仓库里跑前者，会把 `thumb` / `large` 绑回不存在的原图路径，全站图片静默 404。

照片文件在 `assets/opt/` 里一旦被改名、换目录或新增，`photo-data.js` 里的路径就会失效（页面不会报错，只是一片空白）。脚本负责重新绑定。

```bash
python scripts/build_photo_data.py             # 干跑：只报告，退出码非 0 表示有问题
python scripts/build_photo_data.py --write     # 写入 photo-data.js
```

它会核对：

- 每条记录能否唯一解析到磁盘上的文件（按 `filename` + 相册/章节作用域匹配，同名文件分属不同相册是正常的）
- 有没有引用了不存在的文件（不落地）
- 有没有文件没有任何条目引用（孤立文件）
- 有没有单个文件超过 25 MiB

## 首页拼贴小图生成

首页拼贴的编组写在 `scripts/hero_manifest.json`（手工维护：哪几张、分几组、什么顺序），跑脚本生成小图与 `hero-sets.js`。

```bash
python scripts/build_hero_sets.py            # 干跑：校验编组并列出源片体积
python scripts/build_hero_sets.py --write    # 生成 assets/hero/*.webp 与 hero-sets.js
```

它会核对：

- 每组**必须 6 张**（首页有 6 个拼贴格，少一张就填不满）
- 源片路径必须真实存在
- 同一张原片不能重复使用（跨组重复浪费下载，组内重复会在两格放同一张图）
- 产出的单张体积是否在 25 MiB 以内

编组规则是**左列风景、右列城市**：`.collage` 是两列栅格 + 自动排布，数组下标 0/2/4 落左列、1/3/5 落右列，所以按 `[风景, 城市, 风景, 城市, 风景, 城市]` 排列就能得到稳定版式。**插满 6 张、保持奇偶交替，这个版式才成立。**

参数（长边像素、webp 质量）也在 `hero_manifest.json` 的 `output` 里。改完清单或参数都要重新 `--write`。

> `hero-sets.js` 是生成产物，**不要手改**。改编组改 `hero_manifest.json`。

## 本地预览

站点的图片路径是相对路径，但直接用 `file://` 打开会让表单提交失效，建议起一个本地静态服务：

```bash
python -m http.server 8899
# 打开 http://127.0.0.1:8899/
```

想预览"线上到底是哪一份"，先跑构建再看 `dist/` —— 那才是 Cloudflare 会发布的内容：

```bash
bash scripts/build_site.sh
python -m http.server 8899 --directory dist
```

## 部署

### Cloudflare Pages + Git 集成（当前方式）

**必须新建一个 Git 集成项目。** 关键的坑：**Direct Upload（后台拖拽 / `wrangler pages deploy` 直传）建出来的项目，事后无法转成 Git 集成项目** —— 只有建项目时选"连接到 Git"才有自动构建。所以旧的直传项目不要留恋，另建一个。

1. Cloudflare 后台 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. 授权 GitHub，选择仓库 `Chengyu66666/prersonal_photopage`
3. 构建设置按上文的表填：分支 `main`、构建命令 `bash scripts/build_site.sh`、输出目录 `dist`
4. Save and Deploy。之后每次 `git push` 到 `main` 都会自动重新构建发布

背景限制（免费额度）：构建 500 次/月、单次构建 20 分钟超时、单文件 25 MiB、站点 20,000 文件。

**推送到 GitHub 很慢。** 实测本链路约 100 KB/s，推 88 MB 用了 14 分 40 秒。加了新照片后如果要推几百 MB，建议拆成几个提交分次推 —— git 的推送不可续传，一次失败就得整包重来。另外在**你自己的终端**里推可能比在这个受限环境里快得多，值得试一次。

### wrangler 直传（已放弃）

`wrangler deploy --assets=.` 这条路走不通：2.1 GB 的上传在中途断掉，命令本身也没有续传能力。留在这里只是为了说明为什么换方案。若哪天要回到这条路，需要注意两点：

1. **`.assetsignore` 必须排除 `**/.git`。** Workers Static Assets **不会**像 Pages 那样自动跳过 `.git`；仓库根一旦被当作 assets 目录，`.git` 里的 packfile（曾达 82.6 MiB）会被当静态资源上传，构建死在 `Asset too large`。另外 wrangler 读 `.assetsignore`、**不读 `.gitignore`** —— 被 gitignore 不等于不会上传。
2. **不要点「重试部署」。** 重试会沿用原构建的提交，改了 `.assetsignore` 也没用。改动后推一个新提交，或用「创建新部署」触发。

### Netlify（备用）

`netlify.toml` 已配置发布目录与缓存策略。注意 Netlify 只读它自己的 `netlify.toml`，**不读 `_headers`**，所以两边的缓存规则要一起改，否则换平台后行为会变。

首页的想法收集表单走 Netlify Forms（`data-netlify="true"`，表单名 `city-map-ideas`）。**这一项只在 Netlify 上有效**；Cloudflare 是纯静态托管，`POST /` 会返回 405，表单没有后端接收 —— 页面已经会如实提示失败并给出邮箱与微信，不要让失败态重新变成"感谢提交"。

## 一些约定

- **本仓库的 `assets/opt/` 只放派生图，原图永不提交。** `.gitignore` 里那四条 `*.jpg` 规则是刻意留的，删掉就会把 2.1 GB 塞进历史，推送和构建会一起坏掉。
- **任何"仓库里的文件就是线上文件"的判断都成立。** 加文件前想一下它该不该被公开（`README.md`、`scripts/` 之所以不公开，是因为 `build_site.sh` 没拷它们；在 `dist/` 之外新建站点文件不会自动上线 —— 新页面记得加进 `ROOT_FILES`）。
- **不要用 `master` 字段拼路径。** 它指向的原图不在仓库里，前端只用 `thumb` / `large`。改路径只改 `photo-data.js`（由脚本生成），不要在页面里手写图片地址。
- **首页拼贴不要改回原片轮播。** 那个位置每格只显示 456px，用 24 MP 原片等于每 2 秒下 45 MB、解码 576 MB。`hero-sets.js` 与 `assets/hero/` 由 `scripts/build_hero_sets.py` 生成，换图请改 `scripts/hero_manifest.json` 再重新生成。
- **`hero-sets.js` 与 `photo-data.js` 都是生成产物**，手改必漏且漏了不报错（页面只会一片空白或退回旧图）。
- **改图片规格要连着改缓存策略。** 派生图按角色命名（`-thumb` / `-large`），重新编码会原地覆盖同名文件；`_headers` 里 `/assets/opt/*` 因此只给 30 天、不加 `immutable`。要让新图立刻生效，就得在同一个提交里改文件名（见 `build_webp_variants.py` 的 `VARIANTS` 注释）。
- **「正在探索的项目」区块只承载城市生活地图**（`index.html` 的 `.map-section`）：左侧地图说明与入口卡片，右侧想法收集表单，两栏布局。三个沉浸式项目（`与相机的冒险之旅` / `城墙下的秦人` / `大美秦岭`）**不在这个区块出现**，它们只作为「沉浸式作品集」的筛选与图集内容（`#work` 区块 + `portfolio.html`）。曾经此处会用 `renderProjects()` 渲染三张项目卡片，已移除——不要在 `.map-section` 里重新加回项目列表。
- **西安生活地图不使用任何在线地图服务。** 底图是 `xian-map.js` 里手绘的 SVG 示意图，只表达点位的相对方位与路线顺序，不含坐标数据，页面上也标注了「不按测绘比例」。这样做既避免了在纯静态站的前端暴露地图密钥，也不需要引入第三方地图 SDK。如需真实导航，请用合规的地图服务（腾讯地图 / 高德 / 百度 / 天地图）自行查询点位名称。
- **照片评分只记录访客自己的分数**，存在浏览器 `localStorage`，不展示任何聚合均分。不要往这里加伪造的「多少人评价」数字。
- **图片保存防护由 `image-guard.js` + `styles.css` 的三处规则组成，改动时要一起看**：① `image-guard.js` 在捕获阶段拦 `contextmenu` / `dragstart` / `selectstart`，只命中 `img` 与三个看图容器，页面其它地方的右键（复制邮箱、新标签打开链接）必须保持可用；② `styles.css` 基础 `img` 规则里的 `-webkit-user-drag` / `-webkit-touch-callout`；③ 三个灯箱大图 `#lightboxImage` / `#portfolioLightboxImage` / `#mapLightboxImage` 的 `pointer-events: none`。**第 ③ 条最容易误删**——它挡的是浏览器自己的右键/长按菜单，删掉后灯箱里就会出现「图片另存为」。关掉它不会影响缩放与平移，因为那些手势绑在父容器 `.portfolio-image-stage` / `figure` 上。
- **联系方式只在 `script.js` 顶部的 `CONTACT_EMAIL` / `CONTACT_WECHAT` 两个常量里维护**（联系区块由 `rebuildContactSection()` 注入，提交失败提示也读这两个常量）。改邮箱或微信号只改这一处；三个页面共用 `styles.css` 里的 `.contact-*` 样式。
- **表单提交必须区分成功与失败，不许无条件说「感谢」。** 提交入口是 `submitIdeaForm()`：只有 HTTP 2xx 才算成功（`showIdeaToast("ok")`），其余一律进失败态（`showIdeaToast("error")`），失败文案里必须带邮箱与微信。原因是这套页面曾在 Netlify（表单有后端）与 Cloudflare（纯静态，`POST /` 会 405）两边部署 —— 原实现无论结果如何都提示「感谢你的意见」，在 Cloudflare 上访客以为已送达、实际什么都没存下来，双方都不知道。失败态靠 `.idea-toast.is-error` 放开 `pointer-events`，否则访客连邮箱都选不中。
- **照片版权说明分两处，改动时要一起看**：页面页脚（`.footer-credit`，三页都有）和灯箱内的 `.lightbox-credit`（三页的灯箱都有）。新增使用照片的界面时也要带上这一行。
- 页面不依赖 `photo-data.js` 时必须优雅降级：缺少数据时显示提示文案，而不是退回示例项目或占位图。
- 仓库统一使用 **LF** 行尾（`.gitattributes` 固定了 `*.sh` / `*.py` / `*.cjs`）。用 `core.autocrlf=true` 的 Windows 检出会得到 CRLF 工作区，`git add` 会归一化，这是正常的。

## 图片保存防护，以及它的边界

先分清两件事：**「让顺手存图失效」能做，「阻止下载」做不到。** 下面的表格是前者，后面的说明是后者。

### 已经做了的（四层，逐层提高门槛）

| 层 | 位置 | 挡住什么 |
|---|---|---|
| 右键菜单 | `image-guard.js` 捕获阶段拦 `contextmenu` | 只在 `img` 与三个看图容器内生效；页面其它地方的右键（复制邮箱、新标签打开链接）照常可用 |
| 拖拽另存 | `image-guard.js` 拦 `dragstart`，并给每个 `img` 打 `draggable="false"` | 图片拖到桌面、拖进新标签页。含 JS 动态渲染的图 —— 首页图集由 `renderGallery()` 用 `innerHTML` 生成，靠 `MutationObserver` 覆盖 |
| 移动端长按 | `styles.css` 基础 `img` 规则的 `-webkit-touch-callout: none` | iOS Safari 长按弹出的「存储图像」菜单 |
| 灯箱大图 | `styles.css` 里 `#lightboxImage` / `#portfolioLightboxImage` / `#mapLightboxImage` 的 `pointer-events: none` | 浏览器自己的右键 / 长按菜单**根本拿不到图片对象**，菜单里不会出现存图项。缩放、平移、全屏、翻页绑在父容器 `.portfolio-image-stage` / `figure` 上，不受影响 |

**验证时的一个坑：** `-webkit-touch-callout` 是 WebKit 专有属性，**Chrome / Blink 会直接丢弃这个声明**（`CSS.supports('-webkit-touch-callout','none')` 返回 `false`，CSSOM 里也查不到）。所以别在 Chrome 里断言它「没生效」——它只在 iOS Safari 上可验证，交付侧只能确认文件里写了。

### 做不到的（必须知道）

**图片是通过公开 URL 下发的，任何人知道地址就能下载。** 打开开发者工具，Network 面板里任何一张图都能另存；访客禁用 JavaScript 后 `image-guard.js` 整个失效。网页端不存在「绝对不能另存」的实现 —— 任何声称做到的产品都是假象。上面四层的作用是挡住 99% 的顺手操作，不是安全边界。

**真正的防线在别处，按有效性排序：**

1. **Cloudflare 防盗链**（后台 → Scrape Shield → Hotlink Protection）—— 阻止第三方站点直接嵌入你的图片 URL。**这是唯一能从服务端生效的一条**。Pages 是纯静态托管，这件事必须去 Cloudflare 后台点开关，前端配不出来。
2. **水印。** 加在导出阶段，跟着图走 —— 截图、转存、二次传播都带着来源。唯一能追究的手段。
3. **控制分辨率。** 别把 24 MP 原始文件直接交出去 —— 现在全站已经是这样：仓库与线上都是 800 px / 2560 px 两档派生图，原图不经过浏览器。这条以前只对首页拼贴成立，改架构之后对全站成立。

第 1 条随时能在后台开启；第 2 条要改导出流程，需要的话再动。

## 性能基线（2026-09-21 实测）

用无头 Chrome + 本地静态服务逐页跑出来的数字，**同一版探针分别跑"原图版部署目录"与"派生图版构建产物"**，所以两组数字可以直接对比：

| 页面 | 整页真实下载 | 滚动 p95 帧间隔 | 掉帧（>50ms） | 长任务 |
|---|---|---|---|---|
| `index.html` | 41.93 → **3.10 MB** | 83.3 → **16.7 ms** | 7/135 → **0/153** | 1 次 67ms → 1 次 102ms |
| `portfolio.html` | 417.54 → **4.06 MB** | 50.0 → **16.7 ms** | 8/161 → **0/140** | 2 次，最长 227ms → **0 次** |
| `xian-city-wall-map.html` | 53.60 → **0.75 MB** | 16.7 → 16.8 ms | 1/151 → **0/146** | 0 → 0 |

三页都**没有**未捕获异常、坏图、空锚点、重复 id、横向溢出（桌面 1440×900 与移动 390×844 都没有）。

读数注意：无头环境是软件渲染，帧间隔**绝对值低于真机，只看相对差异**；单次运行有约 6% 噪声，判断改善要看多项指标同方向变化。首页那项「长任务 67ms → 102ms」单次变差，属于噪声范畴，而 p95 帧间隔从 83ms 降到 17ms、掉帧从 7 个降到 0 个，方向一致且幅度大。

### 这一版最大的变化：作品集页从"卡得明显"变成"不卡"

改动前 `portfolio.html` 一屏屏滑下来要下 **417 MB**：58 张原图，单张最大 22.97 MB、尺寸 6000×4000。浏览器每张都得先解 24 MP、再缩到约 400px 的卡片里 —— 于是长任务最长 227 ms、滚动 p95 帧间隔 50 ms、8 个掉帧。

改成派生图之后，同一页只下 **4.06 MB**，长任务 **0 次**、掉帧 **0 个**。**收益来自图片尺寸本身，不是靠前端技巧** —— 之前给四处网格与三个灯箱加的 `decoding="async"` 只是缓解，现在它连"需要缓解"的前提都没了。

### 一个待查的既有问题：作品集页 CLS 0.5057

`portfolio.html` 的累积布局偏移是 **0.5057**，而 `index.html` 与 `xian-city-wall-map.html` 都是 0。

**这一条与本次改动无关** —— 同一版探针跑原图版部署目录，作品集页同样是 0.5057，两次读数完全一致。也不是图片加载引起的：网格卡片用的是固定 `aspect-ratio`（`4/5`，`.wide` 用 `4/3`），高度不依赖图片是否加载完。

下一步要定位它，得把页面按步骤分段测（加载后 / 滚动后 / 切专题标签后 / 开灯箱后 / 打分后各测一次），最可能的来源是**切换专题标签时网格条目数变化导致的高度塌缩**，或**打分面板插入内容**。修复方向通常是切标签后把滚动位置带回网格顶部。

### 探针

`stability.cjs` 对三个页面各做一轮：全程采集（未捕获异常 / console error / 4xx-5xx / 长任务 / CLS）→ 滚完整页（触发懒加载与滚动显现，再回来查留白与坏图）→ 用 CDP 派发**真鼠标事件**点击交互（点之前做 hitTest，元素被遮挡或收不到指针事件会当场暴露）→ 移动端 390×844 查横向溢出。共 60 条断言。

```bash
node stability.cjs <站点目录>     # 例如 node stability.cjs dist
```

## 已知代价

**灯箱最大是 2560 px，不是 6000 px 原图。** 这是"仓库即线上"这个架构下唯一实质的取舍：想让访客拿到相机原始文件，就得让图片脱离 Git（放对象存储 / R2，页面引用外部地址），代价是仓库失去"clone 下来就能完整运行"的性质。当前选择是前者。

**推送很慢。** 本链路实测约 100 KB/s，图片每变动 100 MB 就要十几分钟。这是网络条件，不是仓库配置问题。

**首页拼贴与全站不再有性能差异。** 拼贴用 960px，网格用 800px，灯箱用 2560px —— 各档都按显示尺寸给，不存在"某处还在发原图"的角落。
