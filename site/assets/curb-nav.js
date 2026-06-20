/* Injects the one canonical header on every page + smooth page fade + dark/light toggle. */
(function () {
  var NAV = [
    { key: "command", label: "Command Center", href: "index.html" },
    { key: "map", label: "Map", href: "map.html" },
    { key: "priorities", label: "Priorities", href: "priorities.html" },
    { key: "trends", label: "Trends", href: "trends.html" },
    { key: "offenders", label: "Offenders", href: "offenders.html" },
    { key: "assistant", label: "Assistant", href: "assistant.html" },
    { key: "methodology", label: "Methodology", href: "methodology.html" },
  ];

  /* ---- theme helpers ---- */
  var STORAGE_KEY = "curb-theme";

  function currentTheme() {
    return localStorage.getItem(STORAGE_KEY) || "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    // Update every toggle button icon already in the DOM
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      btn.textContent = theme === "dark" ? "light_mode" : "dark_mode";
    });
    // Let the map page (or anything else) react
    document.dispatchEvent(new CustomEvent("curb:theme", { detail: { theme: theme } }));
  }

  function toggleTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Apply saved preference immediately (before render) to avoid flash
  applyTheme(currentTheme());

  function build() {
    var page = document.body.dataset.page || "command";
    var current = NAV.filter(function (n) { return n.key === page; })[0] || NAV[0];
    var theme = currentTheme();

    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '" data-nav="' + n.key + '" class="' +
        (n.key === page ? "active" : "") + '">' + n.label + "</a>";
    }).join("");

    var html =
      '<header class="curb-head">' +
        '<div class="curb-brand">' +
          '<h1 class="curb-logo">C<span>U</span>RB</h1>' +
          '<div class="curb-sub">' +
            '<span class="oi">Operational Intelligence</span>' +
            '<span class="pg">' + current.label + "</span>" +
          "</div>" +
        "</div>" +
        '<nav class="curb-nav">' + links + "</nav>" +
        '<div class="curb-sys">' +
          '<span class="material-symbols-outlined theme-toggle" id="themeToggle" title="' +
            (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") + '">' +
            (theme === "dark" ? "light_mode" : "dark_mode") +
          "</span>" +
          '<span class="material-symbols-outlined" title="Alerts">notifications</span>' +
          '<span class="material-symbols-outlined" title="Operator">account_circle</span>' +
        "</div>" +
      "</header>";

    var mount = document.getElementById("curb-header");
    if (mount) mount.outerHTML = html;
    else document.body.insertAdjacentHTML("afterbegin", html);

    // Wire up the toggle
    var btn = document.getElementById("themeToggle");
    if (btn) btn.addEventListener("click", toggleTheme);

    // expose exact header height so fixed/sticky offsets are pixel-correct
    function setH() {
      var h = document.querySelector("header.curb-head");
      if (h) document.documentElement.style.setProperty("--head-h", h.offsetHeight + "px");
    }
    setH();
    window.addEventListener("resize", setH);

    // smooth fade between pages
    document.querySelectorAll("nav.curb-nav a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        if (a.classList.contains("active")) return;
        e.preventDefault();
        document.body.classList.remove("curb-ready");
        setTimeout(function () { window.location.href = a.getAttribute("href"); }, 220);
      });
    });
  }

  function ready() {
    build();
    requestAnimationFrame(function () { document.body.classList.add("curb-ready"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
