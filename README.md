# Medilink

Plateforme d'orientation médicale : trouver un hôpital ou une pharmacie proche, être guidé par l'assistante **Gemma**, suivre sa demande. Ciblée sur **Lomé (Togo)** et l'Afrique de l'Ouest (Accra, Cotonou, Abidjan, Dakar).

> Medilink n'est pas un service médical et ne pose pas de diagnostic. En cas de danger, appeler les secours (Togo : pompiers 118, police 117, gendarmerie 172, protection civile 170).

## Fonctionnalités
- Recherche d'hôpitaux et de pharmacies autour de la position de l'utilisateur (OpenStreetMap via Overpass).
- Carte **MapLibre GL JS + OpenFreeMap** (sans clé API) et itinéraire routier (OSRM, service de démonstration).
- Assistante **Gemma** (Gemini, API Interactions) : répond à toute question (santé et autre) et, en priorité, recueille motif, urgence et localisation pour orienter vers un établissement. Mode de secours sans IA.
- Aucune donnée d'exemple : les établissements viennent d'OpenStreetMap et de Supabase, les demandes sont créées par les utilisateurs.
- Suivi des demandes, espace hôpital, administration.
- Données vérifiées (Supabase) fusionnées avec OpenStreetMap, avec « vérifié il y a X min ».

## Structure
| Chemin | Rôle |
|---|---|
| `index.html`, `hopitaux.html`, `pharmacies.html`, `suivi.html` | Pages publiques (clients) |
| `hopital/admin.html`, `pharmacie/admin.html`, `js/staff.js` | Espaces professionnels séparés : connexion obligatoire, historique des demandes en lecture seule |
| `admin.html` | Ancienne administration globale (non liée, à décider) |
| `css/app.css` | Styles (vert du logo + noir) |
| `assets/` | Logo et image du hero |
| `data.js` | Villes, numéros d'urgence vérifiés |
| `js/map-engine.js` | Carte, marqueurs, itinéraire |
| `js/gemma-engine.js` | Dialogue de Gemma côté navigateur |
| `js/db.js`, `js/config.js` | Lecture des données vérifiées (Supabase) |
| `js/pages.js`, `js/overpass.js` | Logique des pages, requêtes OSM |
| `api/gemma.js` | Fonction serverless : appelle Gemini, la clé reste côté serveur |
| `supabase/schema.sql` | Tables et règles d'accès (RLS) |

## Configuration
### 1. Gemini (obligatoire pour l'IA)
Vercel → Settings → Environment Variables :
- `GEMINI_API_KEY` : clé créée dans Google AI Studio. **Ne jamais l'écrire dans le code.**
- `GEMINI_MODEL` (facultatif, défaut `gemini-3.8-flash`).

Puis redéployer. Sans clé, Gemma fonctionne en mode de secours.

### 2. Supabase (données vérifiées)
1. Exécuter `supabase/schema.sql` dans le SQL Editor.
2. Renseigner `js/config.js` : `supabaseUrl` et `supabaseAnonKey` (clé « anon » uniquement).
3. **Jamais** la clé `service_role` dans le dépôt.

Sans configuration, le site utilise OpenStreetMap seul.

## Déploiement
Site statique + fonction `api/` : chaque `git push` sur `main` redéploie sur Vercel.

## Sécurité
- Une ancienne clé Gemini a été publique dans l'historique Git : elle doit être **révoquée**.
- L'espace hôpital et l'administration n'ont pas encore d'authentification (prévu avec Supabase Auth).
- Les textes saisis sont échappés avant affichage.

## Feuille de route
- [x] Interface, logo, hero, Lomé et Afrique de l'Ouest
- [x] MapLibre + OpenFreeMap, itinéraire routier
- [x] Clé Gemini côté serveur, API Interactions
- [ ] Tables Supabase créées et demandes de suivi persistantes
- [ ] Connexion du personnel et de l'admin
- [ ] Synchronisation automatique des établissements (tâche programmée)
- [ ] Voix dans le navigateur
- [ ] Messages WhatsApp/SMS puis appels vocaux IA aux établissements (avec accord et mention « appel d'une IA »)
- [ ] Remplacer le serveur d'itinéraire de démonstration (OSRM) par un service pour la production
