// Couche "données vérifiées" : établissements confirmés (Supabase) fusionnés avec OpenStreetMap par proximité.
window.MedilinkDB = {
  ago(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    return m < 1 ? "à l’instant" : m < 60 ? "il y a " + m + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : "il y a " + Math.round(m / 1440) + " j";
  },
  async load() {
    const c = window.MEDILINK_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
    try {
      const r = await fetch(c.supabaseUrl + "/rest/v1/facilities?select=*&is_verified=eq.true", {
        headers: { apikey: c.supabaseAnonKey, Authorization: "Bearer " + c.supabaseAnonKey }
      });
      if (!r.ok) return false;
      const D = window.FASTCOL_DATA;
      D.hospitals = []; D.pharmacies = [];
      (await r.json()).forEach((f) => {
        const when = f.verified_at ? "vérifié " + this.ago(f.verified_at) : "";
        const o = {
          id: f.id, name: f.name, lat: f.lat, lng: f.lng, phone: f.phone || "", emergencyPhone: f.phone || "",
          address: f.address || "", availabilityStatus: [f.availability, when].filter(Boolean).join(", "),
          dutyLabel: f.on_duty ? ["De garde", when].filter(Boolean).join(", ") : "",
          bedsAvailable: f.beds, ambulancesReady: f.ambulances, services: [], medications: []
        };
        (f.kind === "pharmacy" ? D.pharmacies : D.hospitals).push(o);
      });
      return true;
    } catch (err) { return false; }
  },
  async saveRequest(code, ctx, item, mode) {
    const c = window.MEDILINK_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
    const uuid = /^[0-9a-f-]{36}$/i.test(String(item.id));
    try {
      const r = await fetch(c.supabaseUrl + "/rest/v1/requests", {
        method: "POST",
        headers: { apikey: c.supabaseAnonKey, Authorization: "Bearer " + c.supabaseAnonKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          code: code, kind: mode === "pharmacy" ? "pharmacy" : "hospital",
          facility_id: uuid ? item.id : null, osm_id: uuid ? null : String(item.id), facility_name: item.name,
          patient_name: ctx.patientName || "", patient_phone: ctx.phone || "",
          patient_coords: window.FASTCOL_DATA.userPosition.lat.toFixed(4) + ", " + window.FASTCOL_DATA.userPosition.lng.toFixed(4),
          condition: ctx.condition || ctx.medication || "", urgency: ctx.urgency || ctx.urgent || ""
        })
      });
      return r.ok;
    } catch (err) { return false; }
  }
};
