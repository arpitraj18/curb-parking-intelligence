"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePriorities } from "@/lib/data";

const TABS = [
  { href: "/", label: "Map" },
  { href: "/overview", label: "Overview" },
  { href: "/assistant", label: "Assistant" },
];

export default function Header() {
  const pathname = usePathname();
  const { data } = usePriorities();
  const c = data?.citywide;
  const chronic = data?.hotspots.filter((h) => h.persistence_tier === "Chronic").length;

  return (
    <header>
      <div className="brand">
        <span className="logo">
          C<b>U</b>RB
        </span>
        <span className="tag">Curb Intelligence · Bengaluru</span>
      </div>
      <nav>
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      {data && (
        <div className="readouts">
          <div className="ro">
            <div className="v">{(data.meta.hotspot_count || data.hotspots.length).toLocaleString()}</div>
            <div className="k">Hotspots</div>
          </div>
          <div className="ro">
            <div className="v">{chronic}</div>
            <div className="k">Chronic</div>
          </div>
          <div className="ro">
            <div className="v">
              {c?.officers_per_day_p25 ?? "–"}
              <span className="u">–</span>
              {c?.officers_per_day_p75 ?? "–"}
            </div>
            <div className="k">Officers / day</div>
          </div>
          <div className="ro">
            <div className="v">
              {c?.active_days_in_data ?? "–"}
              <span className="u"> d</span>
            </div>
            <div className="k">Window</div>
          </div>
        </div>
      )}
    </header>
  );
}
