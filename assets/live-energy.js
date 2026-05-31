(function () {
  const storageKey = "hems.liveEnergy.city.v1";
  const refreshMs = 15 * 60 * 1000;

  const cities = [
    {
      id: "beijing",
      name: "北京",
      region: "华北电网",
      lat: 39.9042,
      lon: 116.4074,
      mix: { thermal: 66, hydro: 4, wind: 15, solar: 12, nuclear: 3 }
    },
    {
      id: "shanghai",
      name: "上海",
      region: "华东电网",
      lat: 31.2304,
      lon: 121.4737,
      mix: { thermal: 58, hydro: 7, wind: 12, solar: 10, nuclear: 13 }
    },
    {
      id: "guangzhou",
      name: "广州",
      region: "南方电网",
      lat: 23.1291,
      lon: 113.2644,
      mix: { thermal: 49, hydro: 21, wind: 8, solar: 9, nuclear: 13 }
    },
    {
      id: "shenzhen",
      name: "深圳",
      region: "南方电网",
      lat: 22.5431,
      lon: 114.0579,
      mix: { thermal: 49, hydro: 21, wind: 8, solar: 9, nuclear: 13 }
    },
    {
      id: "chengdu",
      name: "成都",
      region: "西南电网",
      lat: 30.5728,
      lon: 104.0668,
      mix: { thermal: 29, hydro: 52, wind: 4, solar: 9, nuclear: 6 }
    },
    {
      id: "wuhan",
      name: "武汉",
      region: "华中电网",
      lat: 30.5928,
      lon: 114.3055,
      mix: { thermal: 55, hydro: 23, wind: 7, solar: 10, nuclear: 5 }
    },
    {
      id: "xian",
      name: "西安",
      region: "西北电网",
      lat: 34.3416,
      lon: 108.9398,
      mix: { thermal: 48, hydro: 9, wind: 22, solar: 20, nuclear: 1 }
    },
    {
      id: "hangzhou",
      name: "杭州",
      region: "华东电网",
      lat: 30.2741,
      lon: 120.1551,
      mix: { thermal: 58, hydro: 7, wind: 12, solar: 10, nuclear: 13 }
    }
  ];

  const weatherText = {
    0: "晴",
    1: "大部晴朗",
    2: "局部多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "强毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    80: "阵雨",
    81: "中等阵雨",
    82: "强阵雨",
    95: "雷阵雨",
    96: "雷阵雨伴冰雹",
    99: "强雷阵雨伴冰雹"
  };

  let selectedCity = loadCity();
  let lastState = { loading: true, weather: null, error: "" };
  let scheduled = false;

  function loadCity() {
    const saved = window.localStorage.getItem(storageKey);
    return cities.find((city) => city.id === saved) || cities[0];
  }

  function saveCity(city) {
    selectedCity = city;
    window.localStorage.setItem(storageKey, city.id);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function isHomeVisible() {
    const text = document.body ? document.body.innerText : "";
    return text.includes("今日节能成果") || text.includes("添加您的智能家电") || Boolean(document.querySelector(".hems-twin"));
  }

  function removePanel() {
    document.querySelectorAll(".hems-live-energy").forEach((node) => node.remove());
  }

  function currentUrl(city) {
    const vars = [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "shortwave_radiation"
    ].join(",");
    const params = new URLSearchParams({
      latitude: city.lat,
      longitude: city.lon,
      current: vars,
      timezone: "auto",
      forecast_days: "1"
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }

  async function fetchWeather(city) {
    const response = await fetch(currentUrl(city), { cache: "no-store" });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const data = await response.json();
    return data.current || {};
  }

  function round(value, digits = 0) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return num.toFixed(digits);
  }

  function estimateGreen(city, weather) {
    const mix = city.mix;
    const base = mix.hydro + mix.wind + mix.solar + mix.nuclear;
    const solarBonus = Math.max(0, Math.min(8, Number(weather.shortwave_radiation || 0) / 90));
    const cloudPenalty = Math.max(0, Math.min(5, Number(weather.cloud_cover || 0) / 20));
    const windBonus = Math.max(0, Math.min(5, (Number(weather.wind_speed_10m || 0) - 8) / 2));
    const score = Math.max(5, Math.min(92, Math.round(base + solarBonus + windBonus - cloudPenalty)));
    return { score, base };
  }

  function adviceFor(score, weather) {
    const temp = Number(weather.temperature_2m);
    if (score >= 55) return "绿电占比较高，适合安排洗衣机、热水器预热和 EV 慢充等可延迟负荷。";
    if (Number.isFinite(temp) && temp >= 30) return "室外温度较高，建议提前预冷并避开晚高峰，优先保障空调舒适度。";
    if (score >= 40) return "当前低碳程度中等，可运行必要负荷，将非紧急设备排到绿电窗口。";
    return "当前绿电占比较低，建议推迟非必要负荷，保持冰箱、照明等基础设备运行。";
  }

  function mixStyle(mix) {
    return [
      `--thermal:${mix.thermal}fr`,
      `--hydro:${mix.hydro}fr`,
      `--wind:${mix.wind}fr`,
      `--solar:${mix.solar}fr`,
      `--nuclear:${mix.nuclear}fr`
    ].join(";");
  }

  function renderTemplate() {
    const weather = lastState.weather || {};
    const mix = selectedCity.mix;
    const green = estimateGreen(selectedCity, weather);
    const updated = weather.time ? weather.time.replace("T", " ") : "等待更新";
    const condition = weatherText[weather.weather_code] || "实时天气";
    const isLoading = lastState.loading ? " is-loading" : "";
    const isChoosing = document.querySelector(".hems-live-energy.is-choosing") ? " is-choosing" : "";

    return `
      <div class="hems-live-energy__head">
        <div>
          <div class="hems-live-energy__title">实时环境与区域能源结构</div>
          <div class="hems-live-energy__meta">${escapeHtml(selectedCity.region)} · 数据时间 ${escapeHtml(updated)}</div>
        </div>
        <button class="hems-live-energy__city-button" type="button" data-live-action="toggle-city">切换城市 · ${escapeHtml(selectedCity.name)}</button>
      </div>
      <div class="hems-live-energy__grid">
        <div class="hems-live-energy__weather">
          <div class="hems-live-energy__weather-main">
            <div class="hems-live-energy__temp">${round(weather.temperature_2m, 1)}°</div>
            <div>
              <div class="hems-live-energy__condition">${escapeHtml(condition)}</div>
              <div class="hems-live-energy__details">体感 ${round(weather.apparent_temperature, 1)}°C · 湿度 ${round(weather.relative_humidity_2m)}% · 风速 ${round(weather.wind_speed_10m, 1)} km/h</div>
            </div>
          </div>
          <div class="hems-live-energy__metrics">
            <div class="hems-live-energy__metric">
              <div class="hems-live-energy__metric-label">云量</div>
              <div class="hems-live-energy__metric-value">${round(weather.cloud_cover)}%</div>
            </div>
            <div class="hems-live-energy__metric">
              <div class="hems-live-energy__metric-label">太阳辐照</div>
              <div class="hems-live-energy__metric-value">${round(weather.shortwave_radiation)} W/m²</div>
            </div>
            <div class="hems-live-energy__metric">
              <div class="hems-live-energy__metric-label">热负荷判断</div>
              <div class="hems-live-energy__metric-value">${Number(weather.temperature_2m) >= 28 ? "制冷压力高" : "负荷平稳"}</div>
            </div>
          </div>
        </div>
        <div class="hems-live-energy__mix">
          <div class="hems-live-energy__mix-head">
            <div>
              <div class="hems-live-energy__mix-title">区域绿电占比估算</div>
              <div class="hems-live-energy__mix-sub">按区域电力结构基准，结合实时风速、云量与太阳辐照修正</div>
            </div>
            <div class="hems-live-energy__green-score">${green.score}%</div>
          </div>
          <div class="hems-live-energy__bar" style="${mixStyle(mix)}" aria-label="区域电力结构">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="hems-live-energy__legend">
            <div class="hems-live-energy__legend-item"><span class="hems-live-energy__legend-dot"></span>火 ${mix.thermal}%</div>
            <div class="hems-live-energy__legend-item"><span class="hems-live-energy__legend-dot"></span>水 ${mix.hydro}%</div>
            <div class="hems-live-energy__legend-item"><span class="hems-live-energy__legend-dot"></span>风 ${mix.wind}%</div>
            <div class="hems-live-energy__legend-item"><span class="hems-live-energy__legend-dot"></span>光 ${mix.solar}%</div>
            <div class="hems-live-energy__legend-item"><span class="hems-live-energy__legend-dot"></span>核 ${mix.nuclear}%</div>
          </div>
          <div class="hems-live-energy__advice">${escapeHtml(adviceFor(green.score, weather))}</div>
        </div>
      </div>
      <div class="hems-live-energy__cities">
        ${cities.map((city) => `<button class="hems-live-energy__city ${city.id === selectedCity.id ? "is-active" : ""}" type="button" data-city-id="${city.id}">${escapeHtml(city.name)}</button>`).join("")}
      </div>
      <div class="hems-live-energy__source">实时天气来自 Open-Meteo Forecast API；绿电占比为区域电力结构估算值，不等同于城市级实时碳强度。${lastState.error ? ` 当前天气接口异常，显示最近或占位数据。` : ""}</div>
    `;
  }

  async function updateWeather() {
    lastState = { ...lastState, loading: true, error: "" };
    renderPanel(true);
    try {
      const weather = await fetchWeather(selectedCity);
      lastState = { loading: false, weather, error: "" };
    } catch (error) {
      lastState = { loading: false, weather: lastState.weather || {}, error: error.message || "weather error" };
    }
    renderPanel(true);
  }

  function bindPanel(panel) {
    const toggle = panel.querySelector('[data-live-action="toggle-city"]');
    if (toggle) {
      toggle.addEventListener("click", () => {
        panel.classList.toggle("is-choosing");
      });
    }

    panel.querySelectorAll("[data-city-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = cities.find((city) => city.id === button.getAttribute("data-city-id"));
        if (!next) return;
        saveCity(next);
        panel.classList.remove("is-choosing");
        updateWeather();
      });
    });
  }

  function renderPanel(force = false) {
    const existing = document.querySelector(".hems-live-energy");
    if (!isHomeVisible()) {
      removePanel();
      return;
    }

    const root = document.getElementById("root");
    const app = root && root.firstElementChild;
    if (!app) return;

    const panel = existing || document.createElement("section");
    const signature = JSON.stringify({
      city: selectedCity.id,
      loading: lastState.loading,
      weather: lastState.weather,
      choosing: existing && existing.classList.contains("is-choosing"),
      error: lastState.error
    });
    if (!force && existing && existing.dataset.signature === signature) return;

    const wasChoosing = existing && existing.classList.contains("is-choosing");
    panel.className = `hems-live-energy${lastState.loading ? " is-loading" : ""}${wasChoosing ? " is-choosing" : ""}`;
    panel.dataset.signature = signature;
    panel.innerHTML = renderTemplate();
    bindPanel(panel);

    const twin = document.querySelector(".hems-twin");
    if (existing && twin && twin.parentNode && twin.previousElementSibling !== panel) {
      twin.insertAdjacentElement("beforebegin", panel);
      return;
    }

    if (!existing) {
      const fixedNav = app.lastElementChild && getComputedStyle(app.lastElementChild).position === "fixed"
        ? app.lastElementChild
        : null;
      if (twin && twin.parentNode) {
        twin.insertAdjacentElement("beforebegin", panel);
      } else {
        const anchor = app.children[1] && app.children[1] !== fixedNav ? app.children[1] : app.firstElementChild;
        if (anchor && anchor.parentNode === app) anchor.insertAdjacentElement("afterend", panel);
        else app.insertBefore(panel, fixedNav || null);
      }
    }
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
    renderPanel(true);
    updateWeather();
    setInterval(updateWeather, refreshMs);
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
