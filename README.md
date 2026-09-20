# 承瑀摄影 Thomas pics

个人摄影作品集网站。零构建的纯静态站点：原生 HTML / CSS / JavaScript，没有任何框架、打包器或运行时依赖，直接部署即可访问。

- **首页** `index.html` — 拼贴式 hero（4 组预制小图，左列风景右列城市，每 5 秒切换）、四个摄影专题入口、沉浸式作品集、西安生活地图入口与想法收集表单、拍摄套餐、预约联系方式
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
hero-sets.js                首页拼贴的预制图组（自动生成，勿手改）
scripts/build_photo_data.py 清单生成与校验脚本（不部署）
scripts/build_hero_sets.py  首页拼贴小图生成脚本（不部署）
scripts/build_webp_variants.py 从原图生成 WebP 派生图（仅本仓库用，不部署）
scripts/hero_manifest.json  首页拼贴的编组清单（手工维护，不部署）
netlify.toml                Netlify 部署与缓存头
.assetsignore               Cloudflare 上传排除规则
assets/
  opt/topics/<主题>/         四个摄影专题；线上是原图，本仓库是 WebP 派生图
  opt/projects/<项目>/       三个项目，可再分章节子目录；形态同上
  hero/set<N>-<M>.webp       首页拼贴专用的 960px 小图，24 张（需要部署）
  wechat-qr.png             微信预约二维码（已裁净白边，PNG 便于保存后再扫）
  *.svg                     Logo 与头像
```

## 本仓库与线上站点的区别

**访客访问的站点不来自这个仓库。** 线上是 `wrangler deploy --assets=.` 从部署目录（`cloudflare-deploy/`）直接上传的 Cloudflare Workers 静态资源，发布的正是 `assets/opt/` 下的**原图本身**。下文所有描述都以那个部署目录为准。

这个仓库（GitHub）不承担访客流量，它要解决的是另一个问题 —— git 处理不了 2.1 GB 已压缩的 JPEG：

- delta 编码在 JPEG 上没有任何收益，每次重新导出都存一份全量副本，`.git` 只增不减；
- 首次推送要搬约 2 GB，经常超时；
- 一旦某个 `.git` 资源超过 25 MiB，Workers 构建就会失败 —— 2026-09-17 那次报的 `Asset too large`，就是一个 82.6 MiB 的 packfile。

所以两边形态不同，但内容一一对应：

| | 部署目录（线上，访客看到的） | 本仓库（GitHub） |
|---|---|---|
| `assets/opt/` 内容 | 346 张原图 JPEG | 692 个 WebP 派生图 |
| 单张最大 | 22.97 MiB | 0.93 MB |
| 图片总体积 | 2.1 GB | **87.9 MB** |

派生图的规格与前端取值对齐，所以单独 checkout 这个仓库也能完整跑起来：

| 名字 | 长边 | 质量 | 前端用途 |
|---|---|---|---|
| `thumb` | 800 px | 74 | 网格、专题卡片 |
| `large` | 1600 px | 78 | 灯箱 / 全屏 |

> 本仓库 `photo-data.js` 里 `thumb` / `large` 指向上面的派生图；`master` 仍记录原图路径，但那份原图**不在仓库里**（由部署目录持有）。前端只读 `thumb` / `large`，`xian-map.js` 顶部注释也写明了 `master` 会被跳过 —— 所以原图缺失不影响任何页面。

重新生成（源目录默认为同级的部署目录，可用 `--source` 指定别处）：

```bash
python scripts/build_webp_variants.py            # 干跑：缺哪些、要重绑几条
python scripts/build_webp_variants.py --write    # 生成派生图并重写 photo-data.js
```

---

## 图片策略：作品集用原图，只有首页拼贴用专用小图

作品集部分发布的就是修图软件导出的原图本身 —— **不降采样、不重新编码、不生成派生图**。按客户要求，一个字节都不改。**唯一的例外是首页那 6 格拼贴**，原因见下一节。

### 首页拼贴为什么必须用小图

拼贴每格最多显示 **456×257 CSS px**（栅格宽 930px、两栏、16:9），而原片是 6000×4000 —— **像素多出约 51 倍**。用原片做轮播的实际代价：

| | 用原片（旧实现） | 用 960px 小图（现在） |
|---|---|---|
| 单次切换下载量 | 约 **45 MB** | 首次之后 **0** |
| 解码位图（单张 24 MP ≈ 96 MB） | 每 2 秒约 **576 MB** | 每张约 2 MB |
| 24 格素材总量 | 141.8 MB | **2.26 MB** |
| 轮播池 | 全部 56 张自然风光（419 MB） | 固定 4 组 × 6 张 |

这是首页「非常卡」的根源：不是动画写得不好，是拿 24 MP 的图去填 456px 的格子。

现在 `hero-sets.js` 里是 4 组预制图，每 5 秒按顺序切换一次，切换前先把整组解码完再换图（所以不会闪），首屏之后趁空闲预热其余三组。拼贴滚出视口会自动停止换图。

**小图只服务首页拼贴。** 作品集网格、灯箱大图、专题页读的都是 `photo-data.js` 里的原片，一张都没换。

### 唯一的硬约束

托管商对**单个文件**有 25 MiB 上限，对**站点总量没有限制**。Cloudflare 具体限两件事：

| 限制 | 值 |
|---|---|
| 单个文件大小 | 25 MiB |
| 文件数（免费 / 付费） | 20,000 / 100,000 |

当前 346 张全部在限额内，最大 **22.97 MiB**（`DSC00265.jpg`，占限额 92%）。

### 被撤下的一张

`DSC07780.jpg`（同名同图在 `城市脉动` 与 `自然风光` 下各一份）是 **6000×4000、31.77 MiB**，超出上限 6.77 MiB —— 只要它在部署目录里，构建必定失败（曾因此报 `Asset too large`）。处理方式：从网站撤下。

原图不在仓库里，但完整保存在本地，任何一份都能拿回来：

```
F:\codex项目\摄影网站\topics\城市脉动\DSC07780.jpg      （源图）
<工作区>\_work\excluded\DSC07780.jpg                   （部署包撤下的那份）
```

若要让这张重新上线，只有三条路：重编码到 25 MiB 以内（分辨率可保持 6000×4000，q95 约 18.4 MiB）、放到对象存储（R2 / 图床）后由页面引用外部地址、或换一张替代。**不能原样放回部署目录。**

> **新增照片前先看单文件大小。** 超过 25 MiB 的图放进去，部署会直接失败；`scripts/build_photo_data.py` 会在生成清单时把超限文件列出来。

## 数据层

`photo-data.js` 暴露一个全局对象 `window.PHOTO_LIBRARY`，是全站唯一的数据源：

- `topics` — 按题材分的四组：自然风光 / 城市脉动 / 人像纪实 / 会议集会
- `projects` — 三个沉浸式项目：与相机的冒险之旅 / 城墙下的秦人 / 大美秦岭

每张照片记录宽高、长宽比、拍摄时间与完整 EXIF（机身、光圈、快门、ISO、焦段），以及三个图片字段：

| 字段 | 用途 |
|---|---|
| `thumb` | 网格、专题卡片 |
| `large` | 灯箱 / 全屏 |
| `master` | 原图路径 |

**在部署目录里，三个字段指向同一个原图文件。** 保留三个名字是为了不动前端渲染逻辑（网格读 `thumb`、灯箱读 `large`）。`master` 曾经的含义是「母版来源记录、不是可用地址」，那是派生图时代的事；现在它就是真实可用的图片地址。本仓库另有一套形态：`thumb` / `large` 指向 WebP 派生图，`master` 退回纯来源记录 —— 见上文「本仓库与线上站点的区别」。

> 首页拼贴**不读这个文件**。它读 `hero-sets.js` 里的 `window.HERO_SETS`（4 组 × 6 张 960px 小图），因为那个位置不需要原图分辨率 —— 详见上文「首页拼贴为什么必须用小图」。

项目的 `cover` 是封面图 URL，`coverId` 是用于定位封面照片的 id；前端按 id 匹配，不要按路径匹配。

**这个文件由脚本生成，不要手工编辑。**

## 清单生成

> 本节针对**部署目录**（原图形态）。在本仓库里跑同一个脚本会把 `thumb` / `large` 绑回不存在的原图路径 —— 仓库请用 `scripts/build_webp_variants.py`，见上文「本仓库与线上站点的区别」。

照片文件在 `assets/opt/` 里一旦被改名、换目录或新增，`photo-data.js` 里的路径就会失效，全站图片静默 404（页面不会报错，只是一片空白）。脚本负责重新绑定。

```bash
python scripts/build_photo_data.py             # 干跑：只报告，退出码非 0 表示有问题
python scripts/build_photo_data.py --write     # 写入 photo-data.js
```

它会核对：

- 每条记录能否唯一解析到磁盘上的文件（按 `filename` + 相册/章节作用域匹配，同名文件分属不同相册是正常的）
- 有没有引用了不存在的文件（不落地）
- 有没有文件没有任何条目引用（孤立文件）
- 有没有单个文件超过 25 MiB（超了部署会失败）

**加图 / 删图 / 改名后，先干跑，再 `--write`。** 干跑通过（退出码 0）才说明可以部署。

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

## 部署

发布目录就是这个目录的内容，所以**这里任何文件都会成为线上资源**。

### Cloudflare

**方式一：本地上传（推荐）**

```bash
npx wrangler deploy --assets=<本地路径> --name=<项目名>    # Workers
npx wrangler pages deploy <本地路径> --project-name=<项目名>  # Pages
```

用 `--dry-run` 可以不开账号先验证一遍：把所有文件读进来并逐个检查 25 MiB 上限，不做任何上传。

**方式二：Git 集成**

推仓库后由 Cloudflare 构建。两个前提：

1. **`.assetsignore` 必须排除 `**/.git`。** Workers Static Assets **不会**像 Pages 那样自动跳过 `.git`；仓库根一旦被当作 assets 目录，`.git` 里的 packfile（和仓库一样大，曾达 82.6 MiB）会被当静态资源上传，构建死在 `Asset too large`。另外 wrangler 读 `.assetsignore`、**不读 `.gitignore`** —— 被 gitignore 不等于不会上传。
2. **不要点「重试部署」。** 重试会沿用原构建的提交，`.assetsignore` 再对也没用。改动后推一个新提交，或用「创建新部署」触发。

报错里那个 `pack-<hash>.pack` 的文件名是内容哈希，可以反查构建机检出的是哪个提交 —— 本地用**相同方式**（`clone --depth 1` 与 `fetch --depth 1` 得到的 pack 名不同）拉对应提交即可比对。

### Netlify

`netlify.toml` 已配置发布目录与缓存策略：

- `/assets/opt/*` 一年强缓存（原片只会换名字重新导出，不会原地覆盖，所以可以 immutable）
- `/assets/hero/*` **只缓存一周**。小图文件名固定是 `set<N>-<M>.webp`，重新编组会原地覆盖同名文件 —— 用一年 immutable 会把旧图钉死在访客缓存里
- HTML 不缓存，改动即时生效

### 部署前自查

```bash
python scripts/build_photo_data.py   # 干跑，确认 346 条全部落地、无超限引用
python scripts/build_hero_sets.py    # 干跑，确认首页 4 组 × 6 张编组完好
```

首页的想法收集表单走 Netlify Forms（`data-netlify="true"`，表单名 `city-map-ideas`）。这一项**只在 Netlify 上有效**，Cloudflare 不会处理这个表单，部署到 Cloudflare 时提交按钮不会有后端接收。

## 一些约定

- **不要用 `master` 字段拼路径之外的东西。** 它现在和 `thumb`/`large` 是同一个文件，改路径只改 `photo-data.js`（由脚本生成），不要在页面里手写图片地址。
- **首页拼贴不要改回原片轮播。** 那个位置每格只显示 456px，用 24 MP 原片等于每 2 秒下 45 MB、解码 576 MB。`hero-sets.js` 与 `assets/hero/` 由 `scripts/build_hero_sets.py` 生成，换图请改 `scripts/hero_manifest.json` 再重新生成。
- **`hero-sets.js` 与 `photo-data.js` 都是生成产物**，手改必漏且漏了不报错（页面只会一片空白或退回旧图）。
- **超过 25 MiB 的图不要放进部署目录。** 会让整个构建失败，而不是只跳过那一张。
- **不要把 `scripts/` 手工塞进部署产物。** 它是开发和校验用的，已在 `.assetsignore` 里排除。
- **「正在探索的项目」区块只承载城市生活地图**（`index.html` 的 `.map-section`）：左侧地图说明与入口卡片，右侧想法收集表单，两栏布局。三个沉浸式项目（`与相机的冒险之旅` / `城墙下的秦人` / `大美秦岭`）**不在这个区块出现**，它们只作为「沉浸式作品集」的筛选与图集内容（`#work` 区块 + `portfolio.html`）。曾经此处会用 `renderProjects()` 渲染三张项目卡片，已移除——不要在 `.map-section` 里重新加回项目列表。
- **西安生活地图不使用任何在线地图服务。** 底图是 `xian-map.js` 里手绘的 SVG 示意图，只表达点位的相对方位与路线顺序，不含坐标数据，页面上也标注了「不按测绘比例」。这样做既避免了在纯静态站的前端暴露地图密钥，也不需要引入第三方地图 SDK。如需真实导航，请用合规的地图服务（腾讯地图 / 高德 / 百度 / 天地图）自行查询点位名称。
- **照片评分只记录访客自己的分数**，存在浏览器 `localStorage`，不展示任何聚合均分。不要往这里加伪造的「多少人评价」数字。
- **图片保存防护由 `image-guard.js` + `styles.css` 的三处规则组成，改动时要一起看**：① `image-guard.js` 在捕获阶段拦 `contextmenu` / `dragstart` / `selectstart`，只命中 `img` 与三个看图容器，页面其它地方的右键（复制邮箱、新标签打开链接）必须保持可用；② `styles.css` 基础 `img` 规则里的 `-webkit-user-drag` / `-webkit-touch-callout`；③ 三个灯箱大图 `#lightboxImage` / `#portfolioLightboxImage` / `#mapLightboxImage` 的 `pointer-events: none`。**第 ③ 条最容易误删**——它挡的是浏览器自己的右键/长按菜单，删掉后灯箱里就会出现「图片另存为」。关掉它不会影响缩放与平移，因为那些手势绑在父容器 `.portfolio-image-stage` / `figure` 上。
- **联系方式只在 `script.js` 顶部的 `CONTACT_EMAIL` / `CONTACT_WECHAT` 两个常量里维护**（联系区块由 `rebuildContactSection()` 注入，提交失败提示也读这两个常量）。改邮箱或微信号只改这一处；三个页面共用 `styles.css` 里的 `.contact-*` 样式。
- **表单提交必须区分成功与失败，不许无条件说「感谢」。** 提交入口是 `submitIdeaForm()`：只有 HTTP 2xx 才算成功（`showIdeaToast("ok")`），其余一律进失败态（`showIdeaToast("error")`），失败文案里必须带邮箱与微信。原因是这套页面同时发在 Netlify（表单有后端）和 Cloudflare（纯静态，`POST /` 会 405）上 —— 原实现无论结果如何都提示「感谢你的意见」，在 Cloudflare 上访客以为已送达、实际什么都没存下来，双方都不知道。失败态靠 `.idea-toast.is-error` 放开 `pointer-events`，否则访客连邮箱都选不中。
- **照片版权说明分两处，改动时要一起看**：页面页脚（`.footer-credit`，三页都有）和灯箱内的 `.lightbox-credit`（三页的灯箱都有）。新增使用照片的界面时也要带上这一行。
- 页面不依赖 `photo-data.js` 时必须优雅降级：缺少数据时显示提示文案，而不是退回示例项目或占位图。
- 仓库统一使用 **LF** 行尾。用 `core.autocrlf=true` 的 Windows 检出会得到 CRLF 工作区，`git add` 会归一化，这是正常的。

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

1. **Cloudflare 防盗链**（后台 → Scrape Shield → Hotlink Protection）—— 阻止第三方站点直接嵌入你的图片 URL。**这是唯一能从服务端生效的一条**，纯静态部署（`wrangler deploy --assets=.` 无自定义 Worker 脚本）配不了，必须去 Cloudflare 后台点开关。
2. **水印。** 加在导出阶段，跟着图走 —— 截图、转存、二次传播都带着来源。唯一能追究的手段。
3. **降分辨率预览。** 网格与灯箱用小图，别把 20 MB 的原片直接交出去。目前只有首页拼贴这么做了（`assets/hero/`），作品集与灯箱仍是原图直出。

第 1 条随时能在后台开启；第 2、3 条要改导出流程，需要的话再动。

## 性能基线（2026-09-20 实测）

用无头 Chrome + 本地静态服务逐页跑出来的数字。**改动前后拿这张表对同一页做对比**，不要凭感觉：

| 页面 | 整页真实下载 | 滚动 p95 帧间隔 | 掉帧（>50ms） | 长任务 | CLS |
|---|---|---|---|---|---|
| `index.html` | 53.7–56.8 MB | 16.8 ms | 3–4 / ~140 帧 | 0–2 次 | 0 |
| `portfolio.html` | **415.5 MB** | **100–217 ms** | 9–14 / ~150 帧 | 5–6 次，最长 394 ms | 0 |
| `xian-city-wall-map.html` | 53.6 MB | 16.8 ms | 1 / ~140 帧 | 0 次 | 0 |

三页都**没有**未捕获异常、坏图、空锚点、重复 id、横向溢出（桌面 1440×900 与移动 390×844 都没有）。

读数注意：无头环境是软件渲染，帧间隔**绝对值低于真机，只看相对差异**；单次运行有约 6% 噪声，
判断改善要看多项指标同方向变化，不要只盯一次数字。

### 卡的是作品集页，根源是解码 24 MP 原图

`portfolio.html` 一屏屏滑下来要下 **415 MB**：58 张原图，单张最大 22.97 MB、尺寸 6000×4000。
浏览器每张都得先解 24 MP、再缩到约 400px 的卡片里 —— 于是长任务最长 394 ms、滚动 p95 帧间隔 217 ms。

已做的缓解（不产生派生文件、不动原图一个字节）：

- `loading="lazy"` —— 原本就有。
- **`decoding="async"`** —— 补到四处网格渲染与三个灯箱大图，让解码离开主线程。
  实测 p95 帧间隔 **217 ms → 100 ms**，掉帧比例 **11% → 6%**。**是缓解，不是根治。**
- 卡片高度由 CSS `aspect-ratio` 决定，图片没加载时版面也不跳（CLS 恒为 0），所以不需要额外占位元素。

**根治只有一条路**：给网格加一层缩略图（长边约 960px），灯箱与作品详情仍读原图 ——
和首页拼贴现在用的是同一个方案（`assets/hero/`，24 张合计 2.26 MB）。要做需先让
`scripts/build_photo_data.py` 在 `photo-data.js` 里多出一个 `grid` 字段，再给网格渲染加上回退。

## 已知代价

**作品集**仍是原图直出：网格和灯箱拉取的是几 MB 到二十几 MB 的单张图片，图集页首次加载会明显偏慢，手机上尤其明显。这是「不压缩」的必然结果，不是 bug。如果哪天真要提速，不破坏原图的办法是加一层按需生成缩略图的图片服务（Cloudflare Images / 图片变换），页面用 `srcset` 引用 —— 原图仍在，只是网格换成了小图。

**首页拼贴**已经不在这个代价里：它用 `assets/hero/` 的 960px 小图，首屏只拉 2.26 MB 中的一组（约 0.6 MB），之后切换零请求。
