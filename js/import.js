// Seite „Einfügen“: Block aus dem Claude-Projekt einlesen, mit vorhandenen Daten abgleichen, übernehmen.
import { state, wert, setzeFakt, speicherePerson, neuePerson, feldDef, speichereFelder } from './store.js';
import { h, toast, normTelefon, telefonGleich, parseWert, gleich, formatWert, heute, geheZu, neuZeichnen } from './util.js';
import { feldBearbeitenDialog } from './felder.js';
import { erkenne, istBlock } from './erkennung.js';
import { plattformAuswahl, plattformVorschlag } from './plattform.js';
import { fotoHinzufuegen, bilderAusEinfuegen, bilderAusZwischenablage } from './fotos.js';

// ---------------- Einlesen ----------------

/** Liest alle ===PERSONEN-DATEN=== … ===ENDE===-Blöcke (oder notfalls reines JSON) aus dem Text. */
export function parseBlock(text) {
  const bloecke = [];
  const re = /===\s*PERSONEN-DATEN\s*===([\s\S]*?)(?:===\s*ENDE\s*===|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) bloecke.push(m[1]);
  if (!bloecke.length) bloecke.push(text);
  const personen = [];
  for (const b of bloecke) {
    const d = jsonLesen(b);
    if (Array.isArray(d?.personen)) personen.push(...d.personen);
    else if (d && typeof d === 'object' && (d.nickname || d.fakten || d.kontakt)) personen.push(d);
  }
  return personen;
}

function jsonLesen(b) {
  let t = b.replace(/```[a-zA-Z]*\s*/g, '');
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('Im Text wurde kein JSON gefunden.');
  t = t.slice(s, e + 1);
  try {
    return JSON.parse(t);
  } catch (fehler1) {
    // Häufige Kopierfehler reparieren: typografische Anführungszeichen, Komma vor } oder ]
    const t2 = t.replace(/[“”„]/g, '"').replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(t2); } catch { throw new Error('Das JSON ist fehlerhaft (' + fehler1.message + ').'); }
  }
}

/** Eine eingelesene Person in eine einheitliche Form bringen. */
function normalisiere(roh) {
  const werte = {};
  for (const [k0, v] of Object.entries(roh.fakten || {})) {
    const key = String(k0).trim().toLowerCase();
    const o = v && typeof v === 'object' && !Array.isArray(v) ? v : { wert: v };
    if (o.wert === null || o.wert === undefined || o.wert === '') continue;
    const f = feldDef(key);
    werte[key] = { wert: f ? (parseWert(f.typ, o.wert) ?? o.wert) : o.wert, beleg: o.beleg ? String(o.beleg) : '' };
  }
  const k = roh.kontakt || {};
  if (k.handy) werte.handy = { wert: normTelefon(k.handy), beleg: '' };
  if (k.line_id) werte.line_id = { wert: String(k.line_id).trim().replace(/^[@~]/, ''), beleg: '' };
  const sonst = Array.isArray(roh.sonstiges) ? roh.sonstiges : roh.sonstiges ? [roh.sonstiges] : [];
  return {
    nickname: String(roh.nickname || '').trim(),
    name: roh.name ? String(roh.name).trim() : null,
    werte,
    whatsapp: !!(k.whatsapp || k.handy_ist_whatsapp),
    sonstiges: sonst.map(String).filter(s => s.trim()),
  };
}

/** Passende vorhandene Person suchen: Handy → LINE-ID → Nickname. */
function finde(imp) {
  const tel = imp.werte.handy?.wert;
  const line = imp.werte.line_id ? String(imp.werte.line_id.wert).toLowerCase() : null;
  const nick = imp.nickname.toLowerCase();
  if (tel) {
    const p = state.personen.find(x => telefonGleich(wert(x, 'handy'), tel));
    if (p) return { p, grund: 'Handynummer' };
  }
  if (line) {
    const p = state.personen.find(x => String(wert(x, 'line_id') || '').toLowerCase().replace(/^[@~]/, '') === line);
    if (p) return { p, grund: 'LINE-ID' };
  }
  if (nick) {
    const p = state.personen.find(x => (x.nickname || '').trim().toLowerCase() === nick);
    if (p) return { p, grund: 'Nickname' };
  }
  return null;
}

// ---------------- Abgleich-Karte pro Person ----------------

function importKarte(imp, alleNeuZeichnen, vorschlag = '', festeZielId = null) {
  const treffer = festeZielId ? null : finde(imp);
  let zielId = festeZielId || (treffer ? treffer.p.id : 'neu');
  let ueberspringen = false;
  let plattform = vorschlag;
  let pfAuswahl = null;
  let aktionen = [];   // Funktionen (p) => void, die beim Speichern ausgeführt werden
  let notizen = [];    // Funktionen () => Text|null
  let nickInput = null;
  const el = h('div', { class: 'box' });

  const zeile = (label, inhalt) => h('div', { class: 'imp-zeile' }, h('strong', {}, label), inhalt);
  const belegEl = n => (n.beleg ? h('div', { class: 'beleg' }, `„${n.beleg}“`) : null);

  async function alsFeldAnlegen(vorlage, wertText, alterKey) {
    const f = await feldBearbeitenDialog(vorlage, true);
    if (!f) return;
    state.felder.push(f);
    await speichereFelder();
    if (alterKey !== undefined) {
      const n = imp.werte[alterKey];
      delete imp.werte[alterKey];
      imp.werte[f.key] = { wert: parseWert(f.typ, n.wert) ?? n.wert, beleg: n.beleg };
    } else {
      // Bei „Beschriftung: Wert“ nur den Wert übernehmen
      const m = wertText.match(/^[^:]{1,30}:\s*(.+)$/);
      const nurWert = m ? m[1].trim() : wertText;
      imp.werte[f.key] = { wert: parseWert(f.typ, nurWert) ?? nurWert, beleg: wertText };
      imp.sonstiges = imp.sonstiges.filter(s => s !== wertText);
    }
    toast(`Feld „${f.label}“ angelegt – Projekt-Anweisung in Claude später aktualisieren`);
    alleNeuZeichnen();
  }

  function render() {
    if (pfAuswahl) plattform = pfAuswahl.lesen();
    pfAuswahl = null;
    aktionen = [];
    notizen = [];
    nickInput = null;
    const ziel = zielId === 'neu' ? null : state.personen.find(p => p.id === zielId);

    const auswahl = h('select', { onchange: e => { zielId = e.target.value; render(); } },
      h('option', { value: 'neu' }, '➕ Neue Person anlegen'),
      [...state.personen].sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'de'))
        .map(p => h('option', { value: p.id }, p.nickname + (p.name ? ` (${p.name})` : ''))));
    auswahl.value = zielId;

    const inhalt = h('div');
    inhalt.hidden = ueberspringen;
    const skip = h('input', { type: 'checkbox', checked: ueberspringen, onchange: e => { ueberspringen = e.target.checked; inhalt.hidden = ueberspringen; } });

    // Plattform zuerst – Pflicht bei neuen Personen, Angebot bei bestehenden ohne Plattform
    let pfLabel = null;
    if (!ziel || !ziel.plattform) {
      pfAuswahl = plattformAuswahl(plattform);
      pfLabel = h('label', {},
        !ziel ? 'Wo kennengelernt? (Plattform)' : 'Plattform (bisher nicht festgelegt, optional)',
        pfAuswahl.el,
        vorschlag && plattform === vorschlag && h('span', { class: 'leise klein' }, `„${vorschlag}“ wurde im Text erkannt – bitte prüfen.`));
      if (ziel) inhalt.append(pfLabel);   // bei neuer Person steht sie ganz oben (siehe unten)
    }

    if (!ziel) {
      nickInput = h('input', { type: 'text', value: imp.nickname });
      inhalt.append(h('label', {}, 'Nickname der neuen Person', nickInput));
    } else if (imp.nickname && imp.nickname.toLowerCase() !== (ziel.nickname || '').toLowerCase()) {
      inhalt.append(h('p', { class: 'leise klein' }, `Im Text heißt die Person „${imp.nickname}“.`));
    }

    // Name
    if (imp.name && (!ziel || !gleich('text', ziel.name, imp.name))) {
      const cb = h('input', { type: 'checkbox', checked: !ziel || !ziel.name });
      inhalt.append(zeile('Name', h('div', {},
        ziel?.name ? h('div', { class: 'warn' }, `⚠️ bisher: ${ziel.name}`) : null,
        h('label', { class: 'haken' }, cb, h('span', { class: 'neu' }, ziel?.name ? 'stattdessen: ' : '✅ neu: '), imp.name))));
      aktionen.push(p => { if (cb.checked) p.name = imp.name; });
    }

    // Definierte Felder
    for (const f of state.felder) {
      const n = imp.werte[f.key];
      const a = ziel ? wert(ziel, f.key) : null;
      if (!n) {
        inhalt.append(zeile(f.label, a === null
          ? h('span', { class: 'fehlt' }, '❌ fehlt noch')
          : h('span', { class: 'leise' }, formatWert(f, a))));
        continue;
      }
      if (a === null) {
        const cb = h('input', { type: 'checkbox', checked: true });
        inhalt.append(zeile(f.label, h('div', {}, h('label', { class: 'haken' }, cb, h('span', { class: 'neu' }, '✅ neu: '), formatWert(f, n.wert)), belegEl(n))));
        aktionen.push(p => { if (cb.checked) setzeFakt(p, f.key, n.wert, n.beleg); });
      } else if (gleich(f.typ, a, n.wert)) {
        inhalt.append(zeile(f.label, h('div', {}, h('span', { class: 'neu' }, '✅ schon vorhanden: '), formatWert(f, a))));
        if (n.beleg && !ziel.fakten[f.key]?.beleg) aktionen.push(p => { if (p.fakten[f.key]) p.fakten[f.key].beleg = n.beleg; });
      } else {
        const gruppe = 'w' + Math.random().toString(36).slice(2);
        const rAlt = h('input', { type: 'radio', name: gruppe, checked: true });
        const rNeu = h('input', { type: 'radio', name: gruppe });
        inhalt.append(zeile(f.label, h('div', {},
          h('div', { class: 'warn' }, '⚠️ Widerspruch – bitte wählen:'),
          h('label', { class: 'haken' }, rAlt, 'bisher: ', formatWert(f, a)),
          h('label', { class: 'haken' }, rNeu, 'neu: ', formatWert(f, n.wert)),
          belegEl(n))));
        aktionen.push(p => { if (rNeu.checked) setzeFakt(p, f.key, n.wert, n.beleg); });
      }
    }

    // WhatsApp-Haken
    if (imp.whatsapp && imp.werte.handy && !(ziel && ziel.kontakt.handy_ist_whatsapp)) {
      const cb = h('input', { type: 'checkbox', checked: true });
      inhalt.append(zeile('WhatsApp', h('label', { class: 'haken' }, cb, h('span', { class: 'neu' }, '✅ Handynummer ist WhatsApp'))));
      aktionen.push(p => { if (cb.checked) p.kontakt.handy_ist_whatsapp = true; });
    }

    // Angaben mit unbekanntem Schlüssel
    for (const k of Object.keys(imp.werte).filter(k => !feldDef(k))) {
      const n = imp.werte[k];
      const cb = h('input', { type: 'checkbox', checked: true });
      inhalt.append(zeile(k, h('div', {},
        h('div', { class: 'warn' }, `Unbekanntes Feld: ${n.wert}`), belegEl(n),
        h('div', { class: 'zeile' },
          h('label', { class: 'haken' }, cb, 'in Notizen'),
          h('button', { type: 'button', onclick: () => alsFeldAnlegen({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1), typ: typeof n.wert === 'number' ? 'zahl' : 'text', frage: '' }, null, k) }, 'Als neues Feld anlegen')))));
      notizen.push(() => (cb.checked ? `${k}: ${n.wert}` : null));
    }

    // Sonstiges
    for (const s of imp.sonstiges) {
      const cb = h('input', { type: 'checkbox', checked: true });
      inhalt.append(zeile('Sonstiges', h('div', {},
        h('div', {}, s),
        h('div', { class: 'zeile' },
          h('label', { class: 'haken' }, cb, 'in Notizen'),
          h('button', { type: 'button', onclick: () => {
            const m = s.match(/^([^:]{1,30}):\s*(.+)$/);
            const label = m ? m[1].trim() : '';
            alsFeldAnlegen({ key: '', label, typ: m && /^\s*-?\d+([.,]\d+)?\s*$/.test(m[2]) ? 'zahl' : 'text', frage: '', woerter: label }, s);
          } }, 'Als neues Feld anlegen')))));
      notizen.push(() => (cb.checked ? s : null));
    }

    if (festeZielId) {
      // Auswertung direkt in einer Person: keine Zuordnung nötig
      el.replaceChildren(h('p', { class: 'leise klein' }, 'Gefundene Angaben – abhaken, was übernommen werden soll:'), inhalt);
      return;
    }
    el.replaceChildren(
      h('h2', {}, imp.nickname || '(ohne Nickname)'),
      h('p', { class: 'leise klein' }, treffer && zielId === treffer.p.id ? `Erkannt über ${treffer.grund}.` : treffer ? '' : 'Keine passende Person gefunden.'),
      !ziel && !ueberspringen ? pfLabel : '',
      h('label', {}, 'Zuordnen zu', auswahl),
      h('label', { class: 'haken' }, skip, 'Diese Person nicht übernehmen'),
      inhalt);
  }

  /** Ist alles Nötige ausgefüllt? (Neue Person braucht eine Plattform.) */
  function pruefen() {
    if (ueberspringen || zielId !== 'neu') return true;
    if (pfAuswahl && pfAuswahl.lesen()) return true;
    pfAuswahl?.markieren();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return false;
  }

  async function anwenden() {
    if (ueberspringen) return null;
    let p = zielId === 'neu' ? null : state.personen.find(x => x.id === zielId);
    if (!p) p = neuePerson((nickInput?.value || '').trim() || imp.nickname || 'Ohne Name');
    const pl = pfAuswahl?.lesen();
    if (pl) p.plattform = pl;
    for (const a of aktionen) a(p);
    const texte = notizen.map(f => f()).filter(Boolean);
    if (texte.length) p.notizen = (p.notizen ? p.notizen.trimEnd() + '\n' : '') + `[${heute()}] ` + texte.join('; ');
    await speicherePerson(p);
    return p;
  }

  render();
  return { el, render, anwenden, pruefen };
}

// ---------------- Feld „Text einfügen“ direkt in einer Person ----------------

/** Box für die Personenseite: Text hineinkopieren → Angaben werden in diese Person sortiert. */
export function einfuegenBox(p, { gross = false } = {}) {
  const ta = h('textarea', { rows: gross ? 10 : 5, placeholder: 'Hier alles hineinkopieren (Strg+V): Profilseite, Chat oder Notizen. Die App sortiert Alter, Größe, Wohnort, Kinder, Single usw. selbst in die Felder. Kopierte Bilder werden zu Fotos.' });
  const ergebnis = h('div');

  function auswerten() {
    const text = ta.value;
    if (!text.trim()) { toast('Bitte zuerst Text einfügen'); return; }
    let roh;
    try {
      roh = istBlock(text) ? parseBlock(text)[0] : erkenne(text);
    } catch (e) {
      ergebnis.replaceChildren(h('p', { class: 'fehler' }, 'Konnte den Text nicht lesen: ' + e.message));
      return;
    }
    if (!roh) { ergebnis.replaceChildren(h('p', { class: 'fehler' }, 'Keine Angaben gefunden.')); return; }
    const imp = normalisiere(roh);
    const n = Object.keys(imp.werte).length;
    let karte;
    karte = importKarte(imp, () => karte.render(), '', p.id);
    const speichern = h('button', { class: 'primaer', onclick: async () => {
      speichern.disabled = true;
      await karte.anwenden();
      toast('Angaben übernommen');
      neuZeichnen();
    } }, 'Ausgewähltes übernehmen');
    ergebnis.replaceChildren(
      h('p', { class: 'leise klein' }, (n ? `${n} Angabe(n) gefunden.` : 'Keine bekannten Angaben gefunden.') + (roh.eigeneZeilen ? ` ${roh.eigeneZeilen} Zeile(n) von dir ignoriert.` : '')),
      karte.el,
      h('div', { class: 'zeile' }, speichern, h('button', { onclick: () => { ergebnis.replaceChildren(); } }, 'Verwerfen')));
  }

  const box = h('div', { class: 'box' + (gross ? ' hervor' : '') },
    h('h2', {}, '📋 Text einfügen und auswerten'),
    gross && h('p', { class: 'leise klein' }, 'Kopiere jetzt das Profil bzw. den Chat dieser Person hier hinein – du musst nichts von Hand ausfüllen.'),
    ta,
    h('div', { class: 'zeile' }, h('button', { class: 'primaer', onclick: auswerten }, 'Auswerten')),
    ergebnis);
  // Nach dem Einfügen von Text gleich auswerten
  ta.addEventListener('paste', () => setTimeout(() => { if (ta.value.trim()) auswerten(); }, 50));
  return { el: box, fokus: () => ta.focus() };
}

// ---------------- Seite ----------------

let entwurf = '';   // eingefügter Text bleibt beim Seitenwechsel erhalten
let entwurfBilder = [];   // eingefügte Bilder (werden der Person als Fotos hinzugefügt)

export function zeigeImport(main) {
  const ta = h('textarea', { rows: 10, placeholder: 'Hier den Block aus Claude einfügen (===PERSONEN-DATEN=== … ===ENDE===). Text davor oder danach stört nicht.', oninput: e => { entwurf = e.target.value; } });
  ta.value = entwurf;
  const ergebnis = h('div');

  // Eingefügte Bilder (Strg+V oder Knopf) sammeln und anzeigen
  const bilderLeiste = h('div', { class: 'galerie' });
  const bilderInfo = h('p', { class: 'leise klein' });
  function bilderZeichnen() {
    bilderLeiste.replaceChildren(...entwurfBilder.map((f, i) => {
      const url = URL.createObjectURL(f);
      return h('button', { type: 'button', class: 'foto', title: 'Entfernen', onclick: () => { entwurfBilder.splice(i, 1); bilderZeichnen(); } },
        h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }), h('span', { class: 'badge' }, '✕'));
    }));
    bilderInfo.textContent = entwurfBilder.length ? `${entwurfBilder.length} Bild(er) werden beim Übernehmen als Fotos gespeichert (antippen = entfernen).` : '';
  }
  const beimEinfuegen = e => {
    if (!ta.isConnected) { window.removeEventListener('paste', beimEinfuegen); return; }
    const bilder = bilderAusEinfuegen(e);
    if (!bilder.length) return;
    if (!e.clipboardData?.types?.includes('text/plain')) e.preventDefault();   // Text (falls dabei) normal einfügen lassen
    entwurfBilder.push(...bilder);
    bilderZeichnen();
    toast(`${bilder.length} Bild(er) hinzugefügt`);
  };
  window.addEventListener('paste', beimEinfuegen);
  bilderZeichnen();

  function auswerten() {
    ergebnis.replaceChildren();
    if (!ta.value.trim()) { toast('Bitte zuerst Text einfügen'); return; }
    let liste;
    let art;
    if (istBlock(ta.value)) {
      art = 'Claude-Block erkannt.';
      try {
        liste = parseBlock(ta.value);
      } catch (e) {
        ergebnis.append(h('p', { class: 'fehler' }, 'Konnte den Block nicht lesen: ' + e.message));
        return;
      }
      if (!liste.length) {
        ergebnis.append(h('p', { class: 'fehler' }, 'Im Block wurden keine Personen gefunden.'));
        return;
      }
    } else {
      // Rohtext: Fakten direkt in der App heraussuchen (offline)
      const p = erkenne(ta.value);
      const n = Object.keys(p.fakten).length;
      art = n ? `Automatisch erkannt: ${n} Angabe(n). Bitte prüfen – was fehlt, kannst du später in der Person ergänzen.` : 'Im Text wurden keine bekannten Angaben gefunden.';
      if (p.eigeneZeilen) art += ` ${p.eigeneZeilen} Zeile(n) von dir wurden ignoriert.`;
      else if (!state.eigeneNamen.length) art += ' Tipp: Unter „Felder → Meine Namen“ deinen Benutzernamen eintragen, damit deine eigenen Nachrichten nicht mit ausgewertet werden.';
      liste = [p];
    }
    const karten = [];
    const alleNeu = () => karten.forEach(k => k.render());
    const vorschlag = plattformVorschlag(ta.value);
    for (const roh of liste) karten.push(importKarte(normalisiere(roh), alleNeu, vorschlag));
    const speichern = h('button', { class: 'primaer', onclick: async () => {
      if (!karten.every(k => k.pruefen())) { toast('Bitte zuerst auswählen, wo du die Person kennengelernt hast'); return; }
      speichern.disabled = true;
      const gespeichert = [];
      for (const k of karten) {
        const p = await k.anwenden();
        if (p) gespeichert.push(p);
      }
      // Eingefügte Bilder als Fotos zur (ersten) Person
      let fotos = 0;
      if (entwurfBilder.length && gespeichert[0]) {
        for (const f of entwurfBilder) {
          try { await fotoHinzufuegen(gespeichert[0], f); fotos++; } catch (e) { toast(e.message, 5000); }
        }
        await speicherePerson(gespeichert[0]);
      }
      entwurf = '';
      entwurfBilder = [];
      toast(`${gespeichert.length} Person(en) gespeichert` + (fotos ? `, ${fotos} Foto(s)` : ''));
      geheZu(gespeichert.length === 1 ? '#/person/' + encodeURIComponent(gespeichert[0].id) : '#/');
    } }, 'Ausgewähltes übernehmen');
    ergebnis.append(h('p', { class: 'leise' }, art + (liste.length > 1 ? ` ${liste.length} Personen.` : '')), ...karten.map(k => k.el), h('div', { class: 'zeile' }, speichern));
  }

  ta.placeholder = 'Hier einfach alles einfügen: kopierte Profilseite, Chat oder Notizen (Englisch/Deutsch). Die App sucht Alter, Größe, Gewicht, Job, Wohnort, Kinder, Single, Nummern usw. selbst heraus. Ein Claude-Block (===PERSONEN-DATEN===) geht auch.';
  main.append(
    h('h1', {}, 'Einfügen'),
    h('p', { class: 'leise klein' }, 'Pro Einfügen eine Person. Die Erkennung läuft nur auf diesem Gerät.'),
    ta,
    bilderInfo,
    bilderLeiste,
    h('div', { class: 'zeile' },
      h('button', { class: 'primaer', onclick: auswerten }, 'Auswerten'),
      h('button', { onclick: async () => {
        try { const b = await bilderAusZwischenablage(); entwurfBilder.push(...b); bilderZeichnen(); toast(`${b.length} Bild(er) hinzugefügt`); } catch (e) { toast(e.message, 6000); }
      } }, '📋 Bild einfügen'),
      h('button', { onclick: async () => {
        try {
          ta.value = await navigator.clipboard.readText();
          entwurf = ta.value;
          auswerten();
        } catch {
          toast('Zugriff auf die Zwischenablage nicht erlaubt – bitte mit Strg+V einfügen');
        }
      } }, 'Aus Zwischenablage einfügen'),
      h('button', { onclick: () => { ta.value = ''; entwurf = ''; entwurfBilder = []; bilderZeichnen(); ergebnis.replaceChildren(); } }, 'Leeren')),
    ergebnis);
}
