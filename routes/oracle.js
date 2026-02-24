const express = require('express');
const { prepare, saveDb } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { chiediOracolo } = require('../utils/ai');

const router = express.Router();

// GET /oracolo
router.get('/', requireAuth, (req, res) => {
  const messaggi = prepare(`
    SELECT domanda, risposta, created_at
    FROM oracle_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.session.userId).reverse();

  res.render('oracle', { messaggi });
});

// POST /oracolo/chiedi (SSE streaming)
router.post('/chiedi', requireAuth, async (req, res) => {
  const { domanda } = req.body;

  if (!domanda || domanda.trim().length === 0) {
    return res.status(400).json({ error: 'Scrivi una domanda.' });
  }

  if (domanda.trim().length > 1000) {
    return res.status(400).json({ error: 'La domanda è troppo lunga (max 1000 caratteri).' });
  }

  const user = prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);

  if (!user) {
    return res.status(401).json({ error: 'Utente non trovato.' });
  }

  // Storico per contesto
  const storico = prepare(`
    SELECT domanda, risposta FROM oracle_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 6
  `).all(req.session.userId).reverse();

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let rispostaCompleta = '';

  try {
    for await (const chunk of chiediOracolo(user, domanda.trim(), storico)) {
      rispostaCompleta += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // Salva nel database
    prepare(`
      INSERT INTO oracle_messages (user_id, domanda, risposta, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(req.session.userId, domanda.trim(), rispostaCompleta);

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Oracle error:', err);
    res.write(`data: ${JSON.stringify({ error: 'L\'oracolo è momentaneamente indisponibile. Riprova più tardi.' })}\n\n`);
    res.end();
  }
});

module.exports = router;
