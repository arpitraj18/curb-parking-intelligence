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

  // honest "why this cause" explanations (cause is derived from vehicle footprint)
  var WHY = {
    "Commuter overflow": "Two-wheeler\u2013heavy mix \u2014 commuters parking for the workday rather than short stops.",
    "Delivery overflow": "Elevated goods-vehicle share \u2014 kerbside loading and unloading.",
    "Hire / transit demand": "Autos and cabs dominate \u2014 pick-up / drop-off demand with nowhere to wait.",
    "Safety risk": "Violations at a safety-critical location \u2014 crossing, school, bus stop or footpath.",
    "Structural demand": "High volume across all vehicle types \u2014 the kerb here is simply undersupplied.",
    "Enforcement priority": "High, recurring volume without a single dominant vehicle type."
  };

  function ensureStyle(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement("style"); s.id = id; s.textContent = css; document.head.appendChild(s);
  }

  // ---- shared hotspot detail drawer ----
  function detail(h) {
    if (!h) return;
    ensureStyle("curb-detail-style",
      '#curb-detail-ov{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.5);opacity:0;transition:opacity .25s var(--ease);display:flex;justify-content:flex-end}' +
      '#curb-detail-ov.show{opacity:1}' +
      '#curb-detail-ov .cd-panel{position:relative;width:440px;max-width:92vw;height:100%;background:var(--surface);border-left:1px solid var(--hairline);box-shadow:-10px 0 40px rgba(0,0,0,.4);transform:translateX(100%);transition:transform .28s var(--ease);overflow-y:auto;padding:14px 22px 20px;font-family:"Geist",sans-serif}' +
      '#curb-detail-ov.show .cd-panel{transform:none}' +
      '#curb-detail-ov .cd-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
      '#curb-detail-ov .cd-flag{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#2a1c00;background:var(--amber-strong);padding:3px 8px;font-weight:600}' +
      '#curb-detail-ov .cd-x{cursor:pointer;color:var(--dim);margin-left:auto;font-size:26px;line-height:1}' +
      '#curb-detail-ov .cd-x:hover{color:var(--text)}' +
      '#curb-detail-ov .cd-rank{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.1em;color:var(--dim)}' +
      '#curb-detail-ov .cd-name{font-size:19px;font-weight:700;line-height:1.15;margin:2px 0 4px}' +
      '#curb-detail-ov .cd-cause{font-size:13px;font-weight:600}' +
      '#curb-detail-ov .cd-why{font-size:11.5px;color:var(--muted);line-height:1.4;margin:5px 0 9px}' +
      '#curb-detail-ov .cd-impactnum{font-family:"JetBrains Mono",monospace;font-size:26px;font-weight:500;line-height:1}' +
      '#curb-detail-ov .cd-impactnum span{font-size:15px;color:var(--muted)}' +
      '#curb-detail-ov .cd-impactbar{height:6px;background:var(--raised2);margin:6px 0 4px;border-radius:3px;overflow:hidden}' +
      '#curb-detail-ov .cd-impactbar span{display:block;height:100%}' +
      '#curb-detail-ov .cd-k{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}' +
      '#curb-detail-ov .cd-grid{border-top:1px solid var(--hairline-soft);margin:10px 0}' +
      '#curb-detail-ov .cd-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--hairline-soft)}' +
      '#curb-detail-ov .cd-row .cd-v{font-family:"JetBrains Mono",monospace;font-size:12px;text-align:right}' +
      '#curb-detail-ov .cd-action{background:var(--raised);border:1px solid var(--hairline-soft);border-left:3px solid var(--amber-strong);border-radius:6px;padding:10px 13px;margin-bottom:12px}' +
      '#curb-detail-ov .cd-fix{font-size:14px;font-weight:600;color:var(--amber);margin-top:4px}' +
      '#curb-detail-ov .cd-note{font-size:11.5px;color:var(--muted);font-style:italic;margin-top:5px}' +
      '#curb-detail-ov .cd-btn{width:100%;padding:10px;border:none;border-radius:8px;background:linear-gradient(180deg,var(--amber) 0%,var(--amber-strong) 100%);color:#1F1500;font-weight:600;font-size:13px;cursor:pointer;font-family:"Geist",sans-serif}');

    var hex = causeHex(h.root_cause);
    var arrow = h.trend === "Emerging" ? "\u25B2" : h.trend === "Cooling" ? "\u25BC" : "\u2013";
    function row(k, v) { return '<div class="cd-row"><span class="cd-k">' + k + '</span><span class="cd-v">' + v + '</span></div>'; }
    var ov = document.createElement("div"); ov.id = "curb-detail-ov";
    ov.innerHTML =
      '<div class="cd-panel">' +
      '<div class="cd-top">' + (h.high_conviction ? '<span class="cd-flag">High-conviction</span>' : '') +
      '<span class="cd-x" id="cdX">\u00D7</span></div>' +
      '<div class="cd-rank">RANK #' + h.rank + '</div>' +
      '<div class="cd-name">' + esc(cleanName(h.name)) + '</div>' +
      '<div class="cd-cause" style="color:' + hex + '">' + esc(h.root_cause) + '</div>' +
      '<div class="cd-why">' + esc(WHY[h.root_cause] || "") + '</div>' +
      '<div class="cd-impactnum">' + Math.round(h.congestion_impact_index) + '<span>/100</span></div>' +
      '<div class="cd-impactbar"><span style="width:' + Math.round(h.congestion_impact_index) + '%;background:' + hex + '"></span></div>' +
      '<div class="cd-k">Obstruction impact index</div>' +
      '<div class="cd-grid">' +
      row("Persistence", h.persistence_tier + " \u00b7 " + h.recurrence_days + "/" + h.window_days + " days") +
      row("Trend", arrow + " " + h.trend + (h.trend_rel_growth ? " (\u00d7" + h.trend_rel_growth + " vs city)" : "")) +
      row("Recidivism", h.recidivism + " \u00b7 " + Math.round((h.repeat_share || 0) * 100) + "% repeat") +
      row("Violations (window)", nfmt(h.violations)) +
      row("Suggested units", h.units_typical + " typical \u00b7 " + h.units_peak + " peak") +
      row("Cumulative coverage", "top " + h.rank + " \u2192 " + h.cumulative_coverage_pct + "% of impact") +
      '</div>' +
      '<div class="cd-action"><div class="cd-k">Recommended action</div>' +
      '<div class="cd-fix">' + esc(h.recommended_fix) + '</div>' +
      (h.deploy_note ? '<div class="cd-note">' + esc(h.deploy_note) + '</div>' : '') + '</div>' +
      '<button class="cd-btn" id="cdMap">Locate on map</button>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });
    function close() { ov.classList.remove("show"); document.removeEventListener("keydown", onKey); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 280); }
    function onKey(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector("#cdX").onclick = close;
    document.addEventListener("keydown", onKey);
    ov.querySelector("#cdMap").onclick = function () { document.body.classList.remove("curb-ready"); setTimeout(function () { location.href = "map.html?focus=" + h.rank; }, 200); };
  }

  // ---- narrowing funnel modal (13,782 -> 1) ----
  function funnel() {
    ensureStyle("curb-funnel-style",
      '#curb-funnel-ov{position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,.55);opacity:0;transition:opacity .25s var(--ease);display:flex;align-items:center;justify-content:center;padding:24px;font-family:"Geist",sans-serif}' +
      '#curb-funnel-ov.show{opacity:1}' +
      '#curb-funnel-ov .cf-modal{width:900px;max-width:96vw;max-height:88vh;background:var(--surface);border:1px solid var(--hairline);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;transform:translateY(14px);transition:transform .28s var(--ease)}' +
      '#curb-funnel-ov.show .cf-modal{transform:none}' +
      '#curb-funnel-ov .cf-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--hairline-soft)}' +
      '#curb-funnel-ov .cf-head h2{font-size:17px;font-weight:700;margin:0}' +
      '#curb-funnel-ov .cf-head .cf-sub{font-size:12px;color:var(--muted);margin-top:3px;max-width:560px;line-height:1.45}' +
      '#curb-funnel-ov .cf-x{cursor:pointer;color:var(--dim);font-size:26px;line-height:1;margin-left:14px}' +
      '#curb-funnel-ov .cf-x:hover{color:var(--text)}' +
      '#curb-funnel-ov .cf-body{display:flex;gap:20px;padding:18px 22px;min-height:0;overflow:hidden}' +
      '#curb-funnel-ov .cf-stages{flex:0 0 360px;display:flex;flex-direction:column;gap:8px}' +
      '#curb-funnel-ov .cf-stage{cursor:pointer;border:1px solid var(--hairline-soft);border-radius:8px;padding:9px 12px;background:var(--raised);transition:all .16s var(--ease);position:relative;overflow:hidden}' +
      '#curb-funnel-ov .cf-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(245,181,68,.18),rgba(245,181,68,.03));border-right:2px solid var(--amber-strong);pointer-events:none}' +
      '#curb-funnel-ov .cf-stage.act{border-color:var(--amber-strong);background:var(--raised2)}' +
      '#curb-funnel-ov .cf-stage .cf-n{font-family:"JetBrains Mono",monospace;font-size:21px;font-weight:500;position:relative}' +
      '#curb-funnel-ov .cf-stage .cf-l{font-size:12px;color:var(--text);position:relative;margin-top:1px}' +
      '#curb-funnel-ov .cf-stage .cf-s{font-size:10.5px;color:var(--dim);position:relative}' +
      '#curb-funnel-ov .cf-members{flex:1;min-width:0;display:flex;flex-direction:column}' +
      '#curb-funnel-ov .cf-mhead{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}' +
      '#curb-funnel-ov .cf-mlist{flex:1;overflow-y:auto;min-height:0}' +
      '#curb-funnel-ov .cf-m{display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:12px}' +
      '#curb-funnel-ov .cf-m:hover{background:var(--raised)}' +
      '#curb-funnel-ov .cf-m.hot{background:rgba(245,181,68,.14);outline:1px solid var(--amber-strong)}' +
      '#curb-funnel-ov .cf-m .cf-mr{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--dim)}' +
      '#curb-funnel-ov .cf-m.hot .cf-mr{color:var(--amber-strong)}' +
      '#curb-funnel-ov .cf-mn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#curb-funnel-ov .cf-md{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px}' +
      '#curb-funnel-ov .cf-mi{font-family:"JetBrains Mono",monospace}' +
      '#curb-funnel-ov .cf-note{font-size:12px;color:var(--muted);padding:12px 4px;line-height:1.5}' +
      '@media (max-width:760px){#curb-funnel-ov .cf-body{flex-direction:column}#curb-funnel-ov .cf-stages{flex-basis:auto}#curb-funnel-ov .cf-members{min-height:200px}}');

    var H = (window.CURB && window.CURB.hotspots) || [], meta = window.CURB.meta, cov = window.CURB.agg.coverage;
    function covAt(n) { var c = cov.filter(function (x) { return x.n === n; })[0]; return c ? c.pct : null; }
    var t100 = H.filter(function (h) { return h.rank <= 100; });
    var t100em = t100.filter(function (h) { return h.trend === "Emerging"; });
    var t100emhab = t100em.filter(function (h) { return h.recidivism === "Habitual"; });
    var HC = (t100emhab[0] || {}).rank;
    var stages = [
      { n: meta.hotspot_count, w: 100, l: "Grid cells with a violation", s: "every \u224855 m cell, citywide", m: null },
      { n: H.length, w: 74, l: "Ranked priority hotspots", s: covAt(500) + "% of total obstruction impact", m: H.slice(0, 50), more: true },
      { n: t100.length, w: 52, l: "Top-impact spots", s: covAt(100) + "% of impact in just " + t100.length, m: t100 },
      { n: t100em.length, w: 33, l: "\u2026that are also emerging", s: "getting worse, not just bad", m: t100em },
      { n: t100emhab.length, w: 17, l: "\u2026that are also habitual", s: "same vehicles keep returning", m: t100emhab }
    ];

    var ov = document.createElement("div"); ov.id = "curb-funnel-ov";
    ov.innerHTML =
      '<div class="cf-modal">' +
      '<div class="cf-head"><div><h2>From ' + nfmt(meta.hotspot_count) + ' to 1</h2>' +
      '<div class="cf-sub">How CURB narrows the whole city down to the single spot worth acting on first. Hover a stage to see the spots inside it \u2014 the high-conviction pick stays highlighted throughout.</div></div>' +
      '<span class="cf-x" id="cfX">\u00D7</span></div>' +
      '<div class="cf-body"><div class="cf-stages" id="cfStages"></div>' +
      '<div class="cf-members"><div class="cf-mhead" id="cfMHead"></div><div class="cf-mlist" id="cfMList"></div></div></div>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add("show"); });

    var stagesEl = ov.querySelector("#cfStages");
    stagesEl.innerHTML = stages.map(function (st, i) {
      return '<div class="cf-stage" data-i="' + i + '"><div class="cf-fill" style="width:' + st.w + '%"></div>' +
        '<div class="cf-n">' + nfmt(st.n) + '</div><div class="cf-l">' + st.l + '</div><div class="cf-s">' + st.s + '</div></div>';
    }).join("");

    function memRow(h) {
      var hex = causeHex(h.root_cause), hot = h.rank === HC;
      return '<div class="cf-m' + (hot ? ' hot' : '') + '" data-rank="' + h.rank + '"><span class="cf-mr">' + h.rank + '</span>' +
        '<span class="cf-mn"><span class="cf-md" style="background:' + hex + '"></span>' + esc(cleanName(h.name)) + '</span>' +
        '<span class="cf-mi">' + Math.round(h.congestion_impact_index) + '</span></div>';
    }
    function setActive(i) {
      stagesEl.querySelectorAll(".cf-stage").forEach(function (e) { e.classList.toggle("act", +e.dataset.i === i); });
      var st = stages[i];
      ov.querySelector("#cfMHead").textContent = st.m ? (st.l.replace(/^\u2026/, "") + " \u2014 " + nfmt(st.n) + (st.more ? " (showing top " + st.m.length + ")" : "")) : st.l;
      var list = ov.querySelector("#cfMList");
      if (!st.m) { list.innerHTML = '<div class="cf-note">Every grid cell that recorded a parking violation \u2014 too many to list individually. CURB ranks them all by obstruction impact, then narrows from there.</div>'; return; }
      list.innerHTML = st.m.map(memRow).join("");
      list.querySelectorAll(".cf-m").forEach(function (r) {
        r.onclick = function () { var h = H.filter(function (x) { return x.rank === +r.dataset.rank; })[0]; close(); setTimeout(function () { detail(h); }, 180); };
      });
    }
    stagesEl.querySelectorAll(".cf-stage").forEach(function (e) {
      e.addEventListener("mouseenter", function () { setActive(+e.dataset.i); });
      e.addEventListener("click", function () { setActive(+e.dataset.i); });
    });
    setActive(3); // open on the "also emerging" stage so the highlight sits among peers

    function close() { ov.classList.remove("show"); document.removeEventListener("keydown", onKey); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 280); }
    function onKey(e) { if (e.key === "Escape") close(); }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    ov.querySelector("#cfX").onclick = close;
    document.addEventListener("keydown", onKey);
  }

  return {
    CAUSE: CAUSE, causeVar: causeVar, causeHex: causeHex, esc: esc,
    cleanName: cleanName, nfmt: nfmt, card: card, query: query,
    detail: detail, funnel: funnel
  };
})();