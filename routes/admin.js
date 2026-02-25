const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/admin');
const { prepare } = require('../db');
const { sendDeletionEmail } = require('../utils/email');

// Admin Login GET
router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: 'Admin Login', error: null });
});

// Admin Login POST
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'lulz_admin_2024';

  if (username === adminUser && password === adminPass) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/login', { title: 'Admin Login', error: 'Credenziali non valide.' });
});

// Admin Logout
router.get('/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin/login');
});

// Admin Dashboard
router.get('/dashboard', requireAdmin, (req, res) => {
  try {
    const userCount = prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL').get().count;
    const unverifiedCount = prepare('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND email_verified = 0').get().count;
    const oracleCount = prepare('SELECT COUNT(*) as count FROM oracle_messages').get().count;
    const latestUsers = prepare(
      'SELECT id, nome, email, email_verified, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5'
    ).all();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: { userCount, unverifiedCount, oracleCount },
      latestUsers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore nel caricamento della dashboard');
  }
});

// Admin Users List
router.get('/users', requireAdmin, (req, res) => {
  try {
    const users = prepare(
      'SELECT id, nome, cognome, email, segno_zodiacale, email_verified, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC'
    ).all();
    res.render('admin/users', { title: 'Gestione Utenti', users, success: req.query.deleted === '1' ? 'Utente eliminato correttamente.' : null });
  } catch (err) {
    res.status(500).send('Errore nel caricamento utenti');
  }
});

// Admin User Details
router.get('/users/:id', requireAdmin, (req, res) => {
  try {
    const user = prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).send('Utente non trovato');
    const oracleActivity = prepare('SELECT * FROM oracle_messages WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.render('admin/user-details', { title: 'Dettagli Utente', user, oracleActivity });
  } catch (err) {
    res.status(500).send('Errore nel caricamento dettagli utente');
  }
});

// POST /admin/users/:id/delete — Elimina un utente (soft delete + email)
router.post('/users/:id/delete', requireAdmin, async (req, res) => {
  try {
    const user = prepare('SELECT email, nome FROM users WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!user) return res.redirect('/admin/users');

    const { email: originalEmail, nome: originalNome } = user;

    // Soft delete: anonimizza i dati
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
    `).run(req.params.id);

    // Cancella messaggi oracolo
    prepare('DELETE FROM oracle_messages WHERE user_id = ?').run(req.params.id);

    // Invia email di conferma cancellazione (fire-and-forget)
    sendDeletionEmail(originalEmail, originalNome).catch((err) => {
      console.error('[Email] Errore invio email cancellazione (admin):', err);
    });

    res.redirect('/admin/users?deleted=1');
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore durante la cancellazione utente');
  }
});

module.exports = router;
