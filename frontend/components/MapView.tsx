"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePriorities, Hotspot } from "@/lib/data";
import { CAUSE, TIERS, causeHex } from "@/lib/theme";

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY || "";

export default function MapView() {
  const { data, error } = usePriorities();
  const [causes, setCauses] = useState<string[]>([]);
  const [tiers, setTiers] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<number, L.CircleMarker>>({});
  const [ready, setReady] = useState(false);

  const visible = useMemo<Hotspot[]>(() => {
    if (!data) return [];
    return data.hotspots.filter((h) => {
      if (causes.length && !causes.includes(h.root_cause)) return false;
      if (tiers.length && !tiers.includes(h.persistence_tier)) return false;
      if (q && !(h.name || "").toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [data, causes, tiers, q]);

  // init map once data is available
  useEffect(() => {
    if (!data || mapRef.current) return;
    const el = document.getElementById("map");
    if (!el) return;

    function withLeaflet(map: L.Map) {
      mapRef.current = map;
      setReady(true);
    }
    if (MAPPLS_KEY) {
      const s = document.createElement("script");
      s.src = `https://apis.mapmyindia.com/advancedmaps/v1/${MAPPLS_KEY}/map_load?v=1.3`;
      s.onload = () => {
        const map = new (window as any).MapmyIndia.Map("map", { center: [12.97, 77.59], zoom: 11 });
        setTimeout(() => withLeaflet(map as L.Map), 400);
      };
      document.head.appendChild(s);
    } else {
      const map = L.map("map", { zoomControl: true, renderer: L.svg() }).setView([12.97, 77.59], 11);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
        attribution: "© OpenStreetMap © CARTO",
      }).addTo(map);
      const rb = document.createElement("div");
      rb.className = "ribbon";
      rb.textContent = "Dev basemap — set NEXT_PUBLIC_MAPPLS_KEY for the sponsor map";
      el.appendChild(rb);
      withLeaflet(map);
    }
  }, [data]);

  // render markers when visible set changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};
    visible.forEach((h) => {
      const hex = causeHex(h.root_cause);
      const mk = L.circleMarker([h.lat, h.lon], {
        radius: 5 + (h.congestion_impact_index / 100) * 16,
        color: hex,
        weight: 2,
        fillColor: hex,
        fillOpacity: 0.45,
      }).addTo(map);
      mk.bindPopup(popupHtml(h));
      mk.on("click", () => select(h.rank, false));
      markersRef.current[h.rank] = mk;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  function select(rank: number, fromCard: boolean) {
    setSelected(rank);
    const h = data?.hotspots.find((x) => x.rank === rank);
    const map = mapRef.current;
    const mk = markersRef.current[rank];
    if (h && map && mk) {
      if (fromCard) map.flyTo([h.lat, h.lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
      mk.openPopup();
      Object.values(markersRef.current).forEach((m) => {
        const p = (m as any)._path as SVGElement | undefined;
        if (p) p.classList.remove("sel");
      });
      const p = (mk as any)._path as SVGElement | undefined;
      if (p) p.classList.add("sel");
    }
  }

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  if (error)
    return <div className="view" style={{ padding: 40, color: "var(--muted)" }}>{error}</div>;

  return (
    <section className="view">
      <div id="map" />
      <div className="legend">
        <div className="lt">Root cause</div>
        {Object.entries(CAUSE).map(([n, i]) => (
          <div className="row" key={n}>
            <span className="dot" style={{ background: i.hex }} />
            {n}
          </div>
        ))}
      </div>
      <aside className="rail">
        <div className="rail-head">
          <h2>Priority Dispatch</h2>
          <div className="sub">
            {visible.length} of {data?.hotspots.length ?? 0} shown · ranked by obstruction impact
          </div>
          <input
            className="search"
            placeholder="Search a junction or area…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="filters">
          <div className="flabel">Cause</div>
          {Object.entries(CAUSE).map(([n, i]) => {
            const on = causes.includes(n);
            return (
              <span
                key={n}
                className="chip"
                onClick={() => toggle(causes, setCauses, n)}
                style={on ? { background: i.hex + "26", color: "#E7EEF7", borderColor: i.hex + "99" } : {}}
              >
                <span className="dot" style={{ background: i.hex }} />
                {n}
              </span>
            );
          })}
          <div className="flabel" style={{ marginTop: 8 }}>
            Persistence
          </div>
          {TIERS.map((t) => {
            const on = tiers.includes(t);
            return (
              <span
                key={t}
                className="chip"
                onClick={() => toggle(tiers, setTiers, t)}
                style={on ? { background: "#FFC23D26", color: "#E7EEF7", borderColor: "#FFC23D99" } : {}}
              >
                {t}
              </span>
            );
          })}
        </div>
        <div className="list">
          {visible.length === 0 && (
            <div style={{ padding: "26px 14px", color: "var(--muted)", fontSize: 12.5 }}>
              No hotspots match these filters. Clear one to see more.
            </div>
          )}
          {visible.map((h) => {
            const hex = causeHex(h.root_cause);
            return (
              <div
                key={h.rank}
                className={`card ${selected === h.rank ? "sel" : ""}`}
                style={{ ["--cc" as any]: hex }}
                onClick={() => select(h.rank, true)}
              >
                <div className="rk">{h.rank}</div>
                <div>
                  <div className="nm">{h.name}</div>
                  <div className="cause">{h.root_cause}</div>
                  <div className="fix">→ {h.recommended_fix}</div>
                  <div className="note">{h.deploy_note}</div>
                  <span className={`pill ${h.persistence_tier}`}>
                    {h.persistence_tier} · {h.recurrence_days}/{h.window_days} d
                  </span>
                </div>
                <div>
                  <div className="idx">{h.congestion_impact_index}</div>
                  <div className="idxk">impact</div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </section>
  );
}

function popupHtml(h: Hotspot): string {
  const hex = causeHex(h.root_cause);
  return `<div class="pop"><h3>#${h.rank} · ${esc(h.name)}</h3>
    <div class="pc" style="color:${hex};font-weight:600">${h.root_cause}</div>
    <div class="pc"><span class="pk">Impact index</span> <b class="mono">${h.congestion_impact_index}</b>/100</div>
    <div class="pc"><span class="pk">Persistence</span> ${h.persistence_tier} (${h.recurrence_days}/${h.window_days} d)</div>
    <div class="pc" style="margin-top:5px">→ ${esc(h.recommended_fix)}</div>
    <div class="pc" style="color:var(--dim);font-style:italic">${esc(h.deploy_note)}</div></div>`;
}
function esc(s: string): string {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m] as string)
  );
}
