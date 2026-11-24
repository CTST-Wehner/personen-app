// Seite „Daten“: Speicherort, Backup herunterladen, Backup einlesen.
import { db } from './db.js';
import { state, speichereFelder, speicherePlattformen, ergaenzen, aenderung } from './store.js';
import { h, toast, heute } from './util.js';
import { bestaetigen } from './dialoge.js';
import { eingerichtet, angemeldet } from './drive.js';
import { trennen, warVerbunden } from './sync.js';
import { jetztSynchronisieren, syncLeiste } from './syncui.js';
import { gespeicherterSchluessel } from './tresor.js';

async function driveBox() {
  const box = h('div', { class: 'box' }, h('h2', {}, '☁ Google Drive (verschlüsselt)'));
  if (!eingerichtet()) {
    box.append(
      h('p', {}, 'Noch nicht eingerichtet. Damit PC, Handy und Tablet dieselben Daten haben, braucht die App einmalig eine „Client-ID“ von Google.'),
      h('p', { class: 'leise klein' }, 'Anleitung: Datei „ANLEITUNG_Google_Drive.md“ im Projektordner. Die Client-ID dann an Claude geben – sie wird in die App eingetragen.'));
    return box;
  }
  const verbunden = await warVerbunden();
  const schluessel = await gespeicherterSchluessel();
  box.append(
    h('p', {}, 'Alle Daten und Fotos werden auf diesem Gerät mit deinem Passwort verschlüsselt und erst dann in deinem Google Drive (Ordner „Personen-App“) gespeichert. Google kann nichts davon lesen. Nach jeder Änderung wird automatisch abgeglichen, solange die Verbindung besteht.'),
    syncLeiste({ immer: true }),
    h('p', { class: 'leise klein' }, [
      schluessel ? '🔒 Passwort ist auf diesem Gerät hinterlegt.' : '🔒 Passwort wird beim ersten Abgleich abgefragt.',
      angemeldet() ? ' Angemeldet bei Google.' : verbunden ? ' Nach dem Öffnen der App einmal „Abgleichen“ tippen.' : '',
    ].join('')),
    h('div', { class: 'zeile' },
      !verbunden && h('button', { class: 'primaer', onclick: async () => { if (await jetztSynchronisieren()) location.reload(); } }, 'Mit Google Drive verbinden'),
      verbunden && h('button', { class: 'gefahr', onclick: async () => {
        if (!(await bestaetigen('Verbindung zu Google Drive auf diesem Gerät trennen? Die Daten bleiben auf dem Gerät und in Drive. Zum erneuten Verbinden brauchst du das Passwort.', 'Trennen'))) return;
        await trennen();
        location.reload();
      } }, 'Verbindung trennen')));
  return box;
}

const blobZuDataUrl = b => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

function dataUrlZuBlob(u) {
  const [kopf, daten] = String(u).split(',');
  const typ = (kopf.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(daten);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: typ });
}

function herunterladen(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function exportieren(mitFotos) {
  const daten = { format: 'personen-backup-v1', erstellt: new Date().toISOString(), felder: state.felder, plattformen: state.plattformen, personen: state.personen, fotos: [] };
  if (mitFotos) {
    toast('Backup wird erstellt …', 10000);
    for (const f of await db.alle('fotos')) {
      daten.fotos.push({ id: f.id, personId: f.personId, datum: f.datum, name: f.name, bild: await blobZuDataUrl(f.blob), vorschau: f.thumb ? await blobZuDataUrl(f.thumb) : null });
    }
  }
  herunterladen(new Blob([JSON.stringify(daten)], { type: 'application/json' }), `personen-backup-${heute()}${mitFotos ? '' : '-ohne-fotos'}.json`);
  toast('Backup heruntergeladen');
}

/** Backup zusammenführen: Neues kommt dazu, bei gleicher Person gewinnt der neuere Stand. */
async function einlesen(datei) {
  let daten;
  try {
    daten = JSON.parse(await datei.text());
  } catch {
    toast('Die Datei ist kein gültiges Backup.', 5000);
    return;
  }
  if (daten?.format !== 'personen-backup-v1') { toast('Unbekanntes Format – erwartet wird ein Backup dieser App.', 5000); return; }

  let felderNeu = 0, neu = 0, aktualisiert = 0, fotos = 0;
  for (const f of daten.felder || []) {
    if (f?.key && !state.felder.some(x => x.key === f.key)) { state.felder.push(f); felderNeu++; }
  }
  if (felderNeu) await speichereFelder();
  let plattformenNeu = 0;
  for (const p of daten.plattformen || []) {
    if (typeof p === 'string' && p && !state.plattformen.includes(p)) { state.plattformen.push(p); plattformenNeu++; }
  }
  if (plattformenNeu) await speicherePlattformen();

  for (const p of daten.personen || []) {
    if (!p?.id) continue;
    const vorhanden = state.personen.find(x => x.id === p.id);
    if (!vorhanden) {
      ergaenzen(p);
      await db.put('personen', p);
      state.personen.push(p);
      neu++;
    } else if ((p.geaendert || '') > (vorhanden.geaendert || '')) {
      ergaenzen(p);
      await db.put('personen', p);
      state.personen[state.personen.indexOf(vorhanden)] = p;
      aktualisiert++;
    }
  }
  for (const f of daten.fotos || []) {
    if (!f?.id || !f.bild || await db.get('fotos', f.id)) continue;
    await db.put('fotos', { id: f.id, personId: f.personId, datum: f.datum, name: f.name, blob: dataUrlZuBlob(f.bild), thumb: f.vorschau ? dataUrlZuBlob(f.vorschau) : null });
    fotos++;
  }
  toast(`Eingelesen: ${neu} neue, ${aktualisiert} aktualisierte Personen, ${fotos} Fotos, ${felderNeu} Felder`, 6000);
  if (neu || aktualisiert || fotos) aenderung.dispatchEvent(new Event('geaendert'));
}

export async function zeigeDaten(main) {
  const speicherInfo = h('p', { class: 'leise' }, 'Speicherbelegung wird ermittelt …');
  const datei = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    const f = e.target.files[0];
    if (f) await einlesen(f);
    e.target.value = '';
  } });

  main.append(
    h('h1', {}, 'Daten'),
    await driveBox(),
    h('div', { class: 'box' },
      h('h2', {}, 'Speicher auf diesem Gerät'),
      h('p', {}, 'Alle Daten und Fotos liegen in diesem Browser auf diesem Gerät. Nach außen geht nur – wenn verbunden – die verschlüsselte Kopie in dein Google Drive; alles andere ist technisch gesperrt.'),
      h('p', { class: 'warn klein' }, 'Achtung: Wenn du im Browser „Websitedaten löschen“ wählst oder die App deinstallierst, sind die Daten weg. Mach deshalb regelmäßig ein Backup.'),
      speicherInfo),
    h('div', { class: 'box' },
      h('h2', {}, 'Backup herunterladen'),
      h('p', { class: 'leise' }, 'Eine Datei mit allen Personen, Feldern und (wahlweise) Fotos. Damit kannst du die Daten auch auf ein anderes Gerät übertragen.'),
      h('div', { class: 'zeile' },
        h('button', { class: 'primaer', onclick: () => exportieren(true) }, 'Alles als JSON herunterladen'),
        h('button', { onclick: () => exportieren(false) }, 'Ohne Fotos (kleiner)'))),
    h('div', { class: 'box' },
      h('h2', {}, 'Backup einlesen'),
      h('p', { class: 'leise' }, 'Führt ein Backup mit den vorhandenen Daten zusammen: Neue Personen kommen dazu, bei derselben Person gewinnt der neuere Stand. Nichts wird gelöscht.'),
      h('button', { onclick: () => datei.click() }, 'Backup-Datei wählen …'),
      datei),
  );

  try {
    const [schaetzung, dauerhaft] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
    const mb = schaetzung ? (schaetzung.usage / 1048576).toFixed(1) : '?';
    speicherInfo.textContent = `${state.personen.length} Personen · belegt ca. ${mb} MB · ` +
      (dauerhaft ? 'Speicher ist als dauerhaft markiert ✅' : 'Speicher ist nicht dauerhaft markiert – der Browser könnte bei Platzmangel aufräumen. Als installierte App ist das meist gelöst.');
  } catch {
    speicherInfo.textContent = '';
  }
}
