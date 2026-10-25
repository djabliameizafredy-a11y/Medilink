// Contrôleur Principal FastCol & MedGemma GPS Platform
// Coordonne : Carte GPS Leaflet, Guidage Turn-by-Turn, Suivi 4 étapes, Dashboard Hôpital, Administration & Anti-Abus

window.AppController = {
  map: null,
  userMarker: null,
  facilityMarkers: [],
  routeLine: null,
  routeGlowLine: null,
  movingVehicleMarker: null,
  navInterval: null,
  isNavigating: false,

  activeMainView: "explorer", // "explorer" | "tracking" | "hospital" | "admin"
  directoryTab: "hospitals", // "hospitals" | "pharmacies"
  selectedServiceFilter: "ALL",
  searchQuery: "",
  selectedFacilityId: "hosp-1",
  selectedFacilityType: "hospital",

  activeRequestId: "REQ-2026-841",
  adminSubTab: "establishments", // "establishments" | "accounts" | "history" | "abuse"

  callTimerInterval: null,
  callSeconds: 654, // 10:54 minutes as in reference image 1

  init() {
    this.initMap();
    this.renderDirectory();
    this.renderTrackingView();
    this.renderHospitalDashboard();
    this.renderAdminPortal();
    window.GemmaAssistant.init();

    // Tracer un premier itinéraire de démonstration vers le CHU Ibn Rochd
    setTimeout(() => {
      this.drawRouteOnMap(window.FASTCOL_DATA.hospitals[0], "hospital", false);
    }, 350);
  },

  // =========================================================================
  // NAVIGATION ENTRE LES 4 GRANDS ESPACES DE LA PLATEFORME
  // =========================================================================
  switchMainView(viewName) {
    this.activeMainView = viewName;
    document.querySelectorAll(".view-section").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".nav-tab").forEach(el => el.classList.remove("active"));

    const targetSection = document.getElementById(`view-${viewName}`);
    const targetBtn = document.getElementById(`tab-btn-${viewName}`);
    if (targetSection) targetSection.classList.add("active");
    if (targetBtn) targetBtn.classList.add("active");

    if (viewName === "explorer" && this.map) {
      setTimeout(() => this.map.invalidateSize(), 150);
    } else if (viewName === "tracking") {
      this.renderTrackingView();
    } else if (viewName === "hospital") {
      this.renderHospitalDashboard();
    } else if (viewName === "admin") {
      this.renderAdminPortal();
    }
  },

  setGemmaModeUI(mode) {
    const hBtn = document.getElementById("gemma-mode-hospital");
    const pBtn = document.getElementById("gemma-mode-pharmacy");
    if (!hBtn || !pBtn) return;

    if (mode === "hospital") {
      hBtn.classList.add("active");
      pBtn.classList.remove("active");
    } else {
      pBtn.classList.add("active");
      hBtn.classList.remove("active");
    }
  },

  // =========================================================================
  // CARTE GPS INTERACTIVE LEAFLET + MARQUEURS + ITINÉRAIRES + GUIDAGE LIVE
  // =========================================================================
  initMap() {
    const pos = window.FASTCOL_DATA.userPosition;
    this.map = L.map("gps-map", {
      zoomControl: false,
      attributionControl: false
    }).setView([pos.lat, pos.lng], 14);

    // Tuiles CartoDB Dark Matter haute lisibilité (style GPS automobile / Traffic Management)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19
    }).addTo(this.map);

    this.renderMapMarkers();
  },

  renderMapMarkers() {
    if (!this.map) return;

    this.facilityMarkers.forEach(m => this.map.removeLayer(m));
    this.facilityMarkers = [];

    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }

    const pos = window.FASTCOL_DATA.userPosition;

    // Marqueur GPS Utilisateur
    const userIcon = L.divIcon({
      className: "",
      html: `<div style="width:26px;height:26px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 0 8px rgba(59,130,246,0.28);display:flex;align-items:center;justify-content:center;font-size:12px;">📍</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    this.userMarker = L.marker([pos.lat, pos.lng], { icon: userIcon })
      .addTo(this.map)
      .bindPopup(`<strong>${pos.label}</strong><br>Coordonnées : ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`);

    // Marqueurs Hôpitaux
    window.FASTCOL_DATA.hospitals.forEach(h => {
      const color = h.availabilityStatus === "Disponible" ? "#ef4444" : "#f59e0b";
      const icon = L.divIcon({
        className: "",
        html: `<div class="custom-map-pin" style="width:36px;height:36px;background:${color};color:#fff;">🏥</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([h.lat, h.lng], { icon })
        .addTo(this.map)
        .bindPopup(`
          <div style="color:#0b2538;min-width:210px;">
            <strong style="font-size:13.5px;">🏥 ${h.name}</strong><br>
            <span style="color:#16a34a;font-weight:700;">● ${h.availabilityStatus}</span> (${h.bedsAvailable} lits • ${h.ambulancesReady} amb.)<br>
            <small>📞 Urgences : <b>${h.emergencyPhone}</b></small><br>
            <small>🩺 ${h.services.slice(0, 3).join(", ")}</small><br>
            <button onclick="window.AppController.startGpsRouteToFacility('${h.id}', 'hospital', true)"
              style="margin-top:6px;width:100%;padding:6px;background:#0b2538;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">
              🧭 Tracer l'itinéraire GPS (${h.etaMin} min)
            </button>
          </div>
        `);

      marker.on("click", () => {
        this.highlightFacilityOnMap(h.id, "hospital");
      });

      this.facilityMarkers.push(marker);
    });

    // Marqueurs Pharmacies de Garde
    window.FASTCOL_DATA.pharmacies.forEach(p => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="custom-map-pin" style="width:36px;height:36px;background:#22c55e;color:#04130a;box-shadow:0 0 16px rgba(34,197,94,0.7);">✚</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(this.map)
        .bindPopup(`
          <div style="color:#0b2538;min-width:210px;">
            <strong style="font-size:13.5px;">🟢 ${p.name}</strong><br>
            <span style="color:#15803d;font-weight:800;">${p.dutyLabel}</span><br>
            <small>📍 ${p.address}</small><br>
            <small>📞 <b>${p.phone}</b></small><br>
            <button onclick="window.AppController.startGpsRouteToFacility('${p.id}', 'pharmacy', true)"
              style="margin-top:6px;width:100%;padding:6px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;">
              🧭 Conduire vers cette Pharmacie (${p.etaMin} min)
            </button>
          </div>
        `);

      marker.on("click", () => {
        this.highlightFacilityOnMap(p.id, "pharmacy");
      });

      this.facilityMarkers.push(marker);
    });
  },

  locateUserRealGPS() {
    const pillText = document.getElementById("gps-status-text");
    if (pillText) pillText.textContent = "Acquisition satellite GPS...";

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          // On met à jour le label avec les vraies coordonnées GPS tout en gardant les établissements proches visibles pour la démo
          const realLat = pos.coords.latitude;
          const realLng = pos.coords.longitude;
          if (pillText) {
            pillText.textContent = `GPS Actif (${realLat.toFixed(3)}, ${realLng.toFixed(3)})`;
          }
          this.showToast(`Position GPS acquise avec succès (${realLat.toFixed(4)}, ${realLng.toFixed(4)})`);
          if (this.map) {
            this.map.flyTo([window.FASTCOL_DATA.userPosition.lat, window.FASTCOL_DATA.userPosition.lng], 14, { duration: 1.0 });
          }
        },
        () => {
          if (pillText) pillText.textContent = "GPS Simulé Actif (Haute Précision)";
          this.showToast("Géolocalisation simulée centrée sur votre secteur médical.");
          if (this.map) {
            this.map.flyTo([window.FASTCOL_DATA.userPosition.lat, window.FASTCOL_DATA.userPosition.lng], 14, { duration: 0.8 });
          }
        },
        { timeout: 4000 }
      );
    }
  },

  changeCity(cityKey) {
    const city = window.FASTCOL_DATA.cities[cityKey];
    if (!city) return;

    const dLat = city.lat - window.FASTCOL_DATA.userPosition.lat;
    const dLng = city.lng - window.FASTCOL_DATA.userPosition.lng;

    window.FASTCOL_DATA.currentCity = cityKey;
    window.FASTCOL_DATA.userPosition.lat = city.lat;
    window.FASTCOL_DATA.userPosition.lng = city.lng;
    window.FASTCOL_DATA.userPosition.label = `Ma position GPS (${city.name})`;

    // Déplacer proportionnellement les établissements pour que la démo interactive fonctionne dans chaque ville
    window.FASTCOL_DATA.hospitals.forEach(h => {
      h.lat += dLat;
      h.lng += dLng;
    });
    window.FASTCOL_DATA.pharmacies.forEach(p => {
      p.lat += dLat;
      p.lng += dLng;
    });

    this.renderMapMarkers();
    this.map.flyTo([city.lat, city.lng], 14, { duration: 0.9 });
    this.drawRouteOnMap(window.FASTCOL_DATA.hospitals[0], "hospital", false);
    this.showToast(`Secteur GPS basculé sur ${city.name}`);
  },

  highlightFacilityOnMap(facilityId, type) {
    this.selectedFacilityId = facilityId;
    this.selectedFacilityType = type;

    const list = type === "hospital" ? window.FASTCOL_DATA.hospitals : window.FASTCOL_DATA.pharmacies;
    const target = list.find(x => x.id === facilityId);
    if (!target) return;

    this.drawRouteOnMap(target, type, false);
    this.renderDirectory();
  },

  startGpsRouteToFacility(facilityId, type, autoStartNav = false) {
    this.selectedFacilityId = facilityId;
    this.selectedFacilityType = type;

    const list = type === "hospital" ? window.FASTCOL_DATA.hospitals : window.FASTCOL_DATA.pharmacies;
    const target = list.find(x => x.id === facilityId);
    if (!target) return;

    this.drawRouteOnMap(target, type, autoStartNav);
    this.renderDirectory();
  },

  drawRouteOnMap(facility, type, startLiveSimulation = false) {
    if (!this.map || !facility) return;

    if (this.routeLine) this.map.removeLayer(this.routeLine);
    if (this.routeGlowLine) this.map.removeLayer(this.routeGlowLine);
    if (this.movingVehicleMarker) this.map.removeLayer(this.movingVehicleMarker);
    if (this.navInterval) {
      clearInterval(this.navInterval);
      this.navInterval = null;
    }

    const start = [window.FASTCOL_DATA.userPosition.lat, window.FASTCOL_DATA.userPosition.lng];
    const end = [facility.lat, facility.lng];

    // Créer des points intermédiaires réalistes façon tracé routier urbain (Image 3 & 4)
    const mid1 = [
      start[0] + (end[0] - start[0]) * 0.35 + 0.0022,
      start[1] + (end[1] - start[1]) * 0.25 - 0.0015
    ];
    const mid2 = [
      start[0] + (end[0] - start[0]) * 0.72 - 0.0014,
      start[1] + (end[1] - start[1]) * 0.68 + 0.0021
    ];

    const waypoints = [start, mid1, mid2, end];
    const routeColor = type === "pharmacy" ? "#22c55e" : "#4ade80";

    // Halo lumineux sous la route
    this.routeGlowLine = L.polyline(waypoints, {
      color: routeColor,
      weight: 12,
      opacity: 0.26,
      lineCap: "round"
    }).addTo(this.map);

    // Ligne principale GPS
    this.routeLine = L.polyline(waypoints, {
      color: routeColor,
      weight: 5,
      opacity: 0.98,
      lineCap: "round"
    }).addTo(this.map);

    this.map.fitBounds(this.routeLine.getBounds(), { padding: [70, 70] });

    // Mettre à jour le HUD de navigation (Image 4 & Image 3)
    const step0 = (facility.routeSteps && facility.routeSteps[0]) || {
      dist: "0,4 km",
      instruction: `Tournez à droite vers ${facility.name}`,
      street: facility.address
    };

    const distEl = document.getElementById("hud-turn-dist");
    const streetEl = document.getElementById("hud-turn-street");
    const modeTitleEl = document.getElementById("hud-mode-title");
    const modeSubEl = document.getElementById("hud-mode-sub");
    const liveEtaTitle = document.getElementById("live-eta-title");
    const liveEtaSub = document.getElementById("live-eta-sub");
    const liveCapBadge = document.getElementById("live-capacity-badge");

    if (distEl) distEl.textContent = step0.dist;
    if (streetEl) streetEl.textContent = step0.instruction;
    if (modeTitleEl) {
      modeTitleEl.textContent = type === "pharmacy" ? "Guidage Pharmacie de Garde" : "Corridor Urgence Médicale";
    }
    if (modeSubEl) {
      modeSubEl.textContent = facility.name;
    }
    if (liveEtaTitle) {
      liveEtaTitle.textContent = `Arrivée dans ${facility.etaMin} min`;
    }
    if (liveEtaSub) {
      liveEtaSub.textContent = `${facility.name} • ${facility.distanceKm} km`;
    }
    if (liveCapBadge) {
      liveCapBadge.textContent = type === "pharmacy"
        ? "Garde 24/7"
        : `Charge ${facility.capacityLoad}%`;
    }

    // Barre inférieure (87 km / 1h28 / 11:42 / DÉMARRER) adaptée au trajet urbain
    const now = new Date();
    now.setMinutes(now.getMinutes() + facility.etaMin);
    const arrivalStr = now.toTimeString().slice(0, 5);

    const tripDist = document.getElementById("trip-dist-val");
    const tripTime = document.getElementById("trip-time-val");
    const tripEta = document.getElementById("trip-eta-val");
    if (tripDist) tripDist.innerHTML = `${facility.distanceKm} km <span>Distance</span>`;
    if (tripTime) tripTime.innerHTML = `${facility.etaMin} min <span>Trajet GPS</span>`;
    if (tripEta) tripEta.innerHTML = `${arrivalStr} <span>Arrivée estimée</span>`;

    // Placer le curseur de navigation 3D (flèche blanche sur cercle vert façon Image 4)
    const navArrowIcon = L.divIcon({
      className: "",
      html: `<div style="width:38px;height:38px;border-radius:50%;background:rgba(34,197,94,0.28);border:2px solid #4ade80;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px rgba(34,197,94,0.8);font-size:18px;">➤</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    this.movingVehicleMarker = L.marker(start, { icon: navArrowIcon }).addTo(this.map);

    if (startLiveSimulation) {
      this.toggleTurnByTurnSimulation(true, waypoints, facility);
    } else {
      this.isNavigating = false;
      this.updateDemarrerButtonUI();
    }
  },

  toggleTurnByTurnSimulation(forceStart = null, customWaypoints = null, customFacility = null) {
    const shouldStart = forceStart !== null ? forceStart : !this.isNavigating;

    if (!shouldStart) {
      this.isNavigating = false;
      if (this.navInterval) {
        clearInterval(this.navInterval);
        this.navInterval = null;
      }
      this.updateDemarrerButtonUI();
      this.showToast("Guidage GPS mis en pause.");
      return;
    }

    const list = this.selectedFacilityType === "hospital"
      ? window.FASTCOL_DATA.hospitals
      : window.FASTCOL_DATA.pharmacies;
    const facility = customFacility || list.find(x => x.id === this.selectedFacilityId) || window.FASTCOL_DATA.hospitals[0];

    const start = [window.FASTCOL_DATA.userPosition.lat, window.FASTCOL_DATA.userPosition.lng];
    const end = [facility.lat, facility.lng];
    const mid1 = [
      start[0] + (end[0] - start[0]) * 0.35 + 0.0022,
      start[1] + (end[1] - start[1]) * 0.25 - 0.0015
    ];
    const mid2 = [
      start[0] + (end[0] - start[0]) * 0.72 - 0.0014,
      start[1] + (end[1] - start[1]) * 0.68 + 0.0021
    ];
    const pts = customWaypoints || [start, mid1, mid2, end];

    this.isNavigating = true;
    this.updateDemarrerButtonUI();
    this.showToast(`Guidage GPS actif vers ${facility.name}`);

    // Interpoler 40 points le long du trajet
    const densePoints = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];
      for (let s = 0; s < 14; s++) {
        const t = s / 14;
        densePoints.push([
          pA[0] + (pB[0] - pA[0]) * t,
          pA[1] + (pB[1] - pA[1]) * t
        ]);
      }
    }
    densePoints.push(end);

    let idx = 0;
    if (this.navInterval) clearInterval(this.navInterval);

    this.navInterval = setInterval(() => {
      if (idx >= densePoints.length) {
        clearInterval(this.navInterval);
        this.navInterval = null;
        this.isNavigating = false;
        this.updateDemarrerButtonUI();
        this.showToast(`Vous êtes arrivé à destination : ${facility.name} !`);
        return;
      }

      const pt = densePoints[idx];
      if (this.movingVehicleMarker) {
        this.movingVehicleMarker.setLatLng(pt);
      }

      // Mettre à jour la vitesse simulée (ex: 29..46 km/h) et la barre de progression
      const speedEl = document.getElementById("hud-speed-val");
      if (speedEl) {
        speedEl.textContent = String(28 + ((idx * 3) % 19));
      }

      const progressPct = Math.min(100, Math.round((idx / (densePoints.length - 1)) * 100));
      const fillEl = document.getElementById("live-route-fill");
      if (fillEl) fillEl.style.width = `${progressPct}%`;

      // Mettre à jour l'instruction turn-by-turn selon l'avancement
      if (facility.routeSteps && facility.routeSteps.length) {
        const stepIndex = Math.min(
          facility.routeSteps.length - 1,
          Math.floor((idx / densePoints.length) * facility.routeSteps.length)
        );
        const st = facility.routeSteps[stepIndex];
        const distEl = document.getElementById("hud-turn-dist");
        const streetEl = document.getElementById("hud-turn-street");
        if (distEl) distEl.textContent = st.dist;
        if (streetEl) streetEl.textContent = st.instruction;
      }

      idx++;
    }, 450);
  },

  updateDemarrerButtonUI() {
    const btn = document.getElementById("btn-demarrer-gps");
    if (!btn) return;
    if (this.isNavigating) {
      btn.textContent = "⏹ ARRÊTER GUIDAGE";
      btn.classList.add("active-nav");
    } else {
      btn.textContent = "DÉMARRER";
      btn.classList.remove("active-nav");
    }
  },

  zoomMap(delta) {
    if (!this.map) return;
    this.map.setZoom(this.map.getZoom() + delta);
  },

  // =========================================================================
  // ACTIONS D'ACCEPTATION DEPUIS GEMMA OU L'ANNUAIRE (HÔPITAL & PHARMACIE)
  // =========================================================================
  acceptHospitalAction(hospitalId, actionType) {
    const hosp = window.FASTCOL_DATA.hospitals.find(h => h.id === hospitalId) || window.FASTCOL_DATA.hospitals[0];
    const ctx = window.GemmaAssistant.hospitalContext;

    this.highlightFacilityOnMap(hosp.id, "hospital");

    if (actionType === "ambulance") {
      // Créer un nouveau signalement envoyé à l'hôpital et basculer vers le suivi ou notifier
      const newReq = {
        id: `REQ-2026-${Math.floor(850 + Math.random() * 140)}`,
        type: "Urgence Ambulance",
        patientName: ctx.patientName || "Citoyen Demandeur",
        condition: ctx.condition || "Urgence médicale signalée via Gemma",
        urgency: ctx.urgency || "Critique",
        service: ctx.service || hosp.services[0],
        facilityId: hosp.id,
        facilityName: hosp.name,
        actionChosen: "Demande d'Ambulance + Prise en charge Urgences",
        status: "Envoyée",
        createdAt: "À l'instant",
        patientCoords: `${window.FASTCOL_DATA.userPosition.lat.toFixed(4)}, ${window.FASTCOL_DATA.userPosition.lng.toFixed(4)} (${ctx.location || "GPS Actif"})`,
        patientPhone: "+212 661 88 20 26",
        abuseScore: 3,
        flaggedAbusive: false,
        messages: [
          {
            sender: "Système Gemma IA",
            time: new Date().toTimeString().slice(0, 5),
            text: `Signalement d'urgence envoyé à ${hosp.name}. Patient : ${ctx.patientName || "Demandeur"}, Motif : ${ctx.condition || "Urgence"}, Urgence : ${ctx.urgency || "Critique"}.`
          }
        ]
      };

      window.FASTCOL_DATA.requests.unshift(newReq);
      this.activeRequestId = newReq.id;
      this.updateBadgesCount();

      this.startGpsRouteToFacility(hosp.id, "hospital", true);
      window.GemmaAssistant.addBotMessage(
        `🚑 <strong>Demande d'ambulance transmise à ${hosp.name} !</strong><br>` +
        `Numéro de dossier : <strong>${newReq.id}</strong> — Statut initial : <strong>Envoyée</strong>.<br>` +
        `L'unité d'urgence est notifiée sur son tableau de bord et votre suivi GPS est actif.`,
        [
          { label: "📊 Voir le Suivi de Prise en Charge (4 étapes)", value: "Ouvrir suivi" }
        ]
      );
      this.showToast(`Signalement ${newReq.id} envoyé à ${hosp.name} !`);
      setTimeout(() => this.switchMainView("tracking"), 900);
    } else if (actionType === "rdv") {
      this.openBookingModal(hosp.id);
    } else if (actionType === "call") {
      this.openVideoCallModal(hosp.id);
    } else if (actionType === "gps") {
      this.startGpsRouteToFacility(hosp.id, "hospital", true);
    }
  },

  acceptPharmacyAction(pharmacyId, actionType, medName = "Médicament") {
    const pharm = window.FASTCOL_DATA.pharmacies.find(p => p.id === pharmacyId) || window.FASTCOL_DATA.pharmacies[0];
    this.syncDirectoryTab("pharmacies");

    if (actionType === "gps" || actionType === "start-nav") {
      this.startGpsRouteToFacility(pharm.id, "pharmacy", true);
      this.showToast(`Guidage GPS démarré vers ${pharm.name}`);
    } else if (actionType === "reserve") {
      const pctx = window.GemmaAssistant.pharmacyContext;
      const newReq = {
        id: `PHARM-2026-${Math.floor(300 + Math.random() * 600)}`,
        type: "Pharmacie de Garde",
        patientName: "Patient Demandeur",
        condition: pctx.condition || `Achat médicament (${medName})`,
        medication: medName,
        urgency: pctx.urgent || "Urgent (Garde)",
        service: "Pharmacie de Garde",
        facilityId: pharm.id,
        facilityName: pharm.name,
        actionChosen: `Réservation ${medName} + Guidage GPS`,
        status: "Reçue",
        createdAt: "À l'instant",
        patientCoords: `${window.FASTCOL_DATA.userPosition.lat.toFixed(4)}, ${window.FASTCOL_DATA.userPosition.lng.toFixed(4)}`,
        patientPhone: "+212 661 88 20 26",
        abuseScore: 1,
        flaggedAbusive: false,
        messages: [
          {
            sender: "Gemma Pharmacie IA",
            time: new Date().toTimeString().slice(0, 5),
            text: `Réservation de "${medName}" envoyée à ${pharm.name} (${pharm.dutyLabel}). Itinéraire GPS activé.`
          }
        ]
      };
      window.FASTCOL_DATA.requests.unshift(newReq);
      this.activeRequestId = newReq.id;
      this.updateBadgesCount();
      this.startGpsRouteToFacility(pharm.id, "pharmacy", true);
      this.showToast(`Boîte de ${medName} réservée à ${pharm.name} ! Guidage GPS en cours.`);
    } else if (actionType === "call") {
      this.showToast(`Appel vers ${pharm.name} (${pharm.phone})...`);
      this.openVideoCallModal(pharm.id, true);
    }
  },

  // =========================================================================
  // COLONNE DROITE : ANNUAIRE HÔPITAUX & PHARMACIES DE GARDE + FILTRES
  // =========================================================================
  syncDirectoryTab(tab) {
    this.directoryTab = tab;
    const hTab = document.getElementById("dir-tab-hospitals");
    const pTab = document.getElementById("dir-tab-pharmacies");
    if (hTab && pTab) {
      hTab.classList.toggle("active", tab === "hospitals");
      pTab.classList.toggle("active", tab === "pharmacies");
    }
    this.renderDirectory();
  },

  filterDirectoryByService(serviceName) {
    this.selectedServiceFilter = serviceName || "ALL";
    const select = document.getElementById("dir-service-select");
    if (select) {
      select.value = this.selectedServiceFilter;
    }

    // Mettre à jour les pills sur la carte
    document.querySelectorAll(".map-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.service === this.selectedServiceFilter);
    });

    if (serviceName === "Pharmacie de Garde") {
      this.syncDirectoryTab("pharmacies");
    } else if (serviceName && serviceName !== "ALL") {
      this.syncDirectoryTab("hospitals");
    } else {
      this.renderDirectory();
    }
  },

  handleDirectorySearch(query) {
    this.searchQuery = (query || "").toLowerCase();
    this.renderDirectory();
  },

  renderDirectory() {
    const container = document.getElementById("facility-list-container");
    if (!container) return;

    if (this.directoryTab === "hospitals") {
      let list = window.FASTCOL_DATA.hospitals.filter(h => {
        const matchService =
          this.selectedServiceFilter === "ALL" ||
          this.selectedServiceFilter === "Pharmacie de Garde" ||
          h.services.some(s => s.toLowerCase().includes(this.selectedServiceFilter.toLowerCase()));
        const matchQuery =
          !this.searchQuery ||
          h.name.toLowerCase().includes(this.searchQuery) ||
          h.services.some(s => s.toLowerCase().includes(this.searchQuery)) ||
          h.address.toLowerCase().includes(this.searchQuery);
        return matchService && matchQuery;
      });

      container.innerHTML = list.map(h => `
        <div class="facility-card ${this.selectedFacilityId === h.id ? 'selected' : ''}" onclick="window.AppController.highlightFacilityOnMap('${h.id}', 'hospital')">
          <div class="facility-top">
            <div class="facility-name">🏥 ${h.name}</div>
            <div class="facility-distance">${h.distanceKm} km • ${h.etaMin} min</div>
          </div>
          <div class="availability-strip">
            <span class="avail-badge ${h.availabilityStatus === 'Disponible' ? 'open' : 'busy'}">
              ● ${h.availabilityStatus}
            </span>
            <span style="font-size:11px;color:#cbd5e1;">🛏️ ${h.bedsAvailable} lits</span>
            <span style="font-size:11px;color:#cbd5e1;">🚑 ${h.ambulancesReady} amb.</span>
            <span style="font-size:11px;color:#94a3b8;">⏱️ ~${h.waitTimeMin} min</span>
          </div>
          <div class="service-tags">
            ${h.services.map(s => `<span class="service-tag">${s}</span>`).join("")}
          </div>
          <div class="facility-contact-row">
            <span>📍 ${h.address}</span>
            <strong style="color:#38bdf8;">📞 ${h.emergencyPhone}</strong>
          </div>
          <div class="facility-actions" onclick="event.stopPropagation()">
            <button class="fac-btn primary-urg" onclick="window.AppController.acceptHospitalAction('${h.id}', 'ambulance')">
              <span>🚑</span><span>Ambulance</span>
            </button>
            <button class="fac-btn primary-route" onclick="window.AppController.startGpsRouteToFacility('${h.id}', 'hospital', true)">
              <span>🧭</span><span>Itinéraire</span>
            </button>
            <button class="fac-btn" onclick="window.AppController.openBookingModal('${h.id}')">
              <span>📅</span><span>RDV CliniQ</span>
            </button>
            <button class="fac-btn" onclick="window.AppController.openVideoCallModal('${h.id}')">
              <span>📞</span><span>Appeler</span>
            </button>
          </div>
        </div>
      `).join("");
    } else {
      let list = window.FASTCOL_DATA.pharmacies.filter(p => {
        const matchQuery =
          !this.searchQuery ||
          p.name.toLowerCase().includes(this.searchQuery) ||
          p.address.toLowerCase().includes(this.searchQuery) ||
          p.medications.some(m => m.name.toLowerCase().includes(this.searchQuery));
        return matchQuery;
      });

      container.innerHTML = list.map(p => `
        <div class="facility-card pharmacy-garde ${this.selectedFacilityId === p.id ? 'selected' : ''}" onclick="window.AppController.highlightFacilityOnMap('${p.id}', 'pharmacy')">
          <div class="facility-top">
            <div class="facility-name">🟢 ${p.name}</div>
            <div class="facility-distance">${p.distanceKm} km • ${p.etaMin} min</div>
          </div>
          <div class="availability-strip">
            <span class="avail-badge garde">✚ ${p.dutyLabel}</span>
          </div>
          <div class="service-tags">
            ${p.medications.map(m => `<span class="service-tag" title="${m.stock}">💊 ${m.name} (${m.price})</span>`).join("")}
          </div>
          <div class="facility-contact-row">
            <span>📍 ${p.address}</span>
            <strong style="color:#4ade80;">📞 ${p.phone}</strong>
          </div>
          <div class="facility-actions" onclick="event.stopPropagation()">
            <button class="fac-btn primary-route" style="grid-column: span 2;" onclick="window.AppController.startGpsRouteToFacility('${p.id}', 'pharmacy', true)">
              <span>🧭</span><span>Me conduire (GPS)</span>
            </button>
            <button class="fac-btn" onclick="window.AppController.acceptPharmacyAction('${p.id}', 'reserve', '${p.medications[0].name.replace(/'/g, "\\'")}')">
              <span>🛍️</span><span>Réserver</span>
            </button>
            <button class="fac-btn" onclick="window.AppController.acceptPharmacyAction('${p.id}', 'call')">
              <span>📞</span><span>Appeler</span>
            </button>
          </div>
        </div>
      `).join("");
    }
  },

  // =========================================================================
  // VUE 2 : SUIVI DE LA PRISE EN CHARGE (4 STATUTS OFFICIELS)
  // Envoyée -> Reçue -> En cours de coordination -> Clôturée
  // =========================================================================
  renderTrackingView() {
    const container = document.getElementById("tracking-view-content");
    if (!container) return;

    const req =
      window.FASTCOL_DATA.requests.find(r => r.id === this.activeRequestId) ||
      window.FASTCOL_DATA.requests[0];

    const statuses = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];
    const currentIdx = Math.max(0, statuses.indexOf(req.status));

    const stepsDescriptions = [
      "Demande et position GPS transmises à l'établissement",
      "L'hôpital a confirmé la réception du signalement",
      "Équipe médicale / Ambulance en cours d'intervention",
      "Prise en charge terminée et dossier clôturé"
    ];

    const stepperHtml = statuses.map((st, idx) => {
      const stateClass = idx < currentIdx ? "completed" : idx === currentIdx ? "current" : "";
      const icon = idx < currentIdx ? "✓" : idx + 1;
      return `
        <div class="step-node ${stateClass}">
          <div class="step-circle">${icon}</div>
          <div class="step-title">${st}</div>
          <div class="step-desc">${stepsDescriptions[idx]}</div>
        </div>
      `;
    }).join("");

    const requestSelectorHtml = window.FASTCOL_DATA.requests
      .filter(r => !r.flaggedAbusive)
      .map(r => `<option value="${r.id}" ${r.id === req.id ? 'selected' : ''}>${r.id} — ${r.patientName} (${r.facilityName}) [${r.status}]</option>`)
      .join("");

    container.innerHTML = `
      <div class="panel-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
          <div>
            <span style="font-size:11.5px;color:#38bdf8;font-weight:700;text-transform:uppercase;">Étape 4 • Suivi en Temps Réel du Demandeur</span>
            <h2 style="font-size:21px;margin-top:2px;">Suivi de la Prise en Charge Médicale</h2>
          </div>
          <select class="city-select" onchange="window.AppController.selectTrackingRequest(this.value)">
            ${requestSelectorHtml}
          </select>
        </div>

        <div class="status-stepper">
          ${stepperHtml}
        </div>

        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border-glass);border-radius:16px;padding:16px;margin-bottom:18px;">
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-size:13px;">
            <div><span style="color:var(--text-muted);">Demandeur / Patient :</span> <strong>${req.patientName}</strong></div>
            <div><span style="color:var(--text-muted);">Niveau d'urgence :</span> <strong style="color:#f87171;">${req.urgency}</strong></div>
            <div><span style="color:var(--text-muted);">Motif / Condition :</span> <strong>${req.condition}</strong></div>
            <div><span style="color:var(--text-muted);">Établissement :</span> <strong style="color:#4ade80;">${req.facilityName}</strong></div>
            <div><span style="color:var(--text-muted);">Action choisie :</span> <strong>${req.actionChosen}</strong></div>
            <div><span style="color:var(--text-muted);">Coordonnées GPS :</span> <strong>${req.patientCoords}</strong></div>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="demarrer-btn" style="padding:10px 18px;font-size:12.5px;" onclick="window.AppController.advanceRequestStatus('${req.id}')">
            ⏭️ Simuler l'étape suivante du statut
          </button>
          <button class="map-pill" onclick="window.AppController.switchMainView('explorer')">
            🗺️ Voir l'ambulance / itinéraire sur le GPS
          </button>
          <button class="map-pill" onclick="window.AppController.openVideoCallModal('${req.facilityId}')">
            📹 Appel Vidéo Régulateur (Dr. Sarah)
          </button>
          <button class="map-pill" onclick="window.AppController.openFeedbackModal()">
            ⭐ Évaluer la prise en charge (Feedback)
          </button>
        </div>
      </div>

      <div class="panel-card" style="display:flex;flex-direction:column;">
        <h3 style="font-size:16px;margin-bottom:4px;">💬 Canal de Communication Direct avec l'Hôpital</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Échangez en direct avec le personnel autorisé de <strong>${req.facilityName}</strong></p>

        <div style="flex:1;overflow-y:auto;max-height:320px;display:flex;flex-direction:column;gap:10px;padding-right:6px;margin-bottom:14px;">
          ${req.messages.map(m => `
            <div style="background:rgba(255,255,255,0.05);border:1px solid var(--border-glass);border-radius:12px;padding:10px 12px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#38bdf8;font-weight:700;margin-bottom:4px;">
                <span>${m.sender}</span>
                <span>${m.time}</span>
              </div>
              <div style="font-size:13px;">${m.text}</div>
            </div>
          `).join("")}
        </div>

        <div style="display:flex;gap:8px;">
          <input id="patient-chat-input" class="gemma-input" placeholder="Écrire un message à l'équipe médicale..." onkeydown="if(event.key==='Enter') window.AppController.sendPatientMessage('${req.id}')" />
          <button class="demarrer-btn" style="padding:10px 16px;font-size:12px;" onclick="window.AppController.sendPatientMessage('${req.id}')">Envoyer</button>
        </div>
      </div>
    `;
  },

  selectTrackingRequest(reqId) {
    this.activeRequestId = reqId;
    this.renderTrackingView();
  },

  advanceRequestStatus(reqId) {
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;

    const order = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];
    const idx = order.indexOf(req.status);
    const nextStatus = order[Math.min(order.length - 1, idx + 1)];
    req.status = nextStatus;

    const autoNotes = {
      "Reçue": "Accusé de réception confirmé par le poste de régulation hospitalier.",
      "En cours de coordination": "Équipe d'intervention et ambulance en coordination active avec suivi GPS.",
      "Clôturée": "Patient pris en charge avec succès. Dossier médical clôturé."
    };

    if (autoNotes[nextStatus]) {
      req.messages.push({
        sender: `Régulation ${req.facilityName}`,
        time: new Date().toTimeString().slice(0, 5),
        text: autoNotes[nextStatus]
      });
    }

    this.renderTrackingView();
    this.renderHospitalDashboard();
    this.renderAdminPortal();
    this.showToast(`Statut de la demande ${req.id} mis à jour : ${nextStatus}`);
  },

  sendPatientMessage(reqId) {
    const input = document.getElementById("patient-chat-input");
    if (!input || !input.value.trim()) return;
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;

    req.messages.push({
      sender: `${req.patientName} (Demandeur)`,
      time: new Date().toTimeString().slice(0, 5),
      text: input.value.trim()
    });
    input.value = "";
    this.renderTrackingView();
    this.renderHospitalDashboard();
  },

  // =========================================================================
  // VUE 3 : TABLEAU DE BORD HÔPITAL (PERSONNEL AUTORISÉ - ÉTAPE 3)
  // Consulter la demande, confirmer sa réception, changer le statut, communiquer
  // =========================================================================
  renderHospitalDashboard() {
    const container = document.getElementById("hospital-dashboard-content");
    if (!container) return;

    const requests = window.FASTCOL_DATA.requests;
    const activeReq = requests.find(r => r.id === this.activeRequestId) || requests[0];
    const hosp = window.FASTCOL_DATA.hospitals[0];

    const statuses = ["Envoyée", "Reçue", "En cours de coordination", "Clôturée"];

    container.innerHTML = `
      <!-- Colonne 1 : Liste des signalements entrants -->
      <div class="panel-card" style="overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div>
            <span style="font-size:11px;color:#4ade80;font-weight:700;text-transform:uppercase;">Étape 3 • Réception Hospitalière</span>
            <h3 style="font-size:17px;">Signalements Entrants (${requests.length})</h3>
          </div>
          <span class="pulse-dot red"></span>
        </div>

        <div class="kpi-grid">
          <div class="kpi-box">
            <div class="kpi-val" style="color:#4ade80;">${hosp.bedsAvailable}</div>
            <div class="kpi-lbl">Lits d'urgence dispo.</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val" style="color:#38bdf8;">${hosp.ambulancesReady}</div>
            <div class="kpi-lbl">Ambulances prêtes</div>
          </div>
        </div>

        <div>
          ${requests.map(r => `
            <div class="signalement-item ${r.id === activeReq.id ? 'active' : ''} ${r.urgency === 'Critique' ? 'critique' : ''}"
                 onclick="window.AppController.selectHospitalRequest('${r.id}')">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px;">
                <strong style="color:#38bdf8;">${r.id}</strong>
                <span style="color:${r.flaggedAbusive ? '#ef4444' : '#a3e635'};font-weight:700;">${r.flaggedAbusive ? '⚠️ Suspect Abus' : r.status}</span>
              </div>
              <div style="font-weight:700;font-size:13.5px;margin-bottom:2px;">👤 ${r.patientName}</div>
              <div style="font-size:12px;color:#cbd5e1;margin-bottom:4px;">🩺 ${r.condition}</div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);">
                <span>🚨 Urgence : ${r.urgency}</span>
                <span>${r.createdAt}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Colonne 2 : Détail du signalement, confirmation de réception & communication -->
      <div class="panel-card" style="overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            <span style="font-size:11.5px;color:#a5b4fc;font-weight:700;">DOSSIER DE RÉGULATION MÉDICALE • ${activeReq.id}</span>
            <h2 style="font-size:20px;margin-top:2px;">${activeReq.patientName} — ${activeReq.condition}</h2>
          </div>
          <span class="avail-badge open" style="font-size:12.5px;padding:6px 12px;">Statut : ${activeReq.status}</span>
        </div>

        <div style="background:rgba(255,255,255,0.04);border:1px solid var(--border-glass);border-radius:14px;padding:14px;margin-bottom:16px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><strong>Établissement destinataire :</strong> ${activeReq.facilityName}</div>
          <div><strong>Service demandé :</strong> ${activeReq.service}</div>
          <div><strong>Coordonnées GPS Patient :</strong> ${activeReq.patientCoords}</div>
          <div><strong>Téléphone du demandeur :</strong> <a href="tel:${activeReq.patientPhone}" style="color:#38bdf8;">${activeReq.patientPhone}</a></div>
          <div><strong>Action souhaitée :</strong> ${activeReq.actionChosen}</div>
          <div><strong>Analyse Anti-Abus Gemma :</strong> <span style="color:${activeReq.abuseScore > 50 ? '#ef4444' : '#4ade80'};font-weight:700;">Score risque ${activeReq.abuseScore}%</span></div>
        </div>

        <div style="margin-bottom:18px;">
          <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;">
            Actions du Personnel Autorisé (Changer le statut de prise en charge) :
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            ${statuses.map(st => `
              <button class="map-pill ${activeReq.status === st ? 'active' : ''}"
                      style="justify-content:center;padding:10px;"
                      onclick="window.AppController.setRequestStatusFromHospital('${activeReq.id}', '${st}')">
                ${st === 'Reçue' ? '✅ Confirmer Réception' : st}
              </button>
            `).join("")}
          </div>
        </div>

        <div style="border-top:1px solid var(--border-glass);padding-top:14px;">
          <h4 style="font-size:14px;margin-bottom:10px;">📡 Messagerie Temps Réel avec le Demandeur (${activeReq.patientName})</h4>
          <div style="max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
            ${activeReq.messages.map(m => `
              <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:9px 12px;font-size:12.5px;">
                <strong style="color:#4ade80;">${m.sender} (${m.time}) :</strong> ${m.text}
              </div>
            `).join("")}
          </div>
          <div style="display:flex;gap:8px;">
            <input id="hospital-reply-input" class="gemma-input" placeholder="Répondre au patient (ex: Ambulance en route, préparez votre carte)..." onkeydown="if(event.key==='Enter') window.AppController.sendHospitalReply('${activeReq.id}')" />
            <button class="demarrer-btn" style="padding:10px 16px;font-size:12px;" onclick="window.AppController.sendHospitalReply('${activeReq.id}')">Répondre</button>
          </div>
        </div>
      </div>

      <!-- Colonne 3 : Mise à jour de la disponibilité déclarée de l'hôpital -->
      <div class="panel-card" style="overflow-y:auto;">
        <h3 style="font-size:16px;margin-bottom:6px;">🏥 Disponibilité Déclarée de l'Hôpital</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">Mise à jour instantanée visible sur la carte GPS des citoyens</p>

        <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
          <div>
            <label style="display:block;margin-bottom:5px;color:var(--text-muted);">Statut d'accueil des Urgences :</label>
            <select id="hosp-avail-status" class="city-select" style="width:100%;padding:10px;" onchange="window.AppController.updateHospitalDeclaredAvailability()">
              <option value="Disponible" ${hosp.availabilityStatus === 'Disponible' ? 'selected' : ''}>🟢 Disponible (Accueil normal)</option>
              <option value="Forte affluence" ${hosp.availabilityStatus === 'Forte affluence' ? 'selected' : ''}>🟠 Forte affluence (Urgences vitales prio)</option>
              <option value="Saturé" ${hosp.availabilityStatus === 'Saturé' ? 'selected' : ''}>🔴 Saturé (Redirection SAMU)</option>
            </select>
          </div>

          <div>
            <label style="display:block;margin-bottom:5px;color:var(--text-muted);">Lits d'urgence disponibles :</label>
            <input id="hosp-beds-input" type="number" class="gemma-input" style="width:100%;" value="${hosp.bedsAvailable}" onchange="window.AppController.updateHospitalDeclaredAvailability()" />
          </div>

          <div>
            <label style="display:block;margin-bottom:5px;color:var(--text-muted);">Ambulances opérationnelles :</label>
            <input id="hosp-amb-input" type="number" class="gemma-input" style="width:100%;" value="${hosp.ambulancesReady}" onchange="window.AppController.updateHospitalDeclaredAvailability()" />
          </div>

          <button class="demarrer-btn" style="width:100%;margin-top:6px;" onclick="window.AppController.updateHospitalDeclaredAvailability()">
            💾 Publier la Disponibilité en Direct
          </button>

          <button class="map-pill" style="width:100%;justify-content:center;border-color:#ef4444;color:#fca5a5;margin-top:8px;"
                  onclick="window.AppController.flagRequestAsAbusive('${activeReq.id}')">
            🚨 Signaler ce dossier comme abusif
          </button>
        </div>
      </div>
    `;
  },

  selectHospitalRequest(reqId) {
    this.activeRequestId = reqId;
    this.renderHospitalDashboard();
  },

  setRequestStatusFromHospital(reqId, newStatus) {
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;
    req.status = newStatus;
    req.messages.push({
      sender: `Personnel Autorisé (${req.facilityName})`,
      time: new Date().toTimeString().slice(0, 5),
      text: `Statut du dossier mis à jour sur : "${newStatus}".`
    });
    this.renderHospitalDashboard();
    this.renderTrackingView();
    this.showToast(`Dossier ${reqId} passé au statut "${newStatus}"`);
  },

  sendHospitalReply(reqId) {
    const input = document.getElementById("hospital-reply-input");
    if (!input || !input.value.trim()) return;
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;

    req.messages.push({
      sender: `Régulation ${req.facilityName} (Dr. Sarah)`,
      time: new Date().toTimeString().slice(0, 5),
      text: input.value.trim()
    });
    input.value = "";
    this.renderHospitalDashboard();
    this.renderTrackingView();
    this.showToast("Message envoyé au demandeur.");
  },

  updateHospitalDeclaredAvailability() {
    const hosp = window.FASTCOL_DATA.hospitals[0];
    const stEl = document.getElementById("hosp-avail-status");
    const bedsEl = document.getElementById("hosp-beds-input");
    const ambEl = document.getElementById("hosp-amb-input");

    if (stEl) hosp.availabilityStatus = stEl.value;
    if (bedsEl) hosp.bedsAvailable = parseInt(bedsEl.value, 10) || 0;
    if (ambEl) hosp.ambulancesReady = parseInt(ambEl.value, 10) || 0;

    this.renderDirectory();
    this.renderMapMarkers();
    this.renderHospitalDashboard();
    this.showToast(`Disponibilité déclarée de ${hosp.name} mise à jour !`);
  },

  flagRequestAsAbusive(reqId) {
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;
    req.flaggedAbusive = true;
    req.abuseScore = 89;
    req.abuseReason = "Signalé manuellement par le personnel hospitalier + vérification Gemma.";
    this.renderHospitalDashboard();
    this.renderAdminPortal();
    this.showToast(`Dossier ${reqId} transféré à la cellule Anti-Abus de l'Administration.`);
  },

  // =========================================================================
  // VUE 4 : PORTAIL D'ADMINISTRATION
  // 1. Gérer les établissements enregistrés
  // 2. Gérer les comptes et les rôles
  // 3. Consulter l'historique des demandes
  // 4. Détecter et traiter les signalements abusifs
  // =========================================================================
  switchAdminSubTab(subTab) {
    this.adminSubTab = subTab;
    this.renderAdminPortal();
  },

  renderAdminPortal() {
    const container = document.getElementById("admin-portal-content");
    if (!container) return;

    const abusiveCount = window.FASTCOL_DATA.requests.filter(r => r.flaggedAbusive || r.abuseScore >= 60).length;

    let subContentHtml = "";

    // 1. GÉRER LES ÉTABLISSEMENTS ENREGISTRÉS
    if (this.adminSubTab === "establishments") {
      subContentHtml = `
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <div>
              <h3>🏥 Gestion des Établissements Enregistrés (Hôpitaux & Pharmacies de Garde)</h3>
              <p style="font-size:12px;color:var(--text-muted);">Ajoutez ou modifiez les hôpitaux, leurs services d'urgence, leurs coordonnées et les pharmacies de garde.</p>
            </div>
            <button class="demarrer-btn" style="padding:10px 18px;font-size:12px;" onclick="window.AppController.addDemoEstablishment()">
              + Ajouter un Établissement
            </button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Établissement</th>
                <th>Catégorie</th>
                <th>Services d'urgence / Garde</th>
                <th>Téléphone</th>
                <th>Disponibilité Déclarée</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${window.FASTCOL_DATA.hospitals.map(h => `
                <tr>
                  <td><strong>🏥 ${h.name}</strong><br><small style="color:var(--text-muted);">${h.address}</small></td>
                  <td>Hôpital / Urgences</td>
                  <td>${h.services.join(", ")}</td>
                  <td>${h.emergencyPhone}</td>
                  <td><span class="avail-badge ${h.availabilityStatus === 'Disponible' ? 'open' : 'busy'}">${h.availabilityStatus} (${h.bedsAvailable} lits)</span></td>
                  <td>
                    <button class="quick-option-btn" onclick="window.AppController.toggleFacilityStatus('${h.id}')">Changer Dispo</button>
                  </td>
                </tr>
              `).join("")}
              ${window.FASTCOL_DATA.pharmacies.map(p => `
                <tr>
                  <td><strong>🟢 ${p.name}</strong><br><small style="color:var(--text-muted);">${p.address}</small></td>
                  <td>Pharmacie de Garde</td>
                  <td>${p.medications.length} médicaments urgents référencés</td>
                  <td>${p.phone}</td>
                  <td><span class="avail-badge garde">${p.dutyLabel}</span></td>
                  <td>
                    <button class="quick-option-btn" onclick="window.AppController.showToast('Fiche Pharmacie vérifiée')">Vérifié GPS</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 2. GÉRER LES COMPTES ET LES RÔLES
    else if (this.adminSubTab === "accounts") {
      subContentHtml = `
        <div class="panel-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
              <h3>👥 Gestion des Comptes Utilisateurs et des Rôles</h3>
              <p style="font-size:12px;color:var(--text-muted);">Attribuez les habilitations : Personnel Hospitalier Autorisé, Pharmacien de Garde, Citoyen ou Administrateur.</p>
            </div>
            <button class="demarrer-btn" style="padding:10px 18px;font-size:12px;" onclick="window.AppController.addDemoUserAccount()">
              + Créer un Compte Autorisé
            </button>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom Complet</th>
                <th>Email</th>
                <th>Rôle Attribué</th>
                <th>Établissement Rattaché</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${window.FASTCOL_DATA.users.map(u => `
                <tr>
                  <td>${u.id}</td>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.email}</td>
                  <td><span class="slot-chip filled">${u.role}</span></td>
                  <td>${u.establishment}</td>
                  <td><strong style="color:${u.status.includes('Suspendu') ? '#ef4444' : '#4ade80'};">${u.status}</strong></td>
                  <td>
                    <button class="quick-option-btn" onclick="window.AppController.toggleUserAccountStatus('${u.id}')">
                      ${u.status.includes('Suspendu') ? 'Réactiver' : 'Suspendre / Rôle'}
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. CONSULTER L'HISTORIQUE DES DEMANDES
    else if (this.adminSubTab === "history") {
      subContentHtml = `
        <div class="panel-card">
          <div style="margin-bottom:16px;">
            <h3>📋 Historique Complet des Demandes & Signalements</h3>
            <p style="font-size:12px;color:var(--text-muted);">Traçabilité complète des demandes d'ambulance, orientations hôpitaux et recherches de pharmacies de garde.</p>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Réf. Demande</th>
                <th>Type</th>
                <th>Demandeur</th>
                <th>Motif / Médicament</th>
                <th>Établissement Cible</th>
                <th>Urgence</th>
                <th>Statut</th>
                <th>Horodatage</th>
              </tr>
            </thead>
            <tbody>
              ${window.FASTCOL_DATA.requests.map(r => `
                <tr>
                  <td><strong style="color:#38bdf8;">${r.id}</strong></td>
                  <td>${r.type}</td>
                  <td>${r.patientName}<br><small style="color:var(--text-muted);">${r.patientPhone}</small></td>
                  <td>${r.condition}</td>
                  <td>${r.facilityName}</td>
                  <td><span class="slot-chip urgent">${r.urgency}</span></td>
                  <td><strong>${r.status}</strong></td>
                  <td>${r.createdAt}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 4. DÉTECTER ET TRAITER LES SIGNALEMENTS ABUSIFS
    else if (this.adminSubTab === "abuse") {
      const flaggedList = window.FASTCOL_DATA.requests.filter(r => r.flaggedAbusive || r.abuseScore >= 50);
      subContentHtml = `
        <div class="panel-card">
          <div style="margin-bottom:16px;">
            <h3>🛡️ Détection et Traitement des Signalements Abusifs (Gemma Anti-Abus)</h3>
            <p style="font-size:12px;color:var(--text-muted);">
              Le moteur IA Gemma analyse la cohérence GPS, la fréquence d'appel et le contenu sémantique pour isoler les faux appels d'urgence.
            </p>
          </div>

          <table class="data-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Compte / Téléphone</th>
                <th>Motif Signalé</th>
                <th>Score Suspicion IA</th>
                <th>Anomalie Détectée</th>
                <th>Décision Administrative</th>
              </tr>
            </thead>
            <tbody>
              ${flaggedList.map(r => `
                <tr>
                  <td><strong style="color:#ef4444;">${r.id}</strong></td>
                  <td><strong>${r.patientName}</strong><br><small>${r.patientPhone}</small></td>
                  <td>${r.condition}</td>
                  <td><span class="avail-badge" style="background:rgba(239,68,68,0.22);color:#fca5a5;">⚠️ ${r.abuseScore}% Risque</span></td>
                  <td>${r.abuseReason || "Incohérence GPS / Appels multiples rapprochés"}</td>
                  <td style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="gemma-action-btn ambulance" onclick="window.AppController.resolveAbuseCase('${r.id}', 'block')">
                      🚫 Bloquer Appelant
                    </button>
                    <button class="gemma-action-btn gps" onclick="window.AppController.resolveAbuseCase('${r.id}', 'clear')">
                      ✓ Marquer Légitime
                    </button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <span style="font-size:11.5px;color:#c4b5fd;font-weight:700;text-transform:uppercase;">Portail d'Administration Centrale</span>
          <h2 style="font-size:22px;">Gouvernance des Établissements, Rôles, Historique & Anti-Abus</h2>
        </div>
        <div class="admin-subnav">
          <button class="admin-tab-btn ${this.adminSubTab === 'establishments' ? 'active' : ''}" onclick="window.AppController.switchAdminSubTab('establishments')">
            🏥 Établissements (${window.FASTCOL_DATA.hospitals.length + window.FASTCOL_DATA.pharmacies.length})
          </button>
          <button class="admin-tab-btn ${this.adminSubTab === 'accounts' ? 'active' : ''}" onclick="window.AppController.switchAdminSubTab('accounts')">
            👥 Comptes & Rôles (${window.FASTCOL_DATA.users.length})
          </button>
          <button class="admin-tab-btn ${this.adminSubTab === 'history' ? 'active' : ''}" onclick="window.AppController.switchAdminSubTab('history')">
            📋 Historique des Demandes (${window.FASTCOL_DATA.requests.length})
          </button>
          <button class="admin-tab-btn ${this.adminSubTab === 'abuse' ? 'active' : ''}" onclick="window.AppController.switchAdminSubTab('abuse')">
            🚨 Signalements Abusifs (${abusiveCount})
          </button>
        </div>
      </div>

      ${subContentHtml}
    `;
  },

  toggleFacilityStatus(hospId) {
    const h = window.FASTCOL_DATA.hospitals.find(x => x.id === hospId);
    if (!h) return;
    h.availabilityStatus = h.availabilityStatus === "Disponible" ? "Forte affluence" : "Disponible";
    this.renderAdminPortal();
    this.renderDirectory();
    this.renderMapMarkers();
    this.showToast(`Statut de ${h.name} basculé sur "${h.availabilityStatus}".`);
  },

  addDemoEstablishment() {
    const pos = window.FASTCOL_DATA.userPosition;
    const newHosp = {
      id: `hosp-${Date.now()}`,
      name: "Clinique Internationale Al Madina (Urgences & Garde)",
      city: window.FASTCOL_DATA.currentCity,
      lat: pos.lat + 0.011,
      lng: pos.lng - 0.012,
      phone: "+212 522 99 10 10",
      emergencyPhone: "+212 522 99 10 15",
      address: "Boulevard Ghandi, Secteur Médical",
      availabilityStatus: "Disponible",
      capacityLoad: 42,
      bedsAvailable: 16,
      ambulancesReady: 3,
      waitTimeMin: 6,
      distanceKm: 1.9,
      etaMin: 5,
      services: ["Urgences Générales", "Cardiologie", "Pédiatrie"],
      doctor: {
        name: "Dr. Kaiya Donin",
        specialty: "Médecin Urgentiste",
        rating: 4.8,
        experienceYears: 7,
        patientsCount: "1.8k+",
        reviewsCount: "640+",
        priceSession: "60 € / 600 MAD"
      },
      routeSteps: [
        { dist: "0,8 km", instruction: "Prenez le Boulevard Ghandi", street: "Boulevard Ghandi" },
        { dist: "1,1 km", instruction: "Entrée Urgences Clinique Al Madina", street: "Secteur Médical" }
      ]
    };
    window.FASTCOL_DATA.hospitals.push(newHosp);
    this.renderAdminPortal();
    this.renderDirectory();
    this.renderMapMarkers();
    this.showToast(`Établissement "${newHosp.name}" ajouté et géolocalisé sur la carte !`);
  },

  addDemoUserAccount() {
    const newUser = {
      id: `USR-0${window.FASTCOL_DATA.users.length + 1}`,
      name: "Dr. Emerson Herwitz",
      email: "e.herwitz@chu-urgence.org",
      role: "Régulateur SAMU & Urgences",
      establishment: "CHU Ibn Rochd",
      status: "Actif"
    };
    window.FASTCOL_DATA.users.push(newUser);
    this.renderAdminPortal();
    this.showToast(`Compte autorisé créé pour ${newUser.name}.`);
  },

  toggleUserAccountStatus(userId) {
    const u = window.FASTCOL_DATA.users.find(x => x.id === userId);
    if (!u) return;
    u.status = u.status.includes("Suspendu") ? "Actif" : "Suspendu (Abus)";
    this.renderAdminPortal();
    this.showToast(`Statut du compte ${u.name} : ${u.status}`);
  },

  resolveAbuseCase(reqId, decision) {
    const req = window.FASTCOL_DATA.requests.find(r => r.id === reqId);
    if (!req) return;
    if (decision === "block") {
      req.status = "Clôturée (Appelant Bloqué)";
      this.showToast(`Numéro ${req.patientPhone} bloqué par l'Administration.`);
    } else {
      req.flaggedAbusive = false;
      req.abuseScore = 5;
      this.showToast(`Signalement ${req.id} réhabilité comme légitime.`);
    }
    this.renderAdminPortal();
  },

  // =========================================================================
  // MODALES : RÉSERVATION CLINIQ (IMAGE 1), APPEL VIDÉO DR. SARAH, FEEDBACK
  // =========================================================================
  openBookingModal(hospitalId) {
    const hosp = window.FASTCOL_DATA.hospitals.find(h => h.id === hospitalId) || window.FASTCOL_DATA.hospitals[0];
    const doc = hosp.doctor;
    const modal = document.getElementById("modal-booking");
    const content = document.getElementById("modal-booking-body");
    if (!modal || !content) return;

    const heights = [14, 22, 18, 30, 16, 38, 24, 15, 28, 42, 26, 18, 32, 20, 14, 28, 22, 16];
    const waveformHtml = heights.map((h, i) =>
      `<div class="wave-tick ${i === 9 ? 'active' : ''}" style="height:${h}px;" onclick="document.querySelectorAll('.wave-tick').forEach(t=>t.classList.remove('active'));this.classList.add('active');"></div>`
    ).join("");

    content.innerHTML = `
      <div class="cliniq-hero">
        <div class="cliniq-top-actions">
          <button class="cliniq-round-icon" onclick="window.AppController.closeModals()">←</button>
          <span style="font-size:12px;font-weight:800;background:rgba(255,255,255,0.65);padding:6px 12px;border-radius:99px;">CliniQ • ${hosp.name.split('-')[0]}</span>
          <button class="cliniq-round-icon">♡</button>
        </div>

        <div class="cliniq-doc-header">
          <div class="cliniq-doc-info">
            <div style="font-size:12px;font-weight:800;margin-bottom:4px;">★ ${doc.rating}</div>
            <h3>${doc.name}</h3>
            <p style="font-size:12px;opacity:0.8;margin-top:4px;">${doc.specialty}</p>
          </div>
          <div class="cliniq-doc-avatar">👩‍⚕️</div>
        </div>

        <div style="display:flex;gap:8px;margin-top:12px;">
          <span style="background:#bfe0f5;padding:7px 14px;border-radius:99px;font-size:12px;font-weight:700;">ⓘ Détails</span>
          <button class="cliniq-round-icon" onclick="window.AppController.openVideoCallModal('${hosp.id}')">📞</button>
          <button class="cliniq-round-icon" onclick="window.AppController.openVideoCallModal('${hosp.id}')">📹</button>
          <button class="cliniq-round-icon" onclick="window.AppController.closeModals();window.AppController.switchMainView('tracking')">💬</button>
        </div>

        <div class="cliniq-stats-pill">
          <div><strong>⏱️ ${doc.experienceYears} Ans</strong><br><span style="color:#64748b;">Expérience</span></div>
          <div><strong>👥 ${doc.patientsCount}</strong><br><span style="color:#64748b;">Patients</span></div>
          <div><strong>⭐ ${doc.reviewsCount}</strong><br><span style="color:#64748b;">Avis vérifiés</span></div>
        </div>
      </div>

      <div class="cliniq-body">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:#475569;">
          <span>Sélectionner la Date</span>
          <span>‹ Aujourd'hui ›</span>
        </div>

        <div class="date-slots-row">
          <div class="date-slot" onclick="document.querySelectorAll('.date-slot').forEach(d=>d.classList.remove('active'));this.classList.add('active');">
            <div style="font-size:16px;font-weight:800;">23</div><div style="font-size:11px;">Ven</div>
          </div>
          <div class="date-slot active" onclick="document.querySelectorAll('.date-slot').forEach(d=>d.classList.remove('active'));this.classList.add('active');">
            <div style="font-size:16px;font-weight:800;">24</div><div style="font-size:11px;">Sam (Urg.)</div>
          </div>
          <div class="date-slot" onclick="document.querySelectorAll('.date-slot').forEach(d=>d.classList.remove('active'));this.classList.add('active');">
            <div style="font-size:16px;font-weight:800;">25</div><div style="font-size:11px;">Dim</div>
          </div>
          <div class="date-slot" onclick="document.querySelectorAll('.date-slot').forEach(d=>d.classList.remove('active'));this.classList.add('active');">
            <div style="font-size:16px;font-weight:800;">26</div><div style="font-size:11px;">Lun</div>
          </div>
        </div>

        <div style="font-size:12.5px;font-weight:700;color:#475569;">Sélectionner l'Heure de Passage</div>
        <div class="waveform-time-picker">
          ${waveformHtml}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;font-weight:700;">
          <span>08:30</span>
          <span>10:00</span>
          <span style="color:#0b2538;font-weight:800;">12:30 (Prioritaire)</span>
          <span>15:00</span>
        </div>

        <button class="cliniq-book-btn" onclick="window.AppController.confirmDoctorBooking('${hosp.id}')">
          Confirmer le Rendez-vous (${doc.priceSession})
        </button>
      </div>
    `;

    modal.classList.add("open");
  },

  confirmDoctorBooking(hospitalId) {
    const hosp = window.FASTCOL_DATA.hospitals.find(h => h.id === hospitalId) || window.FASTCOL_DATA.hospitals[0];
    this.closeModals();
    this.startGpsRouteToFacility(hosp.id, "hospital", true);
    this.showToast(`Rendez-vous confirmé avec ${hosp.doctor.name} à ${hosp.name} ! Itinéraire GPS activé.`);
  },

  openVideoCallModal(facilityId, isPharmacy = false) {
    this.closeModals();
    const modal = document.getElementById("modal-video-call");
    const nameEl = document.getElementById("call-doc-name");
    const subEl = document.getElementById("call-doc-sub");
    if (!modal) return;

    if (isPharmacy) {
      const pharm = window.FASTCOL_DATA.pharmacies.find(p => p.id === facilityId) || window.FASTCOL_DATA.pharmacies[0];
      if (nameEl) nameEl.textContent = pharm.pharmacist;
      if (subEl) subEl.textContent = `${pharm.name} • ${pharm.phone}`;
    } else {
      const hosp = window.FASTCOL_DATA.hospitals.find(h => h.id === facilityId) || window.FASTCOL_DATA.hospitals[0];
      if (nameEl) nameEl.textContent = hosp.doctor.name;
      if (subEl) subEl.textContent = `10:54 minutes • Urgences ${hosp.emergencyPhone}`;
    }

    modal.classList.add("open");
  },

  openFeedbackModal() {
    this.closeModals();
    const modal = document.getElementById("modal-feedback");
    if (modal) modal.classList.add("open");
  },

  submitFeedback() {
    this.closeModals();
    this.showToast("Merci ! Votre évaluation de prise en charge a été enregistrée.");
  },

  closeModals() {
    document.querySelectorAll(".modal-backdrop").forEach(m => m.classList.remove("open"));
  },

  updateBadgesCount() {
    const badge = document.getElementById("hospital-req-badge");
    if (badge) {
      badge.textContent = String(window.FASTCOL_DATA.requests.length);
    }
  },

  showToast(message) {
    let toast = document.getElementById("fastcol-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "fastcol-toast";
      toast.style.cssText =
        "position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;padding:12px 20px;border-radius:14px;border:1px solid #38bdf8;box-shadow:0 14px 34px rgba(0,0,0,0.55);font-size:13px;font-weight:700;z-index:3000;transition:opacity 0.25s;";
      document.body.appendChild(toast);
    }
    toast.textContent = `✨ ${message}`;
    toast.style.opacity = "1";
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = "0";
    }, 3400);
  }
};

window.addEventListener("DOMContentLoaded", () => {
  window.AppController.init();
});
