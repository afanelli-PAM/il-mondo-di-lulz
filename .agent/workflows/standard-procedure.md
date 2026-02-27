---
description: Procedura standard post-modifica (Versione e Sitemap)
---

Ogni volta che viene completata una modifica richiesta dall'utente, eseguire OBBLIGATORIAMENTE i seguenti passi prima di concludere il task:

### 1. Identificazione Tipo di Modifica
- **Evolutiva**: Nuove funzionalità, miglioramenti UI, cambiamenti strutturali.
- **Fix**: Correzione di bug, errori di battitura, piccoli aggiustamenti tecnici.
- **Major**: Cambiamento radicale dell'architettura o richiesta esplicita dell'utente.

### 2. Aggiornamento Versione
Seguire lo schema `X.Y.Z`:
- **Modifica Evolutiva**: Incrementare `Y` (es: `1.1` -> `1.2`). Azzerare `Z` se presente.
- **Fix**: Incrementare `Z` (es: `1.1` -> `1.1.1` o `1.1.1` -> `1.1.2`).
- **Major**: Incrementare `X`, azzerare `Y` e `Z` (es: `1.99.254` -> `2.0.0`).

**File da aggiornare:**
- [footer.ejs](file:///C:/Users/afane/Documents/CoWork/il-mondo-di-lulz/views/partials/footer.ejs) (etichetta visibile)
- [email.js](file:///C:/Users/afane/Documents/CoWork/il-mondo-di-lulz/utils/email.js) (footer delle email)

### 3. Aggiornamento Sitemap
- Aggiornare il file [sitemap.xml](file:///C:/Users/afane/Documents/CoWork/il-mondo-di-lulz/public/sitemap.xml).
- Inserire eventuali nuove rotte create.
- Aggiornare la data `<lastmod>` per tutte le URL toccate dalla modifica con la data attuale.

### 4. Push su GitHub
// turbo
- Eseguire il commit con un messaggio descrittivo.
- Eseguire la push sul ramo `master`.

### 5. Notifica finale
- Comunicare all'utente il completamento, specificando la nuova versione e confermando l'avvenuta push.
