/* ============================================
   IL MONDO DI LULZ - Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  // --- Mobile Menu ---
  initMobileMenu();

  // --- Cookie Banner ---
  initCookieBanner();
});

function initMobileMenu() {
  var btn = document.getElementById('mobile-menu-toggle');
  var nav = document.querySelector('.nav-links');
  if (!btn || !nav) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var isOpen = nav.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Chiudi il menu quando si clicca su un link
  nav.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    });
  });

  // Chiudi il menu quando si clicca fuori
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target) && !btn.contains(e.target)) {
      nav.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function initCookieBanner() {
  var acceptBtn = document.getElementById('cookie-accept');
  var rejectBtn = document.getElementById('cookie-reject');
  var banner = document.getElementById('cookie-banner');

  if (!banner) return;

  function handleConsent(consent) {
    fetch('/api/cookie-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: consent }),
    })
      .then(function () {
        banner.style.transition = 'transform 0.3s ease';
        banner.style.transform = 'translateY(100%)';
        setTimeout(function () {
          banner.remove();
        }, 300);
      })
      .catch(function () {
        banner.remove();
      });
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', function () {
      handleConsent('accept');
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', function () {
      handleConsent('reject');
    });
  }
}
