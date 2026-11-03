// Recherche directe dans Europe PMC (articles relus uniquement), avec cache pour respecter la limite par IP.
const { normEpmc, epmcSearch } = require("./_lib");
module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return res.status(400).json({ error: "recherche trop courte" });
  try {
    const rows = (await epmcSearch(q)).map((r) => normEpmc(r, null)).filter(Boolean);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({ results: rows.map((r) => Object.assign(r, { id: "epmc:" + r.external_id, content_type: "research" })) });
  } catch (e) { res.status(502).json({ error: "Europe PMC indisponible" }); }
};
