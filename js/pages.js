window.Pages = {
  activeRequestId: null,

  esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  initHome() {},

  async initSearchPage(kind) {
    const types = kind === "pharmacy" ? ["pharmacy"] : ["hospital", "clinic"];
    window.GemmaAssistant.init(kind);
    await window.MedilinkDB.load();
    window.MapEngine.init(kind === "pharmacy" ? "map-pharmacy" : "map-hospital", {
      listId: "facility-list",
      statusId: "map-status",
      types: types
    });
  },

  createRequestFromFacility(facilityId) {
    const item = window.MapEngine.findById(facilityId);
    if (!item) return;
    const ctx = window.GemmaAssistant.mode === "pharmacy"
      ? window.GemmaAssistant.pharmacyContext
      : window.GemmaAssistant.hospitalContext;
    const request = {
      id: "REQ-" + Date.now(),
      type: item.type === "pharmacy" ? "Pharmacie" : "Hôpital",
      patientName: this.esc(ctx.patientName || "Demandeur"),
      condition: this.esc(ctx.condition || ctx.medication || "Demande d’orientation"),
      urgency: this.esc(ctx.urgency || ctx.urgent || "Non précisé"),
      service: this.esc(ctx.service || item.healthcare || item.type),
      facilityId: item.id,
      facilityName: this.esc(item.name),
      actionChosen: "Demande envoyée depuis la carte",
      status: "Envoyée",
      createdAt: "À l’instant",
      patientCoords: window.FASTCOL_DATA.userPosition.lat.toFixed(4) + ", " + window.FASTCOL_DATA.userPosition.lng.toFixed(4),
      patientPhone: "",
      abuseScore: 0,
      flaggedAbusive: false,
      messages: [{
        sender: "Medilink",
        time: new Date().toTimeString().slice(0, 5),
        text: "Demande transmise à " + this.esc(item.name) + "."
      }]
    };
    window.FASTCOL_DATA.requests.unshift(request);
    if (window.MedilinkDB) window.MedilinkDB.saveRequest(request.id, ctx, item, window.GemmaAssistant.mode);
    this.activeRequestId = request.id;
    sessionStorage.setItem("medilink-active-request", request.id);
    window.location.href = "suivi.html";
  },

  requestById(id) {
    return window.FASTCOL_DATA.requests.find((r) => r.id === id) || window.FASTCOL_DATA.requests[0];
  },

  initTracking() {
    this.activeRequestId = sessionStorage.getItem("medilink-active-request") || (window.FASTCOL_DATA.requests[0] || {}).id;
    this.renderTracking();
  },

  renderTracking() {
    const req = this.requestById(this.activeRequestId);
    if (!req) {
      ["request-select", "status-stepper", "request-messages"].forEach((i) => { const e = document.getElementById(i); if (e) e.innerHTML = ""; });
      const dd = document.getElementById("request-details");
      if (dd) dd.innerHTML = "<p class='meta mb-0'>Aucune demande pour le moment. Lancez une recherche, puis envoyez une demande à un établissement.</p>";
      return;
    }
    const statuses = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];
    const index = Math.max(0, statuses.indexOf(req.status));
    const select = document.getElementById("request-select");
    const stepper = document.getElementById("status-stepper");
    const details = document.getElementById("request-details");
    const messages = document.getElementById("request-messages");
    if (select) {
      select.innerHTML = window.FASTCOL_DATA.requests.map((r) =>
        "<option value='" + r.id + "'" + (r.id === req.id ? " selected" : "") + ">" + r.id + " — " + r.facilityName + "</option>"
      ).join("");
    }
    if (stepper) {
      stepper.innerHTML = statuses.map((status, i) => {
        const cls = i < index ? "done" : i === index ? "current" : "";
        return "<div class='col-6 col-md-3'><div class='status-step " + cls + "'><div class='meta mb-1'>Étape " + (i + 1) + "</div><strong>" + status + "</strong></div></div>";
      }).join("");
    }
    if (details) {
      details.innerHTML = "<p class='mb-1'><strong>" + req.patientName + "</strong> · " + req.condition + "</p>" +
        "<p class='meta mb-0'>" + req.facilityName + " · " + req.urgency + " · " + req.createdAt + "</p>";
    }
    if (messages) {
      messages.innerHTML = req.messages.map((m) =>
        "<div class='mb-3'><div class='meta'>" + m.sender + " · " + m.time + "</div><div>" + m.text + "</div></div>"
      ).join("");
    }
  },

  selectTracking(id) {
    this.activeRequestId = id;
    sessionStorage.setItem("medilink-active-request", id);
    this.renderTracking();
  },

  sendTrackingMessage() {
    const input = document.getElementById("tracking-message");
    const req = this.requestById(this.activeRequestId);
    if (!input || !input.value.trim() || !req) return;
    req.messages.push({
      sender: req.patientName,
      time: new Date().toTimeString().slice(0, 5),
      text: this.esc(input.value.trim())
    });
    input.value = "";
    this.renderTracking();
  },

  advanceStatus() {
    const req = this.requestById(this.activeRequestId);
    if (!req) return;
    const order = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];
    const next = order[Math.min(order.length - 1, order.indexOf(req.status) + 1)];
    req.status = next;
    req.messages.push({
      sender: req.facilityName,
      time: new Date().toTimeString().slice(0, 5),
      text: "Statut mis à jour : " + next + "."
    });
    this.renderTracking();
  },

  initHospital() {
    this.activeRequestId = (window.FASTCOL_DATA.requests[0] || {}).id;
    this.renderHospital();
  },

  renderHospital() {
    const req = this.requestById(this.activeRequestId);
    const list = document.getElementById("hospital-requests");
    const detail = document.getElementById("hospital-detail");
    if (!req) {
      if (list) list.innerHTML = "";
      if (detail) detail.innerHTML = "<p class='meta mb-0'>Aucune demande reçue pour le moment.</p>";
      return;
    }
    if (list) {
      list.innerHTML = window.FASTCOL_DATA.requests.map((r) =>
        "<button type='button' class='list-group-item list-group-item-action " + (r.id === req.id ? "active" : "") + "' onclick=\"Pages.selectHospital('" + r.id + "')\">" +
        "<div class='d-flex justify-content-between'><span>" + r.patientName + "</span><span>" + r.status + "</span></div>" +
        "<div class='small'>" + r.condition + "</div></button>"
      ).join("");
    }
    if (detail) {
      const statuses = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];
      detail.innerHTML = "<h2 class='h4'>" + req.patientName + "</h2>" +
        "<p class='meta'>" + req.id + " · " + req.facilityName + "</p>" +
        "<p>" + req.condition + "</p>" +
        "<p class='meta'>Position : " + req.patientCoords + "</p>" +
        "<div class='d-flex flex-wrap gap-2 mb-3'>" +
        statuses.map((s) => "<button class='btn btn-sm " + (req.status === s ? "btn-primary" : "btn-outline-dark") + "' type='button' onclick=\"Pages.setHospitalStatus('" + req.id + "','" + s + "')\">" + (s === "Reçue" ? "Confirmer la réception" : s) + "</button>").join("") +
        "</div>" +
        "<div class='mb-3'>" + req.messages.map((m) => "<div class='mb-2'><div class='meta'>" + m.sender + "</div>" + m.text + "</div>").join("") + "</div>" +
        "<div class='input-group'><input id='hospital-message' class='form-control' placeholder='Répondre au demandeur'><button class='btn btn-primary' type='button' onclick=\"Pages.sendHospitalMessage()\">Envoyer</button></div>";
    }
  },

  selectHospital(id) {
    this.activeRequestId = id;
    this.renderHospital();
  },

  setHospitalStatus(id, status) {
    const req = this.requestById(id);
    if (!req) return;
    req.status = status;
    req.messages.push({
      sender: "Personnel hospitalier",
      time: new Date().toTimeString().slice(0, 5),
      text: "Statut : " + status + "."
    });
    this.renderHospital();
  },

  sendHospitalMessage() {
    const input = document.getElementById("hospital-message");
    const req = this.requestById(this.activeRequestId);
    if (!input || !input.value.trim() || !req) return;
    req.messages.push({
      sender: "Personnel hospitalier",
      time: new Date().toTimeString().slice(0, 5),
      text: this.esc(input.value.trim())
    });
    input.value = "";
    this.renderHospital();
  },

  updateHospitalAvailability() {
    const hospital = window.FASTCOL_DATA.hospitals[0] || { name: "votre établissement" };
    const status = document.getElementById("avail-status");
    const beds = document.getElementById("avail-beds");
    const amb = document.getElementById("avail-amb");
    if (status) hospital.availabilityStatus = status.value;
    if (beds) hospital.bedsAvailable = parseInt(beds.value, 10) || 0;
    if (amb) hospital.ambulancesReady = parseInt(amb.value, 10) || 0;
    alert("Disponibilité déclarée mise à jour pour " + hospital.name + ".");
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
