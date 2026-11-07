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
  }

};
