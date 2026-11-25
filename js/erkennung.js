// Offline-Erkennung: zieht Fakten aus hineinkopiertem Text (Profilseite, Chat, Notizen) – Englisch und Deutsch.
// Läuft komplett im Browser, nichts wird verschickt. Ergebnis hat dasselbe Format wie der Claude-Block.
import { state, feldDef } from './store.js';
import { parseWert, digits, gleich } from './util.js';

// Beschriftungen auf Profilseiten → Feld-Schlüssel
const BESCHRIFTUNGEN = {
  nickname: ['name', 'nickname', 'nick', 'username', 'user name', 'display name', 'spitzname', 'benutzername', 'rufname'],
  alter: ['age', 'alter', 'my age', 'how old are you'],
  groesse: ['height', 'größe', 'groesse', 'körpergröße', 'koerpergroesse', 'body height', 'how tall', 'how tall are you', 'my height'],
  gewicht: ['weight', 'gewicht', 'body weight', 'körpergewicht', 'my weight', 'how much do you weigh'],
  job: ['job', 'occupation', 'profession', 'work', 'job title', 'career', 'beruf', 'tätigkeit', 'taetigkeit', 'arbeit', 'what do you do', 'my job', 'employment'],
  wohnort: ['location', 'lives in', 'living in', 'city', 'residence', 'current city', 'hometown', 'wohnort', 'ort', 'stadt', 'wohnt in', 'province', 'region', 'where do you live', 'i live in', 'living'],
  kinder: ['children', 'kids', 'child', 'have children', 'has children', 'have kids', 'has kids', 'kinder', 'kids at home',
    'do you have children', 'do you have kids', 'do you have any children', 'do you have any kids', 'children at home', 'number of children', 'hast du kinder'],
  single: ['relationship status', 'relationship', 'marital status', 'status', 'beziehungsstatus', 'familienstand', 'are you single', 'bist du single'],
  single_seit: ['single since', 'single for', 'single seit', 'how long have you been single', 'how long single'],
  handy: ['phone', 'mobile', 'tel', 'telephone', 'phone number', 'mobile number', 'whatsapp', 'whatsapp number', 'handy', 'telefon', 'handynummer', 'mobil'],
  line_id: ['line', 'line id', 'lineid', 'line-id'],
};

const ZAHLWOERTER = { no: 0, none: 0, keine: 0, kein: 0, one: 1, a: 1, an: 1, ein: 1, eine: 1, einen: 1, eins: 1, two: 2, zwei: 2, three: 3, drei: 3, four: 4, vier: 4, five: 5, fünf: 5, half: 0.5 };

// Kleinbuchstaben, Sonderzeichen weg, „?“/„:“ am Ende weg („Have children?“ → „have children“)
const norm = s => String(s).toLowerCase().replace(/[*_#•·]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/[\s:：=?？]+$/, '').trim();

/**
 * Stimmt ein gefundener Wert mit deinen eigenen Angaben („Meine eigenen Angaben“) überein?
 *  'sicher'   – Text/Ort stimmt überein (z. B. dein Job) → stammt von dir
 *  'moeglich' – Zahl genau gleich (Alter, Größe, Gewicht) → könnte von dir sein
 *  null       – keine Übereinstimmung (Kinder/Ja-Nein werden nicht verglichen, das wäre zu oft zufällig gleich)
 */
export function eigeneAngabeArt(key, wert) {
  const eigen = state.meineFakten?.[key];
  if (eigen === undefined || eigen === null || eigen === '' || wert === null || wert === undefined || wert === '') return null;
  const typ = feldDef(key)?.typ || 'text';
  if (typ === 'text' || typ === 'ort') {
    const a = norm(eigen), b = norm(wert);
    return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b)) ? 'sicher' : null;
  }
  if (typ === 'zahl' && key !== 'kinder') return gleich('zahl', eigen, wert) ? 'moeglich' : null;
  return null;
}

/** Dein Feld „Profil gelesen & verstanden“: das erste Ja/Nein-Feld mit „Profil“ im Namen. */
export function profilFeld() {
  return state.felder.find(f => f.typ === 'janein' && /profil|profile/i.test(`${f.key} ${f.label}`)) || null;
}

/** Wo steht bei dieser Plattform die Antwort? ThaiFriendly: über der Frage, Tinder: darunter. */
export function richtungFuer(plattform) {
  const p = String(plattform || '').toLowerCase().replace(/[\s\-_.]+/g, '');
  if (p.includes('thaifriendly')) return 'oben';
  if (p.includes('tinder')) return 'unten';
  return null;
}

/** Soll diese Angabe/Beschriftung laut „Immer ignorieren“-Liste übersprungen werden? */
export function istIgnoriert(text) {
  const liste = (state.ignorieren || []).map(norm);
  if (!liste.length) return false;
  const t = norm(text);
  if (liste.includes(t)) return true;
  const m = String(text).match(/^([^:：]{1,40}?)\s*[:：]/);   // „Beschriftung: Wert“ → Beschriftung prüfen
  return !!m && liste.includes(norm(m[1]));
}

function labelZuKey(label) {
  const l = norm(label);
  if (!l || !/\p{L}/u.test(l)) return null;
  // eigene Felder (Anzeigename, Schlüssel, Erkennungswörter) zuerst
  for (const f of state.felder) {
    const woerter = [f.key, f.label, ...String(f.woerter || '').split(',')].map(norm).filter(Boolean);
    if (woerter.includes(l)) return f.key;
  }
  for (const [key, liste] of Object.entries(BESCHRIFTUNGEN)) if (liste.includes(l)) return key;
  return null;
}

const kurz = s => { const t = String(s).trim(); return t.length > 80 ? t.slice(0, 77) + '…' : t; };

// ---------- Werte deuten ----------

function groesse(v, nurMitEinheit) {
  let m = v.match(/\b(1\d{2}|2[01]\d)\s*cm\b/i);
  if (m) return +m[1];
  m = v.match(/\b([12])[.,](\d{1,2})\s*(?:m|meter|metre)\b/i);
  if (m) return Math.round(+`${m[1]}.${m[2].padEnd(2, '0')}` * 100);
  m = v.match(/\b([4-7])\s*(?:'|’|′|´|`|ft\.?|feet|foot)\s*(\d{1,2})?\s*(?:"|”|″|''|’’|′′|in\.?|inch|inches)?/i);
  if (m) return Math.round(+m[1] * 30.48 + (+m[2] || 0) * 2.54);
  if (!nurMitEinheit) {
    m = v.match(/\b(1\d{2}|2[01]\d)\b/);
    if (m) return +m[1];
    m = v.match(/\b([12])[.,](\d{2})\b/);
    if (m) return +m[1] * 100 + +m[2];
  }
  return null;
}

function gewicht(v, nurMitEinheit) {
  let m = v.match(/\b(\d{2,3}(?:[.,]\d)?)\s*(?:kg|kilo|kilos|kilogramm?)\b/i);
  if (m) return Math.round(+m[1].replace(',', '.'));
  m = v.match(/\b(\d{2,3})\s*(?:lbs?|pounds?)\b/i);
  if (m) return Math.round(+m[1] * 0.4536);
  if (!nurMitEinheit) {
    m = v.match(/\b(\d{2,3})\b/);
    if (m && +m[1] >= 30 && +m[1] <= 200) return +m[1];
  }
  return null;
}

function kinder(v) {
  const t = v.toLowerCase().trim();
  if (/^(no|none|nope|0|keine?|nein|no kids|no children|zero)\b/.test(t) || /\b(don'?t|do not|haven'?t|keine)\b.*\b(kids?|children|kinder)\b/.test(t)) return 0;
  const m = t.match(/\b(\d|one|two|three|four|five|ein|eine|eins|zwei|drei|vier|fünf)\b/);
  if (m) return /\d/.test(m[1]) ? +m[1] : ZAHLWOERTER[m[1]];
  return null;   // z. B. „yes“ – Anzahl unbekannt
}

function single(v) {
  const t = v.toLowerCase();
  if (/\b(never married|not married|nie verheiratet|nicht verheiratet|not in a relationship)\b/.test(t)) return true;
  if (/\b(married|verheiratet|in a relationship|relationship with|beziehung|taken|vergeben|engaged|verlobt|partner)\b/.test(t)) return false;
  if (/\b(single|ledig|solo|divorced|geschieden|separated|getrennt|widow|widowed|verwitwet|available)\b/.test(t)) return true;
  return null;
}

function seit(v) {
  const t = v.trim();
  let m = t.match(/\b(\d+|one|two|three|four|five|a|an|half a|ein|eine|einem|einen|zwei|drei|vier|fünf)\s*(years?|yrs?|months?|weeks?|jahre?n?|monate?n?|wochen?)\b/i);
  if (m) {
    const zahl = /\d/.test(m[1]) ? m[1] : m[1].toLowerCase() === 'half a' ? '½' : String(ZAHLWOERTER[m[1].toLowerCase().replace(/em$/, '')] ?? 1);
    const e = m[2].toLowerCase();
    const einheit = /^(y|j)/.test(e) ? (zahl === '1' ? 'Jahr' : 'Jahre') : /^(m)/.test(e) ? (zahl === '1' ? 'Monat' : 'Monate') : (zahl === '1' ? 'Woche' : 'Wochen');
    return `${zahl} ${einheit}`;
  }
  m = t.match(/\b(?:since|seit)?\s*((?:19|20)\d{2})\b/i);
  if (m) return `seit ${m[1]}`;
  return t.slice(0, 40) || null;
}

function telefon(v) {
  const m = v.match(/(?:\+|00)\d[\d\s\-().\/]{7,18}\d|\b0\d[\d\s\-\/]{7,13}\d\b/);
  if (!m) return null;
  const n = digits(m[0]).length;
  return n >= 9 && n <= 15 ? m[0] : null;
}

function textKuerzen(v) {
  return v.replace(/\s+(?:with|and|since|for|but|now|at the moment|mit|und|seit|aber|zurzeit)\b.*$/i, '').replace(/[\s,;:–-]+$/, '').trim().slice(0, 60);
}

function deuten(key, v, mitLabel) {
  switch (key) {
    case 'nickname': return v.trim().slice(0, 40) || null;
    case 'alter': {
      const m = v.match(/\b(\d{2})\b/);
      const n = m ? +m[1] : null;
      return n >= 18 && n <= 99 ? n : null;
    }
    case 'groesse': return groesse(v, !mitLabel);
    case 'gewicht': return gewicht(v, !mitLabel);
    case 'kinder': return kinder(v);
    case 'single': return single(v);
    case 'single_seit': return seit(v);
    case 'handy': return telefon(v);
    case 'line_id': {
      const m = v.match(/@?([A-Za-z0-9._-]{3,30})/);
      return m ? m[1] : null;
    }
    default: {
      const f = feldDef(key);
      const w = f ? parseWert(f.typ, v) : v.trim();
      return typeof w === 'string' ? w.slice(0, 60) : w;
    }
  }
}

// ---------- Hauptfunktion ----------

/** Liefert eine Person im Format { nickname, fakten:{key:{wert,beleg}}, kontakt:{whatsapp}, sonstiges:[] }. */
export function erkenne(text, optionen = {}) {
  const fakten = {};
  const sonstiges = [];
  let nickname = '';
  let whatsapp = false;

  let eigeneWerte = 0;
  // Liefert true (gesetzt/schon vorhanden), false (kein Wert) oder 'eigen' (ist deine eigene Angabe → ausgelassen)
  const setze = (key, wert, beleg) => {
    if (wert === null || wert === undefined || wert === '') return false;
    if (key === 'nickname') { nickname ||= String(wert); return true; }
    if (eigeneAngabeArt(key, wert) === 'sicher') { eigeneWerte++; return 'eigen'; }
    if (!fakten[key]) fakten[key] = { wert, beleg: kurz(beleg) };
    return true;
  };

  const alleZeilen = String(text).split(/\r?\n|\s[|•·]\s/).map(z => z.trim()).filter(Boolean);
  let zeilen, entfernt;
  const chat = chatErkennen(alleZeilen, optionen);
  if (chat) {
    // Chat mit Kopfzeilen (z. B. ThaiFriendly): deine Fragen → ihre Antworten zuerst
    for (const qa of chat.antworten) setze(qa.key, qa.wert, qa.beleg);
    for (const s of chat.unbekannt) if (!istIgnoriert(s)) sonstiges.push(s);
    zeilen = chat.ihreZeilen;          // nur ihre Nachrichten weiter auswerten
    entfernt = chat.meineZeilen;
    if (chat.ihrName) nickname = chat.ihrName;
  } else {
    // Deine eigenen Nachrichten (unter „Meine Namen“ eingetragen) nicht auswerten
    ({ zeilen, entfernt } = eigeneZeilenEntfernen(alleZeilen));
  }
  text = zeilen.join('\n');

  // 1) „Beschriftung: Wert“ (oder Beschriftung in einer Zeile, Wert in der nächsten)
  // Steht die Antwort über (ThaiFriendly) oder unter (Tinder) der Frage? Plattform bekannt → festgelegt, sonst ausprobieren.
  // Antwort darf selbst wie ein Feldname aussehen, wenn sie zu derselben Frage passt (Antwort „Single“ auf „Relationship status“)
  const passt = (key, s) => {
    if (!s || s.length > 80 || /[:：]/.test(s) || /[?？]\s*$/.test(s)) return false;
    const k = labelZuKey(s);
    if (k && k !== key) return false;
    return deuten(key, s, true) != null;
  };
  let richtung = optionen.richtung;
  if (richtung !== 'oben' && richtung !== 'unten') {
    let oben = 0, unten = 0;
    zeilen.forEach((z, i) => {
      const key = z.length <= 45 && labelZuKey(z);
      if (!key || key === 'nickname') return;
      const o = passt(key, zeilen[i - 1]), u = passt(key, zeilen[i + 1]);
      if (o && !u) oben++;
      if (u && !o) unten++;
    });
    richtung = oben > unten ? 'oben' : 'unten';
  }

  const paare = [];
  const verbraucht = new Set();
  for (let i = 0; i < zeilen.length; i++) {
    if (verbraucht.has(i)) continue;
    const z = zeilen[i];
    const m = z.match(/^([^:：=\t]{1,30}?)\s*[:：=\t]\s*(.{1,150})$/);
    if (m && /\p{L}/u.test(m[1]) && !/^(https?|www)$/i.test(m[1].trim())) {
      paare.push({ label: m[1].trim(), wert: m[2].trim(), zeile: z });
      continue;
    }
    const key = z.length <= 45 && labelZuKey(z);
    const vorI = i - 1, nachI = i + 1;
    if (!key) {
      // Unbekannte Frage („Do you smoke?“): mit ihrer Antwort anzeigen, damit du entscheiden kannst
      if (/[?？]\s*$/.test(z) && z.length <= 60) {
        const kurzOk = j => j >= 0 && j < zeilen.length && !verbraucht.has(j) && zeilen[j].length <= 40
          && !/[:：]/.test(zeilen[j]) && !/[?？]\s*$/.test(zeilen[j]) && !labelZuKey(zeilen[j]);
        const j = richtung === 'oben' ? (kurzOk(vorI) ? vorI : -1) : (kurzOk(nachI) ? nachI : -1);
        if (j >= 0) {
          verbraucht.add(j);
          paare.push({ label: z.replace(/[\s?？]+$/, '').trim(), wert: zeilen[j], zeile: `${z} ${zeilen[j]}` });
        }
      }
      continue;
    }
    const vorOk = vorI >= 0 && !verbraucht.has(vorI) && passt(key, zeilen[vorI]);
    const nachOk = nachI < zeilen.length && passt(key, zeilen[nachI]);
    const wahl = richtung === 'oben' ? (vorOk ? vorI : nachOk ? nachI : -1) : (nachOk ? nachI : vorOk ? vorI : -1);
    if (wahl < 0) continue;
    verbraucht.add(wahl);
    const label = z.replace(/[\s:：?？]+$/, '').trim();
    paare.push({ label, wert: zeilen[wahl], zeile: wahl < i ? `${zeilen[wahl]} (${z})` : `${z} ${zeilen[wahl]}` });
  }
  // Beschriftungen, die mehrfach vorkommen, sind meist Chat-Namen („Mai: hi“) – nicht als Angabe werten
  const anzahl = {};
  for (const p of paare) anzahl[norm(p.label)] = (anzahl[norm(p.label)] || 0) + 1;
  for (const p of paare) {
    if (istIgnoriert(p.label)) continue;
    const key = labelZuKey(p.label);
    if (/whats\s?app/i.test(p.label)) whatsapp = true;
    if (key) {
      if (!setze(key, deuten(key, p.wert, true), p.zeile) && key !== 'nickname' && !fakten[key]) sonstiges.push(`${p.label}: ${p.wert}`);
    } else if (anzahl[norm(p.label)] === 1 && p.wert.length <= 100 && sonstiges.length < 25) {
      sonstiges.push(`${p.label}: ${p.wert}`);
    }
  }

  // 2) Fließtext (Chats, Beschreibungen)
  // Sätze, in denen deine eigenen Angaben stehen (z. B. dein Job), handeln von dir → nicht auswerten
  const eigeneTexte = Object.entries(state.meineFakten || {})
    .filter(([k, v]) => ['text', 'ort'].includes(feldDef(k)?.typ || 'text') && v && norm(v).length >= 4)
    .map(([, v]) => norm(v));
  const alleSaetze = zeilen.flatMap(z => z.split(/(?<=[.!?])\s+/)).filter(Boolean);
  // Fragesätze („Do you have a girlfriend?“) sagen nichts über sie aus → nicht auswerten
  const saetze = alleSaetze.filter(s => !eigeneTexte.some(t => norm(s).includes(t)) && !/[?？]\s*$/.test(s));
  const eigeneSaetze = alleSaetze.length - saetze.length;
  const suche = re => { for (const s of saetze) { const m = s.match(re); if (m) return { m, s }; } return null; };
  let r;

  if (!fakten.alter) {
    const muster = [
      /\b(?:i'?m|i am|ich bin|aged?)\s*:?\s*(\d{2})\b(?!\s*(?:cm|kg|kilo|lbs?|%|\$|€|k\b|baht|thb|euro|usd|minutes?|min\b|km|m\b|years? ago|(?:years?|y)[\s-]*old\s+(?:son|daughter|kid|child|boy|girl)))/i,
      /\b(\d{2})\s*(?:years?\s*old|yrs?\s*old|y\.?\s?o\.?\b|jahre\s*alt)(?!\s+(?:son|daughter|kid|child|boy|girl|sohn|tochter))/i,
    ];
    aussen: for (const re of muster) {
      for (const s of saetze) {
        const m = s.match(re);
        if (m && +m[1] >= 18 && +m[1] <= 99 && setze('alter', +m[1], s) === true) break aussen;
      }
    }
  }
  if (!fakten.groesse) {
    for (const s of saetze) {
      if (!/(\d\s*cm\b|\d\s*m\b|tall|height|groß|gross|\d\s*(?:ft|feet|'|’|′))/i.test(s)) continue;
      const g = groesse(s, true);
      if (g && g >= 120 && g <= 220 && setze('groesse', g, s) === true) break;
    }
  }
  if (!fakten.gewicht) {
    for (const s of saetze) {
      if (!/(kg|kilo|lbs?|pounds?|weigh|wiege|gewicht)/i.test(s)) continue;
      const g = gewicht(s, true);
      if (g && g >= 30 && g <= 200 && setze('gewicht', g, s) === true) break;
    }
  }
  if (!fakten.kinder) {
    r = suche(/\b(?:don'?t|do not|haven'?t|have no|has no)\s+(?:have\s+)?(?:any\s+)?(?:kids|children)\b|\bno (?:kids|children)\b|\bkeine kinder\b|\bkinderlos\b/i);
    if (r) setze('kinder', 0, r.s);
    else {
      r = suche(/\b(\d|one|two|three|four|five|ein|eine|einen|zwei|drei|vier)\s+(?:kids?|children|child|kinder|kind)\b/i);
      if (r) setze('kinder', kinder(r.m[1]), r.s);
      else {
        r = suche(/\b(?:i have|i got|ich habe)\s+(?:a|one|einen|eine|ein)\s+(?:son|daughter|child|kid|baby|sohn|tochter|kind)\b/i);
        if (r) setze('kinder', 1, r.s);
      }
    }
  }
  if (!fakten.single) {
    r = suche(/\b(?:i'?m|i am|ich bin)\s+(?:still\s+|currently\s+|now\s+|jetzt\s+|noch\s+|seit\s+\S+\s+)?(single|divorced|separated|widowed|married|taken|engaged|geschieden|ledig|getrennt|verwitwet|verheiratet|vergeben|verlobt)\b/i)
      || suche(/\b(never married|not married|nie verheiratet|nicht verheiratet|have a boyfriend|have a girlfriend|habe einen freund|habe eine freundin)\b/i);
    if (r) {
      const w = /boyfriend|girlfriend|einen freund|eine freundin/i.test(r.m[1]) ? false : single(r.m[1]);
      setze('single', w, r.s);
    }
  }
  if (!fakten.single_seit) {
    r = suche(/\bsingle\s+(?:for|since|seit)\s+([^.,!?\n]{1,30})/i)
      || suche(/\b(?:divorced|separated|geschieden|getrennt)\s+(?:for|since|seit)\s+([^.,!?\n]{1,30})/i)
      || suche(/\bseit\s+([^.,!?\n]{1,25}?)\s+(?:single|geschieden|getrennt)\b/i)
      || suche(/\b(?:broke up|split up|got divorced|habe mich getrennt|trennung)\b[^.!?\n]{0,15}?\b((?:\d+|one|two|three|a|an|half a)\s+(?:years?|months?|weeks?)\s+ago)/i);
    if (r) {
      setze('single_seit', seit(r.m[1].replace(/\s+ago$/i, '')), r.s);
      if (!fakten.single) setze('single', true, r.s);
    }
  }
  if (!fakten.job) {
    r = suche(/\b(?:i work as|i'?m working as|i am working as|working as|work as|my job is|my work is|i work in|ich arbeite als|ich bin von beruf|beruflich bin ich)\s+(?:an?\s+|eine?\s+|the\s+)?([^.,!?\n]{2,40})/i);
    if (r) setze('job', r.m[1].replace(/\s+(?:in|at|for|bei|im|in der|and|und)\b.*$/i, '').trim(), r.s);
  }
  if (!fakten.wohnort) {
    r = suche(/\b(?:i live in|lives in|i'?m living in|i am living in|living in|i stay in|i'?m staying in|i am staying in|ich wohne in|wohne in|ich lebe in|lebe in)\s+([^.!?\n]{2,40})/i)
      || suche(/\b(?:i'?m from|i am from|ich komme aus|komme aus)\s+([^.!?\n]{2,40})/i);
    if (r) setze('wohnort', textKuerzen(r.m[1]), r.s);
  }
  // Dein Ja/Nein-Feld „Profil gelesen & verstanden“ (jedes Ja/Nein-Feld mit „Profil“ im Namen)
  const pf = profilFeld();
  if (pf && fakten[pf.key] === undefined) {
    r = suche(/\b(?:didn'?t read|did not read|haven'?t read|have not read|never read|don'?t understand (?:your|ur) profile|didn'?t understand (?:your|ur) profile|what(?:'s| is) (?:in|on) your profile|where is your profile|noch nicht gelesen|nicht gelesen|nicht verstanden)\b|\bnot yet\b.*\b(?:read|profile)\b|\b(?:read|profile)\b.*\bnot yet\b/i);
    if (r) setze(pf.key, false, r.s);
    else {
      r = suche(/\b(?:i\s+(?:already\s+|have\s+|did\s+)?read\s+(?:your|ur)\s+profile|read\s+(?:your|ur)\s+profile\s+(?:already|before|ka|kha|na)|i\s+read\s+(?:it\s+)?already|i\s+(?:already\s+)?understand\s+(?:your|ur)\s+profile|yes,?\s+i\s+(?:read|understand)|i\s+know\s+what\s+you\s+(?:are\s+)?look(?:ing)?\s+for|understand\s+what\s+you\s+(?:are\s+)?look(?:ing)?\s+for|ich\s+habe\s+dein\s+profil\s+gelesen|profil\s+gelesen|profil\s+verstanden)\b/i);
      if (r) setze(pf.key, true, r.s);
    }
  }
  if (!fakten.handy) {
    for (const z of zeilen) {
      const t = telefon(z);
      if (t) { setze('handy', t, z); if (/whats\s?app|\bwa\b/i.test(z)) whatsapp = true; break; }
    }
  }
  if (!fakten.line_id) {
    r = suche(/\bline\s*-?id\s*[:=]?\s*@?([A-Za-z0-9._-]{3,30})/i) || suche(/\bLINE\s*[:=]\s*@?([A-Za-z0-9._-]{3,30})/);
    if (r) setze('line_id', r.m[1], r.s);
  }
  if (!whatsapp && fakten.handy && /whats\s?app/i.test(text)) whatsapp = true;

  // Nickname: Profilseiten beginnen meist mit dem Namen in der ersten Zeile
  if (!nickname) {
    const kompakt = s => String(s).toLowerCase().replace(/[\s\-_.]+/g, '');
    const istKopfzeile = z => /^(hi|hello|hey|hallo|online|offline|profile|profil|home|menu|about|über|active|aktiv|verified)\b/i.test(z)
      || /\b(profile|profil)\b/i.test(z)
      || state.plattformen.some(p => kompakt(p).length >= 4 && kompakt(z).includes(kompakt(p)));
    const z = zeilen.slice(0, 3).find(z => !istKopfzeile(z));
    if (z && z.length <= 25 && !/[:：=]/.test(z) && /\p{L}/u.test(z) && z.split(/\s+/).length <= 3 && !labelZuKey(z)) nickname = z;
  }
  // Chat „Noi: …“: der häufigste Sprecher (deine Zeilen sind schon entfernt) ist die Person
  if (!nickname) {
    const zaehler = {};
    for (const z of zeilen) {
      const sp = sprecherVon(z);
      if (sp && !labelZuKey(sp.name) && /\p{L}/u.test(sp.name) && sp.name.length <= 25) zaehler[sp.name] = (zaehler[sp.name] || 0) + 1;
    }
    const best = Object.entries(zaehler).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1])[0];
    if (best) nickname = best[0];
  }
  // „Mai, 27“ (so zeigt z. B. Tinder Name und Alter) → Nickname „Mai“, Alter 27
  const nameAlter = nickname.match(/^(.+?),\s*(\d{2})$/);
  if (nameAlter) {
    nickname = nameAlter[1].trim();
    const n = +nameAlter[2];
    if (n >= 18 && n <= 99) setze('alter', n, nameAlter[0]);
  }

  return { nickname, name: null, fakten, kontakt: { whatsapp }, sonstiges, eigeneZeilen: entfernt + eigeneSaetze + eigeneWerte, istChat: !!chat };
}

// ---------- Chats mit Kopfzeilen (z. B. ThaiFriendly: „IhrName1998 Today (Just now)“) ----------

const ZEIT = String.raw`(?:today|yesterday|heute|gestern|just now|\(just now\)|\d{1,2}[:.]\d{2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}|(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*|\(?\d+\s*(?:min|mins|minutes?|hours?|hrs?|days?)\s+ago\)?)`;
const KOPF = new RegExp(String.raw`^([\p{L}\p{N}_.\-]{3,30})\s+${ZEIT}\b`, 'iu');
const NUR_NAME = /^[\p{L}\p{N}_.\-]{3,30}$/u;
const NUR_ZEIT = new RegExp(String.raw`^${ZEIT}`, 'i');
const RAUSCHEN = /^(report|mark unread|mark as unread|next message|previous message|unread|read|seen|delivered|sent|translate|show translation|see translation|übersetzen|reply|antworten|like|delete|löschen|block|more)$/i;

function minutenAus(z) {
  const m = z.match(/\b(\d{1,2})[:.](\d{2})\b/);
  return m ? +m[1] * 60 + +m[2] : null;
}

/** Welches Feld fragt deine Frage ab? → { key, invert } (invert: „Hast du einen Freund?“ – Ja heißt nicht single) */
function frageZuKey(frage) {
  const q = norm(frage);
  const direkt = labelZuKey(q);
  if (direkt && direkt !== 'nickname') return { key: direkt };
  for (const f of state.felder) {
    const v = norm(f.frage || '');
    if (v.length >= 8 && (q.includes(v) || v.includes(q))) return { key: f.key };
  }
  const pf = profilFeld();
  if (pf && /\b(read|understand|understood|verstanden|gelesen|lesen)\b.*\bprofil/.test(q)) return { key: pf.key };
  const regeln = [
    [/how old|your age|wie alt/, 'alter'],
    [/how tall|your height|wie gro(ß|ss)/, 'groesse'],
    [/weigh|wie schwer/, 'gewicht'],
    [/children|kids|kinder/, 'kinder'],
    [/how long.*single|single.*how long|since when.*single|seit wann.*single/, 'single_seit'],
    [/boyfriend|husband|married|partner|feste?n? freund|verheiratet/, 'single', true],
    [/single/, 'single'],
    [/\b(job|work|working|do for (?:a )?living|occupation|beruf|arbeite?s?t?)\b/, 'job'],
    [/where.*\b(live|stay|from)\b|wo wohnst|woher/, 'wohnort'],
    [/whats ?app|phone|number|nummer/, 'handy'],
    [/\bline\b/, 'line_id'],
  ];
  for (const [re, key, invert] of regeln) if (re.test(q) && feldDef(key)) return { key, invert: !!invert };
  return null;
}

/**
 * Kurze Antwortzeilen (z. B. „Yes“, „27“, „Nurse“) – für Tinder, wo man nur ihre Antworten kopieren kann.
 * Liefert die Zeilen in der kopierten Reihenfolge (ohne Kopfzeilen, Fragen, Knöpfe, deine Zeilen).
 */
export function kurzeAntworten(text) {
  const eigene = (state.eigeneNamen || []).map(n => norm(String(n).replace(/\s*\([^)]*\)\s*$/, '')));
  return String(text).split(/\r?\n/).map(z => z.trim())
    .filter(z => z && z.length <= 40 && !/[?？]\s*$/.test(z) && !RAUSCHEN.test(z) && !KOPF.test(z) && !NUR_ZEIT.test(z)
      && !eigene.some(n => n && norm(z).includes(n)) && !/^\d{1,2}[:.]\d{2}(\s*(am|pm))?$/i.test(z) && !labelZuKey(z));
}

/** Ihre Antwort auf deine Frage deuten. */
export function antwortDeuten(key, invert, a) {
  const t = a.trim();
  const typ = feldDef(key)?.typ;
  if (typ === 'janein') {
    let w = /^(yes|yeah|yep|yup|ya|ja|of course|sure|already|i did|i do|i have|i am|i'm|i read|i understand|correct|right|ok|okay)\b/i.test(t) ? true
      : /^(no|nope|not|never|nein|i don'?t|i didn'?t|i haven'?t|i am not|i'?m not)\b/i.test(t) ? false : null;
    if (key === 'single' && w === null) w = single(t);
    else if (key === 'single' && /\b(divorced|separated|widow)/i.test(t)) w = !invert;
    if (w !== null && invert) w = !w;
    return w;
  }
  if (key === 'kinder') return kinder(t) ?? (/^(no|nope|never|not)\b/i.test(t) ? 0 : null);
  if (key === 'single_seit') return seit(t);
  if (typ === 'zahl') return deuten(key, t, true);
  if (key === 'wohnort') {
    const m = t.match(/(?:live in|stay in|i'?m in|i am in|from|in|at)\s+([^.!?\n]{2,40})/i);
    const v = textKuerzen(m ? m[1] : t);
    return v.length <= 40 && /\p{L}{2}/u.test(v) && !/[?？]/.test(t) ? v : null;
  }
  if (key === 'job') {
    const m = t.match(/(?:i(?:'m| am) (?:an? )?|i work (?:as|in|at) (?:an? )?|my job is (?:an? )?|work as (?:an? )?)([^.!?\n]{2,40})/i);
    const v = textKuerzen(m ? m[1] : t);
    return v.length <= 40 && /\p{L}{2}/u.test(v) && !/[?？]/.test(t) ? v : null;
  }
  return deuten(key, t, true);
}

/**
 * Erkennt einen Chat mit Kopfzeilen „Absender Zeit“, trennt deine und ihre Nachrichten und ordnet
 * deinen Fragen ihre nächste Antwort zu. Liefert null, wenn es kein solcher Chat ist oder unklar ist, wer du bist.
 */
function chatErkennen(zeilen, optionen) {
  const nachrichten = [];
  let akt = null;
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    let m = z.match(KOPF);
    if (!m && NUR_NAME.test(z) && i + 1 < zeilen.length && NUR_ZEIT.test(zeilen[i + 1])) { m = [z, z]; i++; }   // Name und Zeit in zwei Zeilen
    if (m && labelZuKey(m[1])) m = null;   // „Weight 48.5“ ist keine Kopfzeile
    if (m) { akt = { sender: m[1], minuten: minutenAus(z), text: [] }; nachrichten.push(akt); continue; }
    if (!akt || RAUSCHEN.test(z)) continue;
    akt.text.push(z);
  }
  const sender = [...new Set(nachrichten.map(n => n.sender))];
  if (nachrichten.length < 2 || sender.length < 2) return null;

  const k = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const eigene = (state.eigeneNamen || []).map(n => k(String(n).replace(/\s*\([^)]*\)\s*$/, '')));
  let ich = sender.find(s => eigene.includes(k(s)));
  if (!ich && optionen.nickname) {
    const sie = sender.find(s => k(s) === k(optionen.nickname));
    if (sie && sender.length === 2) ich = sender.find(s => s !== sie);
  }
  if (!ich) return null;   // unklar, wer du bist → normale Erkennung (mit Hinweis „Meine Namen“ eintragen)

  // Zeitliche Reihenfolge: ThaiFriendly zeigt die neueste Nachricht oben; Uhrzeiten (falls da) haben Vorrang
  const zeiten = nachrichten.map(n => n.minuten).filter(x => x !== null);
  let neuesteOben = optionen.neuesteOben ?? (optionen.richtung === 'oben');
  if (zeiten.length >= 2 && zeiten[0] !== zeiten[zeiten.length - 1]) neuesteOben = zeiten[0] > zeiten[zeiten.length - 1];
  const chrono = neuesteOben ? [...nachrichten].reverse() : nachrichten;

  const antworten = [];
  const unbekannt = [];
  let offeneFragen = [];
  for (const n of chrono) {
    const txt = n.text.join(' ');
    if (n.sender === ich) {
      const fragen = txt.split(/(?<=[?？])\s*/).filter(s => /[?？]\s*$/.test(s)).map(s => s.trim());
      if (fragen.length) offeneFragen = fragen;
      continue;
    }
    if (offeneFragen.length && txt) {
      for (const f of offeneFragen) {
        const z = frageZuKey(f);
        if (!z) {
          // Frage passt zu keinem Feld → dir zur Auswahl stellen („Do you smoke: Sometimes“)
          if (offeneFragen.length === 1 && txt.length <= 80) unbekannt.push(`${f.replace(/[\s?？]+$/, '')}: ${txt}`);
          continue;
        }
        const w = antwortDeuten(z.key, z.invert, txt);
        if (w !== null && w !== undefined && w !== '') antworten.push({ key: z.key, wert: w, beleg: `${f} → ${txt}` });
      }
    }
    offeneFragen = [];
  }

  const ihre = nachrichten.filter(n => n.sender !== ich);
  const zaehler = {};
  for (const n of ihre) zaehler[n.sender] = (zaehler[n.sender] || 0) + 1;
  return {
    antworten,
    unbekannt,
    ihreZeilen: ihre.flatMap(n => n.text),
    meineZeilen: nachrichten.filter(n => n.sender === ich).reduce((s, n) => s + n.text.length, 0),
    ihrName: Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
  };
}

// ---------- Eigene Nachrichten herausfiltern ----------

const kompakt = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
// Zeit/Datum/Zusätze aus einer Kopfzeile entfernen („MeinName · 10:32“, „… (you)“, „[23.11.26, 14:02]“)
const kopfBereinigen = z => z
  .replace(/\[[^\]]*\]/g, ' ')
  .replace(/\((?:you|du|ich|me|online|offline)\)/gi, ' ')
  .replace(/\b\d{1,2}[.\/]\d{1,2}(?:[.\/]\d{2,4})?,?/g, ' ')
  .replace(/\b\d{1,2}:\d{2}(?:\s*(?:am|pm|uhr))?\b/gi, ' ')
  .replace(/\((?:just now|\d+\s*\w+\s+ago)\)/gi, ' ')
  .replace(/\b(?:today|yesterday|heute|gestern|just now|online|offline|sent|gesendet|seen|gelesen|unread|ungelesen)\b/gi, ' ')
  .replace(/[-–·•:]+\s*$/, '');

/** „Name: Text“ am Zeilenanfang (Chat-Export, auch mit „[Datum, Uhrzeit]“ davor). */
function sprecherVon(z) {
  const ohneZeit = z.replace(/^\s*\[[^\]]*\]\s*/, '').replace(/^\s*\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4},?\s*\d{1,2}:\d{2}\s*-\s*/, '');
  const m = ohneZeit.match(/^\s*([^:：\d][^:：]{1,39}?)\s*[:：]\s*(.*)$/);
  return m ? { name: m[1].trim(), rest: m[2] } : null;
}

/**
 * Entfernt Zeilen, die von dir stammen:
 *  - „MeinName: text“ oder „[Datum] MeinName: text“ (eine Zeile)
 *  - Kopfzeile „MeinName“ (evtl. mit Uhrzeit) → die folgenden Zeilen bis zur nächsten fremden Kopfzeile
 *  - jede andere Zeile, in der dein Name vorkommt
 */
function eigeneZeilenEntfernen(zeilen) {
  // „Name (Tinder)“ → nur „Name“ vergleichen
  const eigene = (state.eigeneNamen || []).map(n => kompakt(String(n).replace(/\s*\([^)]*\)\s*$/, ''))).filter(n => n.length >= 3);
  if (!eigene.length) return { zeilen, entfernt: 0 };
  const istEigen = s => eigene.includes(kompakt(s));
  const enthaeltEigen = s => { const k = kompakt(s); return eigene.some(n => k.includes(n)); };

  const sprecher = sprecherVon;
  // Kopfzeile eines anderen Absenders: kurz, sieht aus wie ein Benutzername/Name, kein Satz
  const KURZANTWORT = /^(ok|okay|okey|yes|yeah|yep|no|nope|haha+|hehe+|lol|hi|hello|hey|thanks|thank you|thx|good|sure|ja|nein|danke|gut|hallo|na|ka|kha|krub|555+)$/i;
  const fremderKopf = z => {
    if (/^[\p{L}\d_.\- ]{2,25},\s*\d{2}$/u.test(z.trim()) && !istEigen(z.split(',')[0])) return true;   // „Noi, 29“
    const b = kopfBereinigen(z).trim();
    return b.length >= 3 && b.length <= 30 && !istEigen(b) && /^[\p{L}\d_.\- ]+$/u.test(b) && b.split(/\s+/).length <= 3
      && /\p{L}/u.test(b) && !/[.!?,]$/.test(z.trim()) && !KURZANTWORT.test(b);
  };

  const behalten = [];
  let imEigenenBlock = false;
  let blockZeilen = 0;
  let entfernt = 0;
  for (const z of zeilen) {
    const sp = sprecher(z);
    if (sp && kompakt(sp.name).length >= 2) {
      // Zeile mit Sprecher vorneweg
      imEigenenBlock = false;
      if (istEigen(sp.name) || /^(you|du|me|ich)$/i.test(sp.name.trim())) { entfernt++; continue; }
      if (enthaeltEigen(z)) { entfernt++; continue; }
      behalten.push(z);
      continue;
    }
    const kopf = kopfBereinigen(z).trim();
    if (istEigen(kopf)) { imEigenenBlock = true; blockZeilen = 0; entfernt++; continue; }
    if (imEigenenBlock) {
      // Block endet bei fremder Kopfzeile, bei einer Profil-Beschriftung (z. B. „Height“) oder nach vielen Zeilen
      // (z. B. wenn dein Name nur oben in der Menüleiste der kopierten Seite stand)
      if (fremderKopf(z) || labelZuKey(kopf) || ++blockZeilen > 15) { imEigenenBlock = false; behalten.push(z); continue; }
      entfernt++;
      continue;
    }
    if (enthaeltEigen(z)) { entfernt++; continue; }
    behalten.push(z);
  }
  return { zeilen: behalten, entfernt };
}

/** Sieht der Text wie ein Claude-Block / JSON aus? */
export function istBlock(text) {
  return /===\s*PERSONEN-DATEN/i.test(text) || /^\s*(```\w*\s*)?\{[\s\S]*"(personen|fakten)"/.test(text);
}
