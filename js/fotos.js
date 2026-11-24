// Fotos: verkleinern (max. 1600 px, JPEG ~80 %) + Vorschaubild, gespeichert in IndexedDB.
import { db } from './db.js';
import { uuid } from './util.js';

const vorschauCache = new Map();

async function bildLaden(datei) {
  try {
    return await createImageBitmap(datei, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(datei);
    } catch {
      throw new Error(`„${datei.name}“ ist kein lesbares Bild`);
    }
  }
}

function verkleinern(bmp, max, qualitaet) {
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s));
  const hgt = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, hgt);
  ctx.drawImage(bmp, 0, 0, w, hgt);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', qualitaet));
}

/** Bilder aus einem Einfüge-Ereignis (Strg+V) holen. */
export function bilderAusEinfuegen(e) {
  const dateien = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (dateien.length) return dateien;
  return [...(e.clipboardData?.items || [])]
    .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    .map(i => i.getAsFile()).filter(Boolean);
}

/** Bilder aus der Zwischenablage holen (Knopf „Bild einfügen“). Der Browser fragt evtl. einmal um Erlaubnis. */
export async function bilderAusZwischenablage() {
  if (!navigator.clipboard?.read) throw new Error('Dieser Browser kann Bilder nicht per Knopf einfügen – bitte Strg+V drücken.');
  let eintraege;
  try {
    eintraege = await navigator.clipboard.read();
  } catch {
    throw new Error('Kein Zugriff auf die Zwischenablage – bitte erlauben oder Strg+V drücken.');
  }
  const bilder = [];
  for (const it of eintraege) {
    const typ = it.types.find(t => t.startsWith('image/'));
    if (typ) {
      const blob = await it.getType(typ);
      bilder.push(new File([blob], 'eingefuegt.' + (typ.split('/')[1] || 'png'), { type: typ }));
    }
  }
  if (!bilder.length) throw new Error('In der Zwischenablage ist kein Bild. Erst ein Bild ausschneiden/kopieren (am PC z. B. Windows+Umschalt+S).');
  return bilder;
}

/** Foto zu Person hinzufügen (Person danach selbst speichern). */
export async function fotoHinzufuegen(p, datei) {
  const bmp = await bildLaden(datei);
  const blob = await verkleinern(bmp, 1600, 0.8);
  const vorschau = await verkleinern(bmp, 320, 0.75);
  bmp.close?.();
  const id = uuid();
  await db.put('fotos', { id, personId: p.id, blob, thumb: vorschau, datum: new Date().toISOString(), name: datei.name });
  p.fotos.push(id);
  if (!p.hauptfoto) p.hauptfoto = id;
  return id;
}

export async function vorschauUrl(id) {
  if (!id) return null;
  if (vorschauCache.has(id)) return vorschauCache.get(id);
  const f = await db.get('fotos', id);
  if (!f) return null;
  const u = URL.createObjectURL(f.thumb || f.blob);
  vorschauCache.set(id, u);
  return u;
}

/** URL für das große Bild – nach Gebrauch mit URL.revokeObjectURL freigeben. */
export async function grossUrl(id) {
  const f = await db.get('fotos', id);
  return f ? URL.createObjectURL(f.blob) : null;
}

/** Foto löschen (Person danach selbst speichern). */
export async function fotoLoeschen(p, id) {
  await db.del('fotos', id);
  p.fotos = p.fotos.filter(x => x !== id);
  if (p.hauptfoto === id) p.hauptfoto = p.fotos[0] || null;
  const u = vorschauCache.get(id);
  if (u) { URL.revokeObjectURL(u); vorschauCache.delete(id); }
}
