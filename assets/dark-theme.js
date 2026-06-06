/**
 * dark-theme.js — HEMS v2 深色主题切换与增强
 * - 自动检测系统深色模式偏好
 * - 主题切换按钮（固定右上角）
 * - 数字计数动画（深色+浅色均生效）
 * - 实时数据脉冲效果（仅深色模式）
 * - 卡片入场动画（深色+浅色均生效）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "hems-dark-mode";

  /* ---------- 1. Theme Toggle ---------- */
  function isDark() {
    return document.documentElement.classList.contains("hems-dark");
  }

  function setDark(on) {
    if (on) {
      document.documentElement.classList.add("hems-dark");
    } else {
      document.documentElement.classList.remove("hems-dark");
    }
    try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch (e) {}
    updateToggleUI();
  }

  function toggle() {
    setDark(!isDark());
  }

  function updateToggleUI() {
    var btn = document.querySelector(".hems-theme-toggle");
    if (!btn) return;
    var dark = isDark();
    btn.innerHTML = dark
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> 浅色模式'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> 深色模式';
  }

  function injectToggle() {
    if (document.querySelector(".hems-theme-toggle")) return;
    var btn = document.createElement("button");
    btn.className = "hems-theme-toggle";
    btn.type = "button";
    btn.addEventListener("click", toggle);
    document.body.appendChild(btn);
    updateToggleUI();
  }

  /* ---------- 2. Init Theme ---------- */
  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}

    if (stored === "1") {
      setDark(true);
    } else if (stored === "0") {
      setDark(false);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDark(true);
    }

    injectToggle();
  }

  /* ---------- 3. Number Counting Animation (both themes) ---------- */
  var animatedSet = new WeakSet();

  function animateNumbers() {
    var root = document.getElementById("root");
    if (!root) return;

    var candidates = root.querySelectorAll('[style*="font-size: 22px"][style*="font-weight: 700"]');
    candidates.forEach(function (el) {
      if (animatedSet.has(el)) return;
      animatedSet.add(el);

      var text = el.textContent || "";
      var match = text.match(/^([\d.]+)/);
      if (!match) return;

      var target = parseFloat(match[1]);
      var suffix = text.substring(match[1].length);
      var duration = 800;
      var start = performance.now();

      function step(now) {
        var elapsed = now - start;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = (target * eased).toFixed(target % 1 === 0 ? 0 : 2);
        el.textContent = current + suffix;
        if (progress < 1) requestAnimationFrame(step);
      }

      el.textContent = "0" + suffix;
      requestAnimationFrame(step);
    });
  }

  /* ---------- 4. Pulse Effect (dark mode only) ---------- */
  var pulseSet = new WeakSet();

  function addPulseEffects() {
    if (!isDark()) return;

    var root = document.getElementById("root");
    if (!root) return;

    var firstKpi = root.querySelector('[style*="font-size: 22px"][style*="font-weight: 700"][style*="color"]');
    if (firstKpi && !pulseSet.has(firstKpi)) {
      pulseSet.add(firstKpi);
      firstKpi.style.animation = "dt-glow-breathe 3s ease-in-out infinite";
    }
  }

  /* ---------- 5. Card Entrance Animation (both themes) ---------- */
  // 追踪每个面板的上一次可见状态，只有 hidden→visible 才触发动画
  var panelVisibility = new WeakMap();

  function animateEntrance() {
    var root = document.getElementById("root");
    if (!root) return;

    var panels = root.querySelectorAll('.hems-desktop-panel');

    panels.forEach(function (panel, index) {
      var cs = getComputedStyle(panel);
      var isVisible = cs.display !== 'none' && cs.visibility !== 'hidden';
      var wasVisible = panelVisibility.get(panel);

      // 只有从隐藏变为可见，或者首次出现时才动画
      if (isVisible && wasVisible !== true) {
        panelVisibility.set(panel, true);

        // 移除可能残留的动画 class
        panel.classList.remove('hems-panel-animate', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8');

        // 强制 reflow 确保浏览器清除了之前的动画状态
        void panel.offsetHeight;

        // 添加动画 class（使用 @keyframes，不需要管理 transition 起点/终点）
        var delayClass = 'd' + Math.min(index + 1, 8);
        panel.classList.add('hems-panel-animate', delayClass);

        // 动画结束后清理 class（避免影响后续交互）
        setTimeout(function () {
          panel.classList.remove('hems-panel-animate', delayClass);
        }, 600);
      } else if (!isVisible && wasVisible === true) {
        // 面板被隐藏，标记为不可见，清理动画 class
        panelVisibility.set(panel, false);
        panel.classList.remove('hems-panel-animate', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8');
      }
    });
  }

  /* ---------- 6. Observe DOM Changes ---------- */
  function startObserver() {
    var root = document.getElementById("root");
    if (!root) return;

    var timer = null;
    var observer = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        animateNumbers();
        addPulseEffects();
        // 注意：animateEntrance 改由 hems-layout-applied 事件触发
        // 避免与 desktop-layout.js 的 class 清理冲突
      }, 150);
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  /* ---------- 7. Boot ---------- */
  function boot() {
    initTheme();

    function runAnimations() {
      // Small delay to let React finish rendering
      setTimeout(function () {
        animateNumbers();
        addPulseEffects();
        animateEntrance();
        startObserver();
      }, 400);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runAnimations, { once: true });
    } else {
      runAnimations();
    }

    // 监听 desktop-layout.js 布局完成事件，触发动画
    window.addEventListener('hems-layout-applied', function () {
      // 延迟一小段时间让浏览器完成 class 应用和样式计算
      setTimeout(function () {
        animateEntrance();
      }, 50);
    });
  }

  boot();
})();
