require('dotenv/config');
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { getDbAsync, getDb, closeDb, saveDb, prepare } = require('./db');
const SQLiteSessionStore = require('./middleware/session-store');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Trust the first reverse proxy hop in production (required for
// express-rate-limit to read X-Forwarded-For without validation errors,
// and for secure session cookies behind load balancers / PaaS platforms).
if (isProd) {
  app.set('trust proxy', 1);
}

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Body parsing
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1d' : 0 }));

// CSRF protection
const { doubleCsrf } = require('csrf-csrf');
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  },
  getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token'],
});

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Troppe richieste, riprova tra qualche minuto.',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Troppi tentativi, riprova tra qualche minuto.',
});

const oracleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'L\'oracolo ha bisogno di riposo. Riprova tra un minuto.',
});

app.use(generalLimiter);

// Initialize database, then start server
async function start() {
  await getDbAsync();

  // Sessions (after DB init)
  app.use(session({
    store: new SQLiteSessionStore({}),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'lulz.sid',
    cookie: {
      secure: isProd,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));

  // Make CSRF token, user and common stats available to all views
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req, res);
    res.locals.user = req.session.userId ? { id: req.session.userId, nome: req.session.userName } : null;
    res.locals.cookieConsent = req.cookies.cookie_consent;

    // Fetch live stats for the banner
    try {
      const userCount = prepare("SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL").get().count;
      const downloadCount = prepare("SELECT COUNT(*) as count FROM page_views WHERE page LIKE 'download:%'").get().count;
      const visitorCount = prepare("SELECT COUNT(DISTINCT ip_address) as count FROM page_views").get().count;
      res.locals.siteStats = { userCount, downloadCount, visitorCount };
    } catch (e) {
      console.error('[Stats] Error fetching live stats:', e.message);
      res.locals.siteStats = { userCount: 0, downloadCount: 0, visitorCount: 0 };
    }
    next();
  });

  // Page-view tracking + notifica admin primo visitatore
  const { notifyNewVisitor } = require('./utils/email');

  app.use((req, res, next) => {
    if (req.method === 'GET'
      && !req.path.startsWith('/admin')
      && !req.path.startsWith('/api/')
      && !req.path.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|epub|woff2?)$/)) {
      try {
        const db = getDb();
        db.run(
          `INSERT INTO page_views (page, ip_address, session_id, user_id, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [req.path, req.ip, req.sessionID || null, req.session?.userId || null]
        );
      } catch { /* non bloccare la request se il tracking fallisce */ }

      // Notifica admin al primo accesso di ogni sessione (un'email per visitatore)
      // Disabilitato su richiesta utente
      /*
      if (!req.session.adminNotified) {
        req.session.adminNotified = true; // persiste nella sessione → niente email duplicate
        notifyNewVisitor(req.path, req.ip).catch((err) => {
          console.error('[Email] Errore notifica visitatore:', err.message);
        });
      }
      */
    }
    next();
  });

  // Routes
  const authRoutes = require('./routes/auth');
  const oracleRoutes = require('./routes/oracle');
  const profileRoutes = require('./routes/profile');
  const gdprRoutes = require('./routes/gdpr');
  const adminRoutes = require('./routes/admin');
  const authorRoutes = require('./routes/author');

  app.use('/auth', authLimiter, doubleCsrfProtection, authRoutes);
  app.use('/oracolo', oracleLimiter, doubleCsrfProtection, oracleRoutes);
  app.use('/profilo', doubleCsrfProtection, profileRoutes);
  app.use('/gdpr', doubleCsrfProtection, gdprRoutes);
  app.use('/admin', doubleCsrfProtection, adminRoutes);
  app.use('/autore', authorRoutes);

  // Tracked ebook download (EPUB)
  app.get('/download/ebook', (req, res) => {
    try {
      const db = getDb();
      db.run(
        `INSERT INTO page_views (page, ip_address, session_id, user_id, created_at)
         VALUES ('download:ebook', ?, ?, ?, datetime('now'))`,
        [req.ip, req.sessionID || null, req.session?.userId || null]
      );
      saveDb();
    } catch { /* ignore */ }
    res.download(path.join(__dirname, 'public', 'downloads', 'IlMondoDiLulz.epub'), 'IlMondoDiLulz.epub');
  });

  // Tracked ebook download (PDF)
  app.get('/download/pdf', (req, res) => {
    try {
      const db = getDb();
      db.run(
        `INSERT INTO page_views (page, ip_address, session_id, user_id, created_at)
         VALUES ('download:pdf', ?, ?, ?, datetime('now'))`,
        [req.ip, req.sessionID || null, req.session?.userId || null]
      );
      saveDb();
    } catch { /* ignore */ }
    res.download(path.join(__dirname, 'public', 'downloads', 'IlMondoDiLulz.pdf'), 'IlMondoDiLulz.pdf');
  });

  // Homepage
  app.get('/', (req, res) => {
    res.render('index');
  });

  // Cookie policy page
  app.get('/cookie-policy', (req, res) => {
    res.render('cookie-policy');
  });

  // Privacy policy page
  app.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy');
  });

  // Cookie consent API
  app.post('/api/cookie-consent', express.json(), (req, res) => {
    const { consent } = req.body;
    if (consent === 'accept' || consent === 'reject') {
      res.cookie('cookie_consent', consent, {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
      });
      try {
        const db = getDb();
        db.run(
          `INSERT INTO cookie_consents (session_id, user_id, consent_type, granted, ip_address, created_at)
           VALUES (?, ?, 'cookie', ?, ?, datetime('now'))`,
          [req.sessionID || 'anonymous', req.session?.userId || null, consent === 'accept' ? 1 : 0, req.ip]
        );
        saveDb();
      } catch { /* ignore logging errors */ }
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'Valore non valido' });
  });

  // 404
  app.use((req, res) => {
    res.status(404).render('error', { title: '404', message: 'Pagina non trovata.' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code === 'EBADCSRFTOKEN') {
      return res.status(403).render('error', { title: 'Errore', message: 'Token di sicurezza non valido. Ricarica la pagina e riprova.' });
    }
    res.status(500).render('error', { title: 'Errore', message: 'Si è verificato un errore interno.' });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`Il Mondo di Lulz è online su http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Prevent unhandled promise rejections (e.g. SMTP failures) from crashing
  // the entire process. Log them and keep the server alive.
  process.on('unhandledRejection', (reason) => {
    console.error('[WARN] Unhandled promise rejection:', reason);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
