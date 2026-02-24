/* ============================================
   IL MONDO DI LULZ - Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  // --- Cookie Banner ---
  initCookieBanner();
});

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
