const express = require('express');
const { prepare } = require('../db');

const router = express.Router();

// GET /autore - Pagina di dialogo con l'autore
router.get('/', (req, res) => {
    // Prendi le recensioni pubbliche (massimo 10)
    const recensioni = prepare(`
    SELECT nome, contenuto, valutazione, created_at 
    FROM author_feedback 
    WHERE tipo = 'recensione' 
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
        bookInfo,
        recensioni,
        error: null,
        success: req.query.success === '1',
        formData: req.session.userId ? { nome: req.session.userName } : {}
    });
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
      INSERT INTO author_feedback (user_id, nome, email, tipo, contenuto, valutazione)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, nome.trim(), email.trim().toLowerCase(), tipo, contenuto.trim(), valutazione ? parseInt(valutazione, 10) : null);

        res.redirect('/autore?success=1');
    } catch (err) {
        console.error('Error saving author feedback:', err);
        res.status(500).send('Errore interno del server.');
    }
});

module.exports = router;
