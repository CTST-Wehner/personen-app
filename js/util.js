// Kleine Hilfsfunktionen, die überall gebraucht werden.

/** Element bauen: h('div', {class:'x', onclick:fn}, kind1, kind2 …) */
export function h(tag, attrs, ...kinder) {
  const e = document.createElement(tag);
  let wert;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'value') wert = v;
    else if (k === 'checked') e.checked = !!v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kinder.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : String(c));
  }
  if (wert !== undefined) e.value = wert;
  return e;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Heutiges Datum als JJJJ-MM-TT (lokale Zeit). */
export function heute() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function datumDE(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
}

export const digits = s => String(s ?? '').replace(/\D/g, '');

/** Telefonnummer vereinheitlichen: "+66 81-234" -> "+6681234", "0049…" -> "+49…". Ohne Vorwahl bleibt sie wie eingegeben (nur Ziffern). */
export function normTelefon(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  if (t.startsWith('00')) return '+' + digits(t).slice(2);
  if (t.startsWith('+')) return '+' + digits(t);
  return digits(t) || null;
}

/** Zwei Nummern gleich? Vergleicht die letzten 9 Ziffern (damit 081… und +6681… übereinstimmen). */
export function telefonGleich(a, b) {
  const da = digits(a), db = digits(b);
  if (!da || !db) return false;
  const n = Math.min(da.length, db.length, 9);
  return n >= 6 && da.slice(-n) === db.slice(-n);
}

/** Eingabe in den Feldtyp umwandeln. Liefert null, wenn nichts Sinnvolles drinsteht. */
export function parseWert(typ, roh) {
  if (roh === null || roh === undefined) return null;
  switch (typ) {
    case 'zahl': {
      if (typeof roh === 'number') return Number.isFinite(roh) ? roh : null;
      const m = String(roh).replace(',', '.').match(/-?\d+(\.\d+)?/);
      return m ? Number(m[0]) : null;
    }
    case 'janein':
      if (typeof roh === 'boolean') return roh;
      if (/^(ja|yes|true|1|y|j)$/i.test(String(roh).trim())) return true;
      if (/^(nein|no|false|0|n)$/i.test(String(roh).trim())) return false;
      return null;
    case 'telefon':
      return normTelefon(roh);
    default: {
      const s = String(roh).trim();
      return s || null;
    }
  }
}

export function gleich(typ, a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return a == b;
  switch (typ) {
    case 'telefon': return telefonGleich(a, b);
    case 'zahl': return Number(a) === Number(b);
    case 'janein': return !!a === !!b;
    default: return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }
}

export function formatWert(feld, v) {
  if (v === null || v === undefined || v === '') return '—';
  const typ = feld?.typ || 'text';
  if (typ === 'janein') return v ? 'Ja' : 'Nein';
  if (typ === 'zahl') {
    const s = typeof v === 'number' ? v.toLocaleString('de-DE') : String(v);
    return feld?.einheit ? `${s} ${feld.einheit}` : s;
  }
  return String(v);
}

export const slug = s => String(s ?? '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

let toastTimer;
export function toast(text, ms = 2800) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('In die Zwischenablage kopiert');
}

/** Aktuelle Seite neu zeichnen (Scrollposition bleibt). */
export const neuZeichnen = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
export const geheZu = hash => { location.hash = hash; };
