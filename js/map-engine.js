window.MapEngine = {
  map: null,
  markers: [],
  userMarker: null,
  routeLine: null,
  results: [],
  selectedId: null,
  radius: 5000,
  listId: null,
  statusId: null,
  types: ["hospital", "clinic"],

  haversine(lat1, lng1, lat2, lng2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  },

  init(containerId, options) {
    const pos = window.FASTCOL_DATA.userPosition;
    this.listId = options.listId;
    this.statusId = options.statusId;
    this.types = options.types || ["hospital", "clinic"];

    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    this.map = L.map(containerId, { zoomControl: true, attributionControl: true }).setView([pos.lat, pos.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.placeUserMarker(pos.lat, pos.lng);
    this.searchNearby();
  },

  setStatus(text) {
    const el = document.getElementById(this.statusId);
    if (el) el.textContent = text;
  },

  placeUserMarker(lat, lng) {
    if (this.userMarker) this.map.removeLayer(this.userMarker);
    this.userMarker = L.marker([lat, lng]).addTo(this.map).bindPopup("Votre position");
  },

  changeCity(cityKey) {
    const city = window.FASTCOL_DATA.cities[cityKey];
    if (!city) return;
    window.FASTCOL_DATA.currentCity = cityKey;
    window.FASTCOL_DATA.userPosition = { lat: city.lat, lng: city.lng, label: city.name };
    this.placeUserMarker(city.lat, city.lng);
    this.map.setView([city.lat, city.lng], 13);
    this.searchNearby();
  },

  locateUser() {
    this.setStatus("Recherche de votre position…");
    if (!navigator.geolocation) {
      this.setStatus("Géolocalisation indisponible. Utilisez le choix de ville.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        window.FASTCOL_DATA.userPosition = { lat: lat, lng: lng, label: "Position GPS" };
        this.placeUserMarker(lat, lng);
        this.map.setView([lat, lng], 14);
        this.searchNearby();
      },
      () => {
        this.setStatus("Position refusée. La recherche utilise la ville sélectionnée.");
        this.searchNearby();
      },
      { timeout: 6000 }
    );
  },

  mergeVerified(item) {
    const pool = item.type === "pharmacy" ? window.FASTCOL_DATA.pharmacies : window.FASTCOL_DATA.hospitals;
    let closest = null;
    let best = 0.45;
    pool.forEach((ref) => {
      const d = this.haversine(item.lat, item.lng, ref.lat, ref.lng);
      if (d < best) {
        best = d;
        closest = ref;
      }
    });
    if (!closest) return item;
    return Object.assign({}, item, {
      verified: true,
      phone: item.phone || closest.phone || closest.emergencyPhone || "",
      emergencyPhone: closest.emergencyPhone || item.phone,
      availabilityStatus: closest.availabilityStatus || closest.dutyLabel || "",
      services: closest.services || [],
      bedsAvailable: closest.bedsAvailable,
      ambulancesReady: closest.ambulancesReady,
      medications: closest.medications || [],
      verifiedName: closest.name
    });
  },

  fallbackResults() {
    const pos = window.FASTCOL_DATA.userPosition;
    const usePharm = this.types.indexOf("pharmacy") !== -1 && this.types.indexOf("hospital") === -1;
    const source = usePharm ? window.FASTCOL_DATA.pharmacies : window.FASTCOL_DATA.hospitals;
    return source.map((item) => ({
      id: item.id,
      name: item.name,
      type: usePharm ? "pharmacy" : "hospital",
      lat: item.lat,
      lng: item.lng,
      phone: item.phone || item.emergencyPhone || "",
      emergencyPhone: item.emergencyPhone || item.phone,
      address: item.address,
      openingHours: item.dutyLabel || "",
      availabilityStatus: item.availabilityStatus || item.dutyLabel,
      services: item.services || [],
      medications: item.medications || [],
      bedsAvailable: item.bedsAvailable,
      ambulancesReady: item.ambulancesReady,
      verified: true,
      source: "Annuaire Medilink"
    })).map((item) => {
      item.distanceKm = this.haversine(pos.lat, pos.lng, item.lat, item.lng);
      return item;
    });
  },

  async searchNearby() {
    const pos = window.FASTCOL_DATA.userPosition;
    this.setStatus("Recherche OpenStreetMap autour de vous…");
    try {
      const result = await window.OverpassClient.queryAmenities(pos.lat, pos.lng, this.types, this.radius);
      this.results = result.items
        .map((item) => this.mergeVerified(item))
        .map((item) => {
          item.distanceKm = this.haversine(pos.lat, pos.lng, item.lat, item.lng);
          return item;
        })
        .sort((a, b) => a.distanceKm - b.distanceKm);
      const origin = result.fromCache ? "cache local" : "Overpass API";
      this.setStatus(this.results.length + " établissement(s) trouvé(s) via " + origin + ".");
    } catch (err) {
      this.results = this.fallbackResults();
      this.setStatus("Overpass temporairement indisponible. Affichage de l’annuaire Medilink.");
    }
    this.drawMarkers();
    this.renderList();
    return this.results;
  },

  drawMarkers() {
    this.markers.forEach((marker) => this.map.removeLayer(marker));
    this.markers = [];
    this.results.forEach((item) => {
      const marker = L.marker([item.lat, item.lng]).addTo(this.map);
      marker.bindPopup("<strong>" + item.name + "</strong><br>" + (item.address || "Adresse non renseignée"));
      marker.on("click", () => this.focusFacility(item.id));
      this.markers.push(marker);
    });
  },

  esc(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  },

  renderList() {
    const list = document.getElementById(this.listId);
    if (!list) return;
    if (!this.results.length) {
      list.innerHTML = "<p class='meta mb-0'>Aucun établissement trouvé dans ce rayon.</p>";
      return;
    }
    list.innerHTML = this.results.slice(0, 20).map((item) => {
      const phone = item.emergencyPhone || item.phone;
      const name = this.esc(item.name);
      const address = this.esc(item.address || "Adresse non renseignée");
      const hours = item.openingHours ? "<div class='meta'>Horaires OSM : " + this.esc(item.openingHours) + "</div>" : "";
      const extra = item.verified && item.availabilityStatus
        ? "<div class='meta'>Info Medilink : " + this.esc(item.availabilityStatus) + "</div>"
        : "";
      const safePhone = this.esc(phone);
      return "<article class='facility-item'>" +
        "<div class='d-flex justify-content-between gap-3'>" +
        "<div><h3 class='h6 mb-1'>" + name + "</h3>" +
        "<div class='meta'>" + address + "</div>" +
        extra + hours +
        (phone ? "<div class='mt-1'><a href='tel:" + safePhone + "'>" + safePhone + "</a></div>" : "") +
        "</div><div class='text-end meta'>" + item.distanceKm.toFixed(1) + " km</div></div>" +
        "<div class='mt-2 d-flex flex-wrap gap-2'>" +
        "<button class='btn btn-sm btn-outline-dark' type='button' onclick=\"MapEngine.routeTo('" + item.id + "')\">Itinéraire</button>" +
        (phone ? "<a class='btn btn-sm btn-outline-dark' href='tel:" + safePhone + "'>Appeler</a>" : "") +
        "<button class='btn btn-sm btn-primary' type='button' onclick=\"Pages.createRequestFromFacility('" + item.id + "')\">Envoyer une demande</button>" +
        "</div></article>";
    }).join("");
  },

  findById(id) {
    return this.results.find((item) => item.id === id);
  },

  focusFacility(id) {
    const item = this.findById(id);
    if (!item) return;
    this.selectedId = id;
    this.map.setView([item.lat, item.lng], 15);
  },

  routeTo(id) {
    const item = this.findById(id);
    if (!item || !this.map) return;
    this.selectedId = id;
    if (this.routeLine) this.map.removeLayer(this.routeLine);
    const start = window.FASTCOL_DATA.userPosition;
    this.routeLine = L.polyline([[start.lat, start.lng], [item.lat, item.lng]], {
      color: "#1c1c1c",
      weight: 4
    }).addTo(this.map);
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [40, 40] });
    this.setStatus("Itinéraire vers " + item.name + " (" + item.distanceKm.toFixed(1) + " km).");
  }
};
