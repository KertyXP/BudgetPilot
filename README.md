# BudgetPilot

Application web personnelle d'analyse budgétaire **Zero-Database / BYOS (Bring Your Own Storage)** construite avec **Angular**, **Tailwind CSS**, **Chart.js**, **PapaParse**, **PWA (`@angular/pwa`)** et des **Vercel Serverless Functions** pour le flux OAuth 2.0 sécurisé.

Toutes vos données financières restent exclusivement dans votre **Google Drive personnel** : aucune base de données externe, aucun serveur ne stocke vos transactions.

---

## Architecture & Arborescence Google Drive

L'application utilise le scope restreint `https://www.googleapis.com/auth/drive.file` : elle ne peut accéder qu'aux dossiers et fichiers qu'elle crée elle-même.

Structure créée automatiquement dans votre Drive :

```text
Budget_App_Projets/
 └── <Nom_Du_Projet>/           (ex: Budget_2026)
      ├── regles.json           (Catégories + règles IBAN + règles mots-clés/regex)
      ├── transactions.json     (Transactions consolidées et dédupliquées SHA-256)
      └── exports_bruts/        (Archive horodatée de vos fichiers CSV Fortis bruts)
```

### Fonctionnalités principales
- **Authentification OAuth 2.0 durable (Authorization Code Flow)** : échange serveur du code via `/api/auth/login`, stockage du `refresh_token` dans un cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/auth`, rafraîchissement transparent sur erreur `401` via `authInterceptor` avec file d'attente mutualisée.
- **Import CSV BNP Paribas Fortis Belgique** : détection automatique UTF-8 / ISO-8859-1 (Windows-1252), séparateur `;`, montants européens (`-12,50`, `1.250,00`), dates `DD/MM/YYYY`, déduplication incrémentale SHA-256 (basée sur `Numéro de séquence` ou empreinte + compteur journalier `#1/#2`), archivage automatique du CSV brut.
- **Moteur de catégorisation & Workflow Pareto 80/20** : priorité `manualOverride > ibanRules > keywordRules > Non catégorisé`, regroupement des opérations non catégorisées par volume absolu décroissant pour catégoriser 80 % des dépenses en quelques clics.
- **Tableau de bord interactif** : filtres par mois / trimestre / année / plage personnalisée, exclusion des transferts internes, 5 KPIs, Donut cliquable par catégorie, graphique barres empilées mensuelles + courbe des revenus, Top 10 des commerçants.
- **Protection contre les conflits Drive** : vérification optimiste du `modifiedTime` avant chaque `PATCH` avec modale de résolution (recharger ou forcer l'écrasement).
- **PWA Mobile-First** : installable sur Android / iOS avec barre de navigation inférieure dédiée.

---

## 1. Configuration Google Cloud Console

1. Rendez-vous sur [Google Cloud Console](https://console.cloud.google.com/) et créez un nouveau projet (ex. `BudgetPilot`).
2. **Activer l'API Google Drive** :
   - Menu **API et services → Bibliothèque**
   - Recherchez **Google Drive API** et cliquez sur **Activer**.
3. **Configurer l'écran de consentement OAuth** :
   - Menu **Google Auth Platform** (ou **API et services → Écran de consentement OAuth**)
   - Choisissez le type **Externe** (pour un compte Gmail personnel).
   - Remplissez le nom de l'application (`BudgetPilot`) et votre adresse e-mail.
   - Dans **Champs d'application (Scopes)**, ajoutez :
     `https://www.googleapis.com/auth/drive.file`
   - Dans **Utilisateurs test**, ajoutez votre propre adresse e-mail Google (tant que l'application reste en mode *Test*, seuls les utilisateurs test autorisés peuvent se connecter ; note : en mode Test, Google expire les `refresh_token` après 7 jours — passez en mode *En production* si vous souhaitez un `refresh_token` durable sans ré-authentification hebdomadaire).
4. **Créer l'ID Client OAuth 2.0** :
   - Menu **Identifiants → Créer des identifiants → ID client OAuth**
   - Type d'application : **Application Web**
   - **Origines JavaScript autorisées** :
     - `http://localhost:3000` (pour le développement local avec `vercel dev`)
     - `https://votre-projet.vercel.app` (votre domaine de production Vercel)
   - **URI de redirection autorisés** :
     - `postmessage` (ou laissez vide si refusé par la console ; le flux popup Google Identity Services `initCodeClient` utilise `postmessage` implicitement avec l'origine JavaScript autorisée).
   - Copiez le **Client ID** (`GOOGLE_CLIENT_ID`) et le **Client Secret** (`GOOGLE_CLIENT_SECRET`).

---

## 2. Lancement en local avec `vercel dev`

> **Important :** N'utilisez pas uniquement `ng serve` pour tester la connexion Google, car les endpoints Serverless `/api/auth/*` sont exécutés par Vercel. Utilisez `vercel dev` pour lancer Angular et les fonctions `/api` ensemble sur `http://localhost:3000`.

1. Installez les dépendances :
   ```bash
   npm install
   ```
2. Installez la CLI Vercel si besoin :
   ```bash
   npm install -g vercel
   ```
3. Créez un fichier `.env.local` à la racine du projet en copiant `.env.example` :
   ```bash
   cp .env.example .env.local
   ```
   Puis renseignez vos identifiants Google Cloud :
   ```env
   GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-votre-client-secret
   GOOGLE_REDIRECT_URI=postmessage
   ```
4. Démarrez l'environnement complet (Angular + `/api/auth/*`) :
   ```bash
   vercel dev
   ```
5. Ouvrez **http://localhost:3000** dans Chrome, Edge ou Firefox (ces navigateurs considèrent `localhost` comme un contexte sécurisé permettant les cookies `Secure` + `HttpOnly`).

---

## 3. Déploiement sur Vercel

1. Poussez ce dépôt sur GitHub, GitLab ou Bitbucket.
2. Importez le dépôt depuis votre [tableau de bord Vercel](https://vercel.com/new).
3. Vercel détectera automatiquement `vercel.json` :
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist/budget-pilot/browser`
   - **Serverless Functions** : dossier `/api`
4. Dans **Project Settings → Environment Variables**, ajoutez les 3 variables suivantes (pour *Production* et *Preview*) :
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` = `postmessage`
5. Lancez le déploiement, puis ajoutez l'URL finale (`https://votre-app.vercel.app`) dans les **Origines JavaScript autorisées** de votre ID Client OAuth sur Google Cloud Console.

---

## 4. Installation PWA sur smartphone

- **Android (Chrome)** : ouvrez votre URL Vercel → menu `⋮` → **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
- **iOS (Safari)** : ouvrez votre URL Vercel → bouton **Partager** → **Sur l'écran d'accueil**.

---

## Scripts utiles

- `npm run build` : build de production Angular + Service Worker PWA (`ngsw`).
- `npm test` : exécution des tests unitaires (Vitest) pour le parser CSV BNP Paribas Fortis et le moteur de catégorisation Pareto.
- `vercel dev` : serveur local complet (frontend Angular + Vercel Serverless Functions `/api`).
