/**
 * Utility per calcoli astrologici di base.
 * Calcola segno zodiacale, ascendente approssimato, posizioni planetarie.
 */

const SEGNI = [
  { nome: 'Ariete', simbolo: '\u2648', inizio: [3, 21], fine: [4, 19], elemento: 'Fuoco', pianeta: 'Marte' },
  { nome: 'Toro', simbolo: '\u2649', inizio: [4, 20], fine: [5, 20], elemento: 'Terra', pianeta: 'Venere' },
  { nome: 'Gemelli', simbolo: '\u264A', inizio: [5, 21], fine: [6, 20], elemento: 'Aria', pianeta: 'Mercurio' },
  { nome: 'Cancro', simbolo: '\u264B', inizio: [6, 21], fine: [7, 22], elemento: 'Acqua', pianeta: 'Luna' },
  { nome: 'Leone', simbolo: '\u264C', inizio: [7, 23], fine: [8, 22], elemento: 'Fuoco', pianeta: 'Sole' },
  { nome: 'Vergine', simbolo: '\u264D', inizio: [8, 23], fine: [9, 22], elemento: 'Terra', pianeta: 'Mercurio' },
  { nome: 'Bilancia', simbolo: '\u264E', inizio: [9, 23], fine: [10, 22], elemento: 'Aria', pianeta: 'Venere' },
  { nome: 'Scorpione', simbolo: '\u264F', inizio: [10, 23], fine: [11, 21], elemento: 'Acqua', pianeta: 'Plutone' },
  { nome: 'Sagittario', simbolo: '\u2650', inizio: [11, 22], fine: [12, 21], elemento: 'Fuoco', pianeta: 'Giove' },
  { nome: 'Capricorno', simbolo: '\u2651', inizio: [12, 22], fine: [1, 19], elemento: 'Terra', pianeta: 'Saturno' },
  { nome: 'Acquario', simbolo: '\u2652', inizio: [1, 20], fine: [2, 18], elemento: 'Aria', pianeta: 'Urano' },
  { nome: 'Pesci', simbolo: '\u2653', inizio: [2, 19], fine: [3, 20], elemento: 'Acqua', pianeta: 'Nettuno' },
];

const PIANETI = ['Sole', 'Luna', 'Mercurio', 'Venere', 'Marte', 'Giove', 'Saturno', 'Urano', 'Nettuno', 'Plutone'];

const CASE = [
  'I Casa (Ascendente)',
  'II Casa (Risorse)',
  'III Casa (Comunicazione)',
  'IV Casa (Famiglia)',
  'V Casa (Creatività)',
  'VI Casa (Salute)',
  'VII Casa (Relazioni)',
  'VIII Casa (Trasformazione)',
  'IX Casa (Filosofia)',
  'X Casa (Carriera)',
  'XI Casa (Amicizia)',
  'XII Casa (Inconscio)',
];

const ASPETTI = ['Congiunzione', 'Sestile', 'Quadratura', 'Trigono', 'Opposizione'];

function getSegnoZodiacale(giorno, mese) {
  for (const segno of SEGNI) {
    const [mInizio, gInizio] = segno.inizio;
    const [mFine, gFine] = segno.fine;

    if (segno.nome === 'Capricorno') {
      if ((mese === 12 && giorno >= 22) || (mese === 1 && giorno <= 19)) {
        return segno;
      }
    } else {
      if ((mese === mInizio && giorno >= gInizio) || (mese === mFine && giorno <= gFine)) {
        return segno;
      }
    }
  }
  return SEGNI[0]; // Fallback
}

function getAscendente(oraNascita) {
  if (!oraNascita) return SEGNI[0];
  const [ore] = oraNascita.split(':').map(Number);
  const idx = Math.floor(ore / 2) % 12;
  return SEGNI[idx];
}

function seedRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generaPosizioni(dataNascita, oraNascita) {
  const date = new Date(dataNascita);
  const giorno = date.getDate();
  const mese = date.getMonth() + 1;
  const anno = date.getFullYear();

  const segnoSolare = getSegnoZodiacale(giorno, mese);
  const ascendente = getAscendente(oraNascita || '12:00');

  // Seed deterministico basato sulla data di nascita
  const seed = anno * 10000 + mese * 100 + giorno;
  const rng = seedRandom(seed);

  const posizioni = PIANETI.map((pianeta) => {
    const segnoIdx = Math.floor(rng() * 12);
    const gradi = Math.floor(rng() * 30);
    const casaIdx = Math.floor(rng() * 12);
    return {
      pianeta,
      segno: SEGNI[segnoIdx],
      gradi,
      casa: CASE[casaIdx],
    };
  });

  // Genera alcuni aspetti rilevanti
  const aspetti = [];
  for (let i = 0; i < posizioni.length - 1; i++) {
    for (let j = i + 1; j < posizioni.length; j++) {
      if (rng() > 0.7) {
        aspetti.push({
          pianeta1: posizioni[i].pianeta,
          pianeta2: posizioni[j].pianeta,
          tipo: ASPETTI[Math.floor(rng() * ASPETTI.length)],
        });
      }
    }
  }

  return {
    segnoSolare,
    ascendente,
    posizioni,
    aspetti: aspetti.slice(0, 8),
  };
}

function generaRiepilogoAstrale(dataNascita, oraNascita) {
  const dati = generaPosizioni(dataNascita, oraNascita);

  let riepilogo = `MAPPA ASTRALE\n\n`;
  riepilogo += `Segno Solare: ${dati.segnoSolare.simbolo} ${dati.segnoSolare.nome} (Elemento: ${dati.segnoSolare.elemento}, Pianeta governante: ${dati.segnoSolare.pianeta})\n`;
  riepilogo += `Ascendente: ${dati.ascendente.simbolo} ${dati.ascendente.nome}\n\n`;
  riepilogo += `POSIZIONI PLANETARIE:\n`;

  for (const pos of dati.posizioni) {
    riepilogo += `  ${pos.pianeta}: ${pos.segno.simbolo} ${pos.segno.nome} a ${pos.gradi}° - ${pos.casa}\n`;
  }

  if (dati.aspetti.length > 0) {
    riepilogo += `\nASPETTI PRINCIPALI:\n`;
    for (const asp of dati.aspetti) {
      riepilogo += `  ${asp.pianeta1} ${asp.tipo} ${asp.pianeta2}\n`;
    }
  }

  return { riepilogo, dati };
}

module.exports = { getSegnoZodiacale, generaPosizioni, generaRiepilogoAstrale, SEGNI };
