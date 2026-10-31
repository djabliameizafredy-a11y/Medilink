window.GemmaAssistant = {
  mode: "hospital",
  step: 0,
  history: [],
  hospitalContext: { patientName: "", condition: "", urgency: "", service: "", location: "" },
  pharmacyContext: { medication: "", urgent: "", condition: "", location: "" },

  init(mode) {
    this.resetConversation(mode || "hospital");
  },

  resetConversation(mode) {
    this.mode = mode;
    this.step = 0;
    this.history = [];
    const feed = document.getElementById("gemma-chat-feed");
    if (feed) feed.innerHTML = "";

    if (mode === "hospital") {
      this.hospitalContext = { patientName: "", condition: "", urgency: "", service: "", location: "" };
      this.addBotMessage(
        "Je suis Gemma. Pour vous orienter vers un hôpital, dites-moi le motif principal (douleur, fièvre, accident…). Vous pouvez aussi me poser n’importe quelle question de santé ou autre.",
        [
          { label: "Douleur thoracique", value: "Douleur thoracique" },
          { label: "Fièvre chez un enfant", value: "Fièvre chez un enfant" },
          { label: "Chute / traumatisme", value: "Traumatisme après une chute" }
        ]
      );
    } else {
      this.pharmacyContext = { medication: "", urgent: "", condition: "", location: "" };
      this.addBotMessage(
        "Je cherche une pharmacie autour de vous. Quel médicament vous faut-il ? Vous pouvez aussi me poser n’importe quelle question.",
        [
          { label: "Ventoline", value: "Ventoline" },
          { label: "Insuline", value: "Insuline" },
          { label: "Paracétamol", value: "Paracétamol" }
        ]
      );
    }
  },

  cityKey(t) {
    const m = { lom: "lome", accra: "accra", cotonou: "cotonou", abidjan: "abidjan", dakar: "dakar" };
    for (const k in m) if (t.indexOf(k) !== -1) return m[k];
    return null;
  },

  pendingPrompt() {
    const asks = this.mode === "hospital"
      ? ["Pour vous orienter vers un hôpital, quel est le motif, et pour qui ?", "Quel est le niveau d’urgence ?", "Où êtes-vous ? (ville ou position)"]
      : ["Pour trouver une pharmacie, quel médicament cherchez-vous ?", "Est-ce urgent ?", "Pour quelle situation ?", "Où êtes-vous ? (ville ou position)"];
    return this.step < asks.length ? "<br><br><em>" + asks[this.step] + "</em>" : "";
  },

  async callGoogleGenAI(userText) {
    const ctx = this.mode === "hospital" ? this.hospitalContext : this.pharmacyContext;
    try {
      const r = await fetch("/api/gemma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: this.mode, ctx: ctx, text: userText, history: this.history.slice(-8), step: this.step }) });
      const j = r.ok ? await r.json() : null;
      this.history.push({ role: "utilisateur", text: userText });
      if (j && j.replyHtml) this.history.push({ role: "gemma", text: String(j.replyHtml).replace(/<[^>]*>/g, " ") });
      return j;
    } catch (e) { return null; }
  },

  async handleUserInput(rawText) {
    const text = (rawText || "").trim();
    if (!text) return;
    this.addUserMessage(text);
    if (this.mode === "hospital") await this.processHospitalTurn(text);
    else await this.processPharmacyTurn(text);
  },

  async processHospitalTurn(text) {
    const ctx = this.hospitalContext;
    const lower = text.toLowerCase();
    const loading = this.addTypingIndicator();
    const ai = await this.callGoogleGenAI(text);
    if (loading) loading.remove();
    if (ai && ai.intent === "question") { this.addBotMessage(ai.replyHtml + this.pendingPrompt()); return; }
    if (ai) {
      if (ai.patientName && !ctx.patientName) ctx.patientName = ai.patientName;
      if (ai.condition && !ctx.condition) ctx.condition = ai.condition;
      if (ai.service) ctx.service = ai.service;
      if (ai.urgency && this.step >= 1) ctx.urgency = ai.urgency;
      if (ai.location && this.step >= 2) ctx.location = ai.location;
    }

    if (this.step === 0) {
      ctx.condition = ctx.condition || text;
      this.step = 1;
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Quel est le niveau d’urgence ?", [
        { label: "Critique", value: "Urgence critique, ambulance" },
        { label: "Élevée", value: "Urgence élevée" },
        { label: "Modérée", value: "Urgence modérée" },
        { label: "Consultation", value: "Consultation standard" }
      ]);
      return;
    }

    if (this.step === 1) {
      if (!ctx.urgency) {
        if (lower.indexOf("critique") !== -1 || lower.indexOf("ambulance") !== -1) ctx.urgency = "Critique";
        else if (lower.indexOf("élev") !== -1 || lower.indexOf("elev") !== -1) ctx.urgency = "Élevée";
        else if (lower.indexOf("modér") !== -1 || lower.indexOf("moder") !== -1) ctx.urgency = "Modérée";
        else ctx.urgency = "Standard";
      }
      ctx.service = ctx.service || "Urgences générales";
      this.step = 2;
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Indiquez votre ville, ou utilisez votre position pour lancer la recherche OpenStreetMap.", [
        { label: "Ma position", value: "Ma position GPS actuelle" },
        { label: "Lomé", value: "Lomé" },
        { label: "Accra", value: "Accra" }
      ]);
      return;
    }

    if (this.step === 2) {
      ctx.location = ctx.location || text;
      this.step = 3;
      if (window.MapEngine) {
        if (this.cityKey(lower)) window.MapEngine.changeCity(this.cityKey(lower));
        else if (lower.indexOf("position") !== -1 || lower.indexOf("gps") !== -1) window.MapEngine.locateUser();
        else window.MapEngine.searchNearby();
      }
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "La carte affiche les hôpitaux et cliniques autour de vous. Les horaires OpenStreetMap ne confirment pas la capacité d’accueil. Choisissez un établissement dans la liste pour appeler, tracer l’itinéraire ou envoyer une demande.");
    }
  },

  async processPharmacyTurn(text) {
    const ctx = this.pharmacyContext;
    const lower = text.toLowerCase();
    const loading = this.addTypingIndicator();
    const ai = await this.callGoogleGenAI(text);
    if (loading) loading.remove();
    if (ai && ai.intent === "question") { this.addBotMessage(ai.replyHtml + this.pendingPrompt()); return; }
    if (ai) {
      if (ai.medication && !ctx.medication) ctx.medication = ai.medication;
      if (ai.urgent && this.step >= 1) ctx.urgent = ai.urgent;
      if (ai.condition && this.step >= 2) ctx.condition = ai.condition;
      if (ai.location && this.step >= 3) ctx.location = ai.location;
    }

    if (this.step === 0) {
      ctx.medication = ctx.medication || text;
      this.step = 1;
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Ce besoin est-il urgent ?", [
        { label: "Oui, urgent", value: "Urgent, pharmacie de garde" },
        { label: "Non urgent", value: "Non urgent" }
      ]);
      return;
    }

    if (this.step === 1) {
      ctx.urgent = (lower.indexOf("urgent") !== -1 && lower.indexOf("non") === -1) ? "Urgent" : "Standard";
      this.step = 2;
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Pour quelle situation avez-vous besoin de ce médicament ?", [
        { label: "Asthme", value: "Crise d’asthme" },
        { label: "Douleur / fièvre", value: "Fièvre et douleurs" },
        { label: "Traitement habituel", value: "Renouvellement de traitement" }
      ]);
      return;
    }

    if (this.step === 2) {
      ctx.condition = ctx.condition || text;
      this.step = 3;
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Où devez-vous chercher la pharmacie ?", [
        { label: "Ma position", value: "Ma position GPS actuelle" },
        { label: "Lomé", value: "Lomé" },
        { label: "Accra", value: "Accra" }
      ]);
      return;
    }

    if (this.step === 3) {
      ctx.location = ctx.location || text;
      this.step = 4;
      if (window.MapEngine) {
        if (this.cityKey(lower)) window.MapEngine.changeCity(this.cityKey(lower));
        else if (lower.indexOf("position") !== -1 || lower.indexOf("gps") !== -1) window.MapEngine.locateUser();
        else window.MapEngine.searchNearby();
      }
      this.addBotMessage((ai && ai.replyHtml ? ai.replyHtml + "<br><br>" : "") + "Les pharmacies autour de vous apparaissent sur la carte. Un horaire OpenStreetMap n’est pas une confirmation de garde. Utilisez l’itinéraire pour vous y rendre.");
    }
  },

  addTypingIndicator() {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return null;
    const el = document.createElement("div");
    el.className = "chat-msg bot";
    el.textContent = "Gemma rédige une réponse…";
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return el;
  },

  addBotMessage(html, options) {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return;
    const el = document.createElement("div");
    el.className = "chat-msg bot";
    let buttons = "";
    if (options && options.length) {
      buttons = "<div class='d-flex flex-wrap gap-2 mt-2'>" + options.map((opt) =>
        "<button type='button' class='btn btn-sm btn-outline-dark' onclick=\"GemmaAssistant.handleUserInput('" + opt.value.replace(/'/g, "\\'") + "')\">" + opt.label + "</button>"
      ).join("") + "</div>";
    }
    el.innerHTML = html + buttons;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  },

  addUserMessage(text) {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return;
    const el = document.createElement("div");
    el.className = "chat-msg user";
    el.textContent = text;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
  }
};
