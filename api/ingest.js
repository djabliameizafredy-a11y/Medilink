// Ingestion du fil santé. Appelée par GitHub Actions (toutes les heures) avec « Authorization: Bearer CRON_SECRET ».
const crypto = require("crypto");
const { clean, httpsUrl, getText, CATS, normEpmc, epmcSearch } = require("./_lib");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// MedlinePlus : service web officiel, uniquement les pages « sujets de santé » (résumés du domaine public).
async function ingestMedline() {
  const rows = [];
  for (const [cat, t] of Object.entries(CATS)) {
    try {
      const xml = await getText("https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=5&tool=medilink&term=" + encodeURIComponent(t[0]));
      for (const d of xml.match(/<document\b[\s\S]*?<\/document>/g) || []) {
        const url = (d.match(/<document[^>]*\burl="([^"]+)"/) || [])[1];
        if (!url || !/^https:\/\/medlineplus\.gov\/[a-z0-9-]+\.html$/.test(url)) continue; // exclut /ency/, /druginfo/ (contenus sous licence)
        const f = (n) => ((d.match(new RegExp('<content name="' + n + '">([\\s\\S]*?)</content>')) || [])[1]) || "";
        const title = clean(f("title"), 200), summary = clean(f("FullSummary") || f("snippet"), 400);
        if (title && summary) rows.push({ source: "medlineplus", external_id: url, content_type: "advice", title, summary, url, institution: "MedlinePlus, National Library of Medicine", language: "en", category: cat });
      }
    } catch (e) { console.error("medlineplus", cat, e.message); }
    await sleep(800); // bien sous la limite de 85 requêtes par minute
  }
  return rows;
}
async function ingestEpmc() {
  const rows = [], to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  for (const [cat, t] of Object.entries(CATS)) {
    try { (await epmcSearch(t[1], from, to)).forEach((r) => { const n = normEpmc(r, cat); if (n) rows.push(n); }); }
    catch (e) { console.error("europe_pmc", cat, e.message); }
    await sleep(300); // limite d'environ 10 requêtes par seconde
  }
  return rows;
}
// Sources francophones : FR_FEEDS = [{"name":"…","url":"https://…","category":"prevention","summary":true}] (adresses et conditions à vérifier par l'éditeur).
const KW = [["paludisme", /paludisme|malaria/i], ["typhoide", /typho/i], ["diabete", /diab/i], ["hypertension", /hypertension|tension art/i], ["sante_mentale", /sant[ée] mentale|d[ée]pression|anxi/i], ["sommeil", /sommeil/i], ["nutrition", /nutrition|aliment/i], ["sante_maternelle_infantile", /maternel|enfant|nouveau-n|grossesse|vaccin/i], ["medicaments", /m[ée]dicament|pharma/i], ["maladies_infectieuses", /chol[ée]ra|ebola|[ée]pid|infect|virus|fi[èe]vre/i]];
async function ingestFeeds() {
  let feeds = []; try { feeds = JSON.parse(process.env.FR_FEEDS || "[]"); } catch (e) { return []; }
  const rows = [];
  for (const f of feeds.slice(0, 10)) {
    if (!httpsUrl(f.url)) continue;
    try {
      const xml = await getText(f.url);
      for (const i of (xml.match(/<item\b[\s\S]*?<\/item>/g) || []).slice(0, 20)) {
        const g = (n) => { const m = i.match(new RegExp("<" + n + "[^>]*>([\\s\\S]*?)</" + n + ">")); return m ? m[1].replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "") : ""; };
        const link = httpsUrl(clean(g("link"), 500)), title = clean(g("title"), 200), summary = f.summary ? clean(g("description"), 300) : "";
        const d = new Date(g("pubDate"));
        if (!link || !title) continue;
        const cat = f.category && CATS[f.category] ? f.category : ((KW.find((k) => k[1].test(title + " " + summary)) || [])[0] || "prevention");
        rows.push({ source: "institution", external_id: link, content_type: "news", title, summary, url: link, institution: clean(f.name, 60), language: "fr", category: cat, published_at: isNaN(d) ? null : d.toISOString() });
      }
    } catch (e) { console.error("flux", f.name, e.message); }
  }
  return rows;
}
async function upsert(rows) {
  const seen = new Set(), now = new Date().toISOString();
  rows = rows.filter((r) => !seen.has(r.source + r.external_id) && seen.add(r.source + r.external_id)).map((r) => Object.assign(r, { updated_at: now }));
  for (let i = 0; i < rows.length; i += 100) {
    const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/articles?on_conflict=source,external_id", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100))
    });
    if (!r.ok) throw new Error("base " + r.status);
  }
  return rows.length;
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || !same(req.headers.authorization || "", "Bearer " + secret)) return res.status(401).json({ error: "non autorisé" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: "base non configurée" });
  const out = {};
  await Promise.all([["medlineplus", ingestMedline], ["europe_pmc", ingestEpmc], ["institutions", ingestFeeds]].map(async ([k, fn]) => {
    try { out[k] = await upsert(await fn()); } catch (e) { out[k] = "erreur : " + e.message; } // une source en panne n'arrête pas les autres
  }));
  res.status(200).json(out);
};
module.exports.__t = { ingestMedline, ingestEpmc, ingestFeeds, upsert };
