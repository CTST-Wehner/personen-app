// Datenhaltung: Felder-Einstellungen und Personen (im Speicher + IndexedDB).
import { db } from './db.js';
import { uuid, heute, gleich } from './util.js';

export const TYPEN = { zahl: 'Zahl', text: 'Text', ort: 'Ort', janein: 'Ja/Nein', telefon: 'Telefon' };

// Diese Schlüssel haben Sonderfunktionen (Kontakt-Buttons, Karte) und können nicht umbenannt/gelöscht werden.
export const FEST = ['wohnort', 'handy', 'line_id'];

export const STANDARD_FELDER = [
  { key: 'alter', label: 'Alter', typ: 'zahl', einheit: 'Jahre', bedeutung: 'Alter in Jahren (Zahl)', frage: 'How old are you?' },
  { key: 'groesse', label: 'Größe', typ: 'zahl', einheit: 'cm', bedeutung: 'Körpergröße in cm (Zahl; m bzw. ft/in umrechnen)', frage: 'How tall are you?' },
  { key: 'gewicht', label: 'Gewicht', typ: 'zahl', einheit: 'kg', bedeutung: 'Gewicht in kg (Zahl; lbs umrechnen)', frage: 'How much do you weigh?' },
  { key: 'job', label: 'Job', typ: 'text', bedeutung: 'Beruf / Tätigkeit', frage: 'What do you do for work?' },
  { key: 'wohnort', label: 'Wohnort', typ: 'ort', bedeutung: 'Wohnort als Ort/Stadtteil + Land – **keine Straße/Hausnummer**', frage: 'Where do you live? (city / area)' },
  { key: 'kinder', label: 'Kinder', typ: 'zahl', bedeutung: 'Anzahl Kinder (Zahl, 0 = keine)', frage: 'Do you have children?' },
  { key: 'single', label: 'Single', typ: 'janein', bedeutung: 'Ist die Person Single? (true/false; geschieden/getrennt = true)', frage: 'Are you single?' },
  { key: 'single_seit', label: 'Single seit', typ: 'text', bedeutung: 'Wie lange schon Single (z. B. „2 Jahre“, „seit 2023“)', frage: 'How long have you been single?' },
  { key: 'handy', label: 'Handy', typ: 'telefon', frage: 'What is your phone number?' },
  { key: 'line_id', label: 'LINE-ID', typ: 'text', frage: 'What is your LINE ID?' },
];
// Felder, die mit Version 2 dazugekommen sind (werden bei bestehenden Daten einmalig ergänzt)
const NEU_IN_V2 = ['groesse', 'kinder', 'single', 'single_seit'];

export const STANDARD_PLATTFORMEN = ['Tinder', 'ThaiFriendly'];

export const state = { felder: [], personen: [], plattformen: [], standort: null, geloescht: {}, einstellungenZeit: '' };

// Meldet jede Änderung (für den automatischen Abgleich mit Google Drive)
export const aenderung = new EventTarget();
const gemeldet = () => aenderung.dispatchEvent(new Event('geaendert'));

async function einstellungenGeaendert() {
  state.einstellungenZeit = new Date().toISOString();
  await db.put('meta', state.einstellungenZeit, 'einstellungenZeit');
  gemeldet();
}

export async function speicherePlattformen() {
  await db.put('meta', state.plattformen, 'plattformen');
  await einstellungenGeaendert();
}

export async function laden() {
  state.geloescht = (await db.get('meta', 'geloescht')) || {};
  state.einstellungenZeit = (await db.get('meta', 'einstellungenZeit')) || '';
  const pl = await db.get('meta', 'plattformen');
  state.plattformen = Array.isArray(pl) ? pl : [...STANDARD_PLATTFORMEN];
  state.standort = (await db.get('meta', 'standort')) || null;
  const f = await db.get('meta', 'felder');
  state.felder = Array.isArray(f) && f.length ? f : STANDARD_FELDER.map(x => ({ ...x }));
  const version = (await db.get('meta', 'standardVersion')) || 1;
  if (version < 2) {
    for (const key of NEU_IN_V2) {
      if (state.felder.some(x => x.key === key)) continue;
      const def = { ...STANDARD_FELDER.find(s => s.key === key) };
      const iHandy = state.felder.findIndex(x => x.key === 'handy');
      if (iHandy < 0) state.felder.push(def); else state.felder.splice(iHandy, 0, def);
    }
    await db.put('meta', state.felder, 'felder');   // ohne Zeitstempel: ein neues Gerät soll die Felder aus Drive übernehmen
    await db.put('meta', 2, 'standardVersion');
  }
  state.personen = (await db.alle('personen')).map(ergaenzen);
}

/** Fehlende Teile auffüllen (z. B. bei älteren Backups). */
export function ergaenzen(p) {
  p.fakten ||= {};
  p.kontakt ||= { handy_ist_whatsapp: false };
  p.wohnort ||= { lat: null, lng: null };
  p.fotos ||= [];
  p.verlauf ||= [];
  p.notizen ||= '';
  return p;
}

export async function speichereFelder() {
  await db.put('meta', state.felder, 'felder');
  await einstellungenGeaendert();
}
export const feldDef = key => state.felder.find(f => f.key === key);

export function neuePerson(nickname) {
  const jetzt = new Date().toISOString();
  return ergaenzen({ id: uuid(), nickname: nickname || 'Ohne Name', name: null, interessant: false, hauptfoto: null, erstellt: jetzt, geaendert: jetzt });
}

export async function speicherePerson(p) {
  p.geaendert = new Date().toISOString();
  await db.put('personen', p);
  const i = state.personen.findIndex(x => x.id === p.id);
  if (i < 0) state.personen.push(p); else state.personen[i] = p;
  gemeldet();
}

export async function loeschePerson(p) {
  for (const id of p.fotos || []) await db.del('fotos', id);
  await db.del('personen', p.id);
  state.personen = state.personen.filter(x => x.id !== p.id);
  // merken, damit die Person beim Abgleich nicht von einem anderen Gerät zurückkommt
  state.geloescht[p.id] = new Date().toISOString();
  await db.put('meta', state.geloescht, 'geloescht');
  gemeldet();
}

export function wert(p, key) {
  const v = p.fakten?.[key]?.wert;
  return v === undefined || v === null || v === '' ? null : v;
}

/** Fakt setzen. Ein abweichender alter Wert wandert in den Verlauf. neu = null löscht den Fakt. */
export function setzeFakt(p, key, neu, beleg = '', datum) {
  const typ = feldDef(key)?.typ || 'text';
  const alt = p.fakten[key];
  const leer = neu === null || neu === undefined || neu === '';
  const unveraendert = alt && !leer && gleich(typ, alt.wert, neu);
  if (alt && alt.wert != null && !unveraendert) {
    p.verlauf.push({ feld: key, wert: alt.wert, datum: alt.datum, beleg: alt.beleg, ersetzt: heute() });
  }
  if (leer) delete p.fakten[key];
  else p.fakten[key] = { wert: neu, datum: datum || heute(), beleg: beleg || '' };
  // Neuer Wohnort -> alter Kartenpunkt passt nicht mehr
  if (key === 'wohnort' && !unveraendert) p.wohnort = { lat: null, lng: null };
}

export function fortschritt(p) {
  const n = state.felder.length;
  const k = state.felder.filter(f => wert(p, f.key) !== null).length;
  return { k, n };
}
