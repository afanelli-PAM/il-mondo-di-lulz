const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/admin');
const { prepare } = require('../db');

// Admin Login GET
router.get('/login', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
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
        const oracleCount = prepare('SELECT COUNT(*) as count FROM oracle_messages').get().count;
        const latestUsers = prepare('SELECT id, nome, email, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5').all();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: { userCount, oracleCount },
            latestUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Errore nel caricamento della dashboard');
    }
});

// Admin Users List
router.get('/users', requireAdmin, (req, res) => {
    try {
        const users = prepare('SELECT id, nome, cognome, email, segno_zodiacale, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC').all();
        res.render('admin/users', { title: 'Gestione Utenti', users });
    } catch (err) {
        res.status(500).send('Errore nel caricamento utenti');
    }
});

// Admin User Details (Activities)
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

module.exports = router;
