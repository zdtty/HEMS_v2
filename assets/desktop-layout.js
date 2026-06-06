(function () {
  const mq = window.matchMedia("(min-width: 900px)");
  const modeKey = "hems-layout-mode";
  let scheduled = false;
  let toggleButton = null;
  let preferredActiveLabel = null;

  try {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "app" || requestedMode === "mobile") {
      localStorage.setItem(modeKey, "mobile");
    } else if (requestedMode === "desktop") {
      localStorage.removeItem(modeKey);
    }
  } catch (_) {
    // Ignore storage failures in private or restricted browser contexts.
  }

  function textOf(node) {
    return node && node.innerText ? node.innerText : "";
  }

  function isNav(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(node);
    const directButtons = Array.from(node.children).filter((child) => child.tagName === "BUTTON");
    return style.position === "fixed" && directButtons.length >= 5;
  }

  function isOverlay(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(node);
    return style.position === "fixed" && !isNav(node);
  }

  function clearSpanClasses(node) {
    node.classList.remove(
      "hems-desktop-span-3",
      "hems-desktop-span-4",
      "hems-desktop-span-5",
      "hems-desktop-span-6",
      "hems-desktop-span-7",
      "hems-desktop-span-8",
      "hems-desktop-span-12"
    );
  }

  function clearRoleClasses(node) {
    node.classList.remove(
      "hems-desktop-home-hero",
      "hems-desktop-home-savings",
      "hems-desktop-home-alert",
      "hems-desktop-home-price",
      "hems-desktop-home-ev",
      "hems-desktop-home-page",
      "hems-desktop-ev-page"
    );
  }

  function addSpan(node, span) {
    clearSpanClasses(node);
    node.classList.add("hems-desktop-panel", `hems-desktop-span-${span}`);
  }

  function classifyPanel(node, index) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (isOverlay(node)) {
      node.classList.remove("hems-desktop-nav", "hems-desktop-header", "hems-desktop-panel");
      clearSpanClasses(node);
      clearRoleClasses(node);
      node.classList.add("hems-desktop-modal-overlay");
      return;
    }

    if (isNav(node)) {
      node.classList.add("hems-desktop-nav");
      bindNavState(node);
      return;
    }

    node.classList.remove("hems-desktop-nav", "hems-desktop-header", "hems-desktop-modal-overlay");
    clearRoleClasses(node);
    const text = textOf(node);
    const className = node.className || "";

    if (index === 0) {
      node.classList.add("hems-desktop-header");
      addSpan(node, 12);
      return;
    }

    if (className.includes("hems-live-energy")) {
      addSpan(node, 5);
      return;
    }

    if (className.includes("hems-twin")) {
      addSpan(node, 7);
      return;
    }

    if (className.includes("hems-api")) {
      addSpan(node, 12);
      return;
    }

    if ((text.includes("欢迎使用") || text.includes("添加第一台设备")) && text.includes("家庭平面孪生")) {
      node.classList.add("hems-desktop-home-page");
      addSpan(node, 12);
      return;
    }

    if (text.includes("电动汽车充电") && text.includes("充电目标设置")) {
      node.classList.add("hems-desktop-ev-page");
      addSpan(node, 12);
      return;
    }

    if (text.includes("欢迎使用") || text.includes("添加第一台设备")) {
      node.classList.add("hems-desktop-home-hero");
      addSpan(node, 12);
      return;
    }

    if (text.includes("今日节能成果")) {
      node.classList.add("hems-desktop-home-savings");
      addSpan(node, 12);
      return;
    }

    if (text.includes("明日高温预警")) {
      node.classList.add("hems-desktop-home-alert");
      addSpan(node, 12);
      return;
    }

    if (text.includes("今日电价走势")) {
      node.classList.add("hems-desktop-home-price");
      addSpan(node, 12);
      return;
    }

    if (text.includes("电动汽车充电")) {
      node.classList.add("hems-desktop-home-ev");
      addSpan(node, 12);
      return;
    }

    if (text.includes("设备") || text.includes("排程") || text.includes("舒适度") || text.includes("运行日志") || text.includes("决策日志")) {
      addSpan(node, 12);
      return;
    }

    addSpan(node, 6);
  }

  function applyLayout() {
    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    // 保存当前滚动位置，防止布局重排导致页面自动滚动
    const scrollY = window.scrollY;

    const forceMobile = localStorage.getItem(modeKey) === "mobile";
    document.documentElement.classList.toggle("hems-force-mobile", forceMobile);

    if (!mq.matches || forceMobile) {
      app.classList.remove("hems-desktop-app");
      document.querySelectorAll(".hems-desktop-panel,.hems-desktop-nav,.hems-desktop-header,.hems-desktop-modal-overlay,.hems-desktop-home-page,.hems-desktop-home-hero,.hems-desktop-home-savings,.hems-desktop-home-alert,.hems-desktop-home-price,.hems-desktop-home-ev,.hems-desktop-ev-page").forEach((node) => {
        node.classList.remove(
          "hems-desktop-panel",
          "hems-desktop-nav",
          "hems-desktop-header",
          "hems-desktop-modal-overlay",
          "hems-desktop-home-page",
          "hems-desktop-home-hero",
          "hems-desktop-home-savings",
          "hems-desktop-home-alert",
          "hems-desktop-home-price",
          "hems-desktop-home-ev",
          "hems-desktop-ev-page",
          "hems-desktop-span-3",
          "hems-desktop-span-4",
          "hems-desktop-span-5",
          "hems-desktop-span-6",
          "hems-desktop-span-7",
          "hems-desktop-span-8",
          "hems-desktop-span-12"
        );
      });
      updateToggle(forceMobile);
      return;
    }

    updateToggle(false);
    app.classList.add("hems-desktop-app");
    Array.from(app.children).forEach(classifyPanel);
    classifyOverlays(root);
    syncActiveNav();

    // 恢复滚动位置，防止布局重排导致页面跳动
    if (window.scrollY !== scrollY) {
      window.scrollTo(0, scrollY);
    }

    // 通知其他脚本布局已完成（用于触发动画）
    window.dispatchEvent(new CustomEvent('hems-layout-applied'));
  }

  function classifyOverlays(root) {
    root.querySelectorAll("div").forEach((node) => {
      if (!isOverlay(node)) return;
      node.classList.remove("hems-desktop-nav", "hems-desktop-header", "hems-desktop-panel");
      clearSpanClasses(node);
      clearRoleClasses(node);
      node.classList.add("hems-desktop-modal-overlay");
    });
  }

  function syncActiveNav() {
    const activeLabel = preferredActiveLabel || detectActiveLabel();
    document.querySelectorAll(".hems-desktop-nav").forEach((nav) => {
      const buttons = Array.from(nav.children).filter((child) => child.tagName === "BUTTON");
      buttons.forEach((button) => button.classList.remove("is-active"));
      buttons.forEach((button) => {
        const text = textOf(button);
        const isActive =
          text.includes(activeLabel) ||
          (activeLabel === "\u6c7d\u8f66" && text.includes("\u5145\u7535"));
        button.classList.toggle("is-active", isActive);
      });
    });
  }

  function bindNavState(nav) {
    if (nav.dataset.hemsNavBound === "1") return;
    nav.dataset.hemsNavBound = "1";
    nav.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("button");
        if (!button || !nav.contains(button)) return;
        const label = labelFromNavButton(button);
        if (!label) return;
        preferredActiveLabel = label;
        window.requestAnimationFrame(syncActiveNav);
      },
      true
    );
  }

  function labelFromNavButton(button) {
    const text = textOf(button);
    if (text.includes("\u9996\u9875")) return "\u9996\u9875";
    if (text.includes("\u8bbe\u5907")) return "\u8bbe\u5907";
    if (text.includes("\u6392\u7a0b")) return "\u6392\u7a0b";
    if (text.includes("\u8212\u9002\u5ea6")) return "\u8212\u9002\u5ea6";
    if (text.includes("\u6c7d\u8f66") || text.includes("\u5145\u7535")) return "\u6c7d\u8f66";
    if (text.includes("\u65e5\u5fd7")) return "\u65e5\u5fd7";
    return null;
  }

  function detectActiveLabel() {
    const root = document.getElementById("root");
    const text = textOf(root);

    if (text.includes("\u4eca\u65e5\u8282\u80fd\u6210\u679c") && text.includes("\u8bbe\u5907\u72b6\u6001")) return "\u9996\u9875";
    if (text.includes("\u8bbe\u5907\u7ba1\u7406")) return "\u8bbe\u5907";
    if (text.includes("\u6392\u7a0b") && (text.includes("\u7b56\u7565") || text.includes("\u7eff\u8272\u5bb6\u7535"))) return "\u6392\u7a0b";
    if (text.includes("\u8212\u9002\u5ea6\u8c03\u8282")) return "\u8212\u9002\u5ea6";
    if (text.includes("\u7535\u52a8\u6c7d\u8f66\u5145\u7535") && text.includes("\u5145\u7535\u76ee\u6807\u8bbe\u7f6e")) return "\u6c7d\u8f66";
    if (text.includes("\u51b3\u7b56\u65e5\u5fd7")) return "\u65e5\u5fd7";
    return "\u9996\u9875";
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      applyLayout();
    });
  }

  function start() {
    createToggle();
    schedule();
    mq.addEventListener ? mq.addEventListener("change", schedule) : mq.addListener(schedule);
    const root = document.getElementById("root");
    if (!root) return;
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  function createToggle() {
    if (toggleButton) return;
    toggleButton = document.createElement("button");
    toggleButton.className = "hems-layout-toggle";
    toggleButton.type = "button";
    toggleButton.setAttribute("aria-label", "切换桌面版和APP版");
    toggleButton.addEventListener("click", () => {
      const next = localStorage.getItem(modeKey) === "mobile" ? "desktop" : "mobile";
      if (next === "mobile") {
        localStorage.setItem(modeKey, "mobile");
      } else {
        localStorage.removeItem(modeKey);
      }
      schedule();
    });
    document.body.appendChild(toggleButton);
  }

  function updateToggle(forceMobile) {
    if (!toggleButton) return;
    toggleButton.textContent = forceMobile ? "桌面版" : "APP版";
    toggleButton.classList.toggle("is-mobile", forceMobile);
  }
})();
