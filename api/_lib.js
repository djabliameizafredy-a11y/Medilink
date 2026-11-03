// Utilitaires partagés (le préfixe _ empêche Vercel d'en faire une route).
const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
const clean = (s, max) => String(s == null ? "" : s)
  .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENT[m]).replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ").trim().slice(0, max);
const httpsUrl = (u) => (/^https:\/\/[^\s]+$/i.test(u || "") ? u : null);
async function getText(url, ms) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms || 8000), headers: { "User-Agent": "Medilink/1.0 (actualites sante)" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}
const CATS = {
  nutrition: ["nutrition", "nutrition"], sante_mentale: ["mental health", "mental health"], sommeil: ["sleep", "sleep"],
  prevention: ["prevention", "disease prevention"], maladies_infectieuses: ["infections", "infectious diseases"],
  paludisme: ["malaria", "malaria"], typhoide: ["typhoid fever", "typhoid fever"], diabete: ["diabetes", "diabetes"],
  hypertension: ["high blood pressure", "hypertension"], medicaments: ["medicines", "drug therapy"],
  sante_maternelle_infantile: ["pregnancy", "maternal child health"]
};
// Europe PMC : on ne garde que des articles relus (SRC:MED), avec DOI, revue, date et résumé.
function normEpmc(r, category) {
  if (!r || r.source === "PPR" || !r.doi || !r.journalTitle || !r.firstPublicationDate || !r.abstractText || !r.title) return null;
  if (!/^10\.\d{4,9}\/\S+$/.test(r.doi)) return null;
  return {
    source: "europe_pmc", external_id: r.source + ":" + r.id, content_type: "research",
    title: clean(r.title, 250), summary: clean(r.abstractText, 400),
    url: "https://europepmc.org/article/" + encodeURIComponent(r.source) + "/" + encodeURIComponent(r.id),
    author: clean(r.authorString, 120), journal: clean(r.journalTitle, 120), doi: r.doi,
    language: "en", category: category || null, published_at: new Date(r.firstPublicationDate).toISOString()
  };
}
async function epmcSearch(terms, from, to) {
  const q = "(" + terms + ") AND SRC:MED AND NOT SRC:PPR AND HAS_ABSTRACT:y" + (from ? " AND FIRST_PDATE:[" + from + " TO " + to + "]" : "");
  const url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=" + encodeURIComponent(q) + "&format=json&resultType=core&pageSize=20&sort=" + encodeURIComponent("P_PDATE_D desc");
  const d = JSON.parse(await getText(url, 10000));
  return (d && d.resultList && d.resultList.result) || [];
}
function stepsText(d) {
  const steps = Array.isArray(d && d.steps) ? d.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const c = steps[i] && steps[i].content;
    if (Array.isArray(c)) { const t = c.map((p) => (p && p.text) || "").join(""); if (t.trim()) return t; }
  }
  return (d && d.output_text) || "";
}
async function askGemini(system, input) {
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY, "Api-Revision": "2026-05-20" },
    body: JSON.stringify({ model: process.env.GEMINI_MODEL || "gemini-3.8-flash", system_instruction: system, input, generation_config: { max_output_tokens: 1500 } })
  });
  if (!r.ok) throw new Error("Gemini " + r.status);
  return stepsText(await r.json());
}
module.exports = { clean, httpsUrl, getText, CATS, normEpmc, epmcSearch, askGemini };
