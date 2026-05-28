(function () {
  const NS = "http://www.w3.org/2000/svg";
  const stroke = 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const fill = 'fill="currentColor"';

  const icons = {
    "🏠": `<path ${stroke} d="M3.5 10.5 12 3l8.5 7.5"/><path ${stroke} d="M5.5 9.5V20h13V9.5"/><path ${stroke} d="M10 20v-6h4v6"/>`,
    "📱": `<rect ${stroke} x="7" y="3" width="10" height="18" rx="2.4"/><path ${stroke} d="M10.5 6h3M11.5 18h1"/>`,
    "📅": `<rect ${stroke} x="4" y="5.5" width="16" height="14" rx="2"/><path ${stroke} d="M8 3.5v4M16 3.5v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>`,
    "🌡️": `<path ${stroke} d="M10 14.2V5.5a2 2 0 1 1 4 0v8.7a4 4 0 1 1-4 0Z"/><path ${stroke} d="M12 9v6"/>`,
    "🔌": `<path ${stroke} d="M9 3v6M15 3v6M7 9h10v3a5 5 0 0 1-10 0V9Z"/><path ${stroke} d="M12 17v4"/>`,
    "📋": `<rect ${stroke} x="6" y="5" width="12" height="16" rx="2"/><path ${stroke} d="M9 5.5A3 3 0 0 1 12 3a3 3 0 0 1 3 2.5M9 10h6M9 14h6M9 18h4"/>`,
    "❄️": `<path ${stroke} d="M12 3v18M5.5 6.5l13 11M18.5 6.5l-13 11M8 3.8l4 3.2 4-3.2M8 20.2l4-3.2 4 3.2"/>`,
    "🔥": `<path ${stroke} d="M12 21c-3.3 0-5.8-2.2-5.8-5.4 0-2 1.1-3.7 2.7-5.1 1.6-1.4 2.4-3.1 2.2-5.5 2.6 1.5 4.8 4 4.4 7 .9-.8 1.5-1.8 1.8-3 1.2 1.3 2.1 3.2 2.1 5.3C19.4 18.2 16.2 21 12 21Z"/>`,
    "🌀": `<path ${stroke} d="M19 12a7 7 0 1 1-4.2-6.4c2.8 1.4 3 5.4.5 7-2.1 1.4-5.4.4-5.2-2.1.2-2.1 3.1-2.5 4.1-1"/>`,
    "🍽️": `<path ${stroke} d="M7 3v8M4.5 3v8M9.5 3v8M4.5 11h5M7 11v10M16 3c2 1.7 3 4 3 7 0 2-1.2 3.5-3 3.5V21"/>`,
    "💡": `<path ${stroke} d="M9 18h6M10 21h4M8 10a4 4 0 1 1 8 0c0 1.8-1 2.8-2 4-.6.7-.8 1.2-.8 2h-2.4c0-.8-.2-1.3-.8-2-1-1.2-2-2.2-2-4Z"/>`,
    "🧊": `<path ${stroke} d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path ${stroke} d="M5 7l7 4 7-4M12 11v10M8.5 5l7 4"/>`,
    "🤖": `<rect ${stroke} x="5" y="8" width="14" height="10" rx="2"/><path ${stroke} d="M12 8V4M9 4h6M9 13h.01M15 13h.01M10 17h4M3 12h2M19 12h2"/>`,
    "💨": `<path ${stroke} d="M4 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M5 18h6"/>`,
    "📺": `<rect ${stroke} x="4" y="6" width="16" height="11" rx="2"/><path ${stroke} d="M9 21h6M12 17v4M9 3l3 3 3-3"/>`,
    "🌬️": `<path ${stroke} d="M4 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M7 19h5"/>`,
    "⚡": `<path ${stroke} d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/>`,
    "🌱": `<path ${stroke} d="M12 21V11M12 11C8 11 5 8.5 5 5c4 0 7 2.5 7 6ZM12 13c4 0 7-2.5 7-6-4 0-7 2.5-7 6Z"/>`,
    "⚠️": `<path ${stroke} d="M12 4 3.5 19h17L12 4Z"/><path ${stroke} d="M12 9v5M12 17h.01"/>`,
    "📈": `<path ${stroke} d="M4 19h16M5 16l4-4 3 3 6-8"/><path ${stroke} d="M15 7h3v3"/>`,
    "🏗️": `<path ${stroke} d="M4 20h16M6 20V8l6-4 6 4v12M6 8h12M9 20v-8h6v8M12 4v4"/>`,
    "💰": `<path ${stroke} d="M9 7c-1.5-1.8-.7-3.5 3-3.5s4.5 1.7 3 3.5"/><path ${stroke} d="M7 10c-1.8 2.8-3 8 5 8s6.8-5.2 5-8c-1.2-1.8-3-3-5-3s-3.8 1.2-5 3Z"/><path ${stroke} d="M12 10v5M10.2 11.2c.5-.5 3.4-.7 3.6.8.2 1.6-3.7 1-3.5 2.4.2 1.3 2.8 1.1 3.5.4"/>`,
    "🛋️": `<path ${stroke} d="M6 13V9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4"/><path ${stroke} d="M5 12h14a2 2 0 0 1 2 2v4H3v-4a2 2 0 0 1 2-2Z"/><path ${stroke} d="M6 18v2M18 18v2"/>`,
    "🥶": `<circle ${stroke} cx="12" cy="12" r="8"/><path ${stroke} d="M9 10h.01M15 10h.01M8.5 15h7M8 3l1.8 3M16 3l-1.8 3"/>`,
    "😊": `<circle ${stroke} cx="12" cy="12" r="8"/><path ${stroke} d="M9 10h.01M15 10h.01M8.5 14.5c1.8 2 5.2 2 7 0"/>`,
    "🥵": `<circle ${stroke} cx="12" cy="12" r="8"/><path ${stroke} d="M9 10h.01M15 10h.01M8.5 16c1.8-1.2 5.2-1.2 7 0M17 4l1.8-1.8M20 7h2"/>`,
    "🚗": `<path ${stroke} d="M5 14l2-5h10l2 5M6 14h12a2 2 0 0 1 2 2v3h-3M7 19H4v-3a2 2 0 0 1 2-2M8 19h8M7.5 16.5h.01M16.5 16.5h.01"/>`,
    "✅": `<circle ${stroke} cx="12" cy="12" r="8"/><path ${stroke} d="m8.5 12.3 2.2 2.2 4.8-5"/>`,
    "✕": `<path ${stroke} d="M7 7l10 10M17 7 7 17"/>`
  };

  const tokens = Object.keys(icons).sort((a, b) => b.length - a.length);

  function buildIcon(token) {
    const span = document.createElement("span");
    span.className = "hems-line-icon";
    span.setAttribute("aria-hidden", "true");

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.innerHTML = icons[token];
    span.appendChild(svg);
    return span;
  }

  function matchAt(text, index) {
    for (const token of tokens) {
      if (text.startsWith(token, index)) return token;
    }
    return null;
  }

  function replaceTextNode(node) {
    const text = node.nodeValue;
    if (!tokens.some((token) => text.includes(token))) return;

    const fragment = document.createDocumentFragment();
    let buffer = "";
    let index = 0;

    while (index < text.length) {
      const token = matchAt(text, index);
      if (token) {
        if (buffer) {
          fragment.appendChild(document.createTextNode(buffer));
          buffer = "";
        }
        fragment.appendChild(buildIcon(token));
        index += token.length;
      } else {
        buffer += text[index];
        index += 1;
      }
    }

    if (buffer) fragment.appendChild(document.createTextNode(buffer));
    node.parentNode.replaceChild(fragment, node);
  }

  function polish(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.closest && root.closest("script,style,svg,.hems-line-icon")) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest("script,style,svg,.hems-line-icon")) {
          return NodeFilter.FILTER_REJECT;
        }
        return tokens.some((token) => node.nodeValue.includes(token))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(replaceTextNode);
  }

  function start() {
    const root = document.getElementById("root");
    if (!root) return;

    polish(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            replaceTextNode(node);
          } else {
            polish(node);
          }
        });
      }
    });

    observer.observe(root, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
