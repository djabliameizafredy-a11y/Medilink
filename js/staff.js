(function () {
  var C = window.MEDILINK_CONFIG || {};
  var KINDS = document.body.getAttribute("data-kind") === "pharmacy" ? ["pharmacy"] : ["hospital", "clinic"];
  var $ = function (i) { return document.getElementById(i); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var S = null, FID = null;
  try { S = JSON.parse(sessionStorage.getItem("medilink-staff") || "null"); } catch (e) {}

  function show(id) { $("pros").hidden = true; ["login", "denied", "history"].forEach(function (x) { $(x).hidden = x !== id; }); $("logout").hidden = id === "login"; }
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
      FID = (prof && prof.facility_id) || null;
      loadPros();
    } catch (e) { if (S) { $("err").textContent = "Chargement impossible."; show("login"); } }
  }
  function hdr() { return { apikey: C.supabaseAnonKey, Authorization: "Bearer " + S.token }; }
  async function loadPros() {
    if (!FID) return;
    $("pros").hidden = false;
    var L = await api("professionals?select=id,full_name,domain,specialty,experience_years,photo_path,status&facility_id=eq." + FID + "&order=created_at.desc");
    var ST = { pending: "en attente de vérification", approved: "visible", hidden: "masqué" };
    $("plist").innerHTML = L.length ? L.map(function (p) {
      var img = p.photo_path ? "<img src='" + esc(C.supabaseUrl) + "/storage/v1/object/public/professionals/" + esc(p.photo_path) + "' alt='' width='56' height='56' style='object-fit:cover;border-radius:12px'>" : window.Avatar.html(p.full_name, 56);
      var line = [p.domain, p.specialty, p.experience_years != null ? p.experience_years + " ans d’expérience" : ""].filter(Boolean).join(", ");
      return "<div class='d-flex gap-3 align-items-center py-2 border-top'>" + img + "<div class='flex-grow-1'><strong>" + esc(p.full_name) + "</strong><div class='meta'>" + esc(line + " (" + ST[p.status] + ")") + "</div></div><button class='btn btn-sm btn-outline-dark' data-del='" + esc(p.id) + "'>Retirer</button></div>";
    }).join("") : "<p class='meta'>Aucun professionnel enregistré.</p>";
  }
  $("plist").onclick = async function (e) {
    var id = e.target.getAttribute("data-del");
    if (!id) return;
    await fetch(C.supabaseUrl + "/rest/v1/professionals?id=eq." + encodeURIComponent(id), { method: "DELETE", headers: hdr() });
    loadPros();
  };
  $("pform").onsubmit = async function (e) {
    e.preventDefault(); $("perr").textContent = "";
    var file = $("pp").files[0], path = null;
    try {
      if (file) {
        if (["image/jpeg", "image/png"].indexOf(file.type) === -1 || file.size > 2097152) { $("perr").textContent = "Photo : JPEG ou PNG, 2 Mo maximum."; return; }
        path = FID + "/" + crypto.randomUUID() + (file.type === "image/png" ? ".png" : ".jpg");
        var up = await fetch(C.supabaseUrl + "/storage/v1/object/professionals/" + path, { method: "POST", headers: Object.assign(hdr(), { "Content-Type": file.type }), body: file });
        if (!up.ok) { $("perr").textContent = "Envoi de la photo impossible."; return; }
      }
      var r = await fetch(C.supabaseUrl + "/rest/v1/professionals", { method: "POST", headers: Object.assign(hdr(), { "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify({ facility_id: FID, full_name: $("pn").value.trim(), domain: $("pd").value.trim(), specialty: $("ps").value.trim() || null, experience_years: $("pe").value === "" ? null : Number($("pe").value), bio: $("pb").value.trim() || null, photo_path: path, status: "pending" }) });
      if (!r.ok) { $("perr").textContent = "Enregistrement impossible."; return; }
      $("pform").reset(); loadPros();
    } catch (x) { $("perr").textContent = "Enregistrement impossible."; }
  };
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
