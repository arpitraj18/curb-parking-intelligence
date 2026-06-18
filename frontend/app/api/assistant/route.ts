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

export async function POST(req: NextRequest) {
  const { question, rows } = (await req.json()) as { question: string; rows: Row[] };

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      text: "I couldn't find matching hotspots. Try a cause (delivery, safety, commuter, hire) or a different area.",
    });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // deterministic phrasing — works with no key
    const t = rows[0];
    return NextResponse.json({
      text: `Here ${rows.length === 1 ? "is" : "are"} the top ${rows.length} by obstruction impact — leading with ${t.name} (${t.cause.toLowerCase()}, impact ${t.impact}):`,
    });
  }

  try {
    const prompt =
      "You are an assistant for Bengaluru Traffic Police. Use ONLY the JSON rows provided. " +
      "Never add outside facts, never invent numbers. Answer in 2-3 sentences, plainly.\n" +
      `Question: ${question}\nRows: ${JSON.stringify(rows)}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const d = await r.json();
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return NextResponse.json({ text });
  } catch {
    // fall through to templated
  }
  const t = rows[0];
  return NextResponse.json({
    text: `Top ${rows.length} by obstruction impact, leading with ${t.name} (${t.cause.toLowerCase()}, impact ${t.impact}):`,
  });
}
