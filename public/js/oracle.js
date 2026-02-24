/* ============================================
   IL MONDO DI LULZ - Oracle Chat (SSE Streaming)
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('oracle-form');
  var input = document.getElementById('oracle-input');
  var chat = document.getElementById('oracle-chat');
  var submitBtn = document.getElementById('oracle-submit');
  var charCount = document.getElementById('char-count');

  if (!form || !input || !chat) return;

  // Character counter
  input.addEventListener('input', function () {
    charCount.textContent = input.value.length;
  });

  // Auto-scroll chat to bottom
  function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
  }
  scrollToBottom();

  // Submit handler
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var domanda = input.value.trim();
    if (!domanda) return;

    var csrf = form.querySelector('[name=_csrf]').value;

    // Disable input
    input.disabled = true;
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    // Add user message to chat
    var userMsg = document.createElement('div');
    userMsg.className = 'chat-message user-message';
    userMsg.innerHTML =
      '<div class="chat-bubble">' + escapeHtml(domanda) + '</div>' +
      '<small>' + new Date().toLocaleString('it-IT') + '</small>';
    chat.appendChild(userMsg);
    scrollToBottom();

    // Clear input
    input.value = '';
    charCount.textContent = '0';

    // Add oracle response placeholder
    var oracleMsg = document.createElement('div');
    oracleMsg.className = 'chat-message oracle-message';
    oracleMsg.innerHTML =
      '<div class="chat-avatar">&#x1F52E;</div>' +
      '<div class="chat-bubble oracle-typing">L\'oracolo sta consultando le stelle...</div>';
    chat.appendChild(oracleMsg);
    scrollToBottom();

    var bubble = oracleMsg.querySelector('.chat-bubble');

    // SSE streaming request
    fetch('/oracolo/chiedi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({ domanda: domanda }),
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Errore ' + response.status);
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var started = false;

        function read() {
          reader.read().then(function (result) {
            if (result.done) {
              enableInput();
              return;
            }

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              if (line.startsWith('data: ')) {
                try {
                  var data = JSON.parse(line.slice(6));
                  if (data.text) {
                    if (!started) {
                      bubble.textContent = '';
                      bubble.classList.remove('oracle-typing');
                      started = true;
                    }
                    bubble.textContent += data.text;
                    scrollToBottom();
                  }
                  if (data.done) {
                    enableInput();
                    return;
                  }
                  if (data.error) {
                    bubble.textContent = data.error;
                    bubble.classList.remove('oracle-typing');
                    enableInput();
                    return;
                  }
                } catch (e) {
                  // ignore parse errors
                }
              }
            }

            read();
          }).catch(function () {
            bubble.textContent = 'Errore di connessione. Riprova.';
            bubble.classList.remove('oracle-typing');
            enableInput();
          });
        }

        read();
      })
      .catch(function (err) {
        bubble.textContent = 'L\'oracolo è momentaneamente irraggiungibile. Riprova più tardi.';
        bubble.classList.remove('oracle-typing');
        enableInput();
      });
  });

  function enableInput() {
    input.disabled = false;
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loading').style.display = 'none';
    input.focus();
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Submit on Enter (Shift+Enter for newline)
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event('submit'));
    }
  });
});
