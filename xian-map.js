/**
 * 西安生活地图 — 城墙点位、光线时间与路线的交互层。
 *
 * 这里不接入任何在线地图服务：底图是本站手绘的 SVG 示意图，只表达点位的
 * 相对方位与路线顺序，不含坐标数据。需要真实导航时请使用合规的地图服务。
 */

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LIBRARY = window.PHOTO_LIBRARY || null;

  // 城墙轮廓与护城河（示意尺寸，非测绘比例）
  const WALL = { x: 150, y: 106, w: 380, h: 320, r: 10 };
  const MOAT = { x: 94, y: 56, w: 472, h: 420, r: 26 };

  /** 城门。major 为四座主城门，其余为沿城墙的小门。 */
  const GATES = [
    { name: "含光门", edge: "south", x: 175, y: 426 },
    { name: "勿幕门（小南门）", edge: "south", x: 213, y: 426 },
    { name: "朱雀门", edge: "south", x: 262, y: 426 },
    { name: "永宁门（南门）", edge: "south", x: 340, y: 426, major: true },
    { name: "文昌门", edge: "south", x: 393, y: 426 },
    { name: "和平门", edge: "south", x: 431, y: 426 },
    { name: "建国门", edge: "south", x: 469, y: 426 },
    { name: "长乐门（东门）", edge: "east", x: 530, y: 292, major: true },
    { name: "中山门", edge: "east", x: 530, y: 227 },
    { name: "朝阳门", edge: "east", x: 530, y: 168 },
    { name: "尚勤门", edge: "north", x: 503, y: 106 },
    { name: "尚俭门", edge: "north", x: 464, y: 106 },
    { name: "解放门", edge: "north", x: 420, y: 106 },
    { name: "尚德门", edge: "north", x: 379, y: 106 },
    { name: "安远门（北门）", edge: "north", x: 340, y: 106, major: true },
    { name: "尚武门", edge: "north", x: 281, y: 106 },
    { name: "玉祥门", edge: "west", x: 150, y: 186 },
    { name: "安定门（西门）", edge: "west", x: 150, y: 300, major: true },
  ];

  /** 生活点位。where 说明它在城墙的哪一侧，light/window 是拍摄光线条件。 */
  const POINTS = [
    {
      id: "huanhuang",
      name: "环城公园",
      sub: "护城河晨光",
      x: 118,
      y: 356,
      where: "城墙外侧，护城河沿线",
      light: "清晨低角度光，水面反光与薄雾",
      window: "06:30–08:30",
      subject: "护城河水面、晨练人群、城墙长线条",
      tip: "环城公园沿护城河外侧一周，清晨人少、光线斜，是拍城墙全貌最舒服的时段。",
      routes: ["dawn"],
    },
    {
      id: "xiaonanmen",
      name: "勿幕门",
      sub: "小南门早市",
      x: 213,
      y: 462,
      where: "城墙外侧，小南门外街巷",
      light: "侧逆光，蒸汽与人群的轮廓",
      window: "07:00–09:00",
      subject: "早点摊、蒸笼热气、街巷纵深",
      tip: "早市收得早，八点半后摊位陆续撤走。用长焦压缩街巷层次，尽量不打扰摊主。",
      routes: ["dawn"],
    },
    {
      id: "hanguang",
      name: "含光门",
      sub: "唐城墙遗址",
      x: 176,
      y: 394,
      where: "城墙内侧，含光门段",
      light: "上午侧光，适合表现夯土与砖石质感",
      window: "09:00–11:00",
      subject: "遗址断面、博物馆内部空间、街巷出口",
      tip: "含光门段保留唐代城墙遗址断面，适合建筑与人文结合的题材。",
      routes: ["dawn"],
    },
    {
      id: "changlemen",
      name: "长乐门",
      sub: "城东市井",
      x: 546,
      y: 292,
      where: "城墙外侧，东门一带",
      light: "上午顺光，城门立面细节完整",
      window: "08:00–10:30",
      subject: "城门与街市、通勤人流、城墙东段立面",
      tip: "东门外是城东市井最密集的一段，城门内外反差明显，适合拍通勤与生活节奏。",
      routes: ["market"],
    },
    {
      id: "shuyuanmen",
      name: "书院门",
      sub: "书法碑帖一条街",
      x: 415,
      y: 394,
      where: "城墙内侧，文昌门内向东",
      light: "散射光，阴天或上午都稳定",
      window: "09:00–12:00",
      subject: "笔砚纸墨、字画摊、老建筑门楼",
      tip: "店铺开门偏晚。拍摄前先和店主打招呼，多数人愿意配合。",
      routes: ["market"],
    },
    {
      id: "laocaichang",
      name: "建国门内老菜场",
      sub: "市井创意街区",
      x: 469,
      y: 394,
      where: "城墙内侧，建国门内",
      light: "下午侧光，建筑立面投影明显",
      window: "15:00–18:00",
      subject: "老建筑改造立面、市集摊位、年轻人群",
      tip: "老菜场改造街区旧建筑与新业态并存，适合拍城市更新题材。",
      routes: ["market"],
    },
    {
      id: "andingmen",
      name: "安定门",
      sub: "西段日落",
      x: 118,
      y: 250,
      where: "城墙外侧，西门与玉祥门之间",
      light: "日落顺光转侧逆光",
      window: "18:00–19:30",
      subject: "城墙西段立面、街边树木、行人剪影",
      tip: "西段光照更直接，人也比南门段少，适合安静地拍建筑与人。",
      routes: ["sunset"],
    },
    {
      id: "zhuque",
      name: "朱雀门",
      sub: "中轴车流",
      x: 262,
      y: 462,
      where: "城墙外侧，中轴线正对城门",
      light: "蓝调时刻，天光与路灯色温交界",
      window: "17:30–19:00",
      subject: "中轴线车流、城门洞视线、招牌灯箱",
      tip: "站在中轴上正对城门用慢门拉车流。蓝调只有二十分钟左右，提前架好机位。",
      routes: ["sunset"],
    },
    {
      id: "yongning",
      name: "永宁门",
      sub: "日落与入城仪式",
      x: 340,
      y: 462,
      where: "城墙外侧，南门广场与护城河",
      light: "傍晚顶光转侧光的最后一小时",
      window: "18:00–20:30（夏季顺延约一小时）",
      subject: "城楼剪影、护城河倒影、广场人流",
      tip: "先在护城河外侧拍全景，天黑后回到南门广场拍夜景。节假日夜间有入城仪式演出，需要提前占位。",
      routes: ["sunset", "night"],
    },
    {
      id: "shuncheng",
      name: "顺城巷",
      sub: "巷子夜色",
      x: 295,
      y: 394,
      where: "城墙内侧，沿城墙一周的巷子",
      light: "夜间灯光密集，整体偏暖调",
      window: "20:00–23:00",
      subject: "咖啡馆门头、行人步道、城墙墙面纹理",
      tip: "南门到文昌门一段最热闹。雨后地面反光会让画面层次更好。",
      routes: ["night"],
    },
  ];

  const ROUTES = [
    {
      id: "dawn",
      kicker: "06:30–11:00",
      name: "晨光线",
      duration: "约 4.5 小时",
      stops: ["huanhuang", "xiaonanmen", "hanguang"],
      note: "先拍护城河晨光，七点后进小南门早市，收工前到含光门遗址看城墙断面。",
      tone: "brass",
    },
    {
      id: "market",
      kicker: "08:00–18:00",
      name: "市井线",
      duration: "约 3.5 小时拍摄，含午间休整",
      stops: ["changlemen", "shuyuanmen", "laocaichang"],
      note: "从东门早市开始，上午进书院门拍字画摊，下午转场建国门内老菜场。",
      tone: "sage",
    },
    {
      id: "sunset",
      kicker: "18:00–20:30",
      name: "落日线",
      duration: "约 2.5 小时",
      stops: ["andingmen", "zhuque", "yongning"],
      note: "西段日落开场，蓝调时到朱雀门拍车流，最后在南门收夜景。",
      tone: "plum",
    },
    {
      id: "night",
      kicker: "20:00–23:00",
      name: "夜色线",
      duration: "约 3 小时",
      stops: ["shuncheng", "yongning"],
      note: "先钻顺城巷的灯光巷子，再回到南门广场拍城楼夜景与人流。",
      tone: "ink",
    },
  ];

  const POINT_BY_ID = Object.fromEntries(POINTS.map((point) => [point.id, point]));
  const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((route) => [route.id, route]));

  let activePointId = POINTS.find((point) => point.routes.includes("sunset")).id;
  let activeRouteId = null;

  const mapBase = document.querySelector("#mapBase");
  const mapGates = document.querySelector("#mapGates");
  const mapRoutes = document.querySelector("#mapRoutes");
  const mapPoints = document.querySelector("#mapPoints");
  const pointDetail = document.querySelector("#pointDetail");
  const pointList = document.querySelector("#pointList");
  const gateIndex = document.querySelector("#gateIndex");
  const routeGrid = document.querySelector("#routeGrid");
  const stripGrid = document.querySelector("#stripGrid");

  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function roundedRect({ x, y, w, h, r }) {
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${
      r
    } 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${
      x + r
    } ${y}Z`;
  }

  function renderBase() {
    mapBase.replaceChildren();

    // 护城河
    mapBase.appendChild(svg("path", { d: roundedRect(MOAT), class: "map-moat" }));

    // 城墙外圈阴影带，制造墙体厚度
    mapBase.appendChild(
      svg("path", {
        d: roundedRect(WALL),
        class: "map-wall-shadow",
        transform: "translate(0, 3)",
      })
    );

    // 城墙本体
    mapBase.appendChild(svg("path", { d: roundedRect(WALL), class: "map-wall" }));

    // 内侧细线，暗示墙内侧的顺城巷
    const inner = { x: WALL.x + 17, y: WALL.y + 17, w: WALL.w - 34, h: WALL.h - 34, r: 6 };
    mapBase.appendChild(svg("path", { d: roundedRect(inner), class: "map-inner-lane" }));

    const labels = [
      { text: "北", x: 340, y: 42 },
      { text: "南", x: 340, y: 526 },
      { text: "西", x: 52, y: 282 },
      { text: "东", x: 646, y: 282 },
    ];
    labels.forEach((item) => {
      mapBase.appendChild(
        svg("text", { x: item.x, y: item.y, class: "map-compass", "text-anchor": "middle" }, item.text)
      );
    });

    const corners = [
      { text: "西北角", x: WALL.x, y: WALL.y, anchor: "start", dx: 10, dy: -12 },
      { text: "东北角", x: WALL.x + WALL.w, y: WALL.y, anchor: "end", dx: -10, dy: -12 },
      { text: "东南角", x: WALL.x + WALL.w, y: WALL.y + WALL.h, anchor: "end", dx: -10, dy: 20 },
      { text: "西南角", x: WALL.x, y: WALL.y + WALL.h, anchor: "start", dx: 10, dy: 20 },
    ];
    corners.forEach((corner) => {
      mapBase.appendChild(
        svg(
          "text",
          {
            x: corner.x + corner.dx,
            y: corner.y + corner.dy,
            class: "map-corner",
            "text-anchor": corner.anchor,
          },
          corner.text
        )
      );
    });

    mapBase.appendChild(
      svg("text", { x: 340, y: 262, class: "map-inside-label", "text-anchor": "middle" }, "城内")
    );
  }

  function renderGates() {
    mapGates.replaceChildren();

    GATES.forEach((gate) => {
      const group = svg("g", { class: `map-gate map-gate-${gate.edge}` });
      group.appendChild(svg("title", {}, gate.name));

      const size = gate.major ? 11 : 6;
      group.appendChild(
        svg("rect", {
          x: gate.x - size / 2,
          y: gate.y - size / 2,
          width: size,
          height: size,
          class: gate.major ? "map-gate-mark is-major" : "map-gate-mark",
        })
      );

      if (!gate.major) {
        mapGates.appendChild(group);
        return;
      }

      // 主城门名放进城墙内侧，避免和外部点位重叠
      const label = gate.name.replace(/（.*）/, "");
      const anchors = {
        south: { x: gate.x, y: gate.y - 26, anchor: "middle" },
        north: { x: gate.x, y: gate.y + 34, anchor: "middle" },
        east: { x: gate.x - 26, y: gate.y + 4, anchor: "end" },
        west: { x: gate.x + 26, y: gate.y + 4, anchor: "start" },
      };
      const spot = anchors[gate.edge];
      group.appendChild(
        svg(
          "text",
          {
            x: spot.x,
            y: spot.y,
            class: "map-gate-label",
            "text-anchor": spot.anchor,
          },
          label
        )
      );

      mapGates.appendChild(group);
    });
  }

  function routeOrderFor(pointId) {
    if (!activeRouteId) return null;
    const index = ROUTE_BY_ID[activeRouteId].stops.indexOf(pointId);
    return index === -1 ? null : index + 1;
  }

  function renderPoints() {
    mapPoints.replaceChildren();

    POINTS.forEach((point) => {
      const order = routeOrderFor(point.id);
      const dimmed = activeRouteId && order === null;
      const classes = ["map-point"];
      if (point.id === activePointId) classes.push("is-active");
      if (dimmed) classes.push("is-dimmed");
      if (activeRouteId && order !== null) classes.push("is-on-route");

      const group = svg("g", {
        class: classes.join(" "),
        "data-point-id": point.id,
        role: "button",
        tabindex: "0",
        "aria-label": `${point.name} · ${point.sub}`,
      });
      group.appendChild(svg("title", {}, `${point.name} · ${point.sub}`));
      group.appendChild(svg("circle", { cx: point.x, cy: point.y, r: 14, class: "map-point-halo" }));
      group.appendChild(svg("circle", { cx: point.x, cy: point.y, r: 11, class: "map-point-dot" }));
      group.appendChild(
        svg(
          "text",
          { x: point.x, y: point.y + 4, class: "map-point-no", "text-anchor": "middle" },
          String(order ?? POINTS.indexOf(point) + 1)
        )
      );
      mapPoints.appendChild(group);
    });
  }

  function renderRoutesOnMap() {
    mapRoutes.replaceChildren();
    if (!activeRouteId) return;

    const route = ROUTE_BY_ID[activeRouteId];
    const coords = route.stops.map((id) => POINT_BY_ID[id]).filter(Boolean);
    if (coords.length < 2) return;

    const points = coords.map((point) => `${point.x},${point.y}`).join(" ");
    mapRoutes.appendChild(
      svg("polyline", { points, class: `map-route-line tone-${route.tone}`, fill: "none" })
    );

    coords.forEach((point) => {
      mapRoutes.appendChild(
        svg("circle", { cx: point.x, cy: point.y, r: 19, class: `map-route-ring tone-${route.tone}` })
      );
    });
  }

  function renderDetail() {
    const point = POINT_BY_ID[activePointId];
    if (!point) return;
    const routeNames = point.routes.map((id) => ROUTE_BY_ID[id]?.name).filter(Boolean);

    pointDetail.innerHTML = `
      <p class="eyebrow">${point.where}</p>
      <h3>${point.name}<em>${point.sub}</em></h3>
      <dl class="detail-facts">
        <div><dt>光线特征</dt><dd>${point.light}</dd></div>
        <div><dt>建议时段</dt><dd>${point.window}</dd></div>
        <div><dt>拍摄对象</dt><dd>${point.subject}</dd></div>
      </dl>
      <p class="detail-tip">${point.tip}</p>
      <p class="detail-routes">所属路线：${routeNames.length ? routeNames.join(" / ") : "独立点位"}</p>
      <a class="text-link" href="portfolio.html?project=project-02">查看《城墙下的秦人》样张 →</a>
    `;
  }

  function renderPointList() {
    pointList.innerHTML = POINTS.map(
      (point, index) => `
        <button class="point-chip${point.id === activePointId ? " is-active" : ""}" type="button" data-point-id="${point.id}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${point.name}</strong>
          <em>${point.sub}</em>
        </button>
      `
    ).join("");
  }

  function renderRouteCards() {
    routeGrid.innerHTML = ROUTES.map((route) => {
      const active = route.id === activeRouteId ? " is-active" : "";
      const stops = route.stops.map((id) => POINT_BY_ID[id]?.name).filter(Boolean);
      return `
        <button class="route-card tone-${route.tone}${active}" type="button" data-route-id="${route.id}"
          aria-pressed="${route.id === activeRouteId}">
          <span class="route-kicker">${route.kicker}</span>
          <h3>${route.name}</h3>
          <ol class="route-stops">${stops.map((name) => `<li>${name}</li>`).join("")}</ol>
          <p>${route.note}</p>
          <em>${route.duration}</em>
        </button>
      `;
    }).join("");
  }

  function renderGateIndex() {
    const edges = [
      { key: "south", label: "南墙" },
      { key: "east", label: "东墙" },
      { key: "north", label: "北墙" },
      { key: "west", label: "西墙" },
    ];
    gateIndex.innerHTML = edges
      .map((edge) => {
        const names = GATES.filter((gate) => gate.edge === edge.key).map((gate) => gate.name);
        return `
          <div class="gate-group">
            <span>${edge.label}</span>
            <p>${names.join(" · ")}</p>
          </div>
        `;
      })
      .join("");
  }

  function selectPoint(pointId, { scroll = false } = {}) {
    if (!POINT_BY_ID[pointId]) return;
    activePointId = pointId;
    renderPoints();
    renderDetail();
    pointList.querySelectorAll(".point-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.pointId === pointId);
    });
    if (scroll) pointDetail.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function selectRoute(routeId) {
    activeRouteId = activeRouteId === routeId ? null : routeId;
    if (activeRouteId) {
      const first = ROUTE_BY_ID[activeRouteId].stops[0];
      if (first) activePointId = first;
    }
    renderRoutesOnMap();
    renderPoints();
    renderDetail();
    renderPointList();
    renderRouteCards();
  }

  // ---- 样张区：直接取《城墙下的秦人》的真实照片 ----
  const WALL_PROJECT_ID = "project-02";
  let stripPhotos = [];

  // `src` is deliberately not a fallback: masters are archive-only and are not
  // part of the deployed site.
  function stripSource(photo) {
    return { thumb: photo.thumb || photo.large, large: photo.large || photo.thumb };
  }

  function initStrip() {
    if (!LIBRARY) {
      stripGrid.innerHTML = `<p class="library-missing">图库数据未加载，样张暂时无法显示。</p>`;
      return;
    }

    const project = LIBRARY.projects?.[WALL_PROJECT_ID];
    const fallback = LIBRARY.topics?.city?.photos || [];
    const pool = project?.photos?.length ? project.photos : fallback;

    if (!pool.length) {
      stripGrid.innerHTML = `<p class="library-missing">还没有《城墙下的秦人》的样张。</p>`;
      return;
    }

    stripPhotos = pool.slice(0, 12);
    stripGrid.innerHTML = stripPhotos
      .map((photo, index) => {
        const { thumb } = stripSource(photo);
        return `
          <button class="strip-photo" type="button" data-index="${index}">
            <img src="${thumb}" alt="${photo.title || "城墙样张"}" loading="lazy">
          </button>
        `;
      })
      .join("");

    const photoCount = document.querySelector("#mapPhotoCount");
    if (photoCount) photoCount.textContent = String(project?.count ?? pool.length);

    const stripLead = document.querySelector("#stripLead");
    if (stripLead && project) {
      stripLead.textContent = `取自作品集《${project.title || project.label}》，共 ${project.count} 张，下面是最新挑选的一组，点击查看大图。`;
    }
    const stripLink = document.querySelector("#stripLink");
    if (stripLink && project) {
      stripLink.href = `portfolio.html?project=${encodeURIComponent(WALL_PROJECT_ID)}`;
      stripLink.textContent = `查看《${project.title || project.label}》全部作品 →`;
    }
  }

  // ---- 灯箱 ----
  const lightbox = document.querySelector("#mapLightbox");
  const lightboxImage = document.querySelector("#mapLightboxImage");
  const lightboxTitle = document.querySelector("#mapLightboxTitle");
  const lightboxMeta = document.querySelector("#mapLightboxMeta");
  const lightboxCounter = document.querySelector("#mapLightboxCounter");
  const imageStage = document.querySelector("#mapImageStage");
  const fullscreenButton = document.querySelector("#mapFullscreen");
  let lightboxIndex = 0;

  function openLightboxAt(index) {
    if (!stripPhotos.length) return;
    lightboxIndex = (index + stripPhotos.length) % stripPhotos.length;
    const photo = stripPhotos[lightboxIndex];
    const { large } = stripSource(photo);
    lightboxImage.src = large;
    lightboxImage.alt = photo.title || "城墙样张";
    lightboxTitle.textContent = photo.title || "城墙样张";
    const facts = [photo.camera, photo.focalLength, photo.aperture, photo.shutter, photo.iso]
      .filter(Boolean)
      .join(" · ");
    lightboxMeta.textContent = [photo.time, facts].filter(Boolean).join(" / ");
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${stripPhotos.length}`;
    if (!lightbox.open) lightbox.showModal();
  }

  function setFullscreenState(active) {
    lightbox.classList.toggle("is-fullscreen", active);
    fullscreenButton.classList.toggle("active", active);
    fullscreenButton.setAttribute("aria-pressed", active ? "true" : "false");
    fullscreenButton.title = active ? "退出全屏" : "全屏观看";
  }

  function wireEvents() {
    mapPoints.addEventListener("click", (event) => {
      const node = event.target.closest("[data-point-id]");
      if (node) selectPoint(node.getAttribute("data-point-id"));
    });

    mapPoints.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const node = event.target.closest("[data-point-id]");
      if (!node) return;
      event.preventDefault();
      selectPoint(node.getAttribute("data-point-id"));
    });

    pointList.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-point-id]");
      if (chip) selectPoint(chip.dataset.pointId, { scroll: true });
    });

    routeGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-route-id]");
      if (card) selectRoute(card.dataset.routeId);
    });

    stripGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-index]");
      if (button) openLightboxAt(Number(button.dataset.index));
    });

    document.querySelector(".close-lightbox").addEventListener("click", () => lightbox.close());

    fullscreenButton.addEventListener("click", async () => {
      if (document.fullscreenElement === lightbox || lightbox.classList.contains("is-fullscreen")) {
        if (document.fullscreenElement) await document.exitFullscreen();
        else setFullscreenState(false);
        return;
      }
      try {
        if (lightbox.requestFullscreen) {
          await lightbox.requestFullscreen();
          setFullscreenState(document.fullscreenElement === lightbox);
          if (document.fullscreenElement === lightbox) return;
        }
      } catch (error) {
        console.warn("全屏请求未完成，改用页面内全屏。", error);
      }
      setFullscreenState(true);
    });

    document.addEventListener("fullscreenchange", () => {
      setFullscreenState(document.fullscreenElement === lightbox);
    });

    lightbox.addEventListener("close", () => {
      setFullscreenState(false);
      if (document.fullscreenElement === lightbox) document.exitFullscreen().catch(() => {});
    });

    document.addEventListener("keydown", (event) => {
      if (!lightbox.open) return;
      if (event.key === "Escape") {
        lightbox.close();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") openLightboxAt(lightboxIndex + 1);
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") openLightboxAt(lightboxIndex - 1);
    });

    let touchStartX = null;
    imageStage.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
      },
      { passive: true }
    );
    imageStage.addEventListener(
      "touchend",
      (event) => {
        if (touchStartX === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) < 45) return;
        openLightboxAt(lightboxIndex + (delta < 0 ? 1 : -1));
      },
      { passive: true }
    );
  }

  const pointCount = document.querySelector("#mapPointCount");
  const routeCount = document.querySelector("#mapRouteCount");
  if (pointCount) pointCount.textContent = String(POINTS.length);
  if (routeCount) routeCount.textContent = String(ROUTES.length);
  const yearNode = document.querySelector("#year");
  if (yearNode) yearNode.textContent = new Date().getFullYear();

  renderBase();
  renderGates();
  renderRoutesOnMap();
  renderPoints();
  renderDetail();
  renderPointList();
  renderRouteCards();
  renderGateIndex();
  initStrip();
  wireEvents();
})();
