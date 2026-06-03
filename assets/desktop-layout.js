(function () {
  const mq = window.matchMedia("(min-width: 900px)");
  const modeKey = "hems-layout-mode";
  let scheduled = false;
  let toggleButton = null;

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
    return style.position === "fixed" && node.querySelectorAll("button").length >= 5;
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

  function addSpan(node, span) {
    clearSpanClasses(node);
    node.classList.add("hems-desktop-panel", `hems-desktop-span-${span}`);
  }

  function classifyPanel(node, index) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (isNav(node)) {
      node.classList.add("hems-desktop-nav");
      return;
    }

    node.classList.remove("hems-desktop-nav", "hems-desktop-header");
    const text = textOf(node);
    const className = node.className || "";

    if (index === 0 || text.includes("家庭能源管家")) {
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

    if (text.includes("欢迎使用")) {
      addSpan(node, 4);
      return;
    }

    if (text.includes("今日节能成果")) {
      addSpan(node, 4);
      return;
    }

    if (text.includes("明日高温预警")) {
      addSpan(node, 4);
      return;
    }

    if (text.includes("今日电价走势")) {
      addSpan(node, 6);
      return;
    }

    if (text.includes("电动汽车充电")) {
      addSpan(node, 6);
      return;
    }

    if (text.includes("设备") || text.includes("排程") || text.includes("舒适度") || text.includes("运行日志")) {
      addSpan(node, 12);
      return;
    }

    addSpan(node, 6);
  }

  function applyLayout() {
    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    const forceMobile = localStorage.getItem(modeKey) === "mobile";
    document.documentElement.classList.toggle("hems-force-mobile", forceMobile);

    if (!mq.matches || forceMobile) {
      app.classList.remove("hems-desktop-app");
      document.querySelectorAll(".hems-desktop-panel,.hems-desktop-nav,.hems-desktop-header").forEach((node) => {
        node.classList.remove(
          "hems-desktop-panel",
          "hems-desktop-nav",
          "hems-desktop-header",
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
