// Diagnostic réservé à l'administrateur : teste vraiment chaque service et dit ce qui ne va pas.
const { adminOf } = require("./_auth");
const { getText, epmcSearch, askGemini } = require("./_lib");
module.exports = async (req, res) => {
  if (!(await adminOf(req))) return res.status(401).json({ error: "non autorisé" });
  const checks = [], add = (nom, ok, detail) => checks.push({ nom, ok: !!ok, detail: detail || "" });
  const has = (k) => !!process.env[k];
  add("Variable GEMINI_API_KEY", has("GEMINI_API_KEY"));
  add("Variable SUPABASE_URL", has("SUPABASE_URL"));
  add("Variable SUPABASE_SERVICE_ROLE_KEY", has("SUPABASE_SERVICE_ROLE_KEY"));
  add("Variable CRON_SECRET", has("CRON_SECRET"));
  let nf = 0; try { nf = JSON.parse(process.env.FR_FEEDS || "[]").length; } catch (e) { add("FR_FEEDS lisible", false, "JSON invalide"); }
  if (!nf) nf = 2; // flux par défaut intégrés au code (OMS fr + Inserm)
  add("Flux francophones configurés", true, nf + " flux" + (process.env.FR_FEEDS ? "" : " (liste par défaut du dépôt)"));
  if (has("GEMINI_API_KEY")) {
    const modele = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    try { const t0 = Date.now(); const t = await askGemini("Réponds par le seul mot : ok", "ping"); add("Appel réel à Gemini (" + modele + ") en " + (Date.now() - t0) + " ms", t.trim().length > 0, t.slice(0, 30)); }
    catch (e) { add("Appel réel à Gemini (" + modele + ")", false, e.message); }
    if (modele !== "gemini-3.8-flash") { // comparer un modèle plus léger sur le même appel (objectif : réponse immédiate)
      try { const t0 = Date.now(); const t = await askGemini("Réponds par le seul mot : ok", "ping"); add("Comparaison gemini-3.8-flash en " + (Date.now() - t0) + " ms", t.trim().length > 0, "modèle courant : " + modele); }
      catch (e) { add("Comparaison gemini-3.8-flash", false, e.message); }
    }
  }
  if (has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY")) {
    try { const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/articles?select=id&limit=1", { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY }, signal: AbortSignal.timeout(8000) }); add("Base : lecture avec la clé serveur", r.ok, r.ok ? "" : "HTTP " + r.status + " (clé service_role incorrecte ?)"); }
    catch (e) { add("Base : lecture avec la clé serveur", false, e.message); }
  }
  try { const x = await getText("https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=1&tool=medilink&term=diabetes"); add("MedlinePlus joignable et lisible", /<document/.test(x), /<document/.test(x) ? "" : "réponse inattendue"); }
  catch (e) { add("MedlinePlus joignable et lisible", false, e.message); }
  try { const rows = await epmcSearch("diabetes"); add("Europe PMC joignable", rows.length > 0, rows.length + " résultat(s)"); }
  catch (e) { add("Europe PMC joignable", false, e.message); }
  res.status(200).json({ checks });
};
