/**
 * visual-polish.js — HEMS v2 视觉增强脚本
 * - 替换残留 emoji 为 SVG 图标
 * - 设备页按钮悬停显示（桌面端）
 * - 空状态友好提示
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const stroke = 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"';

  // 额外 emoji → SVG 映射（icon-polish.js 未覆盖的）
  const extraIcons = {
    "⏰": `<circle ${stroke} cx="12" cy="12" r="9"/><path ${stroke} d="M12 7v5l3 3"/><path ${stroke} d="M10 2h4M12 2v3"/>`,
    "🔋": `<rect ${stroke} x="6" y="7" width="12" height="10" rx="2"/><path ${stroke} d="M9 21h6M11 4h2v3h-2z"/><path ${stroke} d="M10 11h4M10 14h2"/>`,
    "📉": `<path ${stroke} d="M4 19h16M5 16l4-4 3 3 6-8"/><path ${stroke} d="M15 7h3v3"/>`,
    "📊": `<rect ${stroke} x="4" y="3" width="16" height="18" rx="2"/><path ${stroke} d="M8 16V10M12 16V7M16 16V12"/>`,
    "🚿": `<path ${stroke} d="M4 14l4-4 4 4"/><path ${stroke} d="M8 10V4"/><path ${stroke} d="M16 4v16"/><path ${stroke} d="M16 20h4"/><path ${stroke} d="M16 16h4"/><path ${stroke} d="M16 12h4"/><path ${stroke} d="M16 8h4"/>`,
  };

  const tokens = Object.keys(extraIcons).sort((a, b) => b.length - a.length);

  function buildIcon(token) {
    const span = document.createElement("span");
    span.className = "hems-line-icon";
    span.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.innerHTML = extraIcons[token];
    span.appendChild(svg);
    return span;
  }

  function replaceTextNode(node) {
    const text = node.nodeValue;
    if (!tokens.some((t) => text.includes(t))) return;
    const fragment = document.createDocumentFragment();
    let buffer = "";
    let index = 0;
    while (index < text.length) {
      let matched = false;
      for (const token of tokens) {
        if (text.startsWith(token, index)) {
          if (buffer) {
            fragment.appendChild(document.createTextNode(buffer));
            buffer = "";
          }
          fragment.appendChild(buildIcon(token));
          index += token.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        buffer += text[index];
        index += 1;
      }
    }
    if (buffer) fragment.appendChild(document.createTextNode(buffer));
    node.parentNode.replaceChild(fragment, node);
  }

  function polishEmojis(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.closest && root.closest("script,style,svg,.hems-line-icon")) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,svg,.hems-line-icon")) return NodeFilter.FILTER_REJECT;
        return tokens.some((t) => node.nodeValue.includes(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  /**
   * 设备页按钮优化：桌面端默认隐藏操作按钮，hover 时显示
   */
  function polishDevicePage() {
    const mq = window.matchMedia("(min-width: 900px)");
    if (!mq.matches) return;

    const root = document.getElementById("root");
    if (!root) return;
    const text = root.innerText || "";

    // 检测是否在设备管理页
    if (!text.includes("设备管理") && !text.includes("添加设备")) return;

    // 找到所有设备行
    const allDivs = root.querySelectorAll("div");
    allDivs.forEach((div) => {
      const style = div.getAttribute("style") || "";
      // 设备行特征：flex + space-between + padding: 6px
      if (style.includes("display: flex") &&
          style.includes("align-items: center") &&
          style.includes("justify-content: space-between") &&
          style.includes("padding: 6px")) {
        div.classList.add("hems-device-row");
        // 找到该行内的停止/移除按钮
        const buttons = div.querySelectorAll("button");
        buttons.forEach((btn) => {
          const btnText = btn.innerText || "";
          if (btnText === "停止" || btnText === "移除") {
            btn.classList.add("hems-device-action-btn");
          }
        });
      }
    });
  }

  /**
   * 空状态增强
   */
  function polishEmptyStates() {
    const root = document.getElementById("root");
    if (!root) return;
    const text = root.innerText || "";

    // 日志页空状态
    if (text.includes("决策日志") && !text.includes("条记录")) {
      const logContainer = root.querySelector('[style*="font-size: 13px"]');
      // 不做侵入性修改，保持原样
    }
  }

  /**
   * 柱状图透明度修复（JS 方式，更精确）
   * 将当前时段的柱子 opacity 设为 1
   */
  function fixBarOpacity() {
    const root = document.getElementById("root");
    if (!root) return;

    // 找到包含 ▼ 指示器的柱子（当前时段）
    const indicator = root.querySelector('[style*="position: absolute"][style*="font-size: 7px"]');
    if (!indicator) return;

    const currentBar = indicator.closest('div[style*="flex: 1"]');
    if (currentBar) {
      currentBar.style.opacity = "1";
      currentBar.style.boxShadow = "0 -2px 8px rgba(10, 132, 255, 0.15)";
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      const root = document.getElementById("root");
      if (root) {
        polishEmojis(root);
        polishDevicePage();
        fixBarOpacity();
      }
    });
  }

  let scheduled = false;

  function start() {
    schedule();
    const root = document.getElementById("root");
    if (!root) return;
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            replaceTextNode(node);
          } else {
            polishEmojis(node);
          }
        });
      }
      schedule();
    }).observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
