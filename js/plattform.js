// Plattform („Wo kennengelernt?“): Auswahlfeld mit der Möglichkeit, neue Plattformen hinzuzufügen.
import { state, speicherePlattformen } from './store.js';
import { h } from './util.js';
import { eingabe } from './dialoge.js';

const ANDERE = '__andere__';

/** Plattform im Text erkennen (nur als Vorschlag). */
export function plattformVorschlag(text) {
  const kompakt = s => String(s || '').toLowerCase().replace(/[\s\-_.]+/g, '');
  const t = kompakt(text);
  return state.plattformen.find(p => kompakt(p).length >= 4 && t.includes(kompakt(p))) || '';
}

/** Auswahlfeld. Liefert {el, lesen()} – lesen() gibt '' zurück, wenn nichts gewählt ist. */
export function plattformAuswahl(aktuell = '') {
  const sel = h('select', {});
  let letzter = aktuell || '';

  function fuellen(wert) {
    const liste = [...state.plattformen];
    if (wert && !liste.includes(wert)) liste.push(wert);
    sel.replaceChildren(
      h('option', { value: '' }, '– bitte wählen –'),
      ...liste.map(p => h('option', { value: p }, p)),
      h('option', { value: ANDERE }, '➕ Andere Plattform hinzufügen …'));
    sel.value = wert || '';
    letzter = sel.value;
  }

  sel.addEventListener('change', async () => {
    if (sel.value !== ANDERE) { letzter = sel.value; sel.classList.remove('fehlt-auswahl'); return; }
    const neu = await eingabe('Neue Plattform', '', 'Name der Plattform, z. B. Bumble, Facebook, Instagram, Bar …');
    if (neu) {
      if (!state.plattformen.some(p => p.toLowerCase() === neu.toLowerCase())) {
        state.plattformen.push(neu);
        await speicherePlattformen();
      }
      fuellen(state.plattformen.find(p => p.toLowerCase() === neu.toLowerCase()));
      sel.classList.remove('fehlt-auswahl');
    } else {
      fuellen(letzter);
    }
  });

  fuellen(aktuell);
  return { el: sel, lesen: () => (sel.value === ANDERE ? '' : sel.value), markieren: () => { sel.classList.add('fehlt-auswahl'); sel.focus(); } };
}
