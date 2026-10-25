// Base de données temps réel simulée (Hôpitaux, Pharmacies de garde, Médecins, Signalements, Comptes, Abus)

window.FASTCOL_DATA = {
  cities: {
    casablanca: { name: "Casablanca", lat: 33.5731, lng: -7.5898 },
    rabat: { name: "Rabat", lat: 34.0209, lng: -6.8416 },
    paris: { name: "Paris", lat: 48.8566, lng: 2.3522 },
    dakar: { name: "Dakar", lat: 14.6928, lng: -17.4467 }
  },

  currentCity: "casablanca",
  userPosition: { lat: 33.5731, lng: -7.5898, label: "Ma position GPS actuelle (Centre-Ville)" },

  hospitals: [
    {
      id: "hosp-1",
      name: "CHU Ibn Rochd - Urgences Centrales",
      city: "casablanca",
      lat: 33.5692,
      lng: -7.6038,
      phone: "+212 522 48 20 20",
      emergencyPhone: "141 / +212 522 48 20 00",
      address: "1 Rue des Hôpitaux, Quartier des Hôpitaux",
      availabilityStatus: "Disponible",
      capacityLoad: 72,
      bedsAvailable: 14,
      ambulancesReady: 4,
      waitTimeMin: 8,
      distanceKm: 1.4,
      etaMin: 4,
      services: ["Urgences Générales", "Cardiologie", "Traumatologie", "Neurochirurgie", "Réanimation"],
      doctor: {
        name: "Dr. Sarah Johnson",
        specialty: "Médecin Urgentiste & Cardiologue",
        rating: 4.8,
        experienceYears: 8,
        patientsCount: "3.5k+",
        reviewsCount: "2.8k+",
        priceSession: "Consultation Urgence"
      },
      routeSteps: [
        { dist: "0,4 km", instruction: "Tournez à droite sur Boulevard Zerktouni", street: "Boulevard Zerktouni" },
        { dist: "0,6 km", instruction: "Continuez tout droit vers Rond-Point Mers Sultan", street: "Avenue Mers Sultan" },
        { dist: "0,4 km", instruction: "Entrée Urgences CHU à votre gauche", street: "Rue des Hôpitaux" }
      ]
    },
    {
      id: "hosp-2",
      name: "Hôpital Universitaire International Cheikh Khalifa",
      city: "casablanca",
      lat: 33.5465,
      lng: -7.6512,
      phone: "+212 529 00 44 77",
      emergencyPhone: "+212 529 00 44 88",
      address: "Avenue Mohammed Taïeb Naciri, Hay Hassani",
      availabilityStatus: "Disponible",
      capacityLoad: 54,
      bedsAvailable: 22,
      ambulancesReady: 5,
      waitTimeMin: 5,
      distanceKm: 3.8,
      etaMin: 9,
      services: ["Urgences Générales", "Pédiatrie", "Cardiologie", "Maternité", "Imagerie IRM/Scanner"],
      doctor: {
        name: "Dr. Marilyn Stanton",
        specialty: "Médecin Généraliste & Urgences Pédiatriques",
        rating: 4.9,
        experienceYears: 11,
        patientsCount: "4.2k+",
        reviewsCount: "1.9k+",
        priceSession: "70 € / 700 MAD"
      },
      routeSteps: [
        { dist: "1,2 km", instruction: "Prenez la voie rapide Route d'El Jadida", street: "Route d'El Jadida" },
        { dist: "1,8 km", instruction: "Sortie Hay Hassani / Hôpital Universitaire", street: "Av. Mohammed Taïeb Naciri" },
        { dist: "0,8 km", instruction: "Accès direct Rampe Ambulance Urgences", street: "Parvis HCK" }
      ]
    },
    {
      id: "hosp-3",
      name: "Clinique CliniQ Anfa & Urgences 24/7",
      city: "casablanca",
      lat: 33.5884,
      lng: -7.6321,
      phone: "+212 522 36 90 90",
      emergencyPhone: "+212 522 36 90 15",
      address: "Boulevard d'Anfa, Quartier Racine",
      availabilityStatus: "Forte affluence",
      capacityLoad: 87,
      bedsAvailable: 4,
      ambulancesReady: 2,
      waitTimeMin: 16,
      distanceKm: 2.5,
      etaMin: 7,
      services: ["Urgences Générales", "Maternité", "Ophtalmologie", "Pédiatrie"],
      doctor: {
        name: "Dr. Ching Ming Yu",
        specialty: "Spécialiste Urgences & Médecine Interne",
        rating: 4.6,
        experienceYears: 6,
        patientsCount: "2.1k+",
        reviewsCount: "1.1k+",
        priceSession: "55 € / 550 MAD"
      },
      routeSteps: [
        { dist: "0,9 km", instruction: "Rejoignez le Boulevard d'Anfa", street: "Boulevard d'Anfa" },
        { dist: "1,1 km", instruction: "Tournez à gauche sur Rue Jean Jaurès", street: "Quartier Racine" },
        { dist: "0,5 km", instruction: "Arrivée Clinique CliniQ Anfa", street: "Boulevard d'Anfa" }
      ]
    },
    {
      id: "hosp-4",
      name: "Hôpital Militaire & SAMU Régional",
      city: "casablanca",
      lat: 33.5610,
      lng: -7.5680,
      phone: "+212 522 24 01 01",
      emergencyPhone: "150",
      address: "Boulevard Al Fida, Mers Sultan",
      availabilityStatus: "Disponible",
      capacityLoad: 61,
      bedsAvailable: 19,
      ambulancesReady: 6,
      waitTimeMin: 6,
      distanceKm: 2.1,
      etaMin: 6,
      services: ["Traumatologie", "Urgences Générales", "Grands Brûlés", "Réanimation", "Toxicologie"],
      doctor: {
        name: "Dr. Saif Ababen",
        specialty: "Chirurgien Traumatologue & SAMU",
        rating: 4.7,
        experienceYears: 9,
        patientsCount: "3.0k+",
        reviewsCount: "980+",
        priceSession: "Urgence Publique"
      },
      routeSteps: [
        { dist: "0,7 km", instruction: "Prenez l'Avenue des FAR vers le Sud", street: "Avenue des FAR" },
        { dist: "1,4 km", instruction: "Tournez à droite sur Boulevard Al Fida", street: "Boulevard Al Fida" }
      ]
    }
  ],

  pharmacies: [
    {
      id: "pharm-1",
      name: "Pharmacie de Garde Al Amal 24h/24",
      city: "casablanca",
      lat: 33.5775,
      lng: -7.5965,
      phone: "+212 522 27 45 12",
      address: "48 Rue des Lilas, Quartier Gautier",
      isOnDuty: true,
      dutyLabel: "DE GARDE 24H/24 (Nuit & Jour)",
      distanceKm: 0.8,
      etaMin: 3,
      pharmacist: "Dr. Nadia Berrada (Pharmacienne Titulaire)",
      medications: [
        { name: "Insuline Lantus Solostar", stock: "En stock (8 boîtes)", price: "345 MAD", urgent: true },
        { name: "Ventoline 100 µg Inhalateur", stock: "En stock (15 unités)", price: "48 MAD", urgent: true },
        { name: "Amoxicilline / Augmentin 1g", stock: "En stock (22 boîtes)", price: "95 MAD", urgent: false },
        { name: "Doliprane / Paracétamol 1000mg", stock: "En stock (50+ boîtes)", price: "15 MAD", urgent: false },
        { name: "Adrénaline Epipen Auto-injecteur", stock: "En stock (4 unités)", price: "420 MAD", urgent: true }
      ],
      routeSteps: [
        { dist: "0,3 km", instruction: "Continuez tout droit sur Boulevard Zerktouni", street: "Boulevard Zerktouni" },
        { dist: "0,4 km", instruction: "Tournez à droite sur Rue des Lilas", street: "Rue des Lilas" },
        { dist: "0,1 km", instruction: "La Pharmacie de Garde Al Amal (Croix Verte illuminée) est à droite", street: "48 Rue des Lilas" }
      ]
    },
    {
      id: "pharm-2",
      name: "Grande Pharmacie Centrale de Garde Liberté",
      city: "casablanca",
      lat: 33.5655,
      lng: -7.5810,
      phone: "+212 522 30 88 91",
      address: "112 Quai de la Liberté, Centre-Ville",
      isOnDuty: true,
      dutyLabel: "DE GARDE 24H/24",
      distanceKm: 1.5,
      etaMin: 5,
      pharmacist: "Dr. Karim El Fassi",
      medications: [
        { name: "Ventoline 100 µg Inhalateur", stock: "En stock (9 unités)", price: "48 MAD", urgent: true },
        { name: "Cardioaspirine / Kardégic 75mg", stock: "En stock (18 boîtes)", price: "32 MAD", urgent: true },
        { name: "Insuline NovoRapid", stock: "En stock (6 boîtes)", price: "310 MAD", urgent: true },
        { name: "Sérum Physiologique & Pansements", stock: "En stock", price: "25 MAD", urgent: false },
        { name: "Spasfon Lyoc 80mg", stock: "En stock (14 boîtes)", price: "42 MAD", urgent: false }
      ],
      routeSteps: [
        { dist: "0,6 km", instruction: "Prenez Rue Victor Hugo vers l'Est", street: "Rue Victor Hugo" },
        { dist: "0,9 km", instruction: "Tournez à gauche sur Quai de la Liberté", street: "Quai de la Liberté" }
      ]
    },
    {
      id: "pharm-3",
      name: "Pharmacie du Port & Garde Nocturne",
      city: "casablanca",
      lat: 33.5820,
      lng: -7.6115,
      phone: "+212 522 44 19 03",
      address: "19 Avenue du Port",
      isOnDuty: true,
      dutyLabel: "DE GARDE JUSQU'À 08H00",
      distanceKm: 2.2,
      etaMin: 6,
      pharmacist: "Dr. Salma Tazi",
      medications: [
        { name: "Amoxicilline / Augmentin 1g", stock: "En stock (12 boîtes)", price: "95 MAD", urgent: false },
        { name: "Cortancyl / Prednisolone 20mg", stock: "En stock (10 boîtes)", price: "54 MAD", urgent: true },
        { name: "Doliprane / Paracétamol 1000mg", stock: "En stock (30 boîtes)", price: "15 MAD", urgent: false }
      ],
      routeSteps: [
        { dist: "1,1 km", instruction: "Empruntez le Boulevard Gambetta", street: "Boulevard Gambetta" },
        { dist: "1,1 km", instruction: "Continuez sur Avenue du Port", street: "Avenue du Port" }
      ]
    }
  ],

  requests: [
    {
      id: "REQ-2026-841",
      type: "Hôpital / Ambulance",
      patientName: "Youssef Benali",
      condition: "Douleur thoracique aiguë et essoufflement",
      urgency: "Critique",
      service: "Cardiologie",
      facilityId: "hosp-1",
      facilityName: "CHU Ibn Rochd - Urgences Centrales",
      actionChosen: "Ambulance dépêchée + Urgences",
      status: "En cours de coordination", // Envoyée | Reçue | En cours de coordination | Clôturée
      createdAt: "Il y a 4 min",
      patientCoords: "33.5731, -7.5898 (Quartier Gautier)",
      patientPhone: "+212 661 44 89 12",
      abuseScore: 4,
      flaggedAbusive: false,
      messages: [
        { sender: "Système Gemma IA", time: "14:54", text: "Signalement créé via Gemma. Triage : Douleur thoracique aiguë (Urgence Critique). Établissement sélectionné : CHU Ibn Rochd." },
        { sender: "Régulation CHU Ibn Rochd (Dr. Sarah)", time: "14:55", text: "Demande reçue et confirmée. L'ambulance unité AMB-04 est en route (arrivée estimée : 4 minutes). Restez assis au calme." },
        { sender: "Youssef Benali (Demandeur)", time: "14:56", text: "Merci docteur, je suis au rez-de-chaussée devant le numéro 14." }
      ]
    },
    {
      id: "REQ-2026-840",
      type: "Pharmacie de Garde",
      patientName: "Amina Mansouri",
      condition: "Crise d'asthme modérée - Besoin d'inhalateur",
      medication: "Ventoline 100 µg Inhalateur",
      urgency: "Élevée",
      service: "Pharmacie de Garde",
      facilityId: "pharm-1",
      facilityName: "Pharmacie de Garde Al Amal 24h/24",
      actionChosen: "Guidage GPS vers Pharmacie de Garde",
      status: "Reçue",
      createdAt: "Il y a 11 min",
      patientCoords: "33.5748, -7.5920 (Rue des Lilas)",
      patientPhone: "+212 662 91 03 45",
      abuseScore: 2,
      flaggedAbusive: false,
      messages: [
        { sender: "Système Gemma IA", time: "14:47", text: "Recherche médicament : Ventoline 100 µg (Urgent). Stock confirmé à Pharmacie de Garde Al Amal (0,8 km)." },
        { sender: "Dr. Nadia Berrada (Pharmacienne)", time: "14:48", text: "Votre boîte de Ventoline est préparée au comptoir de garde." }
      ]
    },
    {
      id: "REQ-2026-839",
      type: "Signalement Suspect",
      patientName: "Compte Anonyme #992",
      condition: "Test blague 123 ambulance",
      urgency: "Critique",
      service: "Urgences Générales",
      facilityId: "hosp-1",
      facilityName: "CHU Ibn Rochd - Urgences Centrales",
      actionChosen: "Demande Ambulance",
      status: "Clôturée",
      createdAt: "Il y a 28 min",
      patientCoords: "Position GPS incohérente (3 appels en 2 min)",
      patientPhone: "+212 600 00 00 99",
      abuseScore: 94,
      flaggedAbusive: true,
      abuseReason: "Appels répétitifs (3 en 2 min), motif incohérent détecté par Gemma NLP, coordonnée GPS falsifiée.",
      messages: [
        { sender: "Bouclier Anti-Abus Gemma", time: "14:30", text: "Alerte : Signalement détecté comme potentiellement abusif (Score de risque : 94%)." }
      ]
    }
  ],

  users: [
    { id: "USR-01", name: "Dr. Sarah Johnson", email: "s.johnson@chu-ibnrochd.ma", role: "Personnel Hospitalier (Urgentiste)", establishment: "CHU Ibn Rochd", status: "Actif" },
    { id: "USR-02", name: "Dr. Nadia Berrada", email: "n.berrada@pharm-alamal.ma", role: "Pharmacien de Garde", establishment: "Pharmacie Al Amal 24/7", status: "Actif" },
    { id: "USR-03", name: "Amine Ziani", email: "admin@fastcol-med.org", role: "Super Administrateur", establishment: "Direction Centrale FastCol", status: "Actif" },
    { id: "USR-04", name: "Youssef Benali", email: "y.benali@gmail.com", role: "Citoyen / Demandeur", establishment: "—", status: "Vérifié GPS" },
    { id: "USR-05", name: "Compte Anonyme #992", email: "anon992@temp.org", role: "Citoyen / Demandeur", establishment: "—", status: "Suspendu (Abus)" }
  ]
};
