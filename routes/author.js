const express = require('express');
const { prepare } = require('../db');
const { notifyAuthorFeedback } = require('../utils/email');

const router = express.Router();

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
        bookInfo,
        recensioni,
        error: null,
        success: req.query.success === '1',
        formData: req.session.userId ? { nome: req.session.userName } : {}
    });
});

// GET /autore/altri-libri - Pagina "Algoritmi"
router.get('/altri-libri', (req, res) => {
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
        pdfPreviewUrl: '/downloads/Algoritmi_Estratto.pdf',
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
