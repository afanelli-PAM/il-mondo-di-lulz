const express = require('express');
const { prepare } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendDeletionEmail } = require('../utils/email');

const router = express.Router();

// GET /gdpr/i-miei-dati — Esporta tutti i dati dell'utente (diritto di accesso)
router.get('/i-miei-dati', requireAuth, (req, res) => {
  const user = prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);

  if (!user) return res.redirect('/');

  const messaggi = prepare('SELECT domanda, risposta, created_at FROM oracle_messages WHERE user_id = ?').all(req.session.userId);
  const consensi = prepare('SELECT consent_type, granted, created_at, ip_address FROM cookie_consents WHERE user_id = ?').all(req.session.userId);

  const { password_hash, verification_token, verification_token_expires, ...datiUtente } = user;

  const exportData = {
    informazioni_personali: datiUtente,
    messaggi_oracolo: messaggi,
    consensi_registrati: consensi,
    data_esportazione: new Date().toISOString(),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="i-miei-dati-${user.id}.json"`);
  res.json(exportData);
});

// GET /gdpr/cancella-account — Pagina conferma cancellazione
router.get('/cancella-account', requireAuth, (req, res) => {
  res.render('delete-account', { error: null });
});

// POST /gdpr/cancella-account — Cancella account (diritto all'oblio)
router.post('/cancella-account', requireAuth, async (req, res) => {
  const { conferma } = req.body;

  if (conferma !== 'CANCELLA') {
    return res.render('delete-account', { error: 'Scrivi "CANCELLA" per confermare.' });
  }

  // Recupera email e nome PRIMA dell'anonimizzazione (servono per l'email di conferma)
  const user = prepare('SELECT email, nome FROM users WHERE id = ? AND deleted_at IS NULL').get(req.session.userId);
  if (!user) return res.redirect('/');

  const { email: originalEmail, nome: originalNome } = user;

  // Soft delete: anonimizza i dati mantenendo la struttura
  prepare(`
    UPDATE users SET
      email = 'deleted_' || id || '@deleted.local',
      password_hash = 'DELETED',
      nome = 'Utente',
      cognome = 'Cancellato',
      come_ti_vedono = NULL,
      come_sei = NULL,
      attivita_aspirazioni = NULL,
      tre_cose_piacciono = NULL,
      tre_cose_odi = NULL,
      felicita = NULL,
      tema_natale = NULL,
      verification_token = NULL,
      verification_token_expires = NULL,
      deleted_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(req.session.userId);

  // Cancella messaggi oracolo
  prepare('DELETE FROM oracle_messages WHERE user_id = ?').run(req.session.userId);

  // Invia email di conferma cancellazione (fire-and-forget, non blocca il flusso)
  sendDeletionEmail(originalEmail, originalNome).catch((err) => {
    console.error('[Email] Errore invio email cancellazione:', err);
  });

  req.session.destroy(() => {
    res.clearCookie('lulz.sid');
    res.redirect('/?deleted=1');
  });
});

module.exports = router;
