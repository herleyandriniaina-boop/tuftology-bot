// ════════════════════════════════════════════════════════════
//  TUFTOLOGY — Messenger Bot Server
//  Fonctionnalités :
//   - Webhook Facebook Messenger
//   - Bot auto-répondeur
//   - Menu de bienvenue + boutons rapides
//   - Réception commandes + preuves de paiement
//   - Transfert de tous les messages vers le compte admin
//   - WebView HTML dans Messenger
// ════════════════════════════════════════════════════════════

const express    = require('express');
const bodyParser = require('body-parser');
const axios      = require('axios');
const app        = express();

app.use(bodyParser.json());
app.use(express.static('public'));  // pour servir le formulaire HTML

// ─── CONFIG (à remplir dans les variables d'environnement) ───
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN      = process.env.VERIFY_TOKEN;
// PSID de ton compte admin (toi) — comment l'obtenir : voir guide
const ADMIN_PSID        = process.env.ADMIN_PSID;
// URL publique de ton serveur Railway
const SERVER_URL        = process.env.SERVER_URL || 'https://ton-serveur.up.railway.app';

// ════════════════════════════════════════════════════════════
//  WEBHOOK VERIFICATION
// ════════════════════════════════════════════════════════════
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié !');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ════════════════════════════════════════════════════════════
//  WEBHOOK EVENTS
// ════════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object !== 'page') return res.sendStatus(404);

  res.sendStatus(200); // répondre vite à Facebook

  for (const entry of body.entry) {
    for (const event of (entry.messaging || [])) {
      const senderPsid = event.sender.id;
      const isAdmin    = senderPsid === ADMIN_PSID;

      // ── Message reçu ──────────────────────────────────────
      if (event.message) {
        await handleMessage(senderPsid, event.message, isAdmin);
      }

      // ── Postback (bouton cliqué) ───────────────────────────
      if (event.postback) {
        await handlePostback(senderPsid, event.postback.payload);
      }
    }
  }
});

// ════════════════════════════════════════════════════════════
//  HANDLE MESSAGE
// ════════════════════════════════════════════════════════════
async function handleMessage(psid, message, isAdmin) {
  const text = (message.text || '').toLowerCase().trim();

  // ── Si c'est l'admin qui écrit → ne pas boucler ──────────
  if (isAdmin) return;

  // ── Photo / Preuve de paiement ────────────────────────────
  if (message.attachments) {
    for (const att of message.attachments) {
      if (att.type === 'image') {
        await notifyAdmin(`📸 *PREUVE DE PAIEMENT reçue*\nClient PSID: ${psid}\nURL: ${att.payload.url}`);
        await send(psid, {
          text: "✅ Merci pour votre preuve de paiement ! Notre équipe va vérifier votre paiement et confirmer votre commande sous peu. 🙏"
        });
        return;
      }
      // Autre fichier
      await notifyAdmin(`📎 Fichier reçu de ${psid}\nType: ${att.type}\nURL: ${att.payload?.url || 'N/A'}`);
    }
    return;
  }

  // ── Notifier l'admin de tous les messages ─────────────────
  await notifyAdmin(`💬 *Message de client*\nPSID: ${psid}\nMessage: "${message.text || ''}"`);

  // ── Réponses automatiques ─────────────────────────────────
  if (text.includes('bonjour') || text.includes('salut') || text.includes('hello') || text.includes('bj')) {
    await sendWelcomeMenu(psid);
    return;
  }

  if (text.includes('prix') || text.includes('tarif') || text.includes('coût') || text.includes('combien')) {
    await send(psid, {
      text: "💰 Nos tarifs sont calculés sur mesure selon les dimensions :\n\n• Toile primaire : 25 000 Ar/ml\n• Dos antidérapant : 25 000 Ar/ml\n• Colle : 45 000 Ar/kg\n• Fil laine : 12 000 Ar/100g\n\nUtilisez notre calculateur pour obtenir votre devis exact 👇"
    });
    await sendWebviewButton(psid);
    return;
  }

  if (text.includes('délai') || text.includes('livraison') || text.includes('combien de temps') || text.includes('quand')) {
    await send(psid, {
      text: "📅 Délais de fabrication :\n\n• Petit format (< 6 m²) : 7 jours ouvrables\n• Grand format (≥ 6 m²) : 14 jours ouvrables\n\nCes délais courent à partir de la confirmation de votre acompte 50%."
    });
    return;
  }

  if (text.includes('paiement') || text.includes('payer') || text.includes('mobile money') || text.includes('orange') || text.includes('mvola') || text.includes('airtel')) {
    await send(psid, {
      text: "💳 Modes de paiement acceptés :\n\n🟠 Orange Money\n🔴 Airtel Money\n🔵 MVola (Telma)\n\nNuméro : 033 96 400 40\nCompte : TUFTOLOGY — Say Kim Herley\n\n📸 Envoyez votre capture d'écran de confirmation ici après paiement."
    });
    return;
  }

  if (text.includes('commande') || text.includes('commander') || text.includes('tapis') || text.includes('devis')) {
    await sendWebviewButton(psid);
    return;
  }

  if (text.includes('merci') || text.includes('ok') || text.includes('d\'accord') || text.includes('parfait')) {
    await send(psid, {
      text: "🙏 De rien ! N'hésitez pas si vous avez d'autres questions. L'équipe TUFTOLOGY est là pour vous 🔫✨"
    });
    return;
  }

  // ── Réponse par défaut ────────────────────────────────────
  await sendDefaultReply(psid);
}

// ════════════════════════════════════════════════════════════
//  HANDLE POSTBACK
// ════════════════════════════════════════════════════════════
async function handlePostback(psid, payload) {
  switch (payload) {
    case 'GET_STARTED':
      await sendWelcomeMenu(psid);
      break;
    case 'COMMANDER':
      await sendWebviewButton(psid);
      break;
    case 'TARIFS':
      await send(psid, {
        text: "💰 Nos tarifs sont calculés sur mesure selon les dimensions :\n\n• Toile primaire : 25 000 Ar/ml\n• Dos antidérapant : 25 000 Ar/ml\n• Colle : 45 000 Ar/kg\n• Fil laine acrylique : 12 000 Ar/100g\n⚡ Grand format (≥ 6m²) : +60 000 Ar\n\nUtilisez notre calculateur 👇"
      });
      await sendWebviewButton(psid);
      break;
    case 'DELAIS':
      await send(psid, {
        text: "📅 Délais TUFTOLOGY :\n\n• Petit format < 6m² → 7 jours ouvrables\n• Grand format ≥ 6m² → 14 jours ouvrables\n\nFabrication artisanale à Antananarivo 🇲🇬"
      });
      break;
    case 'PAIEMENT':
      await send(psid, {
        text: "💳 Paiement Mobile Money :\n\n🟠 Orange Money\n🔴 Airtel Money\n🔵 MVola (Telma)\n\nNuméro : 033 96 400 40\nCompte : TUFTOLOGY — Say Kim Herley\n\n📸 Après paiement → envoyez votre capture ici directement !"
      });
      break;
    case 'CONTACT':
      await send(psid, {
        text: "📞 Contactez-nous :\n\n📱 033 96 400 40\n📍 Antananarivo, Madagascar 🇲🇬\n\nNous répondons généralement dans l'heure !"
      });
      break;
  }
}

// ════════════════════════════════════════════════════════════
//  MESSAGES HELPERS
// ════════════════════════════════════════════════════════════

// ── Menu de bienvenue ─────────────────────────────────────
async function sendWelcomeMenu(psid) {
  await send(psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "👋 Bienvenue chez TUFTOLOGY !\n\nNous créons des tapis sur mesure artisanaux à Antananarivo 🇲🇬✨\n\nQue puis-je faire pour vous ?",
        buttons: [
          {
            type: "web_url",
            url: `${SERVER_URL}/formulaire`,
            title: "🔫 Commander un tapis",
            webview_height_ratio: "full",
            messenger_extensions: true
          },
          {
            type: "postback",
            title: "💰 Voir les tarifs",
            payload: "TARIFS"
          },
          {
            type: "postback",
            title: "📅 Délais & infos",
            payload: "DELAIS"
          }
        ]
      }
    }
  });

  // Deuxième bulle avec plus d'options
  await send(psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Besoin d'autre chose ?",
        buttons: [
          {
            type: "postback",
            title: "💳 Modes de paiement",
            payload: "PAIEMENT"
          },
          {
            type: "postback",
            title: "📞 Nous contacter",
            payload: "CONTACT"
          }
        ]
      }
    }
  });
}

// ── Bouton WebView formulaire ─────────────────────────────
async function sendWebviewButton(psid) {
  await send(psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "🔫 Créez votre tapis sur mesure !\nCalculez votre devis et passez commande directement :",
        buttons: [
          {
            type: "web_url",
            url: `${SERVER_URL}/formulaire`,
            title: "📐 Ouvrir le formulaire",
            webview_height_ratio: "full",
            messenger_extensions: true
          }
        ]
      }
    }
  });
}

// ── Réponse par défaut ─────────────────────────────────────
async function sendDefaultReply(psid) {
  await send(psid, {
    attachment: {
      type: "template",
      payload: {
        template_type: "button",
        text: "Bonjour ! 👋 Je suis le bot TUFTOLOGY.\n\nJe peux vous aider avec :\n• Devis et commandes\n• Tarifs et délais\n• Modes de paiement\n\nQue souhaitez-vous ?",
        buttons: [
          {
            type: "web_url",
            url: `${SERVER_URL}/formulaire`,
            title: "🔫 Commander",
            webview_height_ratio: "full",
            messenger_extensions: true
          },
          {
            type: "postback",
            title: "💰 Tarifs",
            payload: "TARIFS"
          },
          {
            type: "postback",
            title: "💳 Paiement",
            payload: "PAIEMENT"
          }
        ]
      }
    }
  });
}

// ── Notifier l'admin ───────────────────────────────────────
async function notifyAdmin(text) {
  if (!ADMIN_PSID) return;
  try {
    await send(ADMIN_PSID, { text: `🔔 TUFTOLOGY BOT\n\n${text}` });
  } catch (e) {
    console.error('Erreur notif admin:', e.message);
  }
}

// ── Envoi générique ────────────────────────────────────────
async function send(psid, messageData) {
  try {
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messages`,
      { recipient: { id: psid }, message: messageData },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
  } catch (err) {
    console.error('Erreur envoi message:', err.response?.data || err.message);
  }
}

// ════════════════════════════════════════════════════════════
//  ROUTE — Formulaire WebView
// ════════════════════════════════════════════════════════════
app.get('/formulaire', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ════════════════════════════════════════════════════════════
//  API — Recevoir une commande depuis le formulaire HTML
// ════════════════════════════════════════════════════════════
app.post('/api/commande', async (req, res) => {
  const { nom, tel, dimensions, total, acompte, psid } = req.body;

  // Notifier l'admin
  const msg = `📦 *NOUVELLE COMMANDE TUFTOLOGY*\n\n👤 Client : ${nom}\n📱 Tél : +261 ${tel}\n📐 Dimensions : ${dimensions}\n💰 Total estimé : ${total} Ar\n💵 Acompte 50% : ${acompte} Ar`;
  await notifyAdmin(msg);

  // Si on a le PSID du client, confirmer dans Messenger
  if (psid) {
    await send(psid, {
      text: `✅ Commande reçue, ${nom} !\n\n📐 ${dimensions}\n💰 Total : ${total} Ar\n💵 Acompte à payer : ${acompte} Ar\n\n💳 Numéro de paiement :\n📱 033 96 400 40\n(TUFTOLOGY — Say Kim Herley)\n\n📸 Envoyez votre preuve de paiement ici dès que c'est fait !`
    });
  }

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════
//  SETUP — Profil du bot (Get Started + Menu persistant)
// ════════════════════════════════════════════════════════════
app.get('/setup', async (req, res) => {
  try {
    // Bouton Get Started
    await axios.post(
      `https://graph.facebook.com/v19.0/me/messenger_profile`,
      {
        get_started: { payload: "GET_STARTED" },
        greeting: [
          {
            locale: "default",
            text: "Bienvenue chez TUFTOLOGY 🔫 — Tapis sur mesure artisanaux à Antananarivo 🇲🇬. Appuyez sur Démarrer pour découvrir nos services !"
          },
          {
            locale: "fr_FR",
            text: "Bienvenue chez TUFTOLOGY 🔫 — Tapis sur mesure artisanaux à Antananarivo 🇲🇬. Appuyez sur Démarrer pour découvrir nos services !"
          }
        ],
        persistent_menu: [
          {
            locale: "default",
            composer_input_disabled: false,
            call_to_actions: [
              {
                type: "web_url",
                title: "🔫 Commander un tapis",
                url: `${SERVER_URL}/formulaire`,
                webview_height_ratio: "full",
                messenger_extensions: true
              },
              {
                type: "postback",
                title: "💰 Tarifs",
                payload: "TARIFS"
              },
              {
                type: "postback",
                title: "📅 Délais de fabrication",
                payload: "DELAIS"
              },
              {
                type: "postback",
                title: "💳 Modes de paiement",
                payload: "PAIEMENT"
              },
              {
                type: "postback",
                title: "📞 Nous contacter",
                payload: "CONTACT"
              }
            ]
          }
        ]
      },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    res.json({ success: true, message: "✅ Profil bot configuré ! Menu persistant + Get Started activés." });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ─── Health check ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send('🔫 TUFTOLOGY Bot — En ligne ✅');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 TUFTOLOGY Bot démarré sur le port ${PORT}`));
