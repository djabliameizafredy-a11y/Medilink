// Moteur Conversationnel Médical & Pharmacie GEMMA IA
// Gère les 2 grands parcours demandés :
// 1) Parcours Hôpital / Ambulance / Appel / Rendez-vous (collecte : nom, condition/maladie, niveau d'urgence, service, lieu/GPS -> scan GPS -> choix hôpital -> action)
// 2) Parcours Achat de Médicament & Pharmacie de Garde (collecte : nom médicament, urgent ou non, condition, lieu/ville -> scan Map -> trouve pharmacie de garde -> guidage GPS sur la carte)

window.GemmaAssistant = {
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
    this.resetConversation("hospital");
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
        `Bonjour, je suis <strong>Gemma</strong>, votre assistante médicale d'urgence et d'orientation GPS.<br><br>` +
        `Que vous souhaitiez <strong>appeler une ambulance</strong>, <strong>lancer un appel médical</strong> ou <strong>vous rendre dans un hôpital proche</strong>, je vais recueillir quelques informations rapides pour lancer la recherche GPS.<br><br>` +
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
        `Mode <strong>Pharmacie de Garde & Médicaments</strong> activé.<br><br>` +
        `Je vais vérifier les stocks des <strong>pharmacies de garde</strong> autour de vous et vous guider par GPS jusqu'à l'officine ouverte.<br><br>` +
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

  handleUserInput(rawText) {
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
      this.processPharmacyTurn(text);
      return;
    }

    if (this.mode === "hospital") {
      this.processHospitalTurn(text);
    } else {
      this.processPharmacyTurn(text);
    }
  },

  // =========================================================================
  // PARCOURS 1 : HÔPITAL / AMBULANCE / APPEL / RENDEZ-VOUS
  // =========================================================================
  processHospitalTurn(text) {
    const lower = text.toLowerCase();
    const ctx = this.hospitalContext;

    // Détection intelligente de service médical dans le texte
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
      if (text.includes("—")) {
        const parts = text.split("—");
        ctx.patientName = parts[0].trim();
        ctx.condition = parts[1].trim();
      } else if (lower.includes("m'appelle")) {
        const m = text.match(/m'appelle\s+([A-Za-zÀ-ÿ]+)/i);
        ctx.patientName = m ? m[1] : "Patient Demandeur";
        ctx.condition = text;
      } else {
        ctx.patientName = text.split(",")[0].slice(0, 26);
        ctx.condition = text;
      }

      this.step = 1;
      this.renderSlotsBar();

      this.addBotMessage(
        `Bien noté pour <strong>${ctx.patientName}</strong> (<em>${ctx.condition}</em>).<br><br>` +
        `Quel est le <strong>niveau d'urgence</strong> de la situation ?`,
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
      if (lower.includes("critique") || lower.includes("vitale") || lower.includes("ambulance")) {
        ctx.urgency = "Critique";
      } else if (lower.includes("élev") || lower.includes("elev") || lower.includes("rapide")) {
        ctx.urgency = "Élevée";
      } else if (lower.includes("modér") || lower.includes("moder")) {
        ctx.urgency = "Modérée";
      } else {
        ctx.urgency = "Standard";
      }

      if (!ctx.service) {
        ctx.service = "Urgences Générales";
      }

      this.step = 2;
      this.renderSlotsBar();

      this.addBotMessage(
        `Niveau d'urgence enregistré : <strong>${ctx.urgency}</strong> (Service orienté : <strong>${ctx.service}</strong>).<br><br>` +
        `Dans quelle <strong>ville / quartier</strong> vous trouvez-vous actuellement pour lancer le scan GPS des hôpitaux proches ?`,
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
      ctx.location = text;
      this.step = 3;
      this.renderSlotsBar();

      // Filtrer et trier les hôpitaux proches selon le service et la disponibilité
      const hospitals = window.FASTCOL_DATA.hospitals;
      const matches = hospitals.filter(h =>
        !ctx.service || ctx.service === "Urgences Générales" || h.services.some(s => s.toLowerCase().includes(ctx.service.toLowerCase()))
      );
      const results = (matches.length ? matches : hospitals).slice(0, 3);

      // Mettre à jour la carte GPS et zoomer sur le meilleur hôpital
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

      this.addBotMessage(
        `🛰️ <strong>Recherche GPS terminée autour de "${ctx.location}" !</strong><br>` +
        `J'ai localisé <strong>${results.length} établissements</strong> adaptés pour <em>${ctx.condition}</em> (Urgence <strong>${ctx.urgency}</strong>) :<br>` +
        cardsHtml +
        `<div style="margin-top:8px;font-size:11.5px;color:#94a3b8;">Acceptez l'établissement de votre choix ci-dessus pour : <strong>appeler une ambulance</strong>, <strong>prendre rendez-vous</strong>, <strong>appeler directement</strong> ou <strong>lancer l'itinéraire GPS</strong>.</div>`,
        [
          { label: "💊 Chercher aussi une Pharmacie de Garde", value: "Basculer vers recherche de médicament" },
          { label: "🔄 Nouvelle demande médicale", value: "Recommencer une recherche" }
        ]
      );
      return;
    }

    // Étape 3+ : Relance ou changement
    if (lower.includes("suivi")) {
      window.AppController.switchMainView("tracking");
      return;
    }
    if (lower.includes("pharmacie") || lower.includes("médicament")) {
      window.AppController.setGemmaModeUI("pharmacy");
      this.switchMode("pharmacy");
    } else if (lower.includes("recommencer") || lower.includes("nouvelle")) {
      this.resetConversation("hospital");
    } else {
      this.step = 0;
      this.processHospitalTurn(text);
    }
  },

  // =========================================================================
  // PARCOURS 2 : ACHAT DE MÉDICAMENT & PHARMACIE DE GARDE SUR LA MAP
  // =========================================================================
  processPharmacyTurn(text) {
    const lower = text.toLowerCase();
    const pctx = this.pharmacyContext;

    // Étape 0 : Nom du médicament
    if (this.step === 0) {
      pctx.medication = text;
      this.step = 1;
      this.renderSlotsBar();

      this.addBotMessage(
        `Médicament recherché : <strong>${pctx.medication}</strong>.<br><br>` +
        `Cet achat est-il <strong>urgent (besoin immédiat en Pharmacie de Garde)</strong> ou <strong>non urgent</strong> ?`,
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

      this.addBotMessage(
        `Noté : <strong>${pctx.urgent}</strong>.<br><br>` +
        `Pour quelle <strong>condition médicale / symptôme</strong> (et avez-vous une ordonnance si requise) ?`,
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
      pctx.condition = text;
      this.step = 3;
      this.renderSlotsBar();

      this.addBotMessage(
        `Condition enregistrée : <em>${pctx.condition}</em>.<br><br>` +
        `Indiquez votre <strong>lieu, quartier ou ville</strong> (ou utilisez votre GPS) pour localiser la <strong>Pharmacie de Garde</strong> qui dispose de <strong>${pctx.medication}</strong> :`,
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
      pctx.location = text;
      this.step = 4;
      this.renderSlotsBar();

      const pharmacies = window.FASTCOL_DATA.pharmacies;
      const medKey = pctx.medication.toLowerCase().split(" ")[0];

      // Chercher les pharmacies de garde qui ont ce médicament
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

      // Afficher immédiatement la pharmacie de garde sur la carte et tracer l'itinéraire GPS jusqu'à elle !
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

      this.addBotMessage(
        `🗺️ <strong>Pharmacie de Garde localisée sur le GPS !</strong><br>` +
        `J'ai trouvé <strong>${bestPharm.name}</strong> ouverte en garde à <strong>${bestPharm.distanceKm} km (${bestPharm.etaMin} min)</strong> avec <strong>${matchedMed.name}</strong> en stock.<br>` +
        `L'itinéraire GPS est déjà tracé sur la carte pour vous conduire jusqu'à la pharmacie :` +
        pharmCards,
        [
          { label: "▶️ Démarrer le guidage vocal GPS maintenant", value: "Démarrer le guidage GPS" },
          { label: "💊 Chercher un autre médicament", value: "Autre médicament" },
          { label: "🏥 Basculer vers Recherche Hôpital / Ambulance", value: "Mode Hôpital" }
        ]
      );
      return;
    }

    // Étape 4+
    if (lower.includes("démarrer") || lower.includes("demarrer") || lower.includes("guidage")) {
      if (window.AppController) {
        window.AppController.toggleTurnByTurnSimulation(true);
      }
      this.addBotMessage(
        `🧭 <strong>Navigation GPS en temps réel activée !</strong> Suivez la ligne verte sur la carte : <em>Tournez à droite sur Rue des Lilas (0,4 km)</em>.`
      );
    } else if (lower.includes("hôpital") || lower.includes("hopital") || lower.includes("ambulance")) {
      window.AppController.setGemmaModeUI("hospital");
      this.switchMode("hospital");
    } else {
      this.resetConversation("pharmacy");
    }
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
