// Verschlüsselung: Aus deinem Passwort wird ein Schlüssel (PBKDF2, 600.000 Runden), damit wird mit AES-256-GCM verschlüsselt.
// Läuft komplett im Browser. Das Passwort selbst wird nirgends gespeichert – nur der daraus abgeleitete Schlüssel
// auf diesem Gerät (nicht auslesbar), damit du es nicht jedes Mal eingeben musst.
import { db } from './db.js';

const RUNDEN = 600000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export class FalschesPasswort extends Error {
  constructor() { super('Das Passwort passt nicht zu den Daten in Google Drive.'); }
}

export function zuB64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function ausB64(b) {
  const s = atob(b);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

export const neuesSalz = () => crypto.getRandomValues(new Uint8Array(16));

export async function schluesselAbleiten(passwort, salz, runden = RUNDEN) {
  const basis = await crypto.subtle.importKey('raw', enc.encode(passwort), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salz, iterations: runden, hash: 'SHA-256' },
    basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Objekt verschlüsseln → Text (JSON-Umschlag), der in Drive gespeichert wird. */
export async function verschluesseln(schluessel, salzB64, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const daten = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, schluessel, enc.encode(JSON.stringify(obj)));
  return JSON.stringify({ format: 'personen-tresor-v1', salt: salzB64, iter: RUNDEN, iv: zuB64(iv), daten: zuB64(daten) });
}

export function umschlagLesen(text) {
  let u;
  try { u = JSON.parse(text); } catch { throw new Error('Die Datei in Google Drive ist beschädigt.'); }
  if (u?.format !== 'personen-tresor-v1') throw new Error('Unbekanntes Dateiformat in Google Drive.');
  return u;
}

export async function entschluesseln(schluessel, umschlag) {
  let klar;
  try {
    klar = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ausB64(umschlag.iv) }, schluessel, ausB64(umschlag.daten));
  } catch {
    throw new FalschesPasswort();
  }
  return JSON.parse(dec.decode(klar));
}

// ---------- Schlüssel auf diesem Gerät ----------
export const gespeicherterSchluessel = () => db.get('meta', 'tresor');          // { key, salt }
export const schluesselSpeichern = (key, salt) => db.put('meta', { key, salt }, 'tresor');
export const schluesselLoeschen = () => db.del('meta', 'tresor');
