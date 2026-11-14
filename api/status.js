// État public minimal : indique seulement si les variables existent (jamais leur valeur).
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    site: "medilink",
    medibot_cle_gemini: !!process.env.GEMINI_API_KEY,
    base_cle_serveur: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    ingestion_secret: !!process.env.CRON_SECRET
  });
};
