import { NextRequest, NextResponse } from "next/server";

// The model is used ONLY as a phrasing layer over rows the client already
// computed from the provided dataset. No external data, no retrieval, no web.
// This matches the organizer-approved boundary. The key stays on the server.

interface Row {
  rank: number;
  name: string;
  cause: string;
  impact: number;
  persistence: string;
  fix: string;
}

const MODEL = "gemini-2.5-flash"; // stable + free-tier; swap to gemini-3.5-flash (paid) for sharper phrasing

function templated(rows: Row[]) {
  const t = rows[0];
  return `Here ${rows.length === 1 ? "is" : "are"} the top ${rows.length} by obstruction impact — leading with ${t.name} (${t.cause.toLowerCase()}, impact ${t.impact}):`;
}

export async function POST(req: NextRequest) {
  const { question, rows } = (await req.json()) as { question: string; rows: Row[] };

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      text: "I couldn't find matching hotspots. Try a cause (delivery, safety, commuter, hire) or a different area.",
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("[assistant] No GEMINI_API_KEY set — using deterministic phrasing.");
    return NextResponse.json({ text: templated(rows), source: "template" });
  }

  try {
    const prompt =
      "You are an assistant for Bengaluru Traffic Police. Use ONLY the JSON rows provided. " +
      "Never add outside facts, never invent numbers. Answer in 2-3 sentences, plainly.\n" +
      `Question: ${question}\nRows: ${JSON.stringify(rows)}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const raw = await r.text(); // read once as text so we can log on any failure

    if (!r.ok) {
      // Google returns a JSON error body (bad key, model not found, quota, etc.)
      console.error(`[assistant] Gemini HTTP ${r.status}:`, raw.slice(0, 500));
      return NextResponse.json({
        text: templated(rows),
        source: "template",
        aiError: `Gemini HTTP ${r.status}: ${raw.slice(0, 300)}`,
      });
    }

    const d = JSON.parse(raw);
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      return NextResponse.json({ text, source: "gemini" });
    }

    // 200 OK but no text — usually a safety block or unexpected shape
    console.error("[assistant] Gemini returned no text. Body:", raw.slice(0, 500));
    return NextResponse.json({
      text: templated(rows),
      source: "template",
      aiError: `No text in response: ${raw.slice(0, 300)}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[assistant] Gemini call threw:", msg);
    return NextResponse.json({ text: templated(rows), source: "template", aiError: msg });
  }
}