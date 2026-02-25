const nodemailer = require('nodemailer');

const FROM_NAME = 'Il Mondo di Lulz';
const FROM_ADDR = process.env.SMTP_USER || 'noreply@ilmondodilulz.com';

function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    // Force IPv4: Railway (and many PaaS) cannot reach SMTP servers over IPv6,
    // causing ENETUNREACH / ETIMEDOUT when dns resolves to an AAAA record first.
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000, // 10s connect timeout
    socketTimeout: 15000,     // 15s socket idle timeout
  });
}

function emailBase(bodyHtml) {
  return `
    <div style="font-family: 'Georgia', serif; max-width: 600px; margin: auto;
                background: #0a0a15; color: #e0d5b0; padding: 40px 36px;
                border-radius: 10px; border: 1px solid #daa520;">
      <div style="text-align: center; margin-bottom: 28px;">
        <h2 style="color: #daa520; letter-spacing: 2px; margin: 0;">✦ Il Mondo di Lulz ✦</h2>
      </div>
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #2a2a3a; margin: 32px 0;" />
      <p style="text-align: center; font-size: 0.78rem; color: #555; margin: 0;">
        &copy; ${new Date().getFullYear()} Il Mondo di Lulz &mdash; v1.0
      </p>
    </div>
  `;
}

/**
 * Invia email di verifica indirizzo dopo la registrazione.
 * @param {string} to  - indirizzo email destinatario
 * @param {string} nome - nome dell'utente
 * @param {string} verificationUrl - URL completo con token
 * @returns {Promise<boolean>}
 */
async function sendVerificationEmail(to, nome, verificationUrl) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] SMTP non configurato — verifica email non inviata a', to);
    return false;
  }

  const body = `
    <h3 style="color: #daa520;">Ciao, ${nome}!</h3>
    <p>Benvenuto nel portale astrologico <strong>Il Mondo di Lulz</strong>.<br>
       Per completare la registrazione e accedere al tuo profilo, clicca sul bottone qui sotto:</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${verificationUrl}"
         style="background: #daa520; color: #0a0a15; padding: 14px 32px; border-radius: 6px;
                text-decoration: none; font-weight: bold; font-size: 1rem; display: inline-block;">
        ✓ Verifica la tua Email
      </a>
    </div>
    <p style="font-size: 0.85rem; color: #888;">
      Il link è valido per <strong>24 ore</strong>.<br>
      Se non hai creato un account su Il Mondo di Lulz, ignora questa email.
    </p>
  `;

  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: 'Verifica il tuo indirizzo email – Il Mondo di Lulz',
    html: emailBase(body),
  });
  return true;
}

/**
 * Invia email di conferma cancellazione account.
 * @param {string} to   - indirizzo email originale (prima dell'anonimizzazione)
 * @param {string} nome - nome originale dell'utente
 * @returns {Promise<boolean>}
 */
async function sendDeletionEmail(to, nome) {
  const transport = getTransport();
  if (!transport) {
    console.warn('[Email] SMTP non configurato — email di cancellazione non inviata a', to);
    return false;
  }

  const body = `
    <h3 style="color: #daa520;">Ciao, ${nome}.</h3>
    <p>Ti confermiamo che il tuo account su <strong>Il Mondo di Lulz</strong>
       è stato correttamente <strong>eliminato</strong>.</p>
    <p>In conformità al <strong>Regolamento GDPR (UE) 2016/679</strong>, tutti i tuoi
       dati personali, le risposte all'intervista e le conversazioni con l'Oracolo sono
       stati <strong>permanentemente cancellati</strong> dai nostri sistemi.</p>
    <p>Se desideri tornare, potrai registrarti nuovamente in qualsiasi momento.</p>
    <p style="margin-top: 24px; color: #888; font-size: 0.9rem;">
      Per informazioni: <a href="mailto:log2ins@gmail.com" style="color: #daa520;">log2ins@gmail.com</a>
    </p>
  `;

  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: 'Il tuo account è stato eliminato – Il Mondo di Lulz',
    html: emailBase(body),
  });
  return true;
}

module.exports = { sendVerificationEmail, sendDeletionEmail };
