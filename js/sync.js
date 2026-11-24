// Abgleich mit Google Drive (verschlüsselt).
// In Drive: Ordner „Personen-App“ mit personen-daten.enc (Personen, Felder, Plattformen) und Unterordner „fotos“ (je Foto eine .enc-Datei).
// Ablauf: herunterladen → entschlüsseln → mit den Daten auf diesem Gerät zusammenführen → Fotos abgleichen → verschlüsselt hochladen.
import { db } from './db.js';
import { state, aenderung, ergaenzen } from './store.js';
import * as drive from './drive.js';
import * as tresor from './tresor.js';

const HAUPTDATEI = 'personen-daten.enc';

export const syncEreignis = new EventTarget();   // 'status' und 'daten' (= Daten haben sich durch den Abgleich geändert)
let status = { zustand: 'aus', text: 'Nicht verbunden' };
export const aktuellerStatus = () => status;
function setze(zustand, text) {
  status = { zustand, text, zeit: new Date().toISOString() };
  syncEreignis.dispatchEvent(new Event('status'));
}

/** Passwort fehlt: neu = noch keine Daten in Drive (neues Passwort festlegen), sonst vorhandenes eingeben. */
export class BrauchtPasswort extends Error {
  constructor(neu, umschlag) {
    super(neu ? 'Bitte ein Passwort für die Verschlüsselung festlegen.' : 'Bitte das Passwort für die Daten in Google Drive eingeben.');
    this.neu = neu;
    this.umschlag = umschlag;
  }
}

/** Passwort übernehmen. Bei vorhandenen Drive-Daten wird geprüft, ob es passt (sonst FalschesPasswort). */
export async function passwortSetzen(passwort, umschlag) {
  if (umschlag) {
    const key = await tresor.schluesselAbleiten(passwort, tresor.ausB64(umschlag.salt), umschlag.iter);
    await tresor.entschluesseln(key, umschlag);   // wirft FalschesPasswort
    await tresor.schluesselSpeichern(key, umschlag.salt);
  } else {
    const salz = tresor.neuesSalz();
    const key = await tresor.schluesselAbleiten(passwort, salz);
    await tresor.schluesselSpeichern(key, tresor.zuB64(salz));
  }
}

// ---------- Zusammenführen (reine Logik, ohne Speichern) ----------

/**
 * lokal/remote: { personen, geloescht, felder, plattformen, einstellungenZeit }
 * Regeln: neuere Fassung einer Person gewinnt; gelöscht gewinnt, wenn das Löschen nach der letzten Änderung war;
 * Felder/Plattformen: der neuere Stand gewinnt komplett.
 */
export function zusammenfuehren(lokal, remote) {
  const personen = new Map(lokal.personen.map(p => [p.id, p]));
  let lokalGeaendert = false;
  const geloescht = { ...(lokal.geloescht || {}) };
  for (const [id, t] of Object.entries(remote.geloescht || {})) if (!geloescht[id] || t > geloescht[id]) geloescht[id] = t;

  for (const rp of remote.personen || []) {
    const lp = personen.get(rp.id);
    if (!lp || (rp.geaendert || '') > (lp.geaendert || '')) { personen.set(rp.id, rp); lokalGeaendert = true; }
  }
  const entfernt = [];
  for (const [id, t] of Object.entries(geloescht)) {
    const p = personen.get(id);
    if (p && t >= (p.geaendert || '')) {
      personen.delete(id);
      if (lokal.personen.some(x => x.id === id)) { entfernt.push(p); lokalGeaendert = true; }
    }
  }
  let einstellungen = null;
  if ((remote.einstellungenZeit || '') > (lokal.einstellungenZeit || '') && Array.isArray(remote.felder)) {
    einstellungen = { felder: remote.felder, plattformen: remote.plattformen || [], eigeneNamen: remote.eigeneNamen || [], ignorieren: remote.ignorieren || [], meineFakten: remote.meineFakten || {}, zeit: remote.einstellungenZeit };
    lokalGeaendert = true;
  }
  return { personen: [...personen.values()], geloescht, entfernt, einstellungen, lokalGeaendert };
}

async function anwenden(erg) {
  const vorher = new Map(state.personen.map(p => [p.id, p]));
  for (const p of erg.personen) if (vorher.get(p.id) !== p) await db.put('personen', ergaenzen(p));
  for (const p of erg.entfernt) {
    for (const id of p.fotos || []) await db.del('fotos', id);
    await db.del('personen', p.id);
  }
  state.personen = erg.personen;
  state.geloescht = erg.geloescht;
  await db.put('meta', state.geloescht, 'geloescht');
  if (erg.einstellungen) {
    state.felder = erg.einstellungen.felder;
    state.plattformen = erg.einstellungen.plattformen;
    state.eigeneNamen = erg.einstellungen.eigeneNamen;
    state.ignorieren = erg.einstellungen.ignorieren;
    state.meineFakten = erg.einstellungen.meineFakten;
    state.einstellungenZeit = erg.einstellungen.zeit;
    await db.put('meta', state.ignorieren, 'ignorieren');
    await db.put('meta', state.meineFakten, 'meineFakten');
    await db.put('meta', state.felder, 'felder');
    await db.put('meta', state.plattformen, 'plattformen');
    await db.put('meta', state.eigeneNamen, 'eigeneNamen');
    await db.put('meta', state.einstellungenZeit, 'einstellungenZeit');
  }
}

const dokument = () => ({
  format: 'personen-daten-v1',
  gespeichert: new Date().toISOString(),
  felder: state.felder,
  plattformen: state.plattformen,
  eigeneNamen: state.eigeneNamen,
  ignorieren: state.ignorieren,
  meineFakten: state.meineFakten,
  einstellungenZeit: state.einstellungenZeit,
  geloescht: state.geloescht,
  personen: state.personen,
});

// ---------- Fotos ----------

const blobB64 = async b => tresor.zuB64(new Uint8Array(await b.arrayBuffer()));

async function fotosAbgleichen(ordnerId, schl) {
  const remote = new Map((await drive.dateienIn(ordnerId)).map(f => [f.name.replace(/\.enc$/, ''), f.id]));
  const lokal = new Set(await db.schluessel('fotos'));
  const benoetigt = new Set(state.personen.flatMap(p => p.fotos || []));
  let hoch = 0, runter = 0;
  for (const id of benoetigt) {
    if (lokal.has(id) && !remote.has(id)) {
      const f = await db.get('fotos', id);
      const text = await tresor.verschluesseln(schl.key, schl.salt, {
        id, personId: f.personId, datum: f.datum, name: f.name,
        bild: await blobB64(f.blob), vorschau: f.thumb ? await blobB64(f.thumb) : null,
      });
      await drive.anlegen(id + '.enc', ordnerId, text);
      hoch++;
    } else if (!lokal.has(id) && remote.has(id)) {
      const umschlag = tresor.umschlagLesen(await drive.ladenText(remote.get(id)));
      const f = await tresor.entschluesseln(schl.key, umschlag);
      await db.put('fotos', {
        id: f.id, personId: f.personId, datum: f.datum, name: f.name,
        blob: new Blob([tresor.ausB64(f.bild)], { type: 'image/jpeg' }),
        thumb: f.vorschau ? new Blob([tresor.ausB64(f.vorschau)], { type: 'image/jpeg' }) : null,
      });
      runter++;
    }
  }
  return { hoch, runter };
}

// ---------- Ablauf ----------

let laeuft = false;
let nochmal = false;

/** Einmal abgleichen. Wirft drive.BrauchtAnmeldung, BrauchtPasswort oder andere Fehler. */
export async function synchronisieren() {
  if (laeuft) { nochmal = true; return; }
  laeuft = true;
  try {
    do { nochmal = false; await einmal(); } while (nochmal);
  } catch (e) {
    if (e instanceof drive.BrauchtAnmeldung) setze('anmelden', 'Bitte mit Google verbinden');
    else if (e instanceof BrauchtPasswort) setze('passwort', 'Passwort nötig');
    else setze('fehler', 'Fehler: ' + e.message);
    throw e;
  } finally {
    laeuft = false;
  }
}

async function einmal() {
  if (!drive.angemeldet()) throw new drive.BrauchtAnmeldung();
  setze('laeuft', 'Gleiche ab …');
  const ordner = await drive.ordnerIds();
  const datei = await drive.findeDatei(HAUPTDATEI, ordner.haupt);
  const schl = await tresor.gespeicherterSchluessel();
  let geaendert = false;

  if (datei) {
    const umschlag = tresor.umschlagLesen(await drive.ladenText(datei.id));
    if (!schl || schl.salt !== umschlag.salt) throw new BrauchtPasswort(false, umschlag);
    const remote = await tresor.entschluesseln(schl.key, umschlag);
    const erg = zusammenfuehren(
      { personen: state.personen, geloescht: state.geloescht, felder: state.felder, plattformen: state.plattformen, einstellungenZeit: state.einstellungenZeit },
      remote);
    await anwenden(erg);
    geaendert = erg.lokalGeaendert;
  } else if (!schl) {
    throw new BrauchtPasswort(true);
  }

  const fotos = await fotosAbgleichen(ordner.fotos, schl);
  if (fotos.runter) geaendert = true;

  const text = await tresor.verschluesseln(schl.key, schl.salt, dokument());
  if (datei) await drive.aktualisieren(datei.id, text);
  else await drive.anlegen(HAUPTDATEI, ordner.haupt, text);

  await db.put('meta', true, 'driveVerbunden');
  setze('ok', 'Abgeglichen ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
  if (geaendert) syncEreignis.dispatchEvent(new Event('daten'));
}

/** Verbindung trennen: Anmeldung und Schlüssel auf diesem Gerät vergessen. Daten bleiben auf dem Gerät und in Drive. */
export async function trennen() {
  drive.abmelden();
  await tresor.schluesselLoeschen();
  await db.put('meta', false, 'driveVerbunden');
  setze('aus', 'Nicht verbunden');
}

/** Nach jeder Änderung automatisch abgleichen (wenn angemeldet), mit kurzer Wartezeit. */
export function autoSyncStarten() {
  let timer;
  aenderung.addEventListener('geaendert', () => {
    if (laeuft) { nochmal = true; return; }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!drive.angemeldet() || !(await tresor.gespeicherterSchluessel())) {
        if (status.zustand === 'ok') setze('anmelden', 'Änderungen noch nicht in Drive');
        return;
      }
      synchronisieren().catch(() => { /* Status zeigt den Fehler */ });
    }, 3000);
  });
}

export async function warVerbunden() {
  return !!(await db.get('meta', 'driveVerbunden'));
}

export function statusBeimStart(verbunden) {
  if (!drive.eingerichtet()) setze('aus', 'Google Drive nicht eingerichtet');
  else if (verbunden) setze('anmelden', 'Tippen zum Abgleichen');
  else setze('aus', 'Nicht verbunden');
}
