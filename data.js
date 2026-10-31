// Données de base. Les établissements viennent d'OpenStreetMap ; l'annuaire vérifié sera dans Supabase (phase 2).
window.FASTCOL_DATA = {
  cities: {
    lome: { name: "Lomé", country: "TG", lat: 6.1319, lng: 1.2228 },
    accra: { name: "Accra", country: "GH", lat: 5.6037, lng: -0.1870 },
    cotonou: { name: "Cotonou", country: "BJ", lat: 6.3703, lng: 2.3912 },
    abidjan: { name: "Abidjan", country: "CI", lat: 5.3600, lng: -4.0083 },
    dakar: { name: "Dakar", country: "SN", lat: 14.6928, lng: -17.4467 }
  },
  currentCity: "lome",
  userPosition: { lat: 6.1319, lng: 1.2228, label: "Lomé" },
  // Numéros vérifiés uniquement. Un pays vide = à compléter après vérification officielle.
  EMERGENCY: {
    TG: [["Pompiers", "118"], ["Police", "117"], ["Gendarmerie", "172"], ["Protection civile", "170"]],
    BJ: [["SAMU", "112"], ["Pompiers", "118"], ["Police", "117"]],
    SN: [["SAMU", "1515"], ["Pompiers", "18"], ["Police", "17"]],
    GH: [], CI: []
  },
  hospitals: [],
  pharmacies: [],
  users: [],
  requests: []
};
