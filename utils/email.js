/**
 * Email utility — dual provider:
 *
 *  1. BREVO (HTTP API, porta 443) — raccomandato per Railway e PaaS.
 *  2. SMTP fallback (nodemailer) — funziona in locale con qualsiasi server SMTP.
 *
 * Se nessuno è configurato, le email vengono loggate in console.
 */

const nodemailer = require('nodemailer');

const FROM_NAME = 'Il Mondo di Lulz';
const FROM_EMAIL = process.env.BREVO_SENDER_EMAIL
  || process.env.SMTP_USER
  || 'noreply@ilmondodilulz.com';
const ADMIN_EMAIL = 'log2ins@gmail.com';

// ---------------------------------------------------------------------------
// HTML wrapper comune
// ---------------------------------------------------------------------------
function emailBase(bodyHtml) {
  return `
    <div style="font-family:'Georgia',serif;max-width:600px;margin:auto;
                background:#0a0a15;color:#e0d5b0;padding:40px 36px;
                border-radius:10px;border:1px solid #daa520;">
      <div style="text-align:center;margin-bottom:28px;">
        <h2 style="color:#daa520;letter-spacing:2px;margin:0;">✦ Il Mondo di Lulz ✦</h2>
      </div>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #2a2a3a;margin:32px 0;" />
      <p style="text-align:center;font-size:0.78rem;color:#555;margin:0;">
        &copy; ${new Date().getFullYear()} Il Mondo di Lulz &mdash; v1.4.5
      </p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Provider 1: Brevo HTTP API (Node 18+ fetch built-in)
// ---------------------------------------------------------------------------
async function sendViaBrevo({ to, subject, html }) {
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Brevo API ${resp.status}: ${text}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Provider 2: SMTP fallback (nodemailer)
// ---------------------------------------------------------------------------
function getSmtpTransport() {
  if (!process.env.SMTP_HOST) return null;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE != null
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    family: 4,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendViaSmtp({ to, subject, html }) {
  const transport = getSmtpTransport();
  if (!transport) return false;
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to, subject, html,
  });
  return true;
}

// ---------------------------------------------------------------------------
// Dispatcher comune
// ---------------------------------------------------------------------------
async function sendEmail({ to, subject, html }) {
  if (process.env.BREVO_API_KEY) {
    console.log('[Email] Invio via Brevo HTTP API a', to);
    return sendViaBrevo({ to, subject, html });
  }
  if (process.env.SMTP_HOST) {
    console.log('[Email] Invio via SMTP a', to);
    return sendViaSmtp({ to, subject, html });
  }
  console.warn('[Email] Nessun provider configurato (BREVO_API_KEY o SMTP_HOST). Email non inviata a', to);
  return false;
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------
async function sendVerificationEmail(to, nome, verificationUrl) {
  const html = emailBase(`
    <h3 style="color:#daa520;">Ciao, ${nome}!</h3>
    <p>Benvenuto nel portale astrologico <strong>Il Mondo di Lulz</strong>.<br>
       Per completare la registrazione clicca sul bottone qui sotto:</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${verificationUrl}"
         style="background:#daa520;color:#0a0a15;padding:14px 32px;border-radius:6px;
                text-decoration:none;font-weight:bold;font-size:1rem;display:inline-block;">
        ✓ Verifica la tua Email
      </a>
    </div>
    <p style="font-size:0.85rem;color:#888;">
      Il link è valido per <strong>24 ore</strong>.<br>
      Se non hai creato un account su Il Mondo di Lulz, ignora questa email.
    </p>
  `);
  return sendEmail({ to, subject: 'Verifica il tuo indirizzo email – Il Mondo di Lulz', html });
}

async function sendDeletionEmail(to, nome) {
  const html = emailBase(`
    <h3 style="color:#daa520;">Ciao, ${nome}.</h3>
    <p>Ti confermiamo che il tuo account su <strong>Il Mondo di Lulz</strong>
       è stato correttamente <strong>eliminato</strong>.</p>
    <p>In conformità al <strong>Regolamento GDPR (UE) 2016/679</strong>, tutti i tuoi
       dati personali, le risposte all'intervista e le conversazioni con l'Oracolo sono
       stati <strong>permanentemente cancellati</strong> dai nostri sistemi.</p>
    <p>Se desideri tornare, potrai registrarti nuovamente in qualsiasi momento.</p>
    <p style="margin-top:24px;color:#888;font-size:0.9rem;">
      Per informazioni: <a href="mailto:log2ins@gmail.com" style="color:#daa520;">log2ins@gmail.com</a>
    </p>
  `);
  return sendEmail({ to, subject: 'Il tuo account è stato eliminato – Il Mondo di Lulz', html });
}

// ---------------------------------------------------------------------------
// Notifiche admin (a log2ins@gmail.com)
// ---------------------------------------------------------------------------

async function notifyNewVisitor(page, ip) {
  const { prepare } = require('../db');
  const adminNotif = prepare("SELECT value FROM settings WHERE key = 'admin_notifications'").get();
  if (!adminNotif || adminNotif.value !== '1') return false;

  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const shortIp = ip ? ip.split('.').slice(0, 2).join('.') + '.x.x' : 'sconosciuto';

  const html = emailBase(`
    <h3 style="color:#daa520;">🌟 Nuovo visitatore sul sito</h3>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Pagina:</td>
        <td style="color:#e0d5b0;">${page}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">IP (parziale):</td>
        <td style="color:#e0d5b0;">${shortIp}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Data/ora:</td>
        <td style="color:#e0d5b0;">${now}</td>
      </tr>
    </table>
  `);

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: '🌟 Nuovo visitatore – Il Mondo di Lulz',
    html,
  });
}

async function notifyNewRegistration(nome, cognome, email, segno) {
  const { prepare } = require('../db');
  const adminNotif = prepare("SELECT value FROM settings WHERE key = 'admin_notifications'").get();
  if (!adminNotif || adminNotif.value !== '1') return false;

  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const adminUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/admin/users';

  const html = emailBase(`
    <h3 style="color:#daa520;">✨ Nuovo utente registrato</h3>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Nome:</td>
        <td style="color:#e0d5b0;">${nome} ${cognome}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Email:</td>
        <td style="color:#e0d5b0;">${email}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Segno:</td>
        <td style="color:#e0d5b0;">${segno}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Data/ora:</td>
        <td style="color:#e0d5b0;">${now}</td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:28px;">
      <a href="${adminUrl}"
         style="background:#daa520;color:#0a0a15;padding:11px 26px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Vedi nel pannello admin →
      </a>
    </div>
  `);

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: '✨ Nuova registrazione – Il Mondo di Lulz',
    html,
  });
}

async function notifyAuthorFeedback(nome, email, tipo, contenuto, valutazione) {
  const { prepare } = require('../db');
  // Nota: inviamo sempre il feedback via email perché è un'azione esplicita dell'utente,
  // indipendentemente dall'impostazione admin_notifications (che riguarda i visitatori).

  const now = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
  const adminUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '') + '/admin/feedback';

  const html = emailBase(`
    <h3 style="color:#daa520;">📩 Nuovo feedback autore</h3>
    <p style="background:rgba(218,165,32,0.1);padding:10px;border-radius:4px;border-left:4px solid #daa520;">
      <strong>Nota:</strong> Questo feedback è in attesa di moderazione e non è ancora visibile pubblicamente.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Nome:</td>
        <td style="color:#e0d5b0;">${nome}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Email:</td>
        <td style="color:#e0d5b0;">${email}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Tipo:</td>
        <td style="color:#e0d5b0;">${tipo.toUpperCase()}</td>
      </tr>
      ${valutazione ? `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Valutazione:</td>
        <td style="color:#daa520;">${'★'.repeat(valutazione)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top;">Messaggio:</td>
        <td style="color:#e0d5b0;">${contenuto}</td>
      </tr>
      <tr>
        <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;">Data/ora:</td>
        <td style="color:#e0d5b0;">${now}</td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:28px;">
      <a href="${adminUrl}"
         style="background:#daa520;color:#0a0a15;padding:11px 26px;border-radius:6px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Gestisci in admin →
      </a>
    </div>
  `);

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `📩 Nuovo feedback (${tipo}) – Il Mondo di Lulz`,
    html,
  });
}

module.exports = {
  sendVerificationEmail,
  sendDeletionEmail,
  notifyNewVisitor,
  notifyNewRegistration,
  notifyAuthorFeedback,
};
