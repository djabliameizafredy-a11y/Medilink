window.GemmaAssistant = {
  apiKeyName: "Default Gemini API Key",
  apiKey: localStorage.getItem("MEDILINK_GEMINI_API_KEY") || "AIzaSyASLHZIKW---LwLrOODKm9UosQukv4xePg",
  models: ["gemma-3-27b-it", "gemini-2.0-flash", "gemini-1.5-flash"],
  mode: "hospital",
  step: 0,
  hospitalContext: { patientName: "", condition: "", urgency: "", service: "", location: "" },
  pharmacyContext: { medication: "", urgent: "", condition: "", location: "" },

  init(mode) {
    this.resetConversation(mode || "hospital");
  },

  resetConversation(mode) {
    this.mode = mode;
    this.step = 0;
    const feed = document.getElementById("gemma-chat-feed");
    if (feed) feed.innerHTML = "";

    if (mode === "hospital") {
      this.hospitalContext = { patientName: "", condition: "", urgency: "", service: "", location: "" };
      this.addBotMessage(
        "Je suis Gemma. Pour lancer une recherche d’hôpital, j’ai besoin du nom du patient et du motif principal (douleur, fièvre, accident…).",
        [
          { label: "Douleur thoracique", value: "Je m’appelle Youssef, douleur thoracique" },
          { label: "Fièvre chez un enfant", value: "Patient Sara, fièvre pédiatrique 39.5" },
          { label: "Chute / traumatisme", value: "Karim, traumatisme après une chute" }
        ]
      );
    } else {
      this.pharmacyContext = { medication: "", urgent: "", condition: "", location: "" };
      this.addBotMessage(
        "Je cherche une pharmacie autour de vous. Quel médicament vous faut-il ?",
        [
          { label: "Ventoline", value: "Ventoline 100 µg" },
          { label: "Insuline", value: "Insuline Lantus" },
          { label: "Paracétamol", value: "Doliprane 1000mg" }
        ]
      );
    }
  },

  async callGoogleGenAI(userText) {
    if (!this.apiKey) return null;
    const ctx = this.mode === "hospital" ? this.hospitalContext : this.pharmacyContext;
    const prompt = this.mode === "hospital"
      ? "Tu es Gemma, assistante d’orientation médicale. Extraire patientName, condition, urgency (Critique|Élevée|Modérée|Standard), service, location. Contexte: " + JSON.stringify(ctx) + ". Réponds en JSON {patientName,condition,urgency,service,location,replyHtml}."
      : "Tu es Gemma, assistante pharmacie. Extraire medication, urgent, condition, location. Contexte: " + JSON.stringify(ctx) + ". Réponds en JSON {medication,urgent,condition,location,replyHtml}.";

    for (let i = 0; i < this.models.length; i++) {
      try {
        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + this.models[i] + ":generateContent?key=" + encodeURIComponent(this.apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt + "\nMessage: " + userText }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 350 }
            })
          }
        );
        if (!response.ok) continue;
        const data = await response.json();
        const raw = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]
          ? data.candidates[0].content.parts[0].text
          : "";
        const match = raw && raw.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      } catch (err) {
        // Try next model
      }
    }
    return null;
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
    if (ai) {
      if (ai.patientName && !ctx.patientName) ctx.patientName = ai.patientName;
      if (ai.condition && !ctx.condition) ctx.condition = ai.condition;
      if (ai.service) ctx.service = ai.service;
      if (ai.urgency && this.step >= 1) ctx.urgency = ai.urgency;
      if (ai.location && this.step >= 2) ctx.location = ai.location;
    }

    if (this.step === 0) {
      ctx.patientName = ctx.patientName || text.split(",")[0].slice(0, 28);
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
        { label: "Casablanca", value: "Casablanca" },
        { label: "Rabat", value: "Rabat" }
      ]);
      return;
    }

    if (this.step === 2) {
      ctx.location = ctx.location || text;
      this.step = 3;
      if (window.MapEngine) {
        if (lower.indexOf("rabat") !== -1) window.MapEngine.changeCity("rabat");
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
        { label: "Casablanca", value: "Casablanca" },
        { label: "Rabat", value: "Rabat" }
      ]);
      return;
    }

    if (this.step === 3) {
      ctx.location = ctx.location || text;
      this.step = 4;
      if (window.MapEngine) {
        if (lower.indexOf("rabat") !== -1) window.MapEngine.changeCity("rabat");
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
