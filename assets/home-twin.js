(function () {
  const storageKey = "hems.twin.rooms.v1";
  const palette = ["#0a84ff", "#34a853", "#ff9f0a", "#8e5cf7", "#00a889", "#ff6b6b"];
  const defaultRooms = [
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

  let rooms = loadRooms();
  let selectedId = rooms[0] ? rooms[0].id : "";
  let scheduled = false;

  function cloneRooms(source) {
    return JSON.parse(JSON.stringify(source));
  }

  function loadRooms() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "null");
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizeRoom);
    } catch {}
    return cloneRooms(defaultRooms);
  }

  function saveRooms() {
    window.localStorage.setItem(storageKey, JSON.stringify(rooms));
  }

  function normalizeRoom(room, index = 0) {
    return {
      id: String(room.id || `room_${Date.now()}_${index}`),
      name: String(room.name || "新房间"),
      color: room.color || palette[index % palette.length],
      power: String(room.power || "0.20 kW"),
      temp: String(room.temp || "24.5°C"),
      devices: Array.isArray(room.devices) ? room.devices.map(String) : [],
      saving: String(room.saving || "15%"),
      status: String(room.status || "自定义房间"),
      advice: String(room.advice || "可继续绑定设备并观察负载变化，AI 将根据房间状态生成节能建议。"),
      actions: Array.isArray(room.actions) && room.actions.length ? room.actions.map(String) : ["查看设备", "节能建议"]
    };
  }

  function autoGrid(index) {
    const firstSlots = [
      { grid: "1 / span 4", row: "1 / span 2" },
      { grid: "5 / span 2", row: "1 / span 2" },
      { grid: "1 / span 2", row: "3 / span 2" },
      { grid: "3 / span 2", row: "3 / span 2" },
      { grid: "5 / span 2", row: "3 / span 2" }
    ];
    if (firstSlots[index]) return firstSlots[index];

    const compactIndex = index - firstSlots.length;
    const col = compactIndex % 3;
    const row = Math.floor(compactIndex / 3) + 2;
    return {
      grid: `${col * 2 + 1} / span 2`,
      row: `${row * 2 + 1} / span 2`
    };
  }

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
    if (!selected) return "";

    return `
      <div class="hems-twin__head">
        <div class="hems-twin__title">家庭平面孪生</div>
        <div class="hems-twin__tools">
          <button class="hems-twin__tool" data-twin-action="reset" type="button">重置</button>
        </div>
      </div>
      <div class="hems-twin__map" role="group" aria-label="家庭平面孪生房间图">
        ${rooms.map((room, index) => {
          const layout = autoGrid(index);
          return `
          <button class="hems-room ${room.id === selectedId ? "is-active" : ""}" data-room="${room.id}" style="--c:${layout.grid};--r:${layout.row};--room-color:${room.color}" type="button">
            <span class="hems-room__top">
              <span class="hems-room__name">${escapeHtml(room.name)}</span>
              <span class="hems-room__state"></span>
            </span>
            <span class="hems-room__meta">
              <span>${escapeHtml(room.temp)}</span>
              <span class="hems-room__power">${escapeHtml(room.power)}</span>
            </span>
          </button>
        `;
        }).join("")}
      </div>
      <form class="hems-twin__add-room" data-twin-form="room">
        <input class="hems-twin__input" name="roomName" maxlength="8" placeholder="新增房间名" autocomplete="off">
        <button class="hems-twin__primary" type="submit">添加房间</button>
      </form>
      <div class="hems-twin__detail">
        <div class="hems-twin__detail-head">
          <div>
            <div class="hems-twin__room-title">${escapeHtml(selected.name)} · 数字映射</div>
            <div class="hems-twin__room-note">${escapeHtml(selected.status)}</div>
          </div>
          <div class="hems-twin__score">
            <span class="hems-twin__score-label">节能潜力</span>
            <span>${escapeHtml(selected.saving)}</span>
          </div>
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
            <div class="hems-twin__metric-label">设备数量</div>
            <div class="hems-twin__metric-value">${selected.devices.length}</div>
          </div>
        </div>
        <div class="hems-twin__section-title">房间电器</div>
        <div class="hems-twin__devices">
          ${selected.devices.length ? selected.devices.map((device, index) => `
            <button class="hems-twin__device" data-device-index="${index}" type="button" title="点击删除">
              ${escapeHtml(device)} <span>×</span>
            </button>
          `).join("") : `<span class="hems-twin__empty">暂无电器</span>`}
        </div>
        <form class="hems-twin__add-device" data-twin-form="device">
          <input class="hems-twin__input" name="deviceName" maxlength="10" placeholder="新增电器名" autocomplete="off">
          <button class="hems-twin__primary" type="submit">添加电器</button>
        </form>
        <div class="hems-twin__advice">${escapeHtml(selected.advice)}</div>
        <div class="hems-twin__actions">
          ${selected.actions.map((action) => `<button class="hems-twin__action" type="button">${escapeHtml(action)}</button>`).join("")}
          <button class="hems-twin__danger" data-twin-action="delete-room" type="button" ${rooms.length <= 1 ? "disabled" : ""}>删除房间</button>
        </div>
      </div>
    `;
  }

  function isHomeVisible() {
    const twin = document.querySelector(".hems-twin");
    let text = document.body ? document.body.innerText : "";
    if (twin) text = text.replace(twin.innerText, "");
    return text.includes("今日节能成果") || text.includes("添加您的智能家电");
  }

  function removeTwin() {
    document.querySelectorAll(".hems-twin").forEach((node) => node.remove());
  }

  function addRoom(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const room = normalizeRoom({
      id: `room_${Date.now()}`,
      name: trimmed,
      color: palette[rooms.length % palette.length],
      devices: []
    }, rooms.length);
    rooms.push(room);
    selectedId = room.id;
    saveRooms();
    renderTwin(true);
  }

  function deleteSelectedRoom() {
    if (rooms.length <= 1) return;
    rooms = rooms.filter((room) => room.id !== selectedId);
    selectedId = rooms[0].id;
    saveRooms();
    renderTwin(true);
  }

  function addDevice(name) {
    const room = roomById(selectedId);
    const trimmed = name.trim();
    if (!room || !trimmed) return;
    if (!room.devices.includes(trimmed)) room.devices.push(trimmed);
    saveRooms();
    renderTwin(true);
  }

  function deleteDevice(index) {
    const room = roomById(selectedId);
    if (!room) return;
    room.devices.splice(index, 1);
    saveRooms();
    renderTwin(true);
  }

  function resetRooms() {
    rooms = cloneRooms(defaultRooms);
    selectedId = rooms[0].id;
    saveRooms();
    renderTwin(true);
  }

  function bindTwin(twin) {
    twin.querySelectorAll("[data-room]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedId = button.getAttribute("data-room") || selectedId;
        renderTwin(true);
      });
    });

    twin.querySelector('[data-twin-form="room"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      addRoom(new FormData(event.currentTarget).get("roomName") || "");
    });

    twin.querySelector('[data-twin-form="device"]')?.addEventListener("submit", (event) => {
      event.preventDefault();
      addDevice(new FormData(event.currentTarget).get("deviceName") || "");
    });

    twin.querySelectorAll("[data-device-index]").forEach((button) => {
      button.addEventListener("click", () => deleteDevice(Number(button.getAttribute("data-device-index"))));
    });

    twin.querySelector('[data-twin-action="delete-room"]')?.addEventListener("click", deleteSelectedRoom);
    twin.querySelector('[data-twin-action="reset"]')?.addEventListener("click", resetRooms);
  }

  function renderTwin(force = false) {
    const existing = document.querySelector(".hems-twin");
    if (!isHomeVisible()) {
      removeTwin();
      return;
    }

    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    const twin = existing || document.createElement("section");
    const signature = JSON.stringify({ selectedId, rooms });
    if (!force && existing && twin.dataset.signature === signature) return;

    twin.className = "hems-twin";
    twin.dataset.signature = signature;
    twin.innerHTML = template();
    bindTwin(twin);

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
