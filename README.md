# 🐉 Il Mondo di Lulz

![Logo](public/images/dragon-logo.svg)

**Il Mondo di Lulz** è un'esperienza digitale immersiva dedicata all'astrologia e al mistero, nata dall'universo narrativo del romanzo di **Antonio Fanelli**. L'applicazione combina tecnologia moderna e antica saggezza per offrire consulti personalizzati e un viaggio unico nella consapevolezza di sé.

## 🌟 Funzionalità Principali

- **✨ Tema Natale di Precisione**: Attraverso un algoritmo innovativo, l'app calcola la posizione esatta dei pianeti al momento della tua nascita per generare una mappa celeste dettagliata.
- **🔮 L'Oracolo di Lulz**: Un sistema interattivo che risponde ai tuoi dubbi in tempo reale, basandosi sulle configurazioni astrali del momento.
- **🛡️ Sicurezza e GDPR**: Implementazione di standard di sicurezza elevati (CSRF protection, Rate Limiting) e gestione trasparente della privacy e del consenso cookie.
- **📚 eBook Integrato**: Possibilità di scaricare gratuitamente il romanzo che ha dato origine a tutto in formato ePub.

## 📖 Il Romanzo

Il sito è ispirato alla storia di Lulz, un giovane hacker che costruisce un portale astrologico come esca per una truffa, ma si ritrova coinvolto in una realtà molto più profonda e magica di quanto immaginasse.

### Copertina del Romanzo
![Il Mondo di Lulz - Copertina](public/images/copertina.jpg)

## 🛠️ Stack Tecnologico

- **Backend**: Node.js & Express
- **Frontend**: EJS (Templates), CSS3 (Modern UI), JS Vanilla
- **Database**: SQLite3 con persistenza asincrona
- **Sicurezza**: Helmet, Double CSRF, Express Session, Rate Limiter

## 🚀 Guida all'Installazione

1. **Clona il progetto**:
   ```bash
   git clone [URL-del-repository]
   ```
2. **Installa le dipendenze**:
   ```bash
   npm install
   ```
3. **Configurazione**:
   Copia il file `.env.example` in `.env` e inserisci le chiavi API per i provider AI (OpenAI o Anthropic).
   ```bash
   cp .env.example .env
   ```
4. **Avvia il server**:
   ```bash
   npm start
   ```
   L'applicazione sarà disponibile su `http://localhost:3000`.

---
*Un progetto di Antonio Fanelli - Esplora l'astrologia tra hacking e destino.*
