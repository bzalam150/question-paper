exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { statusCode: 500, body: JSON.stringify({ error: "GEMINI_API_KEY missing" }) };
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  let b;
  try { b = JSON.parse(event.body); } catch { return { statusCode: 400, body: "bad json" }; }
  const { name = "", stem = "", lang = "Bengali", need = 8, avoid = [] } = b;
  const prompt =
    "You are an exam paper setter. Create exactly " + need + " multiple choice questions in " + lang +
    " for the exam \"" + name + "\", based on the following creative-question stem, passage or topic. " +
    "Questions must be clear, accurate, cover different aspects and range from easy to hard. " +
    "Each has exactly 4 options and exactly one correct answer; vary the correct position. " +
    "Do not put option letters inside the option text. " +
    "Return ONLY a JSON array: [{\"q\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0}] " +
    "where answer is the 0-based index of the correct option." +
    (avoid.length ? "\nDo not repeat or closely resemble these existing questions:\n" + avoid.join("\n") : "") +
    "\n\nStem:\n" + stem;
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
        }),
      }
    );
    if (!r.ok) return { statusCode: r.status, body: JSON.stringify({ error: await r.text() }) };
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const arr = JSON.parse(text.replace(/```json|```/g, "").trim());
    const items = arr.filter(
      (x) => x && x.q && Array.isArray(x.options) && x.options.length === 4 &&
        Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4
    );
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
