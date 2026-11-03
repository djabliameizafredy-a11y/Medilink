window.Pages = {

  esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  initHome() {},

  async initSearchPage(kind) {
    const types = kind === "pharmacy" ? ["pharmacy"] : ["hospital", "clinic"];
    window.MediBot.init(kind);
    await window.MedilinkDB.load();
    window.MapEngine.init(kind === "pharmacy" ? "map-pharmacy" : "map-hospital", {
      listId: "facility-list",
      statusId: "map-status",
      types: types
    });
  },

  async createRequestFromFacility(facilityId) {
    const item = window.MapEngine.findById(facilityId);
    if (!item) return;
    const ctx = window.MediBot.mode === "pharmacy" ? window.MediBot.pharmacyContext : window.MediBot.hospitalContext;
    const code = "MLK-" + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
    const ok = window.MedilinkDB ? await window.MedilinkDB.saveRequest(code, ctx, item, window.MediBot.mode) : false;
    const name = this.esc(item.name);
    window.MediBot.addBotMessage(ok
      ? "Votre demande est enregistrée pour <strong>" + name + "</strong>. Code : <strong>" + code + "</strong>. Si c’est urgent, appelez aussi l’établissement."
      : "La demande n’a pas pu être envoyée pour le moment. Appelez directement <strong>" + name + "</strong>.");
  },

  initAdmin(tab) {
    const requests = window.FASTCOL_DATA.requests;
    const flagged = requests.filter((r) => r.flaggedAbusive || r.abuseScore >= 50);
    const box = document.getElementById("admin-content");
    if (!box) return;
    if (tab === "accounts") {
      box.innerHTML = "<table class='table'><thead><tr><th>Nom</th><th>Rôle</th><th>Établissement</th><th>Statut</th></tr></thead><tbody>" +
        window.FASTCOL_DATA.users.map((u) => "<tr><td>" + u.name + "</td><td>" + u.role + "</td><td>" + u.establishment + "</td><td>" + u.status + "</td></tr>").join("") +
        "</tbody></table>";
    } else if (tab === "history") {
      box.innerHTML = "<table class='table'><thead><tr><th>Réf.</th><th>Demandeur</th><th>Établissement</th><th>Statut</th></tr></thead><tbody>" +
        requests.map((r) => "<tr><td>" + r.id + "</td><td>" + r.patientName + "</td><td>" + r.facilityName + "</td><td>" + r.status + "</td></tr>").join("") +
        "</tbody></table>";
    } else if (tab === "abuse") {
      box.innerHTML = flagged.length
        ? "<table class='table'><thead><tr><th>Réf.</th><th>Compte</th><th>Score</th><th>Motif</th></tr></thead><tbody>" +
          flagged.map((r) => "<tr><td>" + r.id + "</td><td>" + r.patientName + "</td><td>" + r.abuseScore + " %</td><td>" + (r.abuseReason || "Incohérence signalée") + "</td></tr>").join("") +
          "</tbody></table>"
        : "<p class='meta'>Aucun signalement abusif en attente.</p>";
    } else {
      box.innerHTML = "<table class='table'><thead><tr><th>Établissement</th><th>Type</th><th>Contact</th><th>Info déclarée</th></tr></thead><tbody>" +
        window.FASTCOL_DATA.hospitals.map((h) => "<tr><td>" + h.name + "</td><td>Hôpital</td><td>" + h.emergencyPhone + "</td><td>" + h.availabilityStatus + "</td></tr>").join("") +
        window.FASTCOL_DATA.pharmacies.map((p) => "<tr><td>" + p.name + "</td><td>Pharmacie</td><td>" + p.phone + "</td><td>" + p.dutyLabel + "</td></tr>").join("") +
        "</tbody></table>";
    }
  }
};
