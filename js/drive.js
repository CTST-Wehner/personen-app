// Google Drive: Anmeldung (Google Identity Services) und Dateizugriff.
// Berechtigung „drive.file“: Die App sieht NUR die Dateien, die sie selbst angelegt hat – nichts sonst aus deinem Drive.
// Hochgeladen werden ausschließlich verschlüsselte Dateien (siehe tresor.js).
import { GOOGLE_CLIENT_ID } from './config.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const D = 'https://www.googleapis.com/drive/v3/files';
const U = 'https://www.googleapis.com/upload/drive/v3/files';

let token = null;
let ablauf = 0;
let ordnerCache = null;

export class BrauchtAnmeldung extends Error {
  constructor() { super('Bitte mit Google Drive verbinden.'); }
}

export const eingerichtet = () => !!GOOGLE_CLIENT_ID;
export const angemeldet = () => !!token && Date.now() < ablauf;

let gisPromise = null;
export function gisLaden() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => { gisPromise = null; rej(new Error('Die Google-Anmeldung konnte nicht geladen werden (keine Internetverbindung?).')); };
      document.head.append(s);
    });
  }
  return gisPromise;
}

/** Anmeldung – muss durch einen Tipp/Klick ausgelöst werden (Google öffnet ein kleines Fenster). */
export async function anmelden() {
  await gisLaden();
  return new Promise((res, rej) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: r => {
        if (r.error) { rej(new Error('Google: ' + r.error)); return; }
        token = r.access_token;
        ablauf = Date.now() + (Number(r.expires_in || 3600) - 120) * 1000;
        res();
      },
      error_callback: e => rej(new Error(
        e?.type === 'popup_closed' ? 'Anmeldung abgebrochen.'
          : e?.type === 'popup_failed_to_open' ? 'Das Google-Fenster wurde blockiert – bitte Pop-ups für diese Seite erlauben.'
            : 'Anmeldung bei Google fehlgeschlagen.')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function abmelden() {
  try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {}); } catch { /* egal */ }
  token = null;
  ablauf = 0;
  ordnerCache = null;
}

async function api(url, opt = {}) {
  if (!angemeldet()) throw new BrauchtAnmeldung();
  const r = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + token } });
  if (r.status === 401) { token = null; throw new BrauchtAnmeldung(); }
  if (!r.ok) throw new Error(`Google Drive meldet Fehler ${r.status}`);
  return r;
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function suchen(q) {
  const dateien = [];
  let seite = '';
  do {
    const r = await api(`${D}?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name,modifiedTime)&pageSize=1000&spaces=drive${seite ? '&pageToken=' + seite : ''}`);
    const j = await r.json();
    dateien.push(...(j.files || []));
    seite = j.nextPageToken || '';
  } while (seite);
  return dateien;
}

async function ordner(name, eltern) {
  const q = `name='${esc(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (eltern ? ` and '${eltern}' in parents` : '');
  const f = (await suchen(q))[0];
  if (f) return f.id;
  const r = await api(`${D}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(eltern ? { parents: [eltern] } : {}) }),
  });
  return (await r.json()).id;
}

/** Ordner „Personen-App“ und „Personen-App/fotos“ (werden bei Bedarf angelegt). */
export async function ordnerIds() {
  if (!ordnerCache) {
    const haupt = await ordner('Personen-App');
    const fotos = await ordner('fotos', haupt);
    ordnerCache = { haupt, fotos };
  }
  return ordnerCache;
}

export async function findeDatei(name, eltern) {
  return (await suchen(`name='${esc(name)}' and '${eltern}' in parents and trashed=false`))[0] || null;
}

export const dateienIn = eltern => suchen(`'${eltern}' in parents and trashed=false`);

export async function ladenText(id) {
  return (await api(`${D}/${id}?alt=media`)).text();
}

export async function anlegen(name, eltern, text) {
  const grenze = 'personen' + Math.random().toString(36).slice(2);
  const body = `--${grenze}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [eltern] })}\r\n`
    + `--${grenze}\r\nContent-Type: application/octet-stream\r\n\r\n${text}\r\n--${grenze}--`;
  await api(`${U}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${grenze}` }, body });
}

export async function aktualisieren(id, text) {
  await api(`${U}/${id}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'Content-Type': 'application/octet-stream' }, body: text });
}
