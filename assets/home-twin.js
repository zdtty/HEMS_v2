(function () {
  const rooms = [
    {
      id: "living",
      name: "客厅",
      grid: "1 / span 4",
      row: "1 / span 2",
      color: "#0a84ff",
      power: "1.24 kW",
      temp: "24.1°C",
      devices: ["空调", "电视", "照明", "空气净化"],
      saving: "18%",
      status: "舒适 · 负载偏高",
      advice: "空调已接近舒适上限，可下调风量并延迟电视待机电源，预计每小时节省 0.18 kWh。",
      actions: ["舒适优先", "关闭待机"]
    },
    {
      id: "bedroom",
      name: "主卧",
      grid: "5 / span 2",
      row: "1 / span 2",
      color: "#34a853",
      power: "0.42 kW",
      temp: "25.0°C",
      devices: ["空调", "照明", "窗帘"],
      saving: "26%",
      status: "低耗 · 舒适",
      advice: "房间负载较低，建议保持当前策略；睡眠时段可切换静音节能曲线。",
      actions: ["睡眠模式", "保持策略"]
    },
    {
      id: "kitchen",
      name: "厨房",
      grid: "1 / span 2",
      row: "3 / span 2",
      color: "#ff9f0a",
      power: "0.96 kW",
      temp: "26.4°C",
      devices: ["冰箱", "洗碗机", "照明"],
      saving: "12%",
      status: "可延迟设备",
      advice: "洗碗机可移动到低电价时段运行，不影响舒适度，预计今晚节省 ¥1.6。",
      actions: ["延迟运行", "查看排程"]
    },
    {
      id: "study",
      name: "书房",
      grid: "3 / span 2",
      row: "3 / span 2",
      color: "#8e5cf7",
      power: "0.31 kW",
      temp: "24.7°C",
      devices: ["电脑", "照明", "插座"],
      saving: "21%",
      status: "办公场景",
      advice: "插座组存在轻微待机负载，离开房间后可自动切断非必要设备。",
      actions: ["离家断电", "保留电脑"]
    },
    {
      id: "balcony",
      name: "阳台",
      grid: "5 / span 2",
      row: "3 / span 2",
      color: "#00a889",
      power: "0.18 kW",
      temp: "23.6°C",
      devices: ["洗衣机", "传感器"],
      saving: "31%",
      status: "绿电窗口",
      advice: "洗衣机可等待绿电占比最高时运行，预计碳排减少 0.4 kg CO2。",
      actions: ["绿电优先", "立即运行"]
    }
  ];

  let selectedId = rooms[0].id;
  let scheduled = false;

  function roomById(id) {
    return rooms.find((room) => room.id === id) || rooms[0];
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function template() {
    const selected = roomById(selectedId);
    return `
      <div class="hems-twin__head">
        <div>
          <div class="hems-twin__title">家庭平面孪生</div>
          <div class="hems-twin__sub">用可编辑网格映射房间、设备和节能策略</div>
        </div>
        <div class="hems-twin__badge">实时镜像</div>
      </div>
      <div class="hems-twin__map" role="group" aria-label="家庭平面孪生房间图">
        ${rooms.map((room) => `
          <button class="hems-room ${room.id === selectedId ? "is-active" : ""}" data-room="${room.id}" style="--c:${room.grid};--r:${room.row};--room-color:${room.color}" type="button">
            <span class="hems-room__top">
              <span class="hems-room__name">${escapeHtml(room.name)}</span>
              <span class="hems-room__state"></span>
            </span>
            <span class="hems-room__meta">
              <span>${escapeHtml(room.temp)}</span>
              <span class="hems-room__power">${escapeHtml(room.power)}</span>
            </span>
          </button>
        `).join("")}
      </div>
      <div class="hems-twin__detail">
        <div class="hems-twin__detail-head">
          <div>
            <div class="hems-twin__room-title">${escapeHtml(selected.name)} · 数字映射</div>
            <div class="hems-twin__room-note">${escapeHtml(selected.status)}</div>
          </div>
          <div class="hems-twin__score">${escapeHtml(selected.saving)}</div>
        </div>
        <div class="hems-twin__metrics">
          <div class="hems-twin__metric">
            <div class="hems-twin__metric-label">当前功率</div>
            <div class="hems-twin__metric-value">${escapeHtml(selected.power)}</div>
          </div>
          <div class="hems-twin__metric">
            <div class="hems-twin__metric-label">室内温度</div>
            <div class="hems-twin__metric-value">${escapeHtml(selected.temp)}</div>
          </div>
          <div class="hems-twin__metric">
            <div class="hems-twin__metric-label">节能潜力</div>
            <div class="hems-twin__metric-value">${escapeHtml(selected.saving)}</div>
          </div>
        </div>
        <div class="hems-twin__devices">
          ${selected.devices.map((device) => `<span class="hems-twin__device">${escapeHtml(device)}</span>`).join("")}
        </div>
        <div class="hems-twin__advice">${escapeHtml(selected.advice)}</div>
        <div class="hems-twin__actions">
          ${selected.actions.map((action) => `<button class="hems-twin__action" type="button">${escapeHtml(action)}</button>`).join("")}
        </div>
      </div>
    `;
  }

  function isHomeVisible() {
    const text = document.body ? document.body.innerText : "";
    return text.includes("家庭能源管家") || text.includes("欢迎使用 HEMS");
  }

  function removeTwin() {
    document.querySelectorAll(".hems-twin").forEach((node) => node.remove());
  }

  function renderTwin() {
    const existing = document.querySelector(".hems-twin");
    if (!isHomeVisible()) {
      removeTwin();
      return;
    }

    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    const twin = existing || document.createElement("section");
    if (existing && twin.dataset.selected === selectedId) return;

    twin.className = "hems-twin";
    twin.dataset.selected = selectedId;
    twin.innerHTML = template();
    twin.querySelectorAll("[data-room]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.getAttribute("data-room") || selectedId;
        renderTwin();
      });
    });

    if (!existing) {
      const fixedNav = Array.from(app.children).find((child) => {
        const style = child.getAttribute("style") || "";
        return style.includes("position: fixed") && style.includes("bottom: 0");
      });
      const anchor = app.children[1] && app.children[1] !== fixedNav ? app.children[1] : app.firstElementChild;
      if (anchor && anchor.parentNode === app) {
        anchor.insertAdjacentElement("afterend", twin);
      } else {
        app.insertBefore(twin, fixedNav || null);
      }
    }
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      renderTwin();
    });
  }

  function start() {
    scheduleRender();
    const root = document.getElementById("root");
    if (!root) return;
    const observer = new MutationObserver(scheduleRender);
    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
