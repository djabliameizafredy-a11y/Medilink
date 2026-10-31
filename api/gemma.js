// Fonction serverless Vercel : la clé reste côté serveur (variable GEMINI_API_KEY).
// API Interactions (révision 2026-05-20), avec repli sur l'ancienne generateContent.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function stepsText(d) {
  const steps = Array.isArray(d && d.steps) ? d.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const c = steps[i] && steps[i].content;
    if (Array.isArray(c)) {
      const t = c.map((p) => (p && p.text) || "").join("");
      if (t.trim()) return t;
    }
  }
  return (d && d.output_text) || "";
}

const SYSTEM = [
  "Tu es Gemma, l'assistante de Medilink (Lomé et Afrique de l'Ouest).",
  "Tu réponds à TOUTES les questions de l'utilisateur : santé, médecine, bien-être, médicaments, mais aussi n'importe quel autre sujet. Réponds de façon claire, utile et concise (moins de 150 mots), en français, avec le vouvoiement.",
  "Santé : donne des informations générales, signale les signes d'alerte, conseille de consulter un professionnel. Jamais de diagnostic ferme ni de posologie personnalisée. Si la vie semble en danger, demande d'appeler immédiatement les secours.",
  "Ta priorité reste d'aider à trouver un hôpital ou une pharmacie : quand c'est pertinent, demande le motif, l'urgence et la localisation. Mais ne force jamais l'utilisateur à y répondre pour obtenir une réponse à sa question.",
  "Réponds UNIQUEMENT avec un objet JSON : {\"intent\":\"search\" ou \"question\", \"patientName\", \"condition\", \"urgency\" (Critique|Élevée|Modérée|Standard), \"service\", \"medication\", \"urgent\", \"location\", \"replyHtml\"}.",
  "intent = \"search\" si l'utilisateur répond aux questions de recherche ou demande un établissement ; \"question\" pour toute autre demande. Champs inconnus : chaîne vide. replyHtml : texte brut de ta réponse, sans balises."
].join(" ");

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "non configuré" });
  const { mode, ctx, text, history, step } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 800) return res.status(400).json({ error: "entrée invalide" });

  const past = (Array.isArray(history) ? history : []).slice(-8)
    .map((h) => (h && typeof h.text === "string" ? String(h.role).slice(0, 12) + " : " + h.text.slice(0, 400) : ""))
    .filter(Boolean).join("\n");
  const system = SYSTEM + " Recherche en cours : " + (mode === "pharmacy" ? "pharmacie" : "hôpital") + ", étape " + (Number(step) || 0) + ". Contexte recueilli : " + JSON.stringify(ctx || {}).slice(0, 800);
  const input = (past ? "Conversation précédente :\n" + past + "\n\n" : "") + "Message de l'utilisateur : " + text;

  const parse = (raw) => {
    const m = String(raw || "").match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j.replyHtml) return null;
    j.replyHtml = esc(j.replyHtml);
    j.intent = j.intent === "search" ? "search" : "question";
    return j;
  };

  try {
    const r = await fetch(BASE + "/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key, "Api-Revision": "2026-05-20" },
      body: JSON.stringify({ model: MODEL, system_instruction: system, input, generation_config: { max_output_tokens: 2000 } })
    });
    if (r.ok) { const j = parse(stepsText(await r.json())); if (j) return res.status(200).json(j); }
    else console.error("interactions", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("interactions", e.message); }

  try {
    const r = await fetch(BASE + "/models/" + MODEL + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: input }] }], generationConfig: { maxOutputTokens: 2000 } })
    });
    if (r.ok) {
      const d = await r.json();
      const j = parse(d && d.candidates && d.candidates[0] && d.candidates[0].content.parts.map((p) => p.text || "").join(""));
      if (j) return res.status(200).json(j);
    } else console.error("generateContent", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.error("generateContent", e.message); }
  res.status(502).json({ error: "IA indisponible" });
};
