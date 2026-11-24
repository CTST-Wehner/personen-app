// Dialogfenster und Eingabefelder.
import { h, digits, normTelefon, parseWert } from './util.js';

/**
 * Zeigt einen Dialog. knoepfe: [{text, wert, klasse, pruefen}] – wert darf eine Funktion sein.
 * Liefert den wert des gedrückten Knopfs (Esc = null).
 */
export function dialog(titel, inhalt, knoepfe) {
  return new Promise(res => {
    let ergebnis = null;
    const d = h('dialog', { class: 'dlg' });
    const leiste = h('div', { class: 'knoepfe' }, knoepfe.map(k => h('button', {
      type: 'button',
      class: k.klasse || '',
      onclick: async () => {
        if (k.pruefen && !(await k.pruefen())) return;
        ergebnis = typeof k.wert === 'function' ? k.wert() : k.wert;
        d.close();
      },
    }, k.text)));
    d.append(h('h2', {}, titel), h('div', { class: 'dlg-inhalt' }, inhalt), leiste);
    d.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') {
        e.preventDefault();
        leiste.querySelector('.primaer')?.click();
      }
    });
    d.addEventListener('close', () => { d.remove(); res(ergebnis ?? null); });
    document.body.append(d);
    d.showModal();
    d.querySelector('input:not([type=checkbox]):not([type=radio]):not([disabled]),textarea,select')?.focus();
  });
}

export async function bestaetigen(text, ja = 'Ja') {
  const r = await dialog('Bitte bestätigen', h('p', {}, text), [
    { text: 'Abbrechen', wert: false },
    { text: ja, wert: true, klasse: 'primaer gefahr' },
  ]);
  return r === true;
}

export function eingabe(titel, vorgabe = '', hinweis = '') {
  const i = h('input', { type: 'text', value: vorgabe });
  return dialog(titel, [hinweis && h('p', { class: 'leise' }, hinweis), i], [
    { text: 'Abbrechen', wert: null },
    { text: 'OK', klasse: 'primaer', wert: () => i.value.trim() || null },
  ]);
}

/** Eingabefeld mit Vorschlagsliste aller bekannten Orte. */
export function ortEingabe(orte, wert = '', placeholder = 'Ort tippen, z. B. Bang Na, Pattaya, Hua Hin') {
  if (!document.getElementById('orte-liste')) {
    document.body.append(h('datalist', { id: 'orte-liste' }, orte.map(([name]) => h('option', { value: name }))));
  }
  return h('input', { type: 'text', list: 'orte-liste', value: wert, placeholder, autocomplete: 'off' });
}

export const VORWAHLEN = [
  ['+49', 'Deutschland'], ['+66', 'Thailand'], ['+63', 'Philippinen'], ['+84', 'Vietnam'],
  ['+855', 'Kambodscha'], ['+856', 'Laos'], ['+95', 'Myanmar'], ['+62', 'Indonesien'],
  ['+60', 'Malaysia'], ['+65', 'Singapur'], ['+86', 'China'], ['+852', 'Hongkong'],
  ['+886', 'Taiwan'], ['+81', 'Japan'], ['+82', 'Südkorea'], ['+91', 'Indien'],
  ['+43', 'Österreich'], ['+41', 'Schweiz'], ['+48', 'Polen'], ['+380', 'Ukraine'],
  ['+7', 'Russland'], ['+44', 'Großbritannien'], ['+1', 'USA/Kanada'],
];

function letzteVorwahl() {
  try { return localStorage.getItem('vorwahl') || '+66'; } catch { return '+66'; }
}

/** Eingabefeld passend zum Feldtyp. Liefert {el, lesen()}. */
export function feldEingabe(feld, wert) {
  switch (feld.typ) {
    case 'zahl': {
      const i = h('input', { type: 'text', inputmode: 'decimal', value: wert == null ? '' : String(wert).replace('.', ',') });
      return { el: h('span', { class: 'mit-einheit' }, i, feld.einheit || ''), lesen: () => parseWert('zahl', i.value) };
    }
    case 'janein': {
      const s = h('select', {},
        h('option', { value: '' }, '– unbekannt –'),
        h('option', { value: 'ja' }, 'Ja'),
        h('option', { value: 'nein' }, 'Nein'));
      s.value = wert === true ? 'ja' : wert === false ? 'nein' : '';
      return { el: s, lesen: () => (s.value === '' ? null : s.value === 'ja') };
    }
    case 'telefon': {
      const sel = h('select', {}, VORWAHLEN.map(([c, n]) => h('option', { value: c }, `${c} ${n}`)));
      sel.value = letzteVorwahl();
      const i = h('input', { type: 'tel', value: wert ?? '', placeholder: 'z. B. 081 234 5678 oder +66 …' });
      const vorschau = h('div', { class: 'leise klein' });
      const berechne = () => {
        const t = i.value.trim();
        if (!t) return null;
        if (t.startsWith('+') || t.startsWith('00')) return normTelefon(t);
        const d = digits(t).replace(/^0+/, '');
        return d ? sel.value + d : null;
      };
      const zeigen = () => {
        const v = berechne();
        vorschau.textContent = v ? `Wird gespeichert als: ${v}` : 'Beginnt die Nummer nicht mit + oder 00, wird die gewählte Ländervorwahl davorgesetzt (führende 0 fällt weg).';
      };
      i.addEventListener('input', zeigen);
      sel.addEventListener('change', () => { zeigen(); try { localStorage.setItem('vorwahl', sel.value); } catch { /* egal */ } });
      zeigen();
      return { el: h('div', { class: 'telefon' }, h('div', { class: 'zeile' }, sel, i), vorschau), lesen: berechne };
    }
    case 'ort': {
      const i = h('input', { type: 'text', value: wert ?? '', placeholder: 'Ort/Stadtteil, Land – keine Straße' });
      return { el: i, lesen: () => i.value.trim() || null };
    }
    default: {
      const i = h('input', { type: 'text', value: wert ?? '' });
      return { el: i, lesen: () => i.value.trim() || null };
    }
  }
}
