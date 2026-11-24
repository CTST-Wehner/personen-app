// Speicher im Browser (IndexedDB). Die Daten bleiben auf diesem Gerät.
// Tabellen: personen (eine Zeile pro Person), fotos (Bilder als Blobs), meta (Einstellungen, z. B. Felder).

const DB_NAME = 'personen-app';
const VERSION = 1;
let dbPromise;

function oeffnen() {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('personen')) d.createObjectStore('personen', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('fotos')) {
          const f = d.createObjectStore('fotos', { keyPath: 'id' });
          f.createIndex('personId', 'personId');
        }
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbPromise;
}

async function tx(store, modus, fn) {
  const d = await oeffnen();
  return new Promise((res, rej) => {
    const t = d.transaction(store, modus);
    const anfrage = fn(t.objectStore(store));
    let ergebnis;
    if (anfrage) anfrage.onsuccess = () => { ergebnis = anfrage.result; };
    t.oncomplete = () => res(ergebnis);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Speichern abgebrochen'));
  });
}

export const db = {
  alle: store => tx(store, 'readonly', s => s.getAll()),
  schluessel: store => tx(store, 'readonly', s => s.getAllKeys()),
  get: (store, key) => tx(store, 'readonly', s => s.get(key)),
  put: (store, wert, key) => tx(store, 'readwrite', s => (key === undefined ? s.put(wert) : s.put(wert, key))),
  del: (store, key) => tx(store, 'readwrite', s => s.delete(key)),
};
