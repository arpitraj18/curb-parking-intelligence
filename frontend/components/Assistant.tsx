"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePriorities, Hotspot } from "@/lib/data";
import { CAUSE, TIERS, causeHex } from "@/lib/theme";

interface Msg { who: "bot" | "me"; text: string; results?: Hotspot[] }

const SUGGESTIONS = [
  "Top 5 delivery hotspots",
  "Chronic safety spots",
  "Commuter overflow near Koramangala",
  "Worst 5 overall",
];

export default function Assistant() {
  const { data } = usePriorities();
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      who: "bot",
      text:
        "I read CURB's priority list. Ask where to focus — by cause (delivery, safety, commuter, hire), by area, or just the worst spots. Every number comes straight from the data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function queryData(q: string): Hotspot[] {
    if (!data) return [];
    const s = q.toLowerCase();
    let pool = data.hotspots.slice();
    const causeMap: Record<string, string> = {
      delivery: "Delivery overflow",
      safety: "Safety risk",
      commuter: "Commuter overflow",
      hire: "Hire / transit demand",
      auto: "Hire / transit demand",
      transit: "Hire / transit demand",
      structural: "Structural demand",
      enforce: "Enforcement priority",
    };
    for (const k in causeMap) if (s.includes(k)) pool = pool.filter((h) => h.root_cause === causeMap[k]);
    TIERS.forEach((t) => {
      if (s.includes(t.toLowerCase())) pool = pool.filter((h) => h.persistence_tier === t);
    });
    const mArea = s.match(/(?:near|in|around|at)\s+([a-z0-9 .]+)/);
    if (mArea) {
      const area = mArea[1].trim().split(/\s+(top|worst|spots?|hotspots?)\b/)[0].trim();
      if (area.length > 2) {
        const f = pool.filter((h) => (h.name || "").toLowerCase().includes(area));
        if (f.length) pool = f;
      }
    }
    const mN = s.match(/\b(\d{1,2})\b/);
    const n = mN ? Math.min(parseInt(mN[1], 10), 10) : 5;
    return pool.slice(0, n);
  }

  async function ask(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { who: "me", text: q }]);
    const results = queryData(q);
    setBusy(true);
    let phrasing = "";
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          rows: results.map((h) => ({
            rank: h.rank,
            name: h.name,
            cause: h.root_cause,
            impact: h.congestion_impact_index,
            persistence: h.persistence_tier,
            fix: h.recommended_fix,
          })),
        }),
      });
      const d = await r.json();
      phrasing = d.text || "";
    } catch {
      phrasing = "";
    }
    if (!phrasing) phrasing = fallbackText(results);
    setBusy(false);
    setMsgs((m) => [...m, { who: "bot", text: phrasing, results }]);
  }

  return (
    <section className="view">
      <div className="pad">
        <div className="chatwrap">
          <div className="msgs">
            {msgs.map((m, idx) => (
              <div key={idx} className={`msg ${m.who}`}>
                <div className="av">{m.who === "bot" ? "AI" : "You"}</div>
                <div className="body">
                  {m.text}
                  {m.results && m.results.length > 0 && (
                    <div>
                      {m.results.map((h) => (
                        <div
                          key={h.rank}
                          className="res"
                          style={{ ["--cc" as any]: causeHex(h.root_cause) }}
                          onClick={() => router.push("/")}
                        >
                          <div className="rn">
                            #{h.rank} · {h.name}
                          </div>
                          <div className="rc">
                            {h.root_cause} · impact {h.congestion_impact_index} · {h.persistence_tier}
                          </div>
                          <div className="rl">→ {h.recommended_fix} · open the Map tab to locate</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="sugg">
            {SUGGESTIONS.map((s) => (
              <span key={s} className="s" onClick={() => ask(s)}>
                {s}
              </span>
            ))}
          </div>
          <div className="askbar">
            <input
              value={input}
              placeholder="e.g. top delivery hotspots, or chronic safety spots near HSR"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") ask();
              }}
            />
            <button onClick={() => ask()} disabled={busy}>
              {busy ? "…" : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function fallbackText(res: Hotspot[]): string {
  if (!res.length)
    return "I couldn't find matching hotspots. Try a cause (delivery, safety, commuter, hire) or a different area.";
  const top = res[0];
  return `Here ${res.length === 1 ? "is" : "are"} the top ${res.length} by obstruction impact — leading with ${top.name} (${top.root_cause.toLowerCase()}, impact ${top.congestion_impact_index}):`;
}
