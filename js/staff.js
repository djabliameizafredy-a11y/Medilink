(function () {
  var C = window.MEDILINK_CONFIG || {};
  var KINDS = document.body.getAttribute("data-kind") === "pharmacy" ? ["pharmacy"] : ["hospital", "clinic"];
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = null;
  try { S = JSON.parse(sessionStorage.getItem("medilink-staff") || "null"); } catch (e) {}

  function show(id) { ["login", "denied", "history"].forEach(function (x) { $(x).hidden = x !== id; }); $("logout").hidden = id === "login"; }
  function out() { sessionStorage.removeItem("medilink-staff"); S = null; show("login"); }
  async function api(path) {
    var r = await fetch(C.supabaseUrl + "/rest/v1/" + path, { headers: { apikey: C.supabaseAnonKey, Authorization: "Bearer " + S.token } });
    if (r.status === 401) { out(); throw new Error("session expirée"); }
    return r.json();
  }
  async function load() {
    if (!S) return show("login");
    try {
      var prof = (await api("profiles?select=role,facility_id,facilities(name,kind)&id=eq." + S.uid))[0];
      var f = prof && prof.facilities;
      if (!prof || (prof.role !== "admin" && (!f || KINDS.indexOf(f.kind) === -1))) return show("denied");
      $("fac").textContent = f ? f.name : "Administrateur";
      var rows = await api("requests?select=created_at,patient_name,patient_phone,patient_coords,condition,urgency,status,code&order=created_at.desc&limit=200");
      $("rows").innerHTML = rows.length ? rows.map(function (r) {
        return "<tr><td>" + esc(new Date(r.created_at).toLocaleString("fr-FR")) + "</td><td>" + esc(r.patient_name || "Non précisé") + "</td><td>" + esc(r.patient_phone || "Non précisé") + "</td><td>" + esc(r.condition) + "</td><td>" + esc(r.urgency) + "</td><td>" + esc(r.status) + "</td><td>" + esc(r.code) + "</td></tr>";
      }).join("") : "<tr><td colspan='7' class='meta'>Aucune demande reçue pour le moment.</td></tr>";
      show("history");
    } catch (e) { if (S) { $("err").textContent = "Chargement impossible."; show("login"); } }
  }
  $("form").onsubmit = async function (e) {
    e.preventDefault(); $("err").textContent = "";
    if (!C.supabaseUrl || !C.supabaseAnonKey) { $("err").textContent = "Connexion non configurée."; return; }
    try {
      var r = await fetch(C.supabaseUrl + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: C.supabaseAnonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email: $("email").value.trim(), password: $("pw").value }) });
      var d = await r.json();
      if (!r.ok || !d.access_token) { $("err").textContent = "Identifiants incorrects."; return; }
      S = { token: d.access_token, uid: d.user.id }; sessionStorage.setItem("medilink-staff", JSON.stringify(S)); $("pw").value = ""; load();
    } catch (x) { $("err").textContent = "Connexion impossible."; }
  };
  $("logout").onclick = out;
  load();
})();
