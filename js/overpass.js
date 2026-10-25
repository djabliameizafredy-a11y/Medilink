window.OverpassClient = {
  endpoints: [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ],
  cacheMs: 10 * 60 * 1000,

  cacheKey(lat, lng, amenities, radius) {
    return `medilink-overpass:${amenities.sort().join(",")}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
  },

  readCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.savedAt > this.cacheMs) return null;
      return parsed.items;
    } catch (err) {
      return null;
    }
  },

  writeCache(key, items) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), items }));
    } catch (err) {
      // Ignore quota errors
    }
  },

  buildQuery(lat, lng, amenities, radius) {
    const filter = amenities.join("|");
    return `[out:json][timeout:25];
nwr["amenity"~"^(${filter})$"](around:${radius},${lat},${lng});
out center tags;`;
  },

  normalize(element) {
    const tags = element.tags || {};
    const lat = element.lat || (element.center && element.center.lat);
    const lng = element.lon || (element.center && element.center.lon);
    if (lat == null || lng == null) return null;

    const amenity = tags.amenity || "clinic";
    const address = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:postcode"],
      tags["addr:city"]
    ].filter(Boolean).join(", ");

    return {
      id: "osm-" + element.type + "-" + element.id,
      osmId: element.id,
      name: tags.name || this.fallbackName(amenity),
      type: amenity,
      lat: lat,
      lng: lng,
      phone: tags.phone || tags["contact:phone"] || "",
      website: tags.website || tags["contact:website"] || "",
      openingHours: tags.opening_hours || "",
      address: address || tags["addr:full"] || "",
      emergency: tags.emergency || "",
      healthcare: tags.healthcare || tags["healthcare:speciality"] || "",
      source: "OpenStreetMap"
    };
  },

  fallbackName(amenity) {
    if (amenity === "hospital") return "Hôpital";
    if (amenity === "pharmacy") return "Pharmacie";
    return "Clinique";
  },

  async queryAmenities(lat, lng, amenities, radius) {
    const key = this.cacheKey(lat, lng, amenities, radius);
    const cached = this.readCache(key);
    if (cached) return { items: cached, fromCache: true };

    const query = this.buildQuery(lat, lng, amenities, radius);
    let lastError = null;

    for (let i = 0; i < this.endpoints.length; i++) {
      try {
        const response = await fetch(this.endpoints[i], {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          body: "data=" + encodeURIComponent(query)
        });
        if (!response.ok) {
          lastError = new Error("Overpass HTTP " + response.status);
          continue;
        }
        const data = await response.json();
        const items = (data.elements || []).map((el) => this.normalize(el)).filter(Boolean);
        this.writeCache(key, items);
        return { items: items, fromCache: false };
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Overpass indisponible");
  }
};
