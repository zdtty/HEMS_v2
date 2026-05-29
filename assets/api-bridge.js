(function () {
  const apiBase = window.HEMS_API_BASE || "http://127.0.0.1:3001";
  let scheduled = false;

  function isHomeVisible() {
    const text = document.body ? document.body.innerText : "";
    return text.includes("今日节能成果") || text.includes("添加您的智能家电");
  }

  function removePanel() {
    document.querySelectorAll(".hems-api").forEach((node) => node.remove());
  }

  function panelTemplate(state) {
    const statusText = state.ok ? "边缘 API 已连接" : "边缘 API 未连接";
    const meta = state.ok
      ? `模块：${state.modules.join(" / ")}`
      : `本地演示可运行 npm start 后连接 ${apiBase}`;
    return `
      <div class="hems-api__row">
        <div class="hems-api__title">边缘决策服务</div>
        <div class="hems-api__status"><span class="hems-api__dot"></span>${statusText}</div>
      </div>
      <div class="hems-api__meta">${meta}</div>
    `;
  }

  async function fetchHealth() {
    try {
      const response = await fetch(`${apiBase}/api/health`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      return { ok: true, modules: data.modules || [] };
    } catch {
      return { ok: false, modules: [] };
    }
  }

  async function renderPanel() {
    if (!isHomeVisible()) {
      removePanel();
      return;
    }

    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    let panel = document.querySelector(".hems-api");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "hems-api";
      const anchor = document.querySelector(".hems-twin") || app.children[1] || app.firstElementChild;
      if (anchor && anchor.parentNode) {
        anchor.insertAdjacentElement("afterend", panel);
      } else {
        app.appendChild(panel);
      }
    }

    const state = await fetchHealth();
    panel.className = `hems-api ${state.ok ? "is-online" : "is-offline"}`;
    panel.innerHTML = panelTemplate(state);
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      renderPanel();
    });
  }

  function start() {
    scheduleRender();
    setInterval(renderPanel, 15000);
    const root = document.getElementById("root");
    if (!root) return;
    new MutationObserver(scheduleRender).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
