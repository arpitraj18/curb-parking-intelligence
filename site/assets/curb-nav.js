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

    // Inject global ambient mouse glow
    if (!document.querySelector(".ambient-mouse-glow")) {
      var glow = document.createElement("div");
      glow.className = "ambient-mouse-glow";
      document.body.appendChild(glow);
      var ticking = false;
      document.addEventListener("mousemove", function (e) {
        if (!ticking) {
          window.requestAnimationFrame(function () {
            glow.style.transform = "translate(" + e.clientX + "px, " + e.clientY + "px)";
            ticking = false;
          });
          ticking = true;
        }
      });
    }

    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '" data-nav="' + n.key + '" class="' +
        (n.key === page ? "active" : "") + '">' + n.label + "</a>";
    }).join("");

    var html =
      '<header class="curb-head">' +
      '<div class="header-dots"></div>' +
      '<div class="curb-brand">' +
      '<h1 class="curb-logo">C<span>U</span>RB</h1>' +
      '<div class="curb-sub">' +
      '<span class="oi">Operational Intelligence</span>' +
      '<span class="pg">' + current.label + "</span>" +
      "</div>" +
      "</div>" +
      '<nav class="curb-nav">' + links + "</nav>" +
      '<div class="curb-sys">' +
      '<span class="material-symbols-outlined hamburger" id="hamburger">menu</span>' +
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

    // Wire up header dot grid mouse tracking
    var headEl = document.querySelector("header.curb-head");
    if (headEl) {
      headEl.addEventListener("mousemove", function (e) {
        var rect = headEl.getBoundingClientRect();
        headEl.style.setProperty("--hx", (e.clientX - rect.left) + "px");
        headEl.style.setProperty("--hy", (e.clientY - rect.top) + "px");
      });
      headEl.addEventListener("mouseleave", function () {
        headEl.style.setProperty("--hx", "-200px");
        headEl.style.setProperty("--hy", "-200px");
      });
    }

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

    // ---- mobile nav ----
    if (!document.getElementById("mobileNav")) {
      var mobileNav = document.createElement("div");
      mobileNav.className = "mobile-nav";
      mobileNav.id = "mobileNav";
      mobileNav.innerHTML =
        '<div class="mobile-nav-panel">' +
        '<div class="mobile-nav-header">' +
        '<span class="curb-logo" style="font-size:20px;line-height:1">C<span>U</span>RB</span>' +
        '<span class="material-symbols-outlined mobile-close" id="closeNav">close</span>' +
        "</div>" +
        '<div class="mobile-nav-links">' +
        NAV.map(function (n) {
          return '<a href="' + n.href + '" data-nav="' + n.key + '" class="' + (n.key === page ? "active" : "") + '">' +
            n.label + "</a>";
        }).join("") +
        "</div>" +
        "</div>";
      document.body.appendChild(mobileNav);
    }

    var hamburger = document.getElementById("hamburger");
    var mobileNavEl = document.getElementById("mobileNav");
    var closeNav = document.getElementById("closeNav");

    function openMobileNav() {
      mobileNavEl.classList.add("open");
      document.body.classList.add("nav-open");
    }

    function closeMobileNav() {
      mobileNavEl.classList.remove("open");
      document.body.classList.remove("nav-open");
    }

    if (hamburger) hamburger.addEventListener("click", openMobileNav);
    if (closeNav) closeNav.addEventListener("click", closeMobileNav);

    // close on backdrop click
    if (mobileNavEl) {
      mobileNavEl.addEventListener("click", function (e) {
        if (e.target === this) closeMobileNav();
      });
    }

    // mobile nav link clicks — close nav then navigate with fade
    document.querySelectorAll("#mobileNav .mobile-nav-links a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        closeMobileNav();
        document.body.classList.remove("curb-ready");
        setTimeout(function () { window.location.href = a.getAttribute("href"); }, 250);
      });
    });
  }

  /* ---- intro splash (self-contained, additive overlay; shown once per visit) ----
     Lives entirely here so curb.css and the page HTML are untouched. It sits ABOVE
     the page, fades out, and removes itself. Uses your theme vars + Geist font, so
     it matches dark/light automatically. Edit the `quotes` array to use your own. */
  function splash() {
    var quotes = [
      "Every blocked kerb is a street deciding to stop moving.",
      "Congestion isn't chaos \u2014 it's a pattern waiting to be read.",
      "The street tells you where it hurts. CURB listens.",
      "Order the kerb, and the road follows."
    ];

    // shown once per browser session; delete these 3 lines to show on every load
    var seen = false;
    try { seen = sessionStorage.getItem("curb_splash") === "1"; } catch (e) { }
    if (seen) return;
    try { sessionStorage.setItem("curb_splash", "1"); } catch (e) { }

    if (!document.getElementById("curb-splash-style")) {
      var st = document.createElement("style");
      st.id = "curb-splash-style";
      st.textContent =
        '#curb-splash{position:fixed;inset:0;z-index:5000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);background-image:radial-gradient(circle at 50% 44%, rgba(46,37,23,.7), transparent 60%);transition:opacity .6s var(--ease)}' +
        '[data-theme="light"] #curb-splash{background-image:radial-gradient(circle at 50% 44%, rgba(180,165,145,.3), transparent 60%)}' +
        '#curb-splash.done{opacity:0;pointer-events:none}' +
        '#curb-splash .sp-logo{font-family:"Geist",sans-serif;font-weight:800;font-size:62px;letter-spacing:.18em;text-transform:uppercase;color:var(--text);opacity:0;animation:spIn .9s var(--ease) .15s forwards}' +
        '#curb-splash .sp-logo span{color:var(--amber-strong)}' +
        '#curb-splash .sp-tag{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.34em;text-transform:uppercase;color:var(--amber);margin-top:12px;opacity:0;animation:spIn .8s var(--ease) .5s forwards}' +
        '#curb-splash .sp-line{height:2px;width:0;background:var(--amber-strong);margin:24px 0;animation:spLine 1.1s var(--ease) .55s forwards}' +
        '#curb-splash .sp-quote{font-family:"Geist",sans-serif;font-style:italic;font-size:15px;color:var(--muted);max-width:440px;text-align:center;line-height:1.6;opacity:0;animation:spIn 1s var(--ease) .95s forwards}' +
        '@keyframes spIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
        '@keyframes spLine{from{width:0}to{width:210px}}' +
        '@media (prefers-reduced-motion:reduce){#curb-splash .sp-logo,#curb-splash .sp-tag,#curb-splash .sp-quote{opacity:1;animation:none}#curb-splash .sp-line{width:210px;animation:none}}';
      document.head.appendChild(st);
    }

    var q = quotes[Math.floor(Math.random() * quotes.length)];
    var el = document.createElement("div");
    el.id = "curb-splash";
    el.innerHTML =
      '<div class="sp-logo">C<span>U</span>RB</div>' +
      '<div class="sp-tag">Operational Intelligence</div>' +
      '<div class="sp-line"></div>' +
      '<div class="sp-quote">\u201C' + q + '\u201D</div>';
    document.body.appendChild(el);

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    setTimeout(function () {
      el.classList.add("done");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 650);
    }, reduce ? 1100 : 2600);
  }

  function ready() {
    splash();
    build();
    requestAnimationFrame(function () { document.body.classList.add("curb-ready"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();