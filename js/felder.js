// Seite „Felder“: Felder anlegen/ändern/sortieren und Projekt-Anweisung für Claude erzeugen.
import { state, speichereFelder, speicherePerson, speicherePlattformen, TYPEN, FEST, STANDARD_FELDER } from './store.js';
import { h, toast, copyText, slug } from './util.js';
import { dialog, bestaetigen, eingabe } from './dialoge.js';

/** Box zum Verwalten der Plattformen (Tinder, ThaiFriendly, …). */
function plattformBox() {
  const liste = h('div');
  function zeichne() {
    liste.replaceChildren(...state.plattformen.map((p, i) => {
      const anzahl = state.personen.filter(x => x.plattform === p).length;
      return h('div', { class: 'feld-zeile' },
        h('div', {}, h('strong', {}, p), h('span', { class: 'leise' }, `  ${anzahl} Person(en)`)),
        h('div', { class: 'feld-knoepfe' },
          h('button', { disabled: i === 0, onclick: () => schiebe(i, -1) }, '▲'),
          h('button', { disabled: i === state.plattformen.length - 1, onclick: () => schiebe(i, 1) }, '▼'),
          h('button', { onclick: () => umbenennen(i) }, 'Umbenennen'),
          h('button', { class: 'gefahr', onclick: () => entfernen(i) }, 'Entfernen')));
    }));
    if (!state.plattformen.length) liste.append(h('p', { class: 'leise' }, 'Keine Plattformen angelegt.'));
  }
  async function schiebe(i, d) {
    const [p] = state.plattformen.splice(i, 1);
    state.plattformen.splice(i + d, 0, p);
    await speicherePlattformen();
    zeichne();
  }
  async function umbenennen(i) {
    const alt = state.plattformen[i];
    const neu = await eingabe('Plattform umbenennen', alt);
    if (!neu || neu === alt) return;
    state.plattformen[i] = neu;
    await speicherePlattformen();
    for (const p of state.personen) if (p.plattform === alt) { p.plattform = neu; await speicherePerson(p); }
    zeichne();
  }
  async function entfernen(i) {
    const p = state.plattformen[i];
    if (!(await bestaetigen(`„${p}“ aus der Auswahl entfernen? Personen, bei denen das eingetragen ist, behalten den Eintrag.`, 'Entfernen'))) return;
    state.plattformen.splice(i, 1);
    await speicherePlattformen();
    zeichne();
  }
  async function neu() {
    const n = await eingabe('Neue Plattform', '', 'z. B. Bumble, Facebook, Instagram, Bar …');
    if (!n) return;
    if (state.plattformen.some(p => p.toLowerCase() === n.toLowerCase())) { toast('Gibt es schon'); return; }
    state.plattformen.push(n);
    await speicherePlattformen();
    zeichne();
  }
  zeichne();
  return h('div', { class: 'box' },
    h('h2', {}, 'Plattformen („Wo kennengelernt?“)'),
    h('p', { class: 'leise klein' }, 'Wird bei jeder neuen Person als Erstes abgefragt.'),
    liste,
    h('div', { class: 'zeile' }, h('button', { class: 'primaer', onclick: neu }, '+ Plattform hinzufügen')));
}

/** Dialog zum Anlegen/Bearbeiten eines Felds. Liefert das neue Feld-Objekt oder null. */
export async function feldBearbeitenDialog(vorlage, istNeu) {
  const fest = !istNeu && FEST.includes(vorlage.key);
  const label = h('input', { type: 'text', value: vorlage.label || '' });
  const key = h('input', { type: 'text', value: vorlage.key || (istNeu ? slug(vorlage.label || '') : ''), disabled: fest });
  let keyAngefasst = !!vorlage.key;
  key.addEventListener('input', () => { keyAngefasst = true; });
  label.addEventListener('input', () => { if (!keyAngefasst) key.value = slug(label.value); });
  const typ = h('select', { disabled: fest }, Object.entries(TYPEN).map(([k, v]) => h('option', { value: k }, v)));
  typ.value = vorlage.typ || 'text';
  const einheit = h('input', { type: 'text', value: vorlage.einheit || '', placeholder: 'z. B. kg, cm, Jahre' });
  const bedeutung = h('input', { type: 'text', value: vorlage.bedeutung || '', placeholder: 'Erklärung für die Claude-Auswertung' });
  const woerter = h('input', { type: 'text', value: vorlage.woerter || '', placeholder: 'z. B. Eye color, Augenfarbe' });
  const frage = h('textarea', { rows: 2, placeholder: 'z. B. How old are you?' });
  frage.value = vorlage.frage || '';
  const fehler = h('p', { class: 'fehler' });

  return dialog(istNeu ? 'Neues Feld' : 'Feld bearbeiten', [
    h('label', {}, 'Anzeigename', label),
    h('label', {}, 'Schlüssel (nur a–z, 0–9 und _)', key),
    fest && h('p', { class: 'leise klein' }, 'Schlüssel und Typ dieses Felds sind fest, weil Kontakt-Buttons bzw. Karte darauf aufbauen.'),
    h('label', {}, 'Typ', typ),
    h('label', {}, 'Einheit (optional)', einheit),
    h('label', {}, 'Bedeutung (für die Projekt-Anweisung, optional)', bedeutung),
    h('label', {}, 'Frage-Vorlage (für „Noch erfragen“)', frage),
    h('label', {}, 'Erkennungswörter (optional, mit Komma getrennt)', woerter),
    h('p', { class: 'leise klein' }, 'Beschriftungen, unter denen der Wert auf Profilseiten steht – z. B. bei „Eye color: brown“ das Wort „Eye color“. Der Anzeigename wird automatisch auch erkannt.'),
    fehler,
  ], [
    { text: 'Abbrechen', wert: null },
    {
      text: 'Speichern', klasse: 'primaer',
      pruefen: () => {
        const k = key.value.trim();
        if (!label.value.trim()) { fehler.textContent = 'Bitte einen Anzeigenamen eingeben.'; return false; }
        if (!/^[a-z0-9_]+$/.test(k)) { fehler.textContent = 'Schlüssel: nur Kleinbuchstaben a–z, Ziffern und _.'; return false; }
        if (state.felder.some(f => f.key === k) && (istNeu || k !== vorlage.key)) { fehler.textContent = 'Diesen Schlüssel gibt es schon.'; return false; }
        return true;
      },
      wert: () => {
        const f = { key: key.value.trim(), label: label.value.trim(), typ: typ.value, frage: frage.value.trim() };
        if (einheit.value.trim()) f.einheit = einheit.value.trim();
        if (bedeutung.value.trim()) f.bedeutung = bedeutung.value.trim();
        if (woerter.value.trim()) f.woerter = woerter.value.trim();
        return f;
      },
    },
  ]);
}

/** Text für die Claude-Projekt-Anweisung (Abschnitt „Felder“). */
export function projektAnweisung() {
  const zeilen = state.felder
    .filter(f => f.key !== 'handy' && f.key !== 'line_id')
    .map(f => {
      let b = f.bedeutung;
      if (!b) {
        const zusatz = f.typ === 'zahl' ? `Zahl${f.einheit ? ', in ' + f.einheit : ''}` : f.typ === 'janein' ? 'true/false' : f.typ === 'ort' ? 'Ort/Stadtteil + Land, keine Straße' : '';
        b = zusatz ? `${f.label} (${zusatz})` : f.label;
      }
      return `| ${f.key} | ${b} |`;
    });
  return [
    '## Felder',
    '| Schlüssel | Bedeutung |',
    '|---|---|',
    ...zeilen,
    '',
    'Kontaktangaben gehören nach `kontakt`: `handy` (mit Ländervorwahl, wenn erkennbar), `whatsapp` (true, wenn die Nummer als WhatsApp genannt ist), `line_id`.',
  ].join('\n');
}

export function zeigeFelder(main) {
  const liste = h('div');
  const anweisung = h('pre', { class: 'anweisung' });

  function zeichne() {
    liste.replaceChildren(...state.felder.map((f, i) => h('div', { class: 'feld-zeile' },
      h('div', {},
        h('strong', {}, f.label),
        h('span', { class: 'leise' }, `  ${f.key} · ${TYPEN[f.typ] || f.typ}${f.einheit ? ' (' + f.einheit + ')' : ''}`),
        f.frage && h('div', { class: 'leise klein' }, `„${f.frage}“`)),
      h('div', { class: 'feld-knoepfe' },
        h('button', { title: 'nach oben', disabled: i === 0, onclick: () => verschiebe(i, -1) }, '▲'),
        h('button', { title: 'nach unten', disabled: i === state.felder.length - 1, onclick: () => verschiebe(i, 1) }, '▼'),
        h('button', { onclick: () => bearbeiten(i) }, 'Bearbeiten'),
        !FEST.includes(f.key) && h('button', { class: 'gefahr', onclick: () => loeschen(i) }, 'Löschen')))));
    anweisung.textContent = projektAnweisung();
  }

  async function verschiebe(i, d) {
    const [f] = state.felder.splice(i, 1);
    state.felder.splice(i + d, 0, f);
    await speichereFelder();
    zeichne();
  }

  async function bearbeiten(i) {
    const alt = state.felder[i];
    const neu = await feldBearbeitenDialog(alt, false);
    if (!neu) return;
    if (neu.key !== alt.key) {
      // Gespeicherte Werte auf den neuen Schlüssel umziehen
      for (const p of state.personen) {
        let geaendert = false;
        if (p.fakten[alt.key] !== undefined) { p.fakten[neu.key] = p.fakten[alt.key]; delete p.fakten[alt.key]; geaendert = true; }
        for (const v of p.verlauf || []) if (v.feld === alt.key) { v.feld = neu.key; geaendert = true; }
        if (geaendert) await speicherePerson(p);
      }
    }
    state.felder[i] = neu;
    await speichereFelder();
    zeichne();
    toast('Feld gespeichert');
  }

  async function loeschen(i) {
    const f = state.felder[i];
    if (!(await bestaetigen(`Feld „${f.label}“ löschen? Schon gespeicherte Werte bleiben bei den Personen erhalten und erscheinen dort unter „Weitere Angaben“.`, 'Löschen'))) return;
    state.felder.splice(i, 1);
    await speichereFelder();
    zeichne();
  }

  async function neu() {
    const f = await feldBearbeitenDialog({ key: '', label: '', typ: 'text', frage: '' }, true);
    if (!f) return;
    state.felder.push(f);
    await speichereFelder();
    zeichne();
    toast('Feld angelegt – denk daran, die Projekt-Anweisung in Claude zu aktualisieren');
  }

  async function standardHolen() {
    const fehlend = STANDARD_FELDER.filter(s => !state.felder.some(f => f.key === s.key));
    if (!fehlend.length) { toast('Alle Standardfelder sind vorhanden'); return; }
    state.felder.push(...fehlend.map(x => ({ ...x })));
    await speichereFelder();
    zeichne();
  }

  main.append(
    h('h1', {}, 'Felder'),
    h('div', { class: 'box' },
      liste,
      h('div', { class: 'zeile' },
        h('button', { class: 'primaer', onclick: neu }, '+ Feld hinzufügen'),
        h('button', { onclick: standardHolen }, 'Fehlende Standardfelder zurückholen'))),
    plattformBox(),
    h('div', { class: 'box' },
      h('h2', {}, 'Projekt-Anweisung für Claude'),
      h('p', { class: 'leise' }, 'Nach Änderungen an den Feldern: kopieren und im Claude-Projekt „Personen-Auswertung“ den Abschnitt „## Felder“ (bis vor „## Regeln“) damit ersetzen.'),
      anweisung,
      h('button', { class: 'primaer', onclick: () => copyText(projektAnweisung()) }, 'Projekt-Anweisung kopieren')),
  );
  zeichne();
}
