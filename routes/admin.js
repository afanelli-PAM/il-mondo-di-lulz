const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/admin');
const { prepare } = require('../db');
const { sendDeletionEmail, notifyGiveawayStarted } = require('../utils/email');

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

    // ── Statistiche visite ──
    const visitsToday = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page != 'download:ebook' AND created_at >= date('now')"
    ).get().count;
    const visitsWeek = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page != 'download:ebook' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const visitsTotal = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page != 'download:ebook'"
    ).get().count;
    const uniqueVisitorsToday = prepare(
      "SELECT COUNT(DISTINCT ip_address) as count FROM page_views WHERE page != 'download:ebook' AND created_at >= date('now')"
    ).get().count;
    const uniqueVisitorsWeek = prepare(
      "SELECT COUNT(DISTINCT ip_address) as count FROM page_views WHERE page != 'download:ebook' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const uniqueVisitorsTotal = prepare(
      "SELECT COUNT(DISTINCT ip_address) as count FROM page_views WHERE page != 'download:ebook'"
    ).get().count;

    // ── Statistiche download ebook ──
    const downloadsToday = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:ebook' AND created_at >= date('now')"
    ).get().count;
    const downloadsWeek = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:ebook' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const downloadsTotal = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:ebook'"
    ).get().count;

    // ── Statistiche download PDF ──
    const pdfToday = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:pdf' AND created_at >= date('now')"
    ).get().count;
    const pdfWeek = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:pdf' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const pdfTotal = prepare(
      "SELECT COUNT(*) as count FROM page_views WHERE page = 'download:pdf'"
    ).get().count;

    // â”€â”€ Lettori unici estratto "Algoritmi" â”€â”€
    const algoritmiReadersToday = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:algoritmi-estratto' AND created_at >= date('now')"
    ).get().count;
    const algoritmiReadersWeek = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:algoritmi-estratto' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const algoritmiReadersTotal = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:algoritmi-estratto'"
    ).get().count;

    // Lettori unici flipbook "Il Mondo di Lulz"
    const lulzFlipbookReadersToday = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:il-mondo-di-lulz-flipbook' AND created_at >= date('now')"
    ).get().count;
    const lulzFlipbookReadersWeek = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:il-mondo-di-lulz-flipbook' AND created_at >= date('now', '-7 days')"
    ).get().count;
    const lulzFlipbookReadersTotal = prepare(
      "SELECT COUNT(DISTINCT COALESCE(session_id, ip_address)) as count FROM page_views WHERE page = 'read:il-mondo-di-lulz-flipbook'"
    ).get().count;

    const giveawayActive = (prepare("SELECT value FROM settings WHERE key = 'giveaway_active'").get()?.value || '0') === '1';
    const giveawayRoundId = parseInt(prepare("SELECT value FROM settings WHERE key = 'giveaway_round_id'").get()?.value || '0', 10) || 0;

    const giveawayPlayersRound = giveawayRoundId > 0
      ? prepare('SELECT COUNT(DISTINCT user_id) as count FROM giveaway_spins WHERE round_id = ?').get(giveawayRoundId).count
      : 0;
    const giveawaySpinsRound = giveawayRoundId > 0
      ? prepare('SELECT COUNT(*) as count FROM giveaway_spins WHERE round_id = ?').get(giveawayRoundId).count
      : 0;
    const giveawayWinnersRound = giveawayRoundId > 0
      ? prepare('SELECT COUNT(*) as count FROM giveaway_winners WHERE round_id = ?').get(giveawayRoundId).count
      : 0;

    const latestGiveawaySpins = prepare(`
      SELECT gs.round_id, gs.attempt_number, gs.user_sign, gs.result_sign, gs.is_winner, gs.created_at,
             u.nome as user_nome, u.email as user_email
      FROM giveaway_spins gs
      LEFT JOIN users u ON u.id = gs.user_id
      ORDER BY gs.created_at DESC
      LIMIT 15
    `).all();

    const latestGiveawayWinners = prepare(`
      SELECT gw.round_id, gw.win_code, gw.winning_sign, gw.attempt_number, gw.created_at,
             u.nome as user_nome, u.email as user_email
      FROM giveaway_winners gw
      LEFT JOIN users u ON u.id = gw.user_id
      ORDER BY gw.created_at DESC
      LIMIT 15
    `).all();

    // ── Visite ultimi 7 giorni (per grafico) ──
    const visitsByDay = prepare(`
      SELECT date(created_at) as giorno, COUNT(*) as visite, COUNT(DISTINCT ip_address) as unici
      FROM page_views
      WHERE page != 'download:ebook' AND created_at >= date('now', '-6 days')
      GROUP BY date(created_at) ORDER BY giorno ASC
    `).all();

    // ── Pagine più viste ──
    const topPages = prepare(`
      SELECT page, COUNT(*) as visite
      FROM page_views WHERE page != 'download:ebook'
      GROUP BY page ORDER BY visite DESC LIMIT 10
    `).all();

    const latestUsers = prepare(
      'SELECT id, nome, email, email_verified, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5'
    ).all();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      stats: {
        userCount, unverifiedCount, oracleCount,
        visitsToday, visitsWeek, visitsTotal,
        uniqueVisitorsToday, uniqueVisitorsWeek, uniqueVisitorsTotal,
        downloadsToday, downloadsWeek, downloadsTotal,
        pdfToday, pdfWeek, pdfTotal,
        algoritmiReadersToday, algoritmiReadersWeek, algoritmiReadersTotal,
        lulzFlipbookReadersToday, lulzFlipbookReadersWeek, lulzFlipbookReadersTotal,
        giveawayPlayersRound, giveawaySpinsRound, giveawayWinnersRound,
      },
      visitsByDay,
      topPages,
      latestUsers,
      giveaway: { active: giveawayActive, roundId: giveawayRoundId },
      latestGiveawaySpins,
      latestGiveawayWinners,
      // Pass links to the template for rendering
      adminUsersLink: '/admin/users',
      adminSettingsLink: '/admin/settings',
      adminFeedbackLink: '/admin/feedback',
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

// Admin Settings GET
router.get('/settings', requireAdmin, (req, res) => {
  try {
    const rows = prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);

    settings.giveaway_active = settings.giveaway_active || '0';
    settings.giveaway_round_id = settings.giveaway_round_id || '0';

    let success = null;
    if (req.query.saved === '1') {
      const mailed = parseInt(req.query.giveawayEmails || '0', 10) || 0;
      success = mailed > 0
        ? `Impostazioni salvate. Email giveaway inviate a ${mailed} utenti verificati.`
        : 'Impostazioni salvate correttamente.';
    }

    res.render('admin/settings', { title: 'Impostazioni', settings, success });
  } catch (err) {
    res.status(500).send('Errore nel caricamento impostazioni');
  }
});

// Admin Settings POST
router.post('/settings', requireAdmin, async (req, res) => {
  try {
    const keys = ['registration_verify_email', 'admin_notifications', 'giveaway_active'];
    const previous = {};

    keys.forEach(key => {
      previous[key] = prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '0';
    });

    const next = {};
    keys.forEach(key => {
      const value = req.body[key] === '1' ? '1' : '0';
      next[key] = value;
      prepare('UPDATE settings SET value = ?, updated_at = datetime(\'now\') WHERE key = ?').run(value, key);
    });

    let sentCount = 0;
    const giveawayActivated = previous.giveaway_active !== '1' && next.giveaway_active === '1';

    if (giveawayActivated) {
      const currentRound = parseInt(prepare("SELECT value FROM settings WHERE key = 'giveaway_round_id'").get()?.value || '0', 10) || 0;
      const nextRound = currentRound + 1;

      prepare('UPDATE settings SET value = ?, updated_at = datetime(\'now\') WHERE key = ?').run(String(nextRound), 'giveaway_round_id');
      prepare('UPDATE settings SET value = ?, updated_at = datetime(\'now\') WHERE key = ?').run(new Date().toISOString(), 'giveaway_started_at');

      const verifiedUsers = prepare(
        'SELECT nome, email FROM users WHERE deleted_at IS NULL AND email_verified = 1 ORDER BY created_at ASC'
      ).all();

      const results = await Promise.allSettled(
        verifiedUsers.map((u) => notifyGiveawayStarted(u.email, u.nome, nextRound))
      );
      sentCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    const redirectUrl = sentCount > 0
      ? `/admin/settings?saved=1&giveawayEmails=${sentCount}`
      : '/admin/settings?saved=1';
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('[Admin Settings] Error:', err);
    res.status(500).send('Errore nel salvataggio impostazioni');
  }
});

// Admin Feedback List
router.get('/feedback', requireAdmin, (req, res) => {
  try {
    const feedback = prepare('SELECT * FROM author_feedback ORDER BY created_at DESC').all();
    res.render('admin/feedback', { title: 'Gestione Feedback Autore', feedback, success: req.query.deleted === '1' ? 'Feedback eliminato.' : null });
  } catch (err) {
    res.status(500).send('Errore nel caricamento feedback');
  }
});

// Admin Feedback Delete
router.post('/feedback/:id/delete', requireAdmin, (req, res) => {
  try {
    prepare('DELETE FROM author_feedback WHERE id = ?').run(req.params.id);
    res.redirect('/admin/feedback?deleted=1');
  } catch (err) {
    res.status(500).send('Errore nella cancellazione feedback');
  }
});

// Admin Feedback Approve/Unapprove
router.post('/feedback/:id/toggle-approve', requireAdmin, (req, res) => {
  try {
    const feedback = prepare('SELECT is_approved FROM author_feedback WHERE id = ?').get(req.params.id);
    if (!feedback) return res.status(404).send('Feedback non trovato');

    const newStatus = feedback.is_approved === 1 ? 0 : 1;
    prepare('UPDATE author_feedback SET is_approved = ? WHERE id = ?').run(newStatus, req.params.id);

    res.redirect('/admin/feedback?updated=1');
  } catch (err) {
    res.status(500).send('Errore durante l\'aggiornamento dello stato');
  }
});

module.exports = router;
