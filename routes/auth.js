const express = require('express');
const bcrypt = require('bcrypt');
const { prepare } = require('../db');
const { guestOnly } = require('../middleware/auth');
const { getSegnoZodiacale } = require('../utils/astrology');

const router = express.Router();

// GET /auth/register
router.get('/register', guestOnly, (req, res) => {
  res.render('register', { error: null, formData: {} });
});

// POST /auth/register
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

  // Check email unica
  const existing = prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase().trim());
  if (existing) {
    return res.render('register', { error: 'Questa email è già registrata.', formData });
  }

  // Calcola segno zodiacale
  const date = new Date(data_nascita);
  const segno = getSegnoZodiacale(date.getDate(), date.getMonth() + 1);

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = prepare(`
      INSERT INTO users (
        email, password_hash, nome, cognome, data_nascita, ora_nascita, luogo_nascita,
        segno_zodiacale, come_ti_vedono, come_sei, attivita_aspirazioni,
        tre_cose_piacciono, tre_cose_odi, felicita,
        consenso_privacy, data_consenso, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
    `).run(
      email.toLowerCase().trim(), passwordHash, nome.trim(), cognome.trim(),
      data_nascita, ora_nascita || null, luogo_nascita.trim(),
      segno.nome,
      (come_ti_vedono || '').trim() || null,
      (come_sei || '').trim() || null,
      (attivita_aspirazioni || '').trim() || null,
      (tre_cose_piacciono || '').trim() || null,
      (tre_cose_odi || '').trim() || null,
      (felicita || '').trim() || null,
    );

    req.session.userId = result.lastInsertRowid;
    req.session.userName = nome.trim();

    res.redirect('/profilo');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { error: 'Errore durante la registrazione. Riprova.', formData });
  }
});

// GET /auth/login
router.get('/login', guestOnly, (req, res) => {
  res.render('login', { error: null });
});

// POST /auth/login
router.post('/login', guestOnly, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { error: 'Inserisci email e password.' });
  }

  const user = prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase().trim());

  if (!user) {
    return res.render('login', { error: 'Credenziali non valide.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.render('login', { error: 'Credenziali non valide.' });
  }

  req.session.userId = user.id;
  req.session.userName = user.nome;

  res.redirect('/profilo');
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('lulz.sid');
    res.redirect('/');
  });
});

module.exports = router;
