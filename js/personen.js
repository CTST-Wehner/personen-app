// Übersicht (Liste) und Personen-Detail.
import { state, wert, setzeFakt, speicherePerson, loeschePerson, neuePerson, fortschritt, feldDef } from './store.js';
import { h, toast, copyText, digits, neuZeichnen, geheZu, formatWert, heute, datumDE } from './util.js';
import { dialog, bestaetigen, feldEingabe } from './dialoge.js';
import { fotoHinzufuegen, vorschauUrl, grossUrl, fotoLoeschen, bilderAusEinfuegen, bilderAusZwischenablage, ausschnitt, ausschnittAnwenden } from './fotos.js';
import { plattformAuswahl } from './plattform.js';
import { ORTE, REGIONEN, ortVon, entfernung, streckeZu, streckeText, km, kmText, ortNachName, standortSetzen, gpsAbfragen } from './orte.js';
import { ortEingabe } from './dialoge.js';
import { syncLeiste } from './syncui.js';
import { einfuegenBox } from './import.js';
import { eigeneAngabeArt, profilFeld } from './erkennung.js';

// Such-/Filtereinstellungen bleiben beim Seitenwechsel erhalten.
let suche = '';
let filter = 'alle';
let plattformFilter = '';
let umkreis = '';   // '' = alle, Zahl = km um meinen Standort, 'r:<Region>' = Region

/** Dialog „Wo bin ich?“ – Ort wählen (offline) oder GPS. Liefert true, wenn geändert. */
export async function standortDialog() {
  const eingabe = ortEingabe(ORTE, state.standort && !state.standort.name.startsWith('GPS') ? state.standort.name : '');
  const fehler = h('p', { class: 'fehler' });
  let ergebnis = null;
  const schnell = REGIONEN.map(r => h('button', { type: 'button', onclick: () => { eingabe.value = r.name; } }, r.name));
  const gps = h('button', { type: 'button', onclick: async () => {
    gps.disabled = true;
    fehler.textContent = 'Standort wird ermittelt …';
    try {
      ergebnis = await gpsAbfragen();
      eingabe.value = '';
      fehler.textContent = '';
      document.querySelector('dialog.dlg .primaer')?.click();
    } catch (e) {
      fehler.textContent = e.message;
    } finally {
      gps.disabled = false;
    }
  } }, '📡 GPS verwenden');
  const r = await dialog('Wo bin ich?', [
    h('p', { class: 'leise klein' }, 'Ort wählen genügt – es geht nur um ungefähre Entfernungen.'),
    h('div', { class: 'zeile' }, schnell),
    h('label', {}, 'Ort', eingabe),
    h('div', { class: 'zeile' }, gps),
    h('p', { class: 'leise klein' }, 'Hinweis: Am PC ermittelt der Browser die GPS-Position über einen Ortungsdienst im Internet. Ort wählen bleibt komplett offline.'),
    fehler,
  ], [
    { text: 'Abbrechen', wert: null },
    state.standort && { text: 'Entfernen', wert: 'weg', klasse: 'gefahr' },
    {
      text: 'Übernehmen', klasse: 'primaer',
      pruefen: () => {
        if (ergebnis) return true;
        const o = ortNachName(eingabe.value);
        if (!o) { fehler.textContent = 'Diesen Ort kenne ich nicht – bitte aus der Liste wählen.'; return false; }
        ergebnis = { lat: o.lat, lng: o.lng, name: o.ort, zeit: new Date().toISOString() };
        return true;
      },
      wert: 'ok',
    },
  ].filter(Boolean));
  if (r === 'weg') { await standortSetzen(null); return true; }
  if (r === 'ok' && ergebnis) { await standortSetzen(ergebnis); return true; }
  return false;
}

/** Ort der Person von Hand zuordnen (wenn der Wohnort-Text nicht erkannt wurde oder falsch ist). */
async function ortZuordnen(p, speichern) {
  const jetzt = ortVon(p);
  const eingabe = ortEingabe(ORTE, jetzt?.ort || '', 'Nächstgelegenen Ort wählen');
  const fehler = h('p', { class: 'fehler' });
  let o = null;
  const r = await dialog('Ort zuordnen', [
    h('p', { class: 'leise klein' }, `Wohnort laut Angabe: „${wert(p, 'wohnort') || '—'}“. Wähle den Ort aus der Liste, der am nächsten liegt.`),
    h('label', {}, 'Ort', eingabe),
    fehler,
  ], [
    { text: 'Abbrechen', wert: null },
    p.wohnort?.manuell && { text: 'Automatisch', wert: 'auto' },
    { text: 'Übernehmen', klasse: 'primaer', wert: 'ok', pruefen: () => { o = ortNachName(eingabe.value); if (!o) fehler.textContent = 'Bitte einen Ort aus der Liste wählen.'; return !!o; } },
  ].filter(Boolean));
  if (r === 'auto') p.wohnort = { lat: null, lng: null };
  else if (r === 'ok' && o) p.wohnort = { lat: o.lat, lng: o.lng, ort: o.ort, manuell: true };
  else return;
  await speichern();
}
let sortierung = 'nickname';

/** Hauptfoto im Hochformat-Rahmen (gross = volle Auflösung für die Personenseite). */
function bildOderPlatzhalter(p, klasse, gross = false) {
  const box = h('div', { class: klasse }, (p.nickname || '?').charAt(0).toUpperCase());
  if (p.hauptfoto) {
    const id = p.hauptfoto;
    (gross ? grossUrl(id) : vorschauUrl(id)).then(u => {
      if (!u) return;
      const img = h('img', { src: u, alt: '' });
      ausschnittAnwenden(img, ausschnitt(p, id));
      box.replaceChildren(img);
    });
  }
  return box;
}

/** Ausschnitt eines Fotos verschieben (ziehen) und zoomen. */
async function ausschnittDialog(p, id, speichern) {
  const url = await grossUrl(id);
  if (!url) return;
  const a = { ...ausschnitt(p, id) };
  const img = h('img', { src: url, alt: '', draggable: 'false' });
  const rahmen = h('div', { class: 'rahmen' }, img);
  const zoom = h('input', { type: 'range', min: '1', max: '3', step: '0.05', value: String(a.z) });
  const zeigen = () => ausschnittAnwenden(img, a);
  zeigen();
  zoom.addEventListener('input', () => { a.z = Number(zoom.value); zeigen(); });

  // Ziehen mit Maus oder Finger: Bild folgt der Bewegung
  let start = null;
  rahmen.addEventListener('pointerdown', e => {
    e.preventDefault();   // kein Text markieren / Bild „wegziehen“
    start = { px: e.clientX, py: e.clientY, x: a.x, y: a.y };
    try { rahmen.setPointerCapture(e.pointerId); } catch { /* egal */ }
  });
  rahmen.addEventListener('pointermove', e => {
    if (!start) return;
    const w = rahmen.clientWidth, hgt = rahmen.clientHeight;
    const f = 1.6 / a.z;   // Empfindlichkeit
    a.x = Math.min(100, Math.max(0, start.x - (e.clientX - start.px) / w * 100 * f));
    a.y = Math.min(100, Math.max(0, start.y - (e.clientY - start.py) / hgt * 100 * f));
    zeigen();
  });
  const ende = () => { start = null; };
  rahmen.addEventListener('pointerup', ende);
  rahmen.addEventListener('pointercancel', ende);

  const r = await dialog('Ausschnitt anpassen', [
    h('p', { class: 'leise klein' }, 'Bild mit Maus oder Finger verschieben, mit dem Regler vergrößern. So erscheint es in der Übersicht und oben in der Person.'),
    rahmen,
    h('label', {}, 'Zoom', zoom),
  ], [
    { text: 'Zurücksetzen', wert: 'reset' },
    { text: 'Abbrechen', wert: null },
    { text: 'Speichern', wert: 'ok', klasse: 'primaer' },
  ]);
  URL.revokeObjectURL(url);
  if (!r) return;
  p.fotoAusschnitt ||= {};
  if (r === 'reset') delete p.fotoAusschnitt[id];
  else p.fotoAusschnitt[id] = { x: Math.round(a.x), y: Math.round(a.y), z: Math.round(a.z * 100) / 100 };
  await speichern();
}

// ---------------- Übersicht ----------------

export function zeigeUebersicht(main) {
  const liste = h('div', { class: 'karten' });
  const zaehler = h('p', { class: 'leise klein' });

  function karte(p) {
    const f = fortschritt(p);
    return h('a', { class: 'pkarte', href: '#/person/' + encodeURIComponent(p.id) },
      bildOderPlatzhalter(p, 'bild'),
      h('div', { class: 'info' },
        h('div', { class: 'name' }, h('span', {}, p.nickname || '(ohne Nickname)'), p.interessant && h('span', { class: 'stern' }, '★')),
        p.name && h('div', { class: 'leise klein' }, p.name),
        p.plattform && h('span', { class: 'plattform' }, p.plattform),
        (() => {
          const o = ortVon(p);
          if (!o) return null;
          const s = streckeZu(p);
          return h('div', { class: 'leise klein' }, `📍 ${o.ort}${s ? ' · ' + kmText(s.d) + (s.umweg ? ' 🚗' : '') : ''}`);
        })(),
        h('div', { class: 'leise klein' }, `${f.k} von ${f.n} Fakten`),
        h('div', { class: 'balken' }, h('span', { style: `width:${f.n ? Math.round(100 * f.k / f.n) : 0}%` }))));
  }

  function zeichne() {
    const q = suche.trim().toLowerCase();
    const qd = digits(q);
    let ps = state.personen.filter(p => {
      if (q) {
        const text = [p.nickname, p.name, wert(p, 'line_id')].filter(Boolean).join(' ').toLowerCase();
        const tel = digits(wert(p, 'handy'));
        if (!text.includes(q) && !(qd.length >= 3 && tel.includes(qd))) return false;
      }
      if (umkreis) {
        const o = ortVon(p);
        if (!o) return false;
        if (String(umkreis).startsWith('r:')) {
          const r = REGIONEN.find(x => 'r:' + x.name === umkreis);
          if (r && km(r, o) > r.radius) return false;
        } else if (state.standort && entfernung(p) > Number(umkreis)) return false;
      }
      if (plattformFilter === '-' && p.plattform) return false;
      if (plattformFilter && plattformFilter !== '-' && p.plattform !== plattformFilter) return false;
      const f = fortschritt(p);
      if (filter === 'profil') { const pf = profilFeld(); if (!pf || wert(p, pf.key) === true) return false; }
      if (filter === 'stern' && !p.interessant) return false;
      if (filter === 'voll' && f.k < f.n) return false;
      if (filter === 'fehlt' && f.k >= f.n) return false;
      return true;
    });
    const nachName = (a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'de');
    if (sortierung === 'nickname') ps.sort(nachName);
    else if (sortierung === 'geaendert') ps.sort((a, b) => (b.geaendert || '').localeCompare(a.geaendert || ''));
    else if (sortierung === 'luecken') ps.sort((a, b) => fortschritt(a).k - fortschritt(b).k || nachName(a, b));
    else if (sortierung === 'stern') ps.sort((a, b) => (b.interessant ? 1 : 0) - (a.interessant ? 1 : 0) || nachName(a, b));
    else if (sortierung === 'naechste') ps.sort((a, b) => (entfernung(a) ?? Infinity) - (entfernung(b) ?? Infinity) || nachName(a, b));

    liste.replaceChildren(...ps.map(karte));
    zaehler.textContent = `${ps.length} von ${state.personen.length} Personen`;
    if (!state.personen.length) liste.append(h('p', { class: 'leer' }, 'Noch keine Personen. Lege eine an oder füge unter „Einfügen“ eine Auswertung aus Claude ein.'));
  }

  const sucheFeld = h('input', { type: 'search', placeholder: 'Suchen: Nickname, Name, Nummer, LINE', value: suche, oninput: e => { suche = e.target.value; zeichne(); } });
  const filterFeld = h('select', { onchange: e => { filter = e.target.value; zeichne(); } },
    h('option', { value: 'alle' }, 'Alle'),
    h('option', { value: 'stern' }, 'Nur ★'),
    h('option', { value: 'voll' }, 'Vollständig'),
    h('option', { value: 'fehlt' }, 'Fehlt noch etwas'),
    profilFeld() && h('option', { value: 'profil' }, `${profilFeld().label}: noch nicht Ja`));
  if (filter === 'profil' && !profilFeld()) filter = 'alle';
  filterFeld.value = filter;
  const genutzt = [...new Set([...state.plattformen, ...state.personen.map(p => p.plattform).filter(Boolean)])];
  const plattformFeld = h('select', { onchange: e => { plattformFilter = e.target.value; zeichne(); } },
    h('option', { value: '' }, 'Alle Plattformen'),
    genutzt.map(p => h('option', { value: p }, p)),
    h('option', { value: '-' }, 'Ohne Plattform'));
  plattformFeld.value = genutzt.includes(plattformFilter) || plattformFilter === '-' ? plattformFilter : '';
  plattformFilter = plattformFeld.value;
  const sortFeld = h('select', { onchange: e => { sortierung = e.target.value; zeichne(); } },
    h('option', { value: 'nickname' }, 'Sortierung: Name'),
    h('option', { value: 'geaendert' }, 'Zuletzt geändert'),
    h('option', { value: 'luecken' }, 'Meiste Lücken zuerst'),
    h('option', { value: 'stern' }, '★ zuerst'),
    h('option', { value: 'naechste', disabled: !state.standort }, 'Nächste zuerst'));
  if (sortierung === 'naechste' && !state.standort) sortierung = 'nickname';
  sortFeld.value = sortierung;

  // Umkreis / Regionen
  if (umkreis && !String(umkreis).startsWith('r:') && !state.standort) umkreis = '';
  const umkreisFeld = h('select', { onchange: e => { umkreis = e.target.value; zeichne(); regionenZeichnen(); } },
    h('option', { value: '' }, 'Entfernung: alle'),
    [10, 25, 50, 100, 150, 300].map(k => h('option', { value: String(k), disabled: !state.standort }, `bis ${k} km von mir`)),
    REGIONEN.map(r => h('option', { value: 'r:' + r.name }, `Region ${r.name} (${r.radius} km)`)));
  umkreisFeld.value = String(umkreis);

  const standortZeile = h('div', { class: 'zeile klein' },
    h('span', {}, '📍 ', state.standort ? `Ich bin: ${state.standort.name}` : 'Mein Standort ist nicht gesetzt'),
    h('button', { onclick: async () => { if (await standortDialog()) neuZeichnen(); } }, state.standort ? 'ändern' : 'Wo bin ich?'));

  const regionen = h('div', { class: 'zeile' });
  function regionenZeichnen() {
    regionen.replaceChildren(...REGIONEN.map(r => {
      const drin = state.personen.filter(p => { const o = ortVon(p); return o && km(r, o) <= r.radius; });
      const sterne = drin.filter(p => p.interessant).length;
      const aktiv = umkreis === 'r:' + r.name;
      return h('button', { class: 'region' + (aktiv ? ' primaer' : ''), onclick: () => {
        umkreis = aktiv ? '' : 'r:' + r.name;
        umkreisFeld.value = umkreis;
        zeichne();
        regionenZeichnen();
      } }, `${r.name} ±${r.radius} km: ${drin.length}${sterne ? ` (${sterne} ★)` : ''}`);
    }));
    const ohneOrt = state.personen.filter(p => !ortVon(p)).length;
    if (ohneOrt) regionen.append(h('span', { class: 'leise klein' }, `${ohneOrt} ohne bekannten Ort`));
  }
  regionenZeichnen();

  main.append(
    h('div', { class: 'zeile' }, h('h1', { style: 'flex:1;margin:0' }, 'Übersicht'), h('button', { class: 'primaer', onclick: neuAnlegen }, '+ Neue Person')),
    syncLeiste(),
    standortZeile,
    regionen,
    h('div', { class: 'werkzeug' }, sucheFeld, plattformFeld, umkreisFeld, filterFeld, sortFeld),
    zaehler,
    liste);
  zeichne();
}

async function neuAnlegen() {
  const pf = plattformAuswahl();
  const nick = h('input', { type: 'text', placeholder: 'Nickname' });
  const fehler = h('p', { class: 'fehler' });
  const r = await dialog('Neue Person', [h('label', {}, 'Wo kennengelernt? (Plattform)', pf.el), h('label', {}, 'Nickname', nick), fehler], [
    { text: 'Abbrechen', wert: null },
    {
      text: 'Anlegen', klasse: 'primaer',
      pruefen: () => {
        if (!pf.lesen()) { fehler.textContent = 'Bitte zuerst die Plattform wählen.'; pf.markieren(); return false; }
        if (!nick.value.trim()) { fehler.textContent = 'Bitte einen Nickname eingeben.'; nick.focus(); return false; }
        return true;
      },
      wert: () => ({ plattform: pf.lesen(), nickname: nick.value.trim() }),
    },
  ]);
  if (!r) return;
  const p = neuePerson(r.nickname);
  p.plattform = r.plattform;
  await speicherePerson(p);
  geheZu('#/person/' + encodeURIComponent(p.id));
}

// ---------------- Detail ----------------

export async function zeigePerson(main, id) {
  const p = state.personen.find(x => x.id === id);
  if (!p) {
    main.append(h('p', {}, 'Person nicht gefunden. '), h('a', { href: '#/' }, 'Zur Übersicht'));
    return;
  }
  const speichern = async () => { await speicherePerson(p); neuZeichnen(); };

  // Kopf
  const kopf = h('div', { class: 'person-kopf' },
    (() => {
      const b = bildOderPlatzhalter(p, 'hauptbild', true);
      if (p.hauptfoto) {
        b.title = 'Antippen: Foto ansehen / Ausschnitt anpassen';
        b.addEventListener('click', () => fotoAnsicht(p, p.hauptfoto, speichern));
      }
      return b;
    })(),
    h('div', { style: 'flex:1;min-width:200px' },
      h('h1', {}, p.nickname || '(ohne Nickname)'),
      p.name && h('div', { class: 'leise' }, p.name),
      h('div', { class: 'zeile' },
        h('button', { class: 'plattform', title: 'Plattform ändern', onclick: () => plattformAendern(p, speichern) },
          p.plattform ? `${p.plattform} ✎` : 'Plattform festlegen ✎')),
      h('div', { class: 'zeile' },
        h('button', { class: 'sternknopf' + (p.interessant ? ' an' : ''), title: 'interessant', onclick: async () => { p.interessant = !p.interessant; await speichern(); } }, p.interessant ? '★' : '☆'),
        h('button', { onclick: () => namenBearbeiten(p, speichern) }, 'Nickname/Name ändern')),
      (() => { const f = fortschritt(p); return h('div', { class: 'leise klein' }, `${f.k} von ${f.n} Fakten`); })()));

  // Noch keine Angaben (z. B. gerade angelegt) → Einfügefeld groß und ganz oben
  const leer = fortschritt(p).k === 0;
  const einfuegen = einfuegenBox(p, { gross: leer });
  main.append(...[h('p', {}, h('a', { href: '#/' }, '← Übersicht')), kopf, leer && einfuegen.el, kontaktBox(p), faktenBox(p, speichern),
    !leer && einfuegen.el, erfragenBox(p), fotoBox(p, speichern), notizBox(p), verlaufBox(p)].filter(Boolean),
    h('div', { class: 'zeile' }, h('button', { class: 'gefahr', onclick: async () => {
      if (!(await bestaetigen(`„${p.nickname}“ mit allen Fakten und Fotos endgültig löschen? Das lässt sich nicht rückgängig machen.`, 'Endgültig löschen'))) return;
      await loeschePerson(p);
      toast('Person gelöscht');
      geheZu('#/');
    } }, 'Person löschen')));
  // Am PC gleich ins Einfügefeld springen (am Handy nicht – sonst springt die Tastatur auf)
  if (leer && !window.matchMedia('(pointer: coarse)').matches) setTimeout(() => einfuegen.fokus(), 50);
}

async function plattformAendern(p, speichern) {
  const pf = plattformAuswahl(p.plattform || '');
  const r = await dialog('Wo kennengelernt?', h('label', {}, 'Plattform', pf.el), [
    { text: 'Abbrechen', wert: null },
    { text: 'Speichern', klasse: 'primaer', wert: () => ({ wert: pf.lesen() }) },
  ]);
  if (!r) return;
  p.plattform = r.wert || null;
  await speichern();
}

async function namenBearbeiten(p, speichern) {
  const nick = h('input', { type: 'text', value: p.nickname || '' });
  const name = h('input', { type: 'text', value: p.name || '' });
  const ok = await dialog('Nickname / Name', [h('label', {}, 'Nickname (Anzeige)', nick), h('label', {}, 'Name (optional)', name)], [
    { text: 'Abbrechen', wert: false },
    { text: 'Speichern', klasse: 'primaer', wert: true },
  ]);
  if (!ok) return;
  p.nickname = nick.value.trim() || p.nickname;
  p.name = name.value.trim() || null;
  await speichern();
}

function kontaktBox(p) {
  const tel = wert(p, 'handy');
  const line = wert(p, 'line_id');
  if (!tel && !line) return null;
  const knoepfe = [];
  if (tel) {
    knoepfe.push(h('a', { class: 'knopf', href: 'tel:' + tel }, '📞 Anrufen'));
    if (p.kontakt.handy_ist_whatsapp) knoepfe.push(h('a', { class: 'knopf', href: 'https://wa.me/' + digits(tel), target: '_blank', rel: 'noopener noreferrer' }, '💬 WhatsApp'));
  }
  if (line) knoepfe.push(h('a', { class: 'knopf', href: 'https://line.me/ti/p/~' + encodeURIComponent(String(line).replace(/^[@~]/, '')), target: '_blank', rel: 'noopener noreferrer' }, '💬 LINE'));
  const hinweis = tel && !String(tel).startsWith('+') ? h('p', { class: 'warn klein' }, 'Die Nummer hat keine Ländervorwahl – WhatsApp braucht sie. Unter „Handy“ ergänzen.') : null;
  return h('div', { class: 'box' }, h('h2', {}, 'Kontakt'), h('div', { class: 'zeile' }, knoepfe), hinweis);
}

function faktenBox(p, speichern) {
  const zeilen = state.felder.map(f => {
    const fakt = p.fakten[f.key];
    const v = wert(p, f.key);
    let anzeige = formatWert(f, v);
    if (f.key === 'handy' && v && p.kontakt.handy_ist_whatsapp) anzeige += '  (WhatsApp)';
    return h('div', { class: 'fakt', onclick: () => faktBearbeiten(p, f, speichern) },
      h('strong', {}, f.label),
      h('div', {},
        h('div', { class: v === null ? 'leer-wert' : '' }, v === null ? 'fehlt noch' : anzeige),
        fakt && (fakt.datum || fakt.beleg) && h('div', { class: 'leise klein' }, [datumDE(fakt.datum), fakt.beleg && `„${fakt.beleg}“`].filter(Boolean).join(' · ')),
        f.key === 'wohnort' && v !== null && ortZeile(p, speichern),
        v !== null && eigeneAngabeArt(f.key, v) && h('div', { class: 'warn klein' },
          eigeneAngabeArt(f.key, v) === 'sicher' ? '⚠️ Das ist deine eigene Angabe. ' : '⚠️ Gleich wie deine eigene Angabe – stammt das von dir? ',
          h('button', { class: 'plattform', onclick: async e => {
            e.stopPropagation();
            setzeFakt(p, f.key, null);
            await speichern();
          } }, 'Entfernen'))),
      h('span', { class: 'leise' }, '✎'));
  });
  // Werte von gelöschten Feldern
  const weitere = Object.entries(p.fakten).filter(([k]) => !feldDef(k));
  return h('div', { class: 'box' }, h('h2', {}, 'Fakten'), zeilen,
    weitere.length > 0 && h('details', { style: 'margin-top:12px' }, h('summary', {}, `Weitere Angaben (${weitere.length})`),
      weitere.map(([k, f]) => h('div', { class: 'leise klein' }, `${k}: ${f.wert}${f.beleg ? ` („${f.beleg}“)` : ''}`))));
}

function ortZeile(p, speichern) {
  const o = ortVon(p);
  const s = streckeZu(p);
  const knopf = text => h('button', { class: 'plattform', onclick: e => { e.stopPropagation(); ortZuordnen(p, speichern); } }, text);
  if (!o) return h('div', { class: 'warn klein' }, '📍 Ort nicht in der Liste – ', knopf('Ort zuordnen'));
  return h('div', { class: 'klein' },
    `📍 ${o.ort}${o.manuell ? ' (von Hand)' : ''}`,
    s ? h('strong', {}, ` · ${streckeText(s)} von dir`) : h('span', { class: 'leise' }, ' · Standort in der Übersicht setzen, um die Entfernung zu sehen'),
    ' ', knopf('ändern'));
}

async function faktBearbeiten(p, feld, speichern) {
  const fakt = p.fakten[feld.key];
  const ein = feldEingabe(feld, fakt?.wert);
  const beleg = h('input', { type: 'text', value: fakt?.beleg || '', placeholder: 'Woher stammt die Angabe? (optional)' });
  const datum = h('input', { type: 'date', value: fakt?.datum || heute() });
  const wa = feld.key === 'handy' ? h('input', { type: 'checkbox', checked: !!p.kontakt.handy_ist_whatsapp }) : null;
  const knoepfe = [{ text: 'Abbrechen', wert: null }];
  if (fakt) knoepfe.push({ text: 'Leeren', wert: 'leeren', klasse: 'gefahr' });
  knoepfe.push({ text: 'Speichern', wert: 'speichern', klasse: 'primaer' });
  const r = await dialog(feld.label, [
    h('label', {}, feld.label, ein.el),
    wa && h('label', { class: 'haken' }, wa, 'Nummer ist auch WhatsApp'),
    h('label', {}, 'Beleg', beleg),
    h('label', {}, 'Datum', datum),
  ], knoepfe);
  if (!r) return;
  if (r === 'leeren') setzeFakt(p, feld.key, null);
  else setzeFakt(p, feld.key, ein.lesen(), beleg.value.trim(), datum.value || heute());
  if (wa && r === 'speichern') p.kontakt.handy_ist_whatsapp = wa.checked;
  await speichern();
}

function erfragenBox(p) {
  const fehlend = state.felder.filter(f => wert(p, f.key) === null && f.frage);
  if (!fehlend.length) return h('div', { class: 'box' }, h('h2', {}, 'Noch erfragen'), h('p', { class: 'neu' }, '✅ Alles vollständig.'));
  const text = h('textarea', { rows: Math.min(8, fehlend.length + 1) });
  const haken = fehlend.map(f => h('input', { type: 'checkbox', checked: true, onchange: aktualisieren }));
  function aktualisieren() {
    text.value = fehlend.filter((f, i) => haken[i].checked).map(f => f.frage).join('\n');
  }
  aktualisieren();
  return h('div', { class: 'box' },
    h('h2', {}, 'Noch erfragen'),
    fehlend.map((f, i) => h('label', { class: 'haken' }, haken[i], `${f.label}: `, h('span', { class: 'leise' }, f.frage))),
    h('p', { class: 'leise klein' }, 'Nachricht (kann vor dem Kopieren angepasst werden):'),
    text,
    h('div', { class: 'zeile' }, h('button', { class: 'primaer', onclick: () => copyText(text.value) }, 'Kopieren')));
}

function fotoBox(p, speichern) {
  const galerie = h('div', { class: 'galerie' });
  for (const id of p.fotos) {
    const img = h('img', { alt: '' });
    ausschnittAnwenden(img, ausschnitt(p, id));
    vorschauUrl(id).then(u => { if (u) img.src = u; });
    galerie.append(h('button', { type: 'button', class: 'foto' + (id === p.hauptfoto ? ' haupt' : ''), onclick: () => fotoAnsicht(p, id, speichern) },
      img, id === p.hauptfoto && h('span', { class: 'badge' }, 'Hauptfoto')));
  }

  async function hochladen(dateien) {
    const bilder = dateien.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name));
    if (!bilder.length) return;
    toast(`${bilder.length} Foto(s) werden verarbeitet …`, 10000);
    let ok = 0;
    for (const f of bilder) {
      try { await fotoHinzufuegen(p, f); ok++; } catch (e) { toast(e.message, 5000); }
    }
    await speichern();
    if (ok) toast(`${ok} Foto(s) gespeichert`);
  }

  const datei = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: e => hochladen([...e.target.files]) });
  const kamera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: e => hochladen([...e.target.files]) });
  const box = h('div', { class: 'box' },
    h('h2', {}, `Fotos (${p.fotos.length})`),
    galerie,
    h('div', { class: 'zeile' },
      h('button', { onclick: () => datei.click() }, '🖼 Fotos wählen'),
      h('button', { onclick: () => kamera.click() }, '📷 Kamera'),
      h('button', { onclick: async () => {
        try { await hochladen(await bilderAusZwischenablage()); } catch (e) { toast(e.message, 6000); }
      } }, '📋 Bild einfügen')),
    h('p', { class: 'leise klein' }, 'Am PC: Bildausschnitt mit Windows+Umschalt+S ausschneiden, dann hier Strg+V drücken (oder „Bild einfügen“). Bilder können auch hierher gezogen werden.'),
    datei, kamera);
  // Strg+V irgendwo auf der Personenseite: eingefügte Bilder werden zu Fotos (Text bleibt, wo er ist)
  const beimEinfuegen = e => {
    if (!box.isConnected) { window.removeEventListener('paste', beimEinfuegen); return; }
    const bilder = bilderAusEinfuegen(e);
    if (!bilder.length) return;
    if (!e.clipboardData?.types?.includes('text/plain')) e.preventDefault();   // Text (falls dabei) normal einfügen lassen
    hochladen(bilder);
  };
  window.addEventListener('paste', beimEinfuegen);
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drop'); });
  box.addEventListener('dragleave', () => box.classList.remove('drop'));
  box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drop'); hochladen([...e.dataTransfer.files]); });
  return box;
}

async function fotoAnsicht(p, id, speichern) {
  const url = await grossUrl(id);
  const r = await dialog('Foto', h('img', { class: 'gross', src: url || '', alt: '' }), [
    { text: 'Löschen', wert: 'loeschen', klasse: 'gefahr' },
    { text: '✂ Ausschnitt anpassen', wert: 'ausschnitt' },
    id !== p.hauptfoto && { text: 'Als Hauptfoto', wert: 'haupt' },
    { text: 'Schließen', wert: null, klasse: 'primaer' },
  ].filter(Boolean));
  if (url) URL.revokeObjectURL(url);
  if (r === 'ausschnitt') await ausschnittDialog(p, id, speichern);
  if (r === 'haupt') { p.hauptfoto = id; await speichern(); }
  if (r === 'loeschen' && await bestaetigen('Dieses Foto endgültig löschen?', 'Löschen')) {
    await fotoLoeschen(p, id);
    await speichern();
  }
}

function notizBox(p) {
  const ta = h('textarea', { rows: 5 });
  ta.value = p.notizen || '';
  const sichern = async () => {
    if (ta.value === (p.notizen || '')) return;
    p.notizen = ta.value;
    await speicherePerson(p);
    toast('Notizen gespeichert');
  };
  ta.addEventListener('change', sichern);
  return h('div', { class: 'box' }, h('h2', {}, 'Notizen'), ta,
    h('div', { class: 'zeile' }, h('button', { onclick: sichern }, 'Notizen speichern')));
}

function verlaufBox(p) {
  if (!p.verlauf.length) return null;
  return h('div', { class: 'box' }, h('details', {},
    h('summary', {}, `Verlauf – frühere Werte (${p.verlauf.length})`),
    [...p.verlauf].reverse().map(v => {
      const f = feldDef(v.feld);
      return h('div', { class: 'klein', style: 'padding:6px 0;border-bottom:1px solid var(--rand)' },
        h('strong', {}, (f?.label || v.feld) + ': '), formatWert(f, v.wert),
        h('div', { class: 'leise' }, [v.datum && `vom ${datumDE(v.datum)}`, v.beleg && `„${v.beleg}“`, `ersetzt am ${datumDE(v.ersetzt)}`].filter(Boolean).join(' · ')));
    })));
}
