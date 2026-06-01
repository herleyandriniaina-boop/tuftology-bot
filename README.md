# 🔫 TUFTOLOGY — Bot Messenger

## Structure du projet
```
tuftology-bot/
├── server.js          ← Le serveur/bot principal
├── package.json       ← Dépendances Node.js
├── README.md          ← Ce guide
└── public/
    └── index.html     ← Formulaire WebView
```

## Variables d'environnement (à configurer sur Railway)
```
PAGE_ACCESS_TOKEN=   ← Token généré sur Facebook Developer
VERIFY_TOKEN=        ← Mot secret que tu choisis (ex: TUFTOLOGY2024)
ADMIN_PSID=          ← Ton PSID Messenger personnel
SERVER_URL=          ← URL Railway (ex: https://tuftology.up.railway.app)
```

## Déploiement
1. Push ce dossier sur GitHub
2. Connecter Railway à ce repo
3. Ajouter les variables d'environnement
4. Copier l'URL Railway → mettre dans Facebook Webhook
5. Aller sur https://ton-serveur.up.railway.app/setup → configurer le menu

## Endpoints
- GET  /           → Health check
- GET  /webhook    → Vérification Facebook
- POST /webhook    → Réception des événements
- GET  /formulaire → WebView formulaire
- POST /api/commande → Réception commandes HTML
- GET  /setup      → Configure le menu persistant Messenger
