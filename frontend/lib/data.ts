"use client";
import { useEffect, useState } from "react";

export interface Hotspot {
  rank: number;
  name: string;
  lat: number;
  lon: number;
  congestion_impact_index: number;
  persistence_tier: string;
  recurrence_days: number;
  window_days: number;
  units_typical: number;
  units_peak: number;
  root_cause: string;
  recommended_fix: string;
  deploy_note: string;
  violations: number;
  impact_score: number;
  cumulative_coverage_pct: number;
}

export interface Citywide {
  officers_per_day_min?: number;
  officers_per_day_p25?: number;
  officers_per_day_median?: number;
  officers_per_day_p75?: number;
  officers_per_day_max?: number;
  active_days_in_data?: number;
  note?: string;
}

export interface Priorities {
  meta: { hotspot_count?: number; note?: string };
  citywide: Citywide;
  hotspots: Hotspot[];
}

let cache: Priorities | null = null;

// Loads /curb_priorities.json (placed in /public). Cached after first load.
export function usePriorities() {
  const [data, setData] = useState<Priorities | null>(cache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cache) return;
    fetch("/curb_priorities.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d: Priorities) => {
        cache = d;
        setData(d);
      })
      .catch(() =>
        setError(
          "Couldn't load curb_priorities.json. Put it in the /public folder, then refresh."
        )
      );
  }, []);

  return { data, error };
}
