"use client";
import { usePriorities } from "@/lib/data";
import { CAUSE, TIERS, TIER_HEX } from "@/lib/theme";

export default function Overview() {
  const { data, error } = usePriorities();
  if (error) return <div className="pad" style={{ color: "var(--muted)" }}>{error}</div>;
  if (!data) return <div className="pad" style={{ color: "var(--muted)" }}>Loading…</div>;

  const H = data.hotspots;
  const c = data.citywide;
  const chronic = H.filter((h) => h.persistence_tier === "Chronic").length;

  const byCause: Record<string, number> = {};
  const byTier: Record<string, number> = { Chronic: 0, Frequent: 0, Occasional: 0 };
  H.forEach((h) => {
    byCause[h.root_cause] = (byCause[h.root_cause] || 0) + 1;
    byTier[h.persistence_tier] = (byTier[h.persistence_tier] || 0) + 1;
  });
  const maxC = Math.max(...Object.values(byCause), 1);
  const maxT = Math.max(...Object.values(byTier), 1);

  const cov: [number, number][] = [];
  [25, 50, 100, 250].forEach((n) => {
    const r = H.find((h) => h.rank === n);
    if (r) cov.push([n, r.cumulative_coverage_pct]);
  });

  return (
    <section className="view">
      <div className="pad">
        <div className="wrap">
          <div className="h" style={{ marginTop: 6 }}>
            At a glance
          </div>
          <div className="tiles">
            <Tile v={(data.meta.hotspot_count || H.length).toLocaleString()} k="Hotspots ranked" />
            <Tile v={String(chronic)} k="Chronic standing posts" />
            <Tile
              v={`${c.officers_per_day_p25 ?? "–"}–${c.officers_per_day_p75 ?? "–"}`}
              k="Officers active / day"
            />
            <Tile v={String(c.active_days_in_data ?? "–")} u="days" k="Data window" />
          </div>

          <div className="h">Where the obstruction burden sits</div>
          <div className="cov">
            {cov.length ? (
              cov.map(([n, p]) => (
                <div className="c" key={n}>
                  <div className="v">{p}%</div>
                  <div className="k">top {n} spots</div>
                </div>
              ))
            ) : (
              <div className="c">
                <div className="v">—</div>
                <div className="k">serve full data</div>
              </div>
            )}
          </div>
          <div className="caveat">
            Coverage = share of the city&apos;s total obstruction-impact <b>index</b> carried by the
            top-N spots. It is a prioritisation index (severity × vehicle footprint), not a measured
            or predicted change in traffic.
          </div>

          <div className="h">Hotspots by root cause</div>
          <div className="bars">
            {Object.entries(CAUSE).map(([n, i]) => (
              <Bar key={n} label={n} value={byCause[n] || 0} max={maxC} hex={i.hex} />
            ))}
          </div>

          <div className="h">Persistence triage</div>
          <div className="bars">
            {TIERS.map((t) => (
              <Bar key={t} label={t} value={byTier[t] || 0} max={maxT} hex={TIER_HEX[t]} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({ v, u, k }: { v: string; u?: string; k: string }) {
  return (
    <div className="tile">
      <div className="v">
        {v}
        {u ? <span className="u"> {u}</span> : null}
      </div>
      <div className="k">{k}</div>
    </div>
  );
}

function Bar({ label, value, max, hex }: { label: string; value: number; max: number; hex: string }) {
  return (
    <div className="barrow">
      <div className="lab">{label}</div>
      <div className="track">
        <div className="fill" style={{ width: `${(value / max) * 100}%`, background: hex }} />
      </div>
      <div className="n">{value}</div>
    </div>
  );
}
