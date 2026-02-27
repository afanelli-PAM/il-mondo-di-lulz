/**
 * Modulo AI con supporto per Anthropic (Claude) e OpenAI.
 * Il provider viene scelto tramite la variabile d'ambiente AI_PROVIDER.
 */

const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

// --- Client singletons ---
let anthropicClient;
let openaiClient;

function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = require('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// --- Prompt builders (condivisi tra i due provider) ---

function buildTemaNatalePrompt(user, riepilogoAstrale) {
  return `Sei un esperto astrologo italiano del sito "Il Mondo di Lulz".
Agisci come un professionista accreditato: non inventare nulla, ma attieniti rigorosamente alle regole reali dell'astrologia occidentale per l'interpretazione del tema natale.

DATI DELLA PERSONA:
- Nome: ${user.nome} ${user.cognome}
- Data di nascita: ${user.data_nascita}
- Ora di nascita: ${user.ora_nascita || 'non specificata'}
- Luogo di nascita: ${user.luogo_nascita}

MAPPA ASTRALE:
${riepilogoAstrale}

PROFILO PERSONALE (dall'intervista):
- Come gli altri la vedono: ${user.come_ti_vedono || 'Non specificato'}
- Come si descrive realmente: ${user.come_sei || 'Non specificato'}
- Attività e aspirazioni: ${user.attivita_aspirazioni || 'Non specificato'}
- Tre cose che ama: ${user.tre_cose_piacciono || 'Non specificato'}
- Tre cose che odia: ${user.tre_cose_odi || 'Non specificato'}
- Cos'è la felicità: ${user.felicita || 'Non specificato'}

ISTRUZIONI:
1. Scrivi in italiano, con tono mistico ma accessibile
2. Fai riferimento alle posizioni planetarie specifiche
3. Collega le caratteristiche astrologiche al profilo personale della persona
4. Dividi l'interpretazione in sezioni: Personalità, Amore, Carriera, Sfide, Potenzialità
5. Sii dettagliato e specifico, facendo sentire la persona compresa
6. Non superare le 800 parole
7. Non menzionare mai che sei un'intelligenza artificiale`;
}

function buildOracoloSystemPrompt(user, storicoMessaggi) {
  const messaggiPrecedenti = storicoMessaggi
    .slice(-6)
    .map(m => `Domanda: ${m.domanda}\nRisposta: ${m.risposta}`)
    .join('\n\n');

  return `Sei l'Oracolo del sito "Il Mondo di Lulz", un'entità misteriosa e saggia che fornisce consulti astrologici personalizzati.

PERSONALITÀ DELL'ORACOLO:
- Sei un esperto astrologo: le tue risposte devono basarsi su regole tecniche reali (transiti, aspetti, segni) e non su invenzioni creative.
- Parli in italiano con tono mistico, enigmatico ma comprensivo.
- Sei diretto nelle risposte ma avvolgi tutto in un'aura di mistero.
- Mostri di conoscere profondamente la persona (usando i dati del suo profilo).
- Non riveli MAI di essere un'intelligenza artificiale.
- Non dai mai risposte troppo lunghe (max 200 parole).
- Puoi essere ironico o provocatorio quando serve.
- Se la domanda riguarda il tradimento o questioni delicate, sii cauto ma non evasivo.

PROFILO DELL'UTENTE:
- Nome: ${user.nome}
- Segno zodiacale: ${user.segno_zodiacale || 'Non calcolato'}
- Come si vede: ${user.come_sei || 'Non specificato'}
- Cosa ama: ${user.tre_cose_piacciono || 'Non specificato'}
- Cosa odia: ${user.tre_cose_odi || 'Non specificato'}
- Aspirazioni: ${user.attivita_aspirazioni || 'Non specificato'}

${messaggiPrecedenti ? `CONVERSAZIONE PRECEDENTE:\n${messaggiPrecedenti}` : ''}`;
}

// ===================================================
// ANTHROPIC (Claude) implementation
// ===================================================

async function generaTemaNatale_anthropic(user, riepilogoAstrale) {
  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const message = await client.messages.create({
    model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: buildTemaNatalePrompt(user, riepilogoAstrale) }],
  });

  return message.content[0].text;
}

async function* chiediOracolo_anthropic(user, domanda, storicoMessaggi) {
  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const stream = client.messages.stream({
    model,
    max_tokens: 400,
    system: buildOracoloSystemPrompt(user, storicoMessaggi),
    messages: [{ role: 'user', content: domanda }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

// ===================================================
// OPENAI implementation
// ===================================================

async function generaTemaNatale_openai(user, riepilogoAstrale) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: 'Sei un esperto astrologo italiano. Rispondi sempre in italiano.' },
      { role: 'user', content: buildTemaNatalePrompt(user, riepilogoAstrale) },
    ],
  });

  return response.choices[0].message.content;
}

async function* chiediOracolo_openai(user, domanda, storicoMessaggi) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const stream = await client.chat.completions.create({
    model,
    max_tokens: 400,
    stream: true,
    messages: [
      { role: 'system', content: buildOracoloSystemPrompt(user, storicoMessaggi) },
      { role: 'user', content: domanda },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

// ===================================================
// Exported functions - dispatch to active provider
// ===================================================

async function generaTemaNatale(user, riepilogoAstrale) {
  if (provider === 'anthropic') {
    return generaTemaNatale_anthropic(user, riepilogoAstrale);
  }
  return generaTemaNatale_openai(user, riepilogoAstrale);
}

async function* chiediOracolo(user, domanda, storicoMessaggi) {
  if (provider === 'anthropic') {
    yield* chiediOracolo_anthropic(user, domanda, storicoMessaggi);
  } else {
    yield* chiediOracolo_openai(user, domanda, storicoMessaggi);
  }
}

console.log(`[AI] Provider attivo: ${provider}`);

module.exports = { generaTemaNatale, chiediOracolo };
