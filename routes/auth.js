const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const { prepare } = require('../db');
const { guestOnly } = require('../middleware/auth');
const { getSegnoZodiacale } = require('../utils/astrology');
const { sendVerificationEmail, notifyNewRegistration } = require('../utils/email');

const router = express.Router();

const BASE_URL = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

// ---------------------------------------------------------------------------
// GET /auth/register
// ---------------------------------------------------------------------------
router.get('/register', guestOnly, (req, res) => {
  res.render('register', { error: null, formData: {} });
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
router.post('/register', guestOnly, async (req, res) => {
  const {
    email, password, password_confirm, nome, cognome,
    data_nascita, ora_nascita, luogo_nascita,
    come_ti_vedono, come_sei, attivita_aspirazioni,
    tre_cose_piacciono, tre_cose_odi, felicita,
    consenso_privacy,
  } = req.body;

  const formData = req.body;

  // Validazione
  if (!email || !password || !nome || !cognome || !data_nascita || !luogo_nascita) {
    return res.render('register', { error: 'Compila tutti i campi obbligatori.', formData });
  }
  if (password.length < 8) {
    return res.render('register', { error: 'La password deve avere almeno 8 caratteri.', formData });
  }
  if (password !== password_confirm) {
    return res.render('register', { error: 'Le password non corrispondono.', formData });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.render('register', { error: 'Indirizzo email non valido.', formData });
  }
  if (!consenso_privacy) {
    return res.render('register', { error: 'Devi accettare l\'informativa sulla privacy per registrarti.', formData });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Email già registrata?
  const existing = prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get(normalizedEmail);
  if (existing) {
    return res.render('register', { error: 'Questa email è già registrata.', formData });
  }

  const date = new Date(data_nascita);
  const segno = getSegnoZodiacale(date.getDate(), date.getMonth() + 1);

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    // Token di verifica email (valido 24 ore)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    prepare(`
      INSERT INTO users (
        email, password_hash, nome, cognome, data_nascita, ora_nascita, luogo_nascita,
        segno_zodiacale, come_ti_vedono, come_sei, attivita_aspirazioni,
        tre_cose_piacciono, tre_cose_odi, felicita,
        consenso_privacy, data_consenso,
        email_verified, verification_token, verification_token_expires,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'),
                0, ?, ?, datetime('now'), datetime('now'))
    `).run(
      normalizedEmail, passwordHash, nome.trim(), cognome.trim(),
      data_nascita, ora_nascita || null, luogo_nascita.trim(),
      segno.nome,
      (come_ti_vedono || '').trim() || null,
      (come_sei || '').trim() || null,
      (attivita_aspirazioni || '').trim() || null,
      (tre_cose_piacciono || '').trim() || null,
      (tre_cose_odi || '').trim() || null,
      (felicita || '').trim() || null,
      verificationToken,
      tokenExpires,
    );

    const verificationUrl = `${BASE_URL()}/auth/verifica-email?token=${verificationToken}`;

    // Fire-and-forget: l'utente è già creato nel DB, non blocchiamo il redirect
    // se l'SMTP fallisce (l'utente potrà cliccare "Reinvia" dalla pagina di login).
    const regVerify = prepare("SELECT value FROM settings WHERE key = 'registration_verify_email'").get();
    if (regVerify && regVerify.value === '1') {
      sendVerificationEmail(normalizedEmail, nome.trim(), verificationUrl).catch((err) => {
        console.error('[Email] Errore invio verifica a', normalizedEmail, err.message);
      });
    }

    // Notifica admin della nuova registrazione
    notifyNewRegistration(nome.trim(), cognome.trim(), normalizedEmail, segno.nome).catch((err) => {
      console.error('[Email] Errore notifica admin (registrazione):', err.message);
    });

    if (regVerify && regVerify.value === '1') {
      return res.redirect(`/auth/verifica-email-inviata?email=${encodeURIComponent(normalizedEmail)}`);
    } else {
      return res.redirect(`/auth/login?registered=1`);
    }
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { error: 'Errore durante la registrazione. Riprova.', formData });
  }
});

// ---------------------------------------------------------------------------
// GET /auth/verifica-email-inviata  —  "Controlla la tua casella di posta"
// ---------------------------------------------------------------------------
router.get('/verifica-email-inviata', (req, res) => {
  res.render('verify-email-sent', {
    email: req.query.email || '',
    resent: req.query.resent === '1',
  });
});

// ---------------------------------------------------------------------------
// GET /auth/verifica-email?token=xxx  —  Click sul link nell'email
// ---------------------------------------------------------------------------
router.get('/verifica-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.render('verify-email', { success: false, message: 'Token mancante.' });

  const user = prepare('SELECT * FROM users WHERE verification_token = ? AND deleted_at IS NULL').get(token);

  if (!user) {
    return res.render('verify-email', { success: false, message: 'Link non valido o già utilizzato.' });
  }

  if (new Date(user.verification_token_expires) < new Date()) {
    return res.render('verify-email', {
      success: false,
      message: 'Il link di verifica è scaduto. <a href="/auth/verifica-email-inviata?email=' + encodeURIComponent(user.email) + '">Richiedi un nuovo link</a>.',
    });
  }

  prepare(`
    UPDATE users SET email_verified = 1, verification_token = NULL,
    verification_token_expires = NULL, updated_at = datetime('now')
    WHERE id = ?
  `).run(user.id);

  res.render('verify-email', { success: true, message: 'Email verificata con successo! Ora puoi accedere.' });
});

// ---------------------------------------------------------------------------
// POST /auth/reinvia-verifica  —  Reinvia email di verifica
// ---------------------------------------------------------------------------
router.post('/reinvia-verifica', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();

  const user = prepare(
    'SELECT * FROM users WHERE email = ? AND email_verified = 0 AND deleted_at IS NULL'
  ).get(email);

  if (user) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    prepare(`
      UPDATE users SET verification_token = ?, verification_token_expires = ?,
      updated_at = datetime('now') WHERE id = ?
    `).run(verificationToken, tokenExpires, user.id);

    const regVerify = prepare("SELECT value FROM settings WHERE key = 'registration_verify_email'").get();
    if (regVerify && regVerify.value === '1') {
      sendVerificationEmail(email, user.nome, verificationUrl).catch((err) => {
        console.error('[Email] Errore reinvio verifica a', email, err.message);
      });
    }
  }

  // Risposta generica (non rivela se l'email esiste nel sistema)
  res.redirect(`/auth/verifica-email-inviata?email=${encodeURIComponent(email)}&resent=1`);
});

// ---------------------------------------------------------------------------
// GET /auth/login
// ---------------------------------------------------------------------------
router.get('/login', guestOnly, (req, res) => {
  let info = null;
  if (req.query.verified === '1') info = 'Email verificata! Ora puoi accedere.';
  if (req.query.registered === '1') info = 'Registrazione completata con successo! Ora puoi accedere.';

  res.render('login', {
    error: null,
    info,
    needsVerification: false,
    pendingEmail: null,
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
router.post('/login', guestOnly, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { error: 'Inserisci email e password.', info: null, needsVerification: false, pendingEmail: null });
  }

  const user = prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase().trim());

  if (!user) {
    return res.render('login', { error: 'Credenziali non valide.', info: null, needsVerification: false, pendingEmail: null });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.render('login', { error: 'Credenziali non valide.', info: null, needsVerification: false, pendingEmail: null });
  }

  // Blocca l'accesso se l'email non è stata verificata (solo se la verifica è attiva)
  const regVerify = prepare("SELECT value FROM settings WHERE key = 'registration_verify_email'").get();
  if (regVerify && regVerify.value === '1' && !user.email_verified) {
    return res.render('login', {
      error: null,
      info: null,
      needsVerification: true,
      pendingEmail: user.email,
    });
  }

  req.session.userId = user.id;
  req.session.userName = user.nome;
  res.redirect('/profilo');
});

// ---------------------------------------------------------------------------
// GET /auth/logout
// ---------------------------------------------------------------------------
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('lulz.sid');
    res.redirect('/');
  });
});

module.exports = router;
