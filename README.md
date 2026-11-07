# Medilink

Plateforme d'orientation médicale : trouver un hôpital ou une pharmacie proche, être guidé par l'bot **MediBot**, envoyer une demande à l'établissement. Ciblée sur **Lomé (Togo)** et l'Afrique de l'Ouest (Accra, Cotonou, Abidjan, Dakar).

> Medilink n'est pas un service médical et ne pose pas de diagnostic. En cas de danger, appeler les secours (Togo : pompiers 118, police 117, gendarmerie 172, protection civile 170).

## Fonctionnalités
- Recherche d'hôpitaux et de pharmacies autour de la position de l'utilisateur (OpenStreetMap via Overpass).
- Carte **MapLibre GL JS + OpenFreeMap** (sans clé API) et itinéraire routier (OSRM, service de démonstration).
- Bot **MediBot** (Gemini, API Interactions) : répond à toute question (santé et autre) et, en priorité, recueille motif, urgence et localisation pour orienter vers un établissement. Mode de secours sans IA.
- Dictée vocale dans le chat (`js/voice.js`, API Web Speech du navigateur, français) : le texte reconnu est relu avant envoi. Non disponible sur Firefox.
- Aucune donnée d'exemple : les établissements viennent d'OpenStreetMap et de Supabase, les demandes sont créées par les utilisateurs.
- Suivi conseil (annuaire des professionnels et messagerie : à venir), suivi des demandes, page À propos.
- Espaces pro : historique des demandes et enregistrement des professionnels (validés par un admin avant affichage).
- Données vérifiées (Supabase) fusionnées avec OpenStreetMap, avec « vérifié il y a X min ».

## Structure
| Chemin | Rôle |
|---|---|
| `index.html`, `hopitaux.html`, `pharmacies.html`, `suivi-conseil.html`, `apropos.html` | Pages publiques (clients) |
| `hopital/admin.html`, `pharmacie/admin.html`, `js/staff.js` | Espaces professionnels séparés : connexion obligatoire, historique des demandes en lecture seule |
| `Djabli-admin.html`, `Djabli-admin-apropos.html`, `js/admin.js` | Administration : connexion admin, tableau de bord, aide |
| `css/app.css` | Styles (vert du logo + noir) |
| `assets/` | Logo et image du hero |
| `data.js` | Villes, numéros d'urgence vérifiés |
| `js/map-engine.js` | Carte, marqueurs, itinéraire |
| `js/medibot-engine.js` | Dialogue de MediBot côté navigateur |
| `js/db.js`, `js/config.js` | Lecture des données vérifiées (Supabase) |
| `js/pages.js`, `js/overpass.js` | Logique des pages, requêtes OSM |
| `api/medibot.js` | Fonction serverless : appelle Gemini, la clé reste côté serveur |
| `supabase/schema.sql` | Tables et règles d'accès (RLS) |

## Configuration
### 1. Gemini (obligatoire pour l'IA)
Vercel → Settings → Environment Variables :
- `GEMINI_API_KEY` : clé créée dans Google AI Studio. **Ne jamais l'écrire dans le code.**
- `GEMINI_MODEL` (facultatif, défaut `gemini-3.8-flash`).

Puis redéployer. Sans clé, MediBot fonctionne en mode de secours.

### 2. Supabase (données vérifiées)
Le projet `medilink` existe déjà et `js/config.js` le référence (clé « anon » uniquement). `supabase/schema.sql` et `supabase/feed.sql` décrivent ce qui y est appliqué. Pour un nouveau projet, les exécuter dans cet ordre.
3. **Jamais** la clé `service_role` dans le dépôt.

Sans configuration, le site utilise OpenStreetMap seul.

## Déploiement
Site statique + fonction `api/` : chaque `git push` sur `main` redéploie sur Vercel.

## Fil Actualités santé
Page `actualites.html`. Trois sources : MedlinePlus (service web officiel, résumés du domaine public, jamais les flux RSS ni les pages A.D.A.M./ASHP), Europe PMC (articles relus, sans préprints) et des flux d'institutions francophones à configurer.
- Base : exécuter `supabase/feed.sql`.
- Variables Vercel : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement), `CRON_SECRET`, `GEMINI_API_KEY`, et `FR_FEEDS` (facultatif) : `[{"name":"…","url":"https://…","category":"prevention","summary":false}]`. Vérifier les conditions de réutilisation de chaque flux avant de l'ajouter.
- Actualisation : secrets GitHub `INGEST_URL` (`https://<site>/api/ingest`) et `CRON_SECRET` (même valeur que dans Vercel). `.github/workflows/ingest.yml` s'exécute toutes les heures. Vercel gratuit ne permet qu'une tâche planifiée par jour.
- Intérêts et articles enregistrés : stockés dans le navigateur (`localStorage`), jamais envoyés au serveur.

## Administration (`Djabli-admin.html`)
Connexion obligatoire, rôle `admin` exigé. Pour créer le compte : Supabase → Authentication → Users → Add user ; puis, dans le SQL Editor : `insert into profiles (id, role) values ('<id de l''utilisateur>', 'admin');`. Désactiver l'inscription publique (Authentication → Sign In / Providers). Aide : `Djabli-admin-apropos.html`.

## Sécurité
- Une ancienne clé Gemini a été publique dans l'historique Git : elle doit être **révoquée**.
- L'espace hôpital et l'administration n'ont pas encore d'authentification (prévu avec Supabase Auth).
- Les textes saisis sont échappés avant affichage.

## Feuille de route
- [x] Interface, logo, hero, Lomé et Afrique de l'Ouest
- [x] MapLibre + OpenFreeMap, itinéraire routier
- [x] Clé Gemini côté serveur, API Interactions
- [x] Projet Supabase créé (Paris), tables et règles d'accès appliquées, vérifiées par le conseiller de sécurité
- [ ] Demandes enregistrées de bout en bout (test réel après déploiement)
- [ ] Connexion du personnel et de l'admin
- [ ] Synchronisation automatique des établissements (tâche programmée)
- [ ] Voix dans le navigateur
- [ ] Messages WhatsApp/SMS puis appels vocaux IA aux établissements (avec accord et mention « appel d'une IA »)
- [ ] Remplacer le serveur d'itinéraire de démonstration (OSRM) par un service pour la production
