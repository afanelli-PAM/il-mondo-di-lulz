const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prepare } = require('../db');
const { notifyAuthorFeedback, sendGiveawayWinEmail } = require('../utils/email');

const router = express.Router();
const MAX_GIVEAWAY_ATTEMPTS = 3;
const ZODIAC_SIGNS = [
    'Ariete',
    'Toro',
    'Gemelli',
    'Cancro',
    'Leone',
    'Vergine',
    'Bilancia',
    'Scorpione',
    'Sagittario',
    'Capricorno',
    'Acquario',
    'Pesci',
];

function normalizeSign(sign) {
    if (!sign) return null;
    const normalized = String(sign)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    return ZODIAC_SIGNS.find((s) => s.toLowerCase() === normalized) || null;
}

function getGiveawayState() {
    const active = (prepare("SELECT value FROM settings WHERE key = 'giveaway_active'").get()?.value || '0') === '1';
    const roundId = parseInt(prepare("SELECT value FROM settings WHERE key = 'giveaway_round_id'").get()?.value || '0', 10) || 0;
    return { active, roundId };
}

function buildWinCode(roundId) {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    const suffix = Date.now().toString(36).toUpperCase();
    return `LULZ-${roundId}-${random}-${suffix}`;
}

function generateUniqueWinCode(roundId) {
    for (let i = 0; i < 8; i++) {
        const candidate = buildWinCode(roundId);
        const existing = prepare('SELECT id FROM giveaway_winners WHERE win_code = ?').get(candidate);
        if (!existing) return candidate;
    }
    return buildWinCode(roundId);
}

// GET /autore - Pagina di dialogo con l'autore
router.get('/', (req, res) => {
    // Prendi le recensioni pubbliche (massimo 10)
    const recensioni = prepare(`
    SELECT nome, contenuto, valutazione, created_at 
    FROM author_feedback 
    WHERE tipo = 'recensione' AND is_approved = 1
    ORDER BY created_at DESC 
    LIMIT 10
  `).all();

    // Informazioni sul libro (tradotte e riassunte da Grokipedia/Search)
    const bookInfo = {
        titolo: "Il mondo di Lulz",
        autore: "Antonio Fanelli",
        descrizione: "Il mondo di Lulz è un technothriller italiano che esplora la vulnerabilità digitale e i meccanismi del web. La storia segue Lulz, un giovane e cinico hacker di Bari, che crea un finto sito di astrologia per adescare Giulia e rubare i suoi dati personali. Quello che inizia come un freddo calcolo informatico finisce per travolgere l'intera cerchia sociale della ragazza e lo stesso Lulz, che si ritrova inaspettatamente coinvolto emotivamente nella vita della sua vittima.",
        temi: [
            "Vulnerabilità dei dati personali online",
            "Ingegneria sociale e manipolazione del destino",
            "Il confine tra identità digitale e reale",
            "Cinismo tecnologico vs. sentimenti umani"
        ],
        storia: "Originariamente autopubblicato nel 2012, il romanzo ha ricevuto nuove edizioni nel 2023. È stato apprezzato per la sua capacità di rendere accessibili concetti informatici complessi tramite una narrazione scorrevole e inquietante."
    };

    res.render('author-dialog', {
        title: 'Il libro',
        bookInfo,
        recensioni,
        error: null,
        success: req.query.success === '1',
        formData: req.session.userId ? { nome: req.session.userName } : {}
    });
});

// GET /autore/altri-libri - Pagina "Algoritmi"
router.get('/altri-libri', (req, res) => {
    const estrattoPath = path.join(__dirname, '..', 'public', 'downloads', 'Algoritmi_Estratto.pdf');
    let estrattoVersion = Date.now();
    try {
        estrattoVersion = fs.statSync(estrattoPath).mtimeMs.toFixed(0);
    } catch (err) {
        console.warn('[AltriLibri] Impossibile leggere mtime estratto:', err.message);
    }

    const algoritmiInfo = {
        titolo: 'Algoritmi',
        autore: 'Antonio Fanelli',
        editore: 'Edizioni Mondo Nuovo',
        collana: 'Tascabili da viaggio',
        formato: '12x18,5 - brossurato',
        pagine: '308',
        isbn: '9791281202481',
        uscita: '22 novembre 2024',
        prezzo: 'EUR 18,00',
        coverImage: '/images/CopertinaMondoNuovo.jpg',
        productUrl: 'https://www.edizionimondonuovo.com/catalogo/algoritmi/',
        approfondimentoUrl: 'https://www.arte-news.it/ApprofondimentoPoliticaSociet/Esploso/15993/Algoritmi-di-Antonio-Fanelli-Un-Thriller-Tecnologico-che-Toglie-il-Respiro',
        trailerUrl: 'https://www.youtube.com/watch?v=z20eBwc2d8Q',
        trailerEmbedUrl: 'https://www.youtube.com/embed/z20eBwc2d8Q',
        pdfPreviewUrl: `/download/algoritmi-estratto?v=${estrattoVersion}`,
        descrizione: 'Sara, una giovane di famiglia agiata, viene ricattata da un hacker chiamato "Riddle" dopo una notte nata per gioco. Da quel momento, minacce digitali, forum tossici e manipolazione online si intrecciano in un thriller teso e contemporaneo.',
        temi: [
            'Ricatto digitale e sorveglianza',
            'Manipolazione online e responsabilita collettiva',
            'Confine fragile tra finzione, spettacolo e realta',
            'Privacy come illusione nell era iperconnessa'
        ]
    };

    const reviewExtracts = [
        {
            text: 'Un thriller tecnologico che toglie il respiro.',
            source: 'Arte News',
            url: algoritmiInfo.approfondimentoUrl
        },
        {
            text: 'Tiene il lettore con il fiato sospeso fino all ultima pagina.',
            source: 'Arte News',
            url: algoritmiInfo.approfondimentoUrl
        },
        {
            text: '4.40/5 di valutazione media della community (5 rating).',
            source: 'Goodreads - Antonio Fanelli (author page)',
            url: 'https://www.goodreads.com/author/list/6653396.Antonio_Fanelli'
        }
    ];

    res.render('author-other-books', {
        title: 'Altri libri dell autore',
        algoritmiInfo,
        reviewExtracts
    });
});

// GET /autore/giveaway/status - Stato ruota giveaway per utente corrente
router.get('/giveaway/status', (req, res) => {
    try {
        const { active, roundId } = getGiveawayState();

        if (!req.session.userId) {
            return res.json({
                active,
                roundId,
                requiresLogin: true,
                emailVerified: false,
                hasWon: false,
                attemptsUsed: 0,
                attemptsLeft: 0,
                maxAttempts: MAX_GIVEAWAY_ATTEMPTS,
                userSign: null,
                winCode: null,
                canSpin: false,
            });
        }

        const user = prepare(
            'SELECT id, nome, email, email_verified, segno_zodiacale FROM users WHERE id = ? AND deleted_at IS NULL'
        ).get(req.session.userId);

        if (!user) {
            return res.json({
                active,
                roundId,
                requiresLogin: true,
                emailVerified: false,
                hasWon: false,
                attemptsUsed: 0,
                attemptsLeft: 0,
                maxAttempts: MAX_GIVEAWAY_ATTEMPTS,
                userSign: null,
                winCode: null,
                canSpin: false,
            });
        }

        const winner = roundId > 0
            ? prepare('SELECT win_code FROM giveaway_winners WHERE user_id = ? AND round_id = ?').get(user.id, roundId)
            : null;
        const attemptsUsed = roundId > 0
            ? prepare('SELECT COUNT(*) as count FROM giveaway_spins WHERE user_id = ? AND round_id = ?').get(user.id, roundId).count
            : 0;
        const attemptsLeft = Math.max(0, MAX_GIVEAWAY_ATTEMPTS - attemptsUsed);

        return res.json({
            active,
            roundId,
            requiresLogin: false,
            emailVerified: user.email_verified === 1,
            hasWon: !!winner,
            attemptsUsed,
            attemptsLeft,
            maxAttempts: MAX_GIVEAWAY_ATTEMPTS,
            userSign: normalizeSign(user.segno_zodiacale) || user.segno_zodiacale || null,
            winCode: winner ? winner.win_code : null,
            canSpin: active && user.email_verified === 1 && !winner && attemptsLeft > 0,
        });
    } catch (err) {
        console.error('[Giveaway] Status error:', err);
        return res.status(500).json({ error: 'Errore durante il caricamento dello stato giveaway.' });
    }
});

// POST /autore/giveaway/spin - Esegue una giocata alla ruota
router.post('/giveaway/spin', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Devi essere registrato per giocare.' });
        }

        const acceptedTerms = req.body?.acceptedTerms === true || req.body?.acceptedTerms === '1';
        if (!acceptedTerms) {
            return res.status(400).json({ error: 'Devi accettare le condizioni di gioco prima di girare la ruota.' });
        }

        const { active, roundId } = getGiveawayState();
        if (!active || roundId <= 0) {
            return res.status(400).json({ error: 'Giveaway non attivo al momento.' });
        }

        const user = prepare(
            'SELECT id, nome, email, email_verified, segno_zodiacale FROM users WHERE id = ? AND deleted_at IS NULL'
        ).get(req.session.userId);

        if (!user) {
            return res.status(401).json({ error: 'Sessione non valida. Effettua di nuovo il login.' });
        }

        if (user.email_verified !== 1) {
            return res.status(403).json({ error: 'Per partecipare devi prima confermare l indirizzo email.' });
        }

        const userSign = normalizeSign(user.segno_zodiacale);
        if (!userSign) {
            return res.status(400).json({ error: 'Segno zodiacale non disponibile nel profilo utente.' });
        }

        const existingWinner = prepare(
            'SELECT win_code FROM giveaway_winners WHERE user_id = ? AND round_id = ?'
        ).get(user.id, roundId);

        if (existingWinner) {
            return res.status(400).json({
                error: 'Hai gia vinto questo giveaway.',
                hasWon: true,
                winCode: existingWinner.win_code,
            });
        }

        const attemptsUsed = prepare(
            'SELECT COUNT(*) as count FROM giveaway_spins WHERE user_id = ? AND round_id = ?'
        ).get(user.id, roundId).count;

        if (attemptsUsed >= MAX_GIVEAWAY_ATTEMPTS) {
            return res.status(400).json({ error: 'Hai terminato i 3 tentativi disponibili per questo giveaway.' });
        }

        const resultSign = ZODIAC_SIGNS[Math.floor(Math.random() * ZODIAC_SIGNS.length)];
        const isWinner = resultSign === userSign;
        const attemptNumber = attemptsUsed + 1;

        const spinInsert = prepare(`
            INSERT INTO giveaway_spins (
                user_id, round_id, attempt_number, user_sign, result_sign, is_winner,
                accepted_terms, ip_address, session_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            user.id,
            roundId,
            attemptNumber,
            userSign,
            resultSign,
            isWinner ? 1 : 0,
            1,
            req.ip || null,
            req.sessionID || null
        );

        let winCode = null;
        if (isWinner) {
            winCode = generateUniqueWinCode(roundId);
            prepare(`
                INSERT INTO giveaway_winners (
                    user_id, round_id, win_code, winning_sign, attempt_number, source_spin_id, redeemed, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
            `).run(user.id, roundId, winCode, resultSign, attemptNumber, spinInsert.lastInsertRowid || null);

            sendGiveawayWinEmail(user.email, user.nome, winCode, userSign, roundId).catch((err) => {
                console.error('[Email] Errore invio email vincita giveaway:', err.message);
            });
        }

        return res.json({
            success: true,
            roundId,
            resultSign,
            userSign,
            isWinner,
            attemptsUsed: attemptNumber,
            attemptsLeft: Math.max(0, MAX_GIVEAWAY_ATTEMPTS - attemptNumber),
            maxAttempts: MAX_GIVEAWAY_ATTEMPTS,
            winCode,
            message: isWinner
                ? 'Complimenti! Hai vinto il libro cartaceo.'
                : 'Nessuna vincita in questo tentativo. Puoi riprovare.',
        });
    } catch (err) {
        console.error('[Giveaway] Spin error:', err);
        return res.status(500).json({ error: 'Errore durante la giocata. Riprova tra poco.' });
    }
});

// POST /autore/feedback - Invia messaggio o recensione
router.post('/feedback', async (req, res) => {
    const { nome, email, tipo, contenuto, valutazione } = req.body;
    const userId = req.session.userId || null;

    // Validazione base
    if (!nome || !email || !tipo || !contenuto) {
        // Nota: in un'app reale dovremmo ri-renderizzare la pagina con l'errore,
        // qui semplifichiamo per brevità o usiamo un redirect con errore.
        return res.status(400).send('Tutti i campi sono obbligatori.');
    }

    try {
        prepare(`
      INSERT INTO author_feedback (user_id, nome, email, tipo, contenuto, valutazione, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(userId, nome.trim(), email.trim().toLowerCase(), tipo, contenuto.trim(), valutazione ? parseInt(valutazione, 10) : null);

        // Notifica l'autore (admin) via email
        notifyAuthorFeedback(nome.trim(), email.trim().toLowerCase(), tipo, contenuto.trim(), valutazione ? parseInt(valutazione, 10) : null).catch((err) => {
            console.error('[Email] Errore notifica feedback autore:', err.message);
        });

        res.redirect('/autore?success=1');
    } catch (err) {
        console.error('Error saving author feedback:', err);
        res.status(500).send('Errore interno del server.');
    }
});

module.exports = router;
