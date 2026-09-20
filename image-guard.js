/*!
 * image-guard.js —— 图片保存防护
 *
 * 目的：让访客「顺手右键 / 长按 / 拖拽」这几种最常见的存图动作失效。
 *
 * 边界（必须清楚）：这是提高门槛，不是阻止。图片是通过公开 URL 下发的，
 * 任何人知道地址就能拿到，打开开发者工具也能在 Network 里另存。
 * 网页端不存在「绝对不能下载」的实现 —— 真正有效的手段是水印、降分辨率预览，
 * 或用 Cloudflare 的防盗链（Scrape Shield）阻止第三方站点直接嵌入。详见 README。
 *
 * 做法分三层：
 *   1. 右键菜单：只在图片与看图区域拦截，页面其它地方保持原样（访客仍能复制邮箱、右键打开链接）。
 *   2. 拖拽另存：拦截 dragstart，覆盖首页拼贴、图集、灯箱等所有图片，含 JS 动态渲染出来的。
 *   3. 兜底：给每个 img 打上 draggable="false"，避免拖出半透明残影。
 * 长按菜单（移动端 Safari / Chrome）由 styles.css 的 -webkit-touch-callout 负责；
 * 灯箱大图另有一层 pointer-events: none，让浏览器菜单里根本不出现存图项。
 */
(function () {
  "use strict";

  // 命中这些范围就拦右键：图片本身，以及三个看图容器。
  const MENU_SCOPE = "img, .lightbox, .portfolio-lightbox, .portfolio-image-stage, [data-no-save]";

  function inScope(target, selector) {
    return target instanceof Element && target.closest(selector);
  }

  // 1) 右键菜单
  document.addEventListener(
    "contextmenu",
    (event) => {
      if (inScope(event.target, MENU_SCOPE)) event.preventDefault();
    },
    true
  );

  // 2) 拖拽另存：捕获阶段生效，动态插入的图片同样覆盖
  document.addEventListener(
    "dragstart",
    (event) => {
      if (inScope(event.target, "img")) event.preventDefault();
    },
    true
  );

  // 3) 拖动时选中图片内容，视觉上像被“拎起来”，一并挡掉
  document.addEventListener(
    "selectstart",
    (event) => {
      if (inScope(event.target, "img")) event.preventDefault();
    },
    true
  );

  // 4) 给 img 打 draggable="false"（含后续动态渲染的）
  function stamp(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll("img:not([draggable])").forEach((image) => {
      image.draggable = false;
    });
  }

  function start() {
    stamp(document);
    new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.tagName === "IMG") {
            node.draggable = false;
          } else {
            stamp(node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
