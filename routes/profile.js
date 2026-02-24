const express = require('express');
const { prepare } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { generaRiepilogoAstrale } = require('../utils/astrology');
const { generaTemaNatale } = require('../utils/ai');

const router = express.Router();

// GET /profilo - Dashboard utente
router.get('/', requireAuth, (req, res) => {
  const user = prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);

  if (!user) {
    req.session.destroy(() => res.redirect('/'));
    return;
  }

  const messaggiRecenti = prepare(`
    SELECT domanda, risposta, created_at
    FROM oracle_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(req.session.userId);

  res.render('dashboard', { profilo: user, messaggiRecenti });
});

// GET /profilo/tema-natale
router.get('/tema-natale', requireAuth, (req, res) => {
  const user = prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);

  if (!user) {
    return res.redirect('/');
  }

  const { riepilogo, dati } = generaRiepilogoAstrale(user.data_nascita, user.ora_nascita);

  res.render('natal-chart', {
    profilo: user,
    riepilogo,
    dati,
    interpretazione: user.tema_natale,
  });
});

// POST /profilo/genera-tema - Genera tema natale con AI
router.post('/genera-tema', requireAuth, async (req, res) => {
  const user = prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Utente non trovato.' });
  }

  try {
    const { riepilogo } = generaRiepilogoAstrale(user.data_nascita, user.ora_nascita);
    const interpretazione = await generaTemaNatale(user, riepilogo);

    prepare(`
      UPDATE users SET tema_natale = ?, tema_natale_generato_il = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(interpretazione, user.id);

    res.json({ ok: true, interpretazione });
  } catch (err) {
    console.error('Natal chart generation error:', err);
    res.status(500).json({ error: 'Errore nella generazione del tema natale. Riprova più tardi.' });
  }
});

module.exports = router;
