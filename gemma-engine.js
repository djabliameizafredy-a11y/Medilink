// Moteur Conversationnel Médical & Pharmacie GEMMA IA (Connecté à l'API Google Gemini / Gemma)
// Clé configurée : "Default Gemini API Key"
// Gère les 2 grands parcours demandés :
// 1) Parcours Hôpital / Ambulance / Appel / Rendez-vous (collecte : nom, condition/maladie, niveau d'urgence, service, lieu/GPS -> scan GPS -> choix hôpital -> action)
// 2) Parcours Achat de Médicament & Pharmacie de Garde (collecte : nom médicament, urgent ou non, condition, lieu/ville -> scan Map -> trouve pharmacie de garde -> guidage GPS sur la carte)

window.GemmaAssistant = {
  apiKeyName: "Default Gemini API Key",
  apiKey: localStorage.getItem("MEDILINK_GEMINI_API_KEY") || "AIzaSyASLHZIKW---LwLrOODKm9UosQukv4xePg",
  models: ["gemma-3-27b-it", "gemini-2.0-flash", "gemini-1.5-flash"],
  activeModel: "gemma-3-27b-it / gemini-2.0-flash",
  useLiveApi: true,
  chatHistory: [],

  mode: "hospital", // "hospital" | "pharmacy"
  step: 0,

  hospitalContext: {
    patientName: "",
    condition: "",
    urgency: "",
    service: "",
    location: ""
  },

  pharmacyContext: {
    medication: "",
    urgent: "",
    condition: "",
    location: ""
  },

  init() {
    this.updateApiBadgeUI("Connecté • " + this.apiKeyName);
    this.resetConversation("hospital");
  },

  updateApiBadgeUI(statusText, isOnline = true) {
    const badge = document.getElementById("gemma-api-status");
    if (badge) {
      badge.innerHTML = `<span class="pulse-dot" style="width:6px;height:6px;background:${isOnline ? '#22c55e' : '#f59e0b'};"></span> ${statusText}`;
    }
  },

  openApiConfigPrompt() {
    const current = this.apiKey;
    const entered = prompt(
      `Configuration de la clé API (${this.apiKeyName}) :\nEntrez votre clé Google Gemini / Gemma API :`,
      current
    );
    if (entered && entered.trim()) {
      this.apiKey = entered.trim();
      localStorage.setItem("MEDILINK_GEMINI_API_KEY", this.apiKey);
      this.updateApiBadgeUI("Clé active • " + this.apiKeyName, true);
      if (window.AppController) {
        window.AppController.showToast(`Clé "${this.apiKeyName}" enregistrée et active !`);
      }
    }
  },

  switchMode(newMode) {
    this.mode = newMode;
    this.resetConversation(newMode);
    if (window.AppController) {
      window.AppController.syncDirectoryTab(newMode === "hospital" ? "hospitals" : "pharmacies");
    }
  },

  resetConversation(mode) {
    this.mode = mode;
    this.step = 0;
    this.chatHistory = [];
    const feed = document.getElementById("gemma-chat-feed");
    if (feed) feed.innerHTML = "";

    if (mode === "hospital") {
      this.hospitalContext = {
        patientName: "",
        condition: "",
        urgency: "",
        service: "",
        location: ""
      };
      this.renderSlotsBar();
      this.addBotMessage(
        `Bonjour, je suis <strong>Gemma</strong> (connectée via <em>${this.apiKeyName}</em>), votre assistante médicale d'urgence et d'orientation GPS.<br><br>` +
        `Que vous souhaitiez <strong>appeler une ambulance</strong>, <strong>lancer un appel médical</strong> ou <strong>vous rendre dans un hôpital proche</strong>, je vais recueillir les informations nécessaires pour lancer la recherche GPS.<br><br>` +
        `Pour commencer, quel est le <strong>nom du patient</strong> et quelle est sa <strong>condition ou maladie / symptôme principal</strong> ?`,
        [
          { label: "Youssef — Douleur thoracique", value: "Je m'appelle Youssef, j'ai une forte douleur thoracique" },
          { label: "Sara — Fièvre enfant 39.5°C", value: "Patient Sara, forte fièvre pédiatrique 39.5°C" },
          { label: "Karim — Fracture / Chute", value: "Karim, traumatisme au bras après une chute" },
          { label: "Urgence Ambulance immédiate", value: "Urgence vitale, besoin d'une ambulance immédiatement" }
        ]
      );
    } else {
      this.pharmacyContext = {
        medication: "",
        urgent: "",
        condition: "",
        location: ""
      };
      this.renderSlotsBar();
      this.addBotMessage(
        `Mode <strong>Pharmacie de Garde & Médicaments</strong> activé (propulsé par <em>${this.apiKeyName}</em>).<br><br>` +
        `Je vais vérifier les stocks des <strong>pharmacies de garde</strong> autour de vous et vous conduire par GPS sur la carte jusqu'à l'officine ouverte.<br><br>` +
        `Quel est le <strong>nom du médicament</strong> recherché ?`,
        [
          { label: "Ventoline 100 µg (Asthme)", value: "Ventoline 100 µg Inhalateur" },
          { label: "Insuline Lantus / NovoRapid", value: "Insuline Lantus Solostar" },
          { label: "Amoxicilline / Augmentin 1g", value: "Amoxicilline 1g" },
          { label: "Doliprane / Paracétamol 1000mg", value: "Doliprane 1000mg" },
          { label: "Adrénaline Epipen", value: "Adrénaline Epipen Auto-injecteur" }
        ]
      );
    }
  },

  renderSlotsBar() {
    const bar = document.getElementById("gemma-slots-bar");
    if (!bar) return;

    if (this.mode === "hospital") {
      const c = this.hospitalContext;
      bar.innerHTML = `
        <span class="slot-chip ${c.patientName ? 'filled' : ''}">👤 ${c.patientName || "Nom ?"}</span>
        <span class="slot-chip ${c.condition ? 'filled' : ''}">🩺 ${c.condition || "Condition / Maladie ?"}</span>
        <span class="slot-chip ${c.urgency ? 'urgent' : ''}">🚨 ${c.urgency || "Niveau d'urgence ?"}</span>
        <span class="slot-chip ${c.service ? 'filled' : ''}">🏥 ${c.service || "Service ?"}</span>
        <span class="slot-chip ${c.location ? 'filled' : ''}">📍 ${c.location || "Ville / GPS ?"}</span>
      `;
    } else {
      const p = this.pharmacyContext;
      bar.innerHTML = `
        <span class="slot-chip ${p.medication ? 'filled' : ''}">💊 ${p.medication || "Médicament ?"}</span>
        <span class="slot-chip ${p.urgent ? 'urgent' : ''}">⚡ ${p.urgent || "Urgent ou non ?"}</span>
        <span class="slot-chip ${p.condition ? 'filled' : ''}">🩺 ${p.condition || "Condition ?"}</span>
        <span class="slot-chip ${p.location ? 'filled' : ''}">📍 ${p.location || "Lieu / Ville ?"}</span>
      `;
    }
  },

  // =========================================================================
  // APPEL EN DIRECT À L'API GOOGLE GEMINI / GEMMA (AVEC EXTRACTION JSON)
  // =========================================================================
  async callGoogleGenAI(userText) {
    if (!this.apiKey) return null;

    const hospitalsSummary = window.FASTCOL_DATA.hospitals.map(h =>
      `- ${h.name} (${h.distanceKm} km, ${h.etaMin} min, Dispo: ${h.availabilityStatus}, Lits: ${h.bedsAvailable}, Ambulances: ${h.ambulancesReady}, Services: ${h.services.join(", ")}, Tél: ${h.emergencyPhone})`
    ).join("\n");

    const pharmaciesSummary = window.FASTCOL_DATA.pharmacies.map(p =>
      `- ${p.name} (${p.distanceKm} km, ${p.etaMin} min, ${p.dutyLabel}, Adresse: ${p.address}, Tél: ${p.phone}, Stocks: ${p.medications.map(m => m.name + " " + m.price).join(", ")})`
    ).join("\n");

    const systemInstruction = this.mode === "hospital"
      ? `Tu es Gemma, l'assistante IA médicale d'urgence de la plateforme Medilink / FastCol.
Ton rôle : recueillir les informations du patient (1: patientName, 2: condition/maladie, 3: urgency [Critique, Élevée, Modérée, Standard], 4: service médical [Urgences Générales, Cardiologie, Pédiatrie, Traumatologie, Maternité], 5: location/ville) avant ou pendant le lancement de la recherche GPS d'hôpitaux.
Contexte actuel déjà collecté : ${JSON.stringify(this.hospitalContext)}
Étape actuelle : ${this.step} (0=demander nom/condition, 1=demander urgence, 2=demander ville/lieu GPS, 3=présenter les hôpitaux trouvés).
Hôpitaux disponibles sur le GPS :
${hospitalsSummary}

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown autour si possible) au format :
{
  "patientName": "valeur extraite ou existante",
  "condition": "valeur extraite ou existante",
  "urgency": "Critique | Élevée | Modérée | Standard ou vide",
  "service": "Cardiologie | Pédiatrie | Traumatologie | Maternité | Urgences Générales",
  "location": "ville/quartier extrait ou existant",
  "replyHtml": "Ta réponse bienveillante, concise et professionnelle en français (2 à 4 phrases max, avec balises <strong> si utile)."
}`
      : `Tu es Gemma, l'assistante IA Pharmacie de Garde de la plateforme Medilink / FastCol.
Ton rôle : recueillir les conditions d'achat de médicament (1: medication [nom du médicament], 2: urgent [Urgent (Garde 24/7) ou Standard], 3: condition médicale/symptôme, 4: location/ville/quartier) puis lancer la recherche sur la carte GPS pour trouver la pharmacie de garde et conduire l'utilisateur jusqu'à elle.
Contexte actuel déjà collecté : ${JSON.stringify(this.pharmacyContext)}
Étape actuelle : ${this.step}.
Pharmacies de garde sur le GPS :
${pharmaciesSummary}

Réponds UNIQUEMENT avec un objet JSON valide au format :
{
  "medication": "nom du médicament extrait ou existant",
  "urgent": "Urgent (Garde 24/7) | Standard ou vide",
  "condition": "condition/symptôme extrait ou existant",
  "location": "lieu/ville extrait ou existant",
  "replyHtml": "Ta réponse concise et rassurante en français (2 à 4 phrases max, avec balises <strong> si utile)."
}`;

    const promptText = `${systemInstruction}\n\nMessage de l'utilisateur : "${userText}"`;

    for (const modelName of this.models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 450
            }
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!rawText) continue;

        this.activeModel = modelName;
        this.updateApiBadgeUI(`IA Active (${modelName})`, true);

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        // Passe automatiquement au modèle suivant ou au moteur local
      }
    }
    return null;
  },

  async handleUserInput(rawText) {
    const text = (rawText || "").trim();
    if (!text) return;

    this.addUserMessage(text);

    // Détection automatique de bascule si l'utilisateur parle de médicament/pharmacie alors qu'il est en mode hôpital
    const lower = text.toLowerCase();
    if (
      this.mode === "hospital" &&
      this.step === 0 &&
      (lower.includes("pharmacie") || lower.includes("médicament") || lower.includes("medicament") || lower.includes("ventoline") || lower.includes("insuline"))
    ) {
      window.AppController.setGemmaModeUI("pharmacy");
      this.mode = "pharmacy";
      await this.processPharmacyTurn(text);
      return;
    }

    if (this.mode === "hospital") {
      await this.processHospitalTurn(text);
    } else {
      await this.processPharmacyTurn(text);
    }
  },

  // =========================================================================
  // PARCOURS 1 : HÔPITAL / AMBULANCE / APPEL / RENDEZ-VOUS
  // =========================================================================
  async processHospitalTurn(text) {
    const lower = text.toLowerCase();
    const ctx = this.hospitalContext;

    // Relances spéciales à l'étape 3
    if (this.step >= 3) {
      if (lower.includes("suivi")) {
        window.AppController.switchMainView("tracking");
        return;
      }
      if (lower.includes("pharmacie") || lower.includes("médicament")) {
        window.AppController.setGemmaModeUI("pharmacy");
        this.switchMode("pharmacy");
        return;
      }
      if (lower.includes("recommencer") || lower.includes("nouvelle")) {
        this.resetConversation("hospital");
        return;
      }
      this.step = 0;
    }

    // Indicateur de réflexion Gemma IA
    const loadingEl = this.addTypingIndicator();
    const aiData = await this.callGoogleGenAI(text);
    if (loadingEl) loadingEl.remove();

    // Enrichir le contexte avec l'extraction IA si disponible
    if (aiData) {
      if (aiData.patientName && !ctx.patientName) ctx.patientName = aiData.patientName;
      if (aiData.condition && !ctx.condition) ctx.condition = aiData.condition;
      if (aiData.service) ctx.service = aiData.service;
      if (aiData.urgency && this.step >= 1) ctx.urgency = aiData.urgency;
      if (aiData.location && this.step >= 2) ctx.location = aiData.location;
    }

    // Détection locale complémentaire de service médical
    if (lower.includes("cardio") || lower.includes("thoracique") || lower.includes("coeur") || lower.includes("cœur")) {
      ctx.service = "Cardiologie";
    } else if (lower.includes("pédiatr") || lower.includes("pediatr") || lower.includes("enfant") || lower.includes("bébé")) {
      ctx.service = "Pédiatrie";
    } else if (lower.includes("fracture") || lower.includes("chute") || lower.includes("accident") || lower.includes("trauma") || lower.includes("brûl")) {
      ctx.service = "Traumatologie";
    } else if (lower.includes("maternit") || lower.includes("enceinte") || lower.includes("accouchement")) {
      ctx.service = "Maternité";
    }

    // Étape 0 : Nom + Condition / Maladie
    if (this.step === 0) {
      if (!ctx.patientName || !ctx.condition) {
        if (text.includes("—")) {
          const parts = text.split("—");
          ctx.patientName = ctx.patientName || parts[0].trim();
          ctx.condition = ctx.condition || parts[1].trim();
        } else if (lower.includes("m'appelle")) {
          const m = text.match(/m'appelle\s+([A-Za-zÀ-ÿ]+)/i);
          ctx.patientName = ctx.patientName || (m ? m[1] : "Patient Demandeur");
          ctx.condition = ctx.condition || text;
        } else {
          ctx.patientName = ctx.patientName || text.split(",")[0].slice(0, 26);
          ctx.condition = ctx.condition || text;
        }
      }

      this.step = 1;
      this.renderSlotsBar();

      const botReply = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br><br>Quel est le <strong>niveau d'urgence</strong> de la situation ?`
        : `Bien noté pour <strong>${ctx.patientName}</strong> (<em>${ctx.condition}</em>).<br><br>Quel est le <strong>niveau d'urgence</strong> de la situation ?`;

      this.addBotMessage(
        botReply,
        [
          { label: "🔴 Critique / Urgence vitale (Ambulance)", value: "Urgence Critique - Besoin d'ambulance" },
          { label: "🟠 Élevée (Prise en charge rapide)", value: "Urgence Élevée" },
          { label: "🟡 Modérée (Consultation aujourd'hui)", value: "Urgence Modérée" },
          { label: "🟢 Standard (Rendez-vous / Appel conseil)", value: "Consultation Standard" }
        ]
      );
      return;
    }

    // Étape 1 : Niveau d'urgence
    if (this.step === 1) {
      if (!ctx.urgency) {
        if (lower.includes("critique") || lower.includes("vitale") || lower.includes("ambulance")) {
          ctx.urgency = "Critique";
        } else if (lower.includes("élev") || lower.includes("elev") || lower.includes("rapide")) {
          ctx.urgency = "Élevée";
        } else if (lower.includes("modér") || lower.includes("moder")) {
          ctx.urgency = "Modérée";
        } else {
          ctx.urgency = "Standard";
        }
      }

      if (!ctx.service) {
        ctx.service = "Urgences Générales";
      }

      this.step = 2;
      this.renderSlotsBar();

      const botReply = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br><br>Confirmez votre <strong>ville / quartier ou position GPS</strong> pour lancer la recherche des hôpitaux proches :`
        : `Niveau d'urgence enregistré : <strong>${ctx.urgency}</strong> (Service orienté : <strong>${ctx.service}</strong>).<br><br>Dans quelle <strong>ville / quartier</strong> vous trouvez-vous actuellement pour lancer le scan GPS des hôpitaux proches ?`;

      this.addBotMessage(
        botReply,
        [
          { label: "📍 Utiliser ma position GPS actuelle (Casablanca Centre)", value: "Ma position GPS actuelle - Casablanca Centre" },
          { label: "📍 Quartier Anfa / Racine", value: "Casablanca - Quartier Anfa" },
          { label: "📍 Quartier Hay Hassani", value: "Casablanca - Hay Hassani" },
          { label: "📍 Mers Sultan / Centre", value: "Casablanca - Mers Sultan" }
        ]
      );
      return;
    }

    // Étape 2 : Localisation -> Lancement de la recherche GPS sur la carte !
    if (this.step === 2) {
      ctx.location = ctx.location || text;
      this.step = 3;
      this.renderSlotsBar();

      const hospitals = window.FASTCOL_DATA.hospitals;
      const matches = hospitals.filter(h =>
        !ctx.service || ctx.service === "Urgences Générales" || h.services.some(s => s.toLowerCase().includes(ctx.service.toLowerCase()))
      );
      const results = (matches.length ? matches : hospitals).slice(0, 3);

      if (window.AppController) {
        window.AppController.filterDirectoryByService(ctx.service);
        window.AppController.highlightFacilityOnMap(results[0].id, "hospital");
      }

      let cardsHtml = results.map(h => `
        <div class="gemma-result-card">
          <h4>
            <span>🏥 ${h.name}</span>
            <span style="font-size:11px;color:#38bdf8;">${h.distanceKm} km (${h.etaMin} min)</span>
          </h4>
          <div class="gemma-result-meta">
            <div>✅ <strong>Disponibilité :</strong> ${h.availabilityStatus} (${h.bedsAvailable} lits • ${h.ambulancesReady} ambulances)</div>
            <div>🩺 <strong>Service :</strong> ${h.services.slice(0, 3).join(", ")}</div>
            <div>📞 <strong>Urgences :</strong> ${h.emergencyPhone} | Standard : ${h.phone}</div>
          </div>
          <div class="gemma-action-grid">
            <button class="gemma-action-btn ambulance" onclick="window.AppController.acceptHospitalAction('${h.id}', 'ambulance')">
              🚑 Appeler Ambulance
            </button>
            <button class="gemma-action-btn rdv" onclick="window.AppController.acceptHospitalAction('${h.id}', 'rdv')">
              📅 Prendre RDV
            </button>
            <button class="gemma-action-btn call" onclick="window.AppController.acceptHospitalAction('${h.id}', 'call')">
              📞 Appeler (${h.doctor.name.split(' ')[1]})
            </button>
            <button class="gemma-action-btn gps" onclick="window.AppController.acceptHospitalAction('${h.id}', 'gps')">
              🧭 S'y rendre (GPS)
            </button>
          </div>
        </div>
      `).join("");

      const introHtml = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br>`
        : `🛰️ <strong>Recherche GPS terminée autour de "${ctx.location}" !</strong><br>J'ai localisé <strong>${results.length} établissements</strong> adaptés pour <em>${ctx.condition}</em> (Urgence <strong>${ctx.urgency}</strong>) :<br>`;

      this.addBotMessage(
        introHtml +
        cardsHtml +
        `<div style="margin-top:8px;font-size:11.5px;color:#94a3b8;">Acceptez l'établissement de votre choix ci-dessus pour : <strong>appeler une ambulance</strong>, <strong>prendre rendez-vous</strong>, <strong>appeler directement</strong> ou <strong>lancer l'itinéraire GPS</strong>.</div>`,
        [
          { label: "💊 Chercher aussi une Pharmacie de Garde", value: "Basculer vers recherche de médicament" },
          { label: "🔄 Nouvelle demande médicale", value: "Recommencer une recherche" }
        ]
      );
      return;
    }
  },

  // =========================================================================
  // PARCOURS 2 : ACHAT DE MÉDICAMENT & PHARMACIE DE GARDE SUR LA MAP
  // =========================================================================
  async processPharmacyTurn(text) {
    const lower = text.toLowerCase();
    const pctx = this.pharmacyContext;

    if (this.step >= 4) {
      if (lower.includes("démarrer") || lower.includes("demarrer") || lower.includes("guidage")) {
        if (window.AppController) {
          window.AppController.toggleTurnByTurnSimulation(true);
        }
        this.addBotMessage(
          `🧭 <strong>Navigation GPS en temps réel activée !</strong> Suivez la ligne verte sur la carte : <em>Tournez à droite sur Rue des Lilas (0,4 km)</em>.`
        );
        return;
      } else if (lower.includes("hôpital") || lower.includes("hopital") || lower.includes("ambulance")) {
        window.AppController.setGemmaModeUI("hospital");
        this.switchMode("hospital");
        return;
      } else {
        this.resetConversation("pharmacy");
        return;
      }
    }

    const loadingEl = this.addTypingIndicator();
    const aiData = await this.callGoogleGenAI(text);
    if (loadingEl) loadingEl.remove();

    if (aiData) {
      if (aiData.medication && !pctx.medication) pctx.medication = aiData.medication;
      if (aiData.urgent && this.step >= 1) pctx.urgent = aiData.urgent;
      if (aiData.condition && this.step >= 2) pctx.condition = aiData.condition;
      if (aiData.location && this.step >= 3) pctx.location = aiData.location;
    }

    // Étape 0 : Nom du médicament
    if (this.step === 0) {
      pctx.medication = pctx.medication || text;
      this.step = 1;
      this.renderSlotsBar();

      const botReply = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br><br>Cet achat est-il <strong>urgent (besoin immédiat en Pharmacie de Garde)</strong> ou <strong>non urgent</strong> ?`
        : `Médicament recherché : <strong>${pctx.medication}</strong>.<br><br>Cet achat est-il <strong>urgent (besoin immédiat en Pharmacie de Garde)</strong> ou <strong>non urgent</strong> ?`;

      this.addBotMessage(
        botReply,
        [
          { label: "🚨 Oui, URGENT (Pharmacie de Garde immédiate)", value: "Urgent - Besoin immédiat en pharmacie de garde" },
          { label: "🕒 Non urgent (Achat standard)", value: "Non urgent - Standard" }
        ]
      );
      return;
    }

    // Étape 1 : Urgent ou non -> demande Condition / Symptômes
    if (this.step === 1) {
      pctx.urgent = (lower.includes("urgent") && !lower.includes("non")) ? "Urgent (Garde 24/7)" : "Standard";
      this.step = 2;
      this.renderSlotsBar();

      const botReply = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br><br>Pour quelle <strong>condition médicale / symptôme</strong> (et avez-vous une ordonnance) ?`
        : `Noté : <strong>${pctx.urgent}</strong>.<br><br>Pour quelle <strong>condition médicale / symptôme</strong> (et avez-vous une ordonnance si requise) ?`;

      this.addBotMessage(
        botReply,
        [
          { label: "Crise d'asthme / Gêne respiratoire (Avec ordonnance)", value: "Crise d'asthme - Avec ordonnance" },
          { label: "Diabète / Traitement quotidien", value: "Diabète - Renouvellement urgent" },
          { label: "Fièvre / Douleur aiguë (Sans ordonnance)", value: "Fièvre et douleurs aiguës" },
          { label: "Infection bactérienne (Ordonnance médecin)", value: "Infection sous ordonnance médicale" }
        ]
      );
      return;
    }

    // Étape 2 : Condition -> demande Lieu / Ville
    if (this.step === 2) {
      pctx.condition = pctx.condition || text;
      this.step = 3;
      this.renderSlotsBar();

      const botReply = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br><br>Indiquez votre <strong>lieu, quartier ou ville</strong> pour localiser la Pharmacie de Garde sur la carte GPS :`
        : `Condition enregistrée : <em>${pctx.condition}</em>.<br><br>Indiquez votre <strong>lieu, quartier ou ville</strong> (ou utilisez votre GPS) pour localiser la <strong>Pharmacie de Garde</strong> qui dispose de <strong>${pctx.medication}</strong> :`;

      this.addBotMessage(
        botReply,
        [
          { label: "📍 Ma position GPS actuelle (Quartier Gautier / Centre)", value: "Casablanca - Quartier Gautier (GPS Actuel)" },
          { label: "📍 Centre-Ville / Quai de la Liberté", value: "Casablanca - Quai de la Liberté" },
          { label: "📍 Avenue du Port", value: "Casablanca - Avenue du Port" }
        ]
      );
      return;
    }

    // Étape 3 : Lieu / Ville -> Recherche sur la Map & Guidage GPS jusqu'à la Pharmacie de Garde !
    if (this.step === 3) {
      pctx.location = pctx.location || text;
      this.step = 4;
      this.renderSlotsBar();

      const pharmacies = window.FASTCOL_DATA.pharmacies;
      const medKey = pctx.medication.toLowerCase().split(" ")[0];

      let matchingPharmacies = pharmacies.filter(ph =>
        ph.medications.some(m => m.name.toLowerCase().includes(medKey))
      );
      if (matchingPharmacies.length === 0) {
        matchingPharmacies = pharmacies;
      }

      const bestPharm = matchingPharmacies[0];
      const matchedMed =
        bestPharm.medications.find(m => m.name.toLowerCase().includes(medKey)) ||
        { name: pctx.medication, stock: "En stock confirmé (Garde)", price: "65 MAD" };

      if (window.AppController) {
        window.AppController.syncDirectoryTab("pharmacies");
        window.AppController.startGpsRouteToFacility(bestPharm.id, "pharmacy", true);
      }

      let pharmCards = matchingPharmacies.map(ph => {
        const medObj =
          ph.medications.find(m => m.name.toLowerCase().includes(medKey)) ||
          { name: pctx.medication, stock: "En stock (Vérifié)", price: "65 MAD" };
        return `
          <div class="gemma-result-card" style="border-color:#22c55e;">
            <h4>
              <span>🟢 ${ph.name}</span>
              <span style="font-size:11px;color:#4ade80;">${ph.distanceKm} km (${ph.etaMin} min)</span>
            </h4>
            <div class="gemma-result-meta">
              <div>🛡️ <strong>Statut :</strong> <span style="color:#4ade80;font-weight:700;">${ph.dutyLabel}</span></div>
              <div>💊 <strong>${medObj.name} :</strong> ${medObj.stock} — <strong>${medObj.price}</strong></div>
              <div>📍 <strong>Adresse :</strong> ${ph.address}</div>
              <div>📞 <strong>Téléphone :</strong> ${ph.phone} (${ph.pharmacist})</div>
            </div>
            <div class="gemma-action-grid">
              <button class="gemma-action-btn gps" onclick="window.AppController.acceptPharmacyAction('${ph.id}', 'gps', '${medObj.name.replace(/'/g, "\\'")}')">
                🧭 Me conduire (GPS)
              </button>
              <button class="gemma-action-btn rdv" onclick="window.AppController.acceptPharmacyAction('${ph.id}', 'reserve', '${medObj.name.replace(/'/g, "\\'")}')">
                🛍️ Réserver boîte
              </button>
              <button class="gemma-action-btn call" onclick="window.AppController.acceptPharmacyAction('${ph.id}', 'call', '${medObj.name.replace(/'/g, "\\'")}')">
                📞 Appeler Garde
              </button>
              <button class="gemma-action-btn ambulance" onclick="window.AppController.acceptPharmacyAction('${ph.id}', 'start-nav', '${medObj.name.replace(/'/g, "\\'")}')">
                ▶️ DÉMARRER Trajet
              </button>
            </div>
          </div>
        `;
      }).join("");

      const introHtml = (aiData && aiData.replyHtml)
        ? `${aiData.replyHtml}<br>`
        : `🗺️ <strong>Pharmacie de Garde localisée sur le GPS !</strong><br>J'ai trouvé <strong>${bestPharm.name}</strong> ouverte en garde à <strong>${bestPharm.distanceKm} km (${bestPharm.etaMin} min)</strong> avec <strong>${matchedMed.name}</strong> en stock.<br>L'itinéraire GPS est déjà tracé sur la carte pour vous conduire jusqu'à la pharmacie :`;

      this.addBotMessage(
        introHtml + pharmCards,
        [
          { label: "▶️ Démarrer le guidage vocal GPS maintenant", value: "Démarrer le guidage GPS" },
          { label: "💊 Chercher un autre médicament", value: "Autre médicament" },
          { label: "🏥 Basculer vers Recherche Hôpital / Ambulance", value: "Mode Hôpital" }
        ]
      );
      return;
    }
  },

  addTypingIndicator() {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return null;
    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg bot";
    msgDiv.innerHTML = `
      <div class="chat-msg-sender">✨ Gemma IA (${this.apiKeyName})</div>
      <div style="color:#a5b4fc;font-size:12px;">Analyse médicale & interrogation GPS en cours...</div>
    `;
    feed.appendChild(msgDiv);
    feed.scrollTop = feed.scrollHeight;
    return msgDiv;
  },

  addBotMessage(htmlContent, quickOptions = []) {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg bot";

    let optionsHtml = "";
    if (quickOptions && quickOptions.length > 0) {
      optionsHtml = `<div class="chat-quick-options">` +
        quickOptions.map(opt =>
          `<button class="quick-option-btn" onclick="window.GemmaAssistant.handleUserInput('${opt.value.replace(/'/g, "\\'")}')">${opt.label}</button>`
        ).join("") +
        `</div>`;
    }

    msgDiv.innerHTML = `
      <div class="chat-msg-sender">✨ Assistant Médical Gemma IA</div>
      <div>${htmlContent}</div>
      ${optionsHtml}
    `;

    feed.appendChild(msgDiv);
    feed.scrollTop = feed.scrollHeight;
  },

  addUserMessage(text) {
    const feed = document.getElementById("gemma-chat-feed");
    if (!feed) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "chat-msg user";
    msgDiv.textContent = text;
    feed.appendChild(msgDiv);
    feed.scrollTop = feed.scrollHeight;
  }
};
