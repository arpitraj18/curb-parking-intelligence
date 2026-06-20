// CURB assistant — serverless function (Vercel/Netlify Node 18+).
// Grounds Gemini strictly on the provided hotspot rows (no outside data).
// Set GEMINI_API_KEY in the host's environment variables.

const HOTSPOTS = require("./_hotspots.json");
const MODEL = "gemini-2.5-flash";

const SYSTEM = [
  "You are CURB's analyst assistant for the Bengaluru Traffic Police.",
  "You answer ONLY using the JSON list of hotspots provided in the user message.",
  "These rows were pre-computed from the provided enforcement dataset.",
  "Rules:",
  "- Never invent or add any hotspot, number, place, or fact not in the provided list.",
  "- Never use outside knowledge, current events, or anything beyond these rows.",
  "- 'impact' is a 0-100 prioritisation index, NOT measured traffic. Call it 'obstruction impact'; never a percentage of congestion.",
  "- If no provided hotspot fits the question, say so plainly.",
  "- Be concise (1-3 sentences), operational, plain English.",
  'Return ONLY JSON of the form {"answer": string, "ranks": number[]} where ranks are the rank values you cite (max 6, most relevant first).',
].join("\n");

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      try { return resolve(typeof req.body === "string" ? JSON.parse(req.body) : req.body); }
      catch { return resolve({}); }
    }
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
  });
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const body = req.method === "POST" ? await readBody(req) : {};
    const question = (body.question || (req.query && req.query.q) || "").toString().trim();
    if (!question) return res.status(400).json({ error: "Missing question" });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(503).json({ error: "no_key", message: "GEMINI_API_KEY not set" });

    const prompt =
      "QUESTION:\n" + question +
      "\n\nHOTSPOTS (the only data you may use):\n" + JSON.stringify(HOTSPOTS);

    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      MODEL + ":generateContent?key=" + key;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Gemini error", r.status, errText);
      return res.status(502).json({ error: "upstream", status: r.status });
    }

    const data = await r.json();
    const text = (((data.candidates || [])[0] || {}).content || {}).parts?.[0]?.text || "";
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { answer: text, ranks: [] }; }

    const byRank = {};
    HOTSPOTS.forEach((h) => (byRank[h.rank] = h));
    const results = (parsed.ranks || [])
      .map((rk) => byRank[rk])
      .filter(Boolean)
      .slice(0, 6);

    return res.status(200).json({ answer: parsed.answer || "", results, source: "gemini" });
  } catch (e) {
    console.error("assistant error", e);
    return res.status(500).json({ error: "server", message: String(e) });
  }
};
