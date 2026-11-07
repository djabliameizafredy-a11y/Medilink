(function () {
  var C = window.MEDILINK_CONFIG || {};
  var $ = function (i) { return document.getElementById(i); };
  var S = null;
  try { S = JSON.parse(sessionStorage.getItem("medilink-admin") || "null"); } catch (e) {}
  function show(id) { ["login", "denied", "dash"].forEach(function (x) { $(x).hidden = x !== id; }); $("logout").hidden = id === "login"; }
  function out() { sessionStorage.removeItem("medilink-admin"); S = null; show("login"); }
  function hdr() { return { apikey: C.supabaseAnonKey, Authorization: "Bearer " + S.token }; }
  async function get(path, extra) {
    var r = await fetch(C.supabaseUrl + "/rest/v1/" + path, { headers: Object.assign(hdr(), extra || {}) });
    if (r.status === 401) { out(); throw new Error("session expirée"); }
    return r;
  }
  async function count(path) {
    var r = await get(path + "&limit=1", { Prefer: "count=exact" });
    if (!r.ok) return null;
    var m = (r.headers.get("Content-Range") || "").match(/\/(\d+)$/);
    return m ? Number(m[1]) : null;
  }
  function card(label, value) {
    var d = document.createElement("div"); d.className = "col-6 col-md-4";
    var p = document.createElement("div"); p.className = "panel p-3 h-100";
    var l = document.createElement("div"); l.className = "meta"; l.textContent = label;
    var v = document.createElement("div"); v.className = "h3 mb-0"; v.textContent = value;
    p.append(l, v); d.append(p); return d;
  }
  async function stats() {
    var week = new Date(Date.now() - 7 * 864e5).toISOString(), miss = 0;
    var list = [["Demandes reçues", "requests?select=id"], ["Demandes des 7 derniers jours", "requests?select=id&created_at=gte." + week],
      ["Établissements", "facilities?select=id"], ["Établissements vérifiés", "facilities?select=id&is_verified=eq.true"],
      ["Professionnels en attente", "professionals?select=id&status=eq.pending"], ["Articles du fil santé", "articles?select=id"]];
    var res = await Promise.all(list.map(function (s) { return count(s[1]).catch(function () { return null; }); }));
    $("stats").replaceChildren();
    list.forEach(function (s, i) { if (res[i] == null) miss++; $("stats").append(card(s[0], res[i] == null ? "—" : String(res[i]))); });
    var last = "—";
    try {
      var r = await get("articles?select=updated_at&order=updated_at.desc&limit=1");
      var j = r.ok ? await r.json() : [];
      last = j[0] ? new Date(j[0].updated_at).toLocaleString("fr-FR") : "Jamais";
    } catch (e) {}
    $("stats").append(card("Dernière actualisation du fil", last));
    $("statnote").textContent = miss ? "Un tiret signifie une donnée indisponible (base ou table non configurée)." : "";
  }
  async function load() {
    if (!S) return show("login");
    try {
      var r = await get("profiles?select=role&id=eq." + S.uid), j = r.ok ? await r.json() : [];
      if (!j[0] || j[0].role !== "admin") { out(); show("denied"); return; }
      $("who").textContent = S.email || "administrateur";
      show("dash"); stats();
    } catch (e) { if (S) { $("err").textContent = "Chargement impossible."; show("login"); } }
  }
  $("form").onsubmit = async function (e) {
    e.preventDefault(); $("err").textContent = "";
    if (!C.supabaseUrl || !C.supabaseAnonKey) { $("err").textContent = "Connexion non configurée."; return; }
    try {
      var email = $("email").value.trim();
      var r = await fetch(C.supabaseUrl + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: C.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: email, password: $("pw").value }) });
      var d = await r.json();
      if (!r.ok || !d.access_token) { $("err").textContent = "Identifiants incorrects."; return; }
      S = { token: d.access_token, uid: d.user.id, email: email }; sessionStorage.setItem("medilink-admin", JSON.stringify(S)); $("pw").value = ""; load();
    } catch (x) { $("err").textContent = "Connexion impossible."; }
  };
  $("logout").onclick = out;
  load();
})();
