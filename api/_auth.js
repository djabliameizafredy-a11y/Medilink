// Vérifie qu'une requête vient d'un administrateur connecté (jeton Supabase vérifié côté serveur).
async function adminOf(req) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const m = String(req.headers.authorization || "").match(/^Bearer (.+)$/);
  if (!url || !key || !m) return null;
  try {
    const u = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + m[1] }, signal: AbortSignal.timeout(8000) });
    if (!u.ok) return null;
    const user = await u.json();
    if (!user || !/^[0-9a-f-]{36}$/i.test(String(user.id))) return null;
    const p = await fetch(url + "/rest/v1/profiles?select=role&id=eq." + user.id, { headers: { apikey: key, Authorization: "Bearer " + key }, signal: AbortSignal.timeout(8000) });
    const rows = p.ok ? await p.json() : [];
    return rows[0] && rows[0].role === "admin" ? user : null;
  } catch (e) { return null; }
}
module.exports = { adminOf };
