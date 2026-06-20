/* Shared helpers used across CURB pages. Assumes window.CURB (curb-data.js). */
window.CURBX = (function () {
  var CAUSE = {
    "Commuter overflow": "var(--c-commuter)",
    "Delivery overflow": "var(--c-delivery)",
    "Hire / transit demand": "var(--c-hire)",
    "Safety risk": "var(--c-safety)",
    "Structural demand": "var(--c-structural)",
    "Enforcement priority": "var(--c-enforcement)",
  };
  var CAUSE_HEX = {
    "Commuter overflow": "#5AA0E6",
    "Delivery overflow": "#F0A93B",
    "Hire / transit demand": "#B08AF0",
    "Safety risk": "#E5564B",
    "Structural demand": "#46C08A",
    "Enforcement priority": "#B6A892",
  };
  function causeVar(c) { return CAUSE[c] || "var(--dim)"; }
  function causeHex(c) { return CAUSE_HEX[c] || "#9D8F7C"; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m];
    });
  }
  function cleanName(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function nfmt(n) { return Number(n).toLocaleString(); }

  // hotspot card element (used in watchlist, dispatch rail, assistant)
  function card(h, onClick) {
    var el = document.createElement("div");
    el.className = "hcard";
    el.style.setProperty("--cc", causeVar(h.root_cause));
    el.innerHTML =
      '<div class="rk">' + h.rank + "</div>" +
      "<div>" +
        '<div class="nm">' + esc(cleanName(h.name)) + "</div>" +
        '<div class="cause">' + esc(h.root_cause) + "</div>" +
        '<div class="fix">\u2192 ' + esc(h.recommended_fix) + "</div>" +
        (h.deploy_note ? '<div class="note">' + esc(h.deploy_note) + "</div>" : "") +
        '<span class="pill ' + h.persistence_tier + '">' + h.persistence_tier +
          " \u00b7 " + h.recurrence_days + "/" + h.window_days + "d</span>" +
      "</div>" +
      "<div>" +
        '<div class="idx">' + Math.round(h.congestion_impact_index) + "</div>" +
        '<div class="idxk">impact</div>' +
      "</div>";
    if (onClick) el.addEventListener("click", function () { onClick(h); });
    return el;
  }

  // deterministic NL query for the assistant (data-grounded)
  function query(q) {
    var hs = (window.CURB && window.CURB.hotspots) || [];
    var s = q.toLowerCase();
    var pool = hs.slice();
    var causeMap = {
      delivery: "Delivery overflow", safety: "Safety risk", commuter: "Commuter overflow",
      hire: "Hire / transit demand", auto: "Hire / transit demand", transit: "Hire / transit demand",
      structural: "Structural demand", enforce: "Enforcement priority",
    };
    Object.keys(causeMap).forEach(function (k) {
      if (s.indexOf(k) >= 0) pool = pool.filter(function (h) { return h.root_cause === causeMap[k]; });
    });
    ["chronic", "frequent", "occasional"].forEach(function (t) {
      if (s.indexOf(t) >= 0) pool = pool.filter(function (h) { return (h.persistence_tier || "").toLowerCase() === t; });
    });
    if (s.indexOf("emerging") >= 0) pool = pool.filter(function (h) { return h.trend === "Emerging"; });
    if (s.indexOf("habitual") >= 0) pool = pool.filter(function (h) { return h.recidivism === "Habitual"; });
    var area = s.match(/(?:near|in|around|at)\s+([a-z0-9 .]+)/);
    if (area) {
      var a = area[1].trim().split(/\s+(top|worst|spots?|hotspots?)\b/)[0].trim();
      if (a.length > 2) {
        var f = pool.filter(function (h) { return (h.name || "").toLowerCase().indexOf(a) >= 0; });
        if (f.length) pool = f;
      }
    }
    var mN = s.match(/\b(\d{1,2})\b/);
    var n = mN ? Math.min(parseInt(mN[1], 10), 10) : 5;
    return pool.slice(0, n);
  }

  return { CAUSE: CAUSE, causeVar: causeVar, causeHex: causeHex, esc: esc,
           cleanName: cleanName, nfmt: nfmt, card: card, query: query };
})();
