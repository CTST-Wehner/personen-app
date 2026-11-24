// Start der App und Seitenwechsel (#/…).
import { laden } from './store.js';
import { zeigeUebersicht, zeigePerson } from './personen.js';
import { zeigeImport } from './import.js';
import { zeigeFelder } from './felder.js';
import { zeigeDaten } from './daten.js';
import { h, neuZeichnen } from './util.js';
import { autoSyncStarten, syncEreignis, aktuellerStatus, warVerbunden, statusBeimStart } from './sync.js';
import { eingerichtet, gisLaden } from './drive.js';

const main = document.getElementById('main');
let letzterHash = null;

async function route() {
  const teile = location.hash.replace(/^#\/?/, '').split('/');
  const r = teile[0] || '';
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('aktiv', a.dataset.r === r || (r === 'person' && a.dataset.r === '')));

  const scrollY = window.scrollY;
  const gleicheSeite = location.hash === letzterHash;
  letzterHash = location.hash;
  main.replaceChildren();
  try {
    switch (r) {
      case '': await zeigeUebersicht(main); break;
      case 'person': await zeigePerson(main, decodeURIComponent(teile[1] || '')); break;
      case 'import': zeigeImport(main); break;
      case 'felder': zeigeFelder(main); break;
      case 'daten': await zeigeDaten(main); break;
      case 'karte':
        main.append(h('h1', {}, 'Karte'), h('p', { class: 'leise' }, 'Die Karte wird im nächsten Bauschritt eingebaut.'));
        break;
      default: location.hash = '#/';
    }
  } catch (err) {
    console.error(err);
    main.append(h('p', { class: 'fehler' }, 'Fehler: ' + err.message));
  }
  window.scrollTo(0, gleicheSeite ? scrollY : 0);
}

async function start() {
  try {
    await laden();
  } catch (err) {
    main.replaceChildren(h('p', { class: 'fehler' }, 'Der Speicher im Browser konnte nicht geöffnet werden: ' + err.message));
    return;
  }
  // Browser bitten, die Daten nicht automatisch aufzuräumen.
  try { await navigator.storage?.persist?.(); } catch { /* egal */ }
  window.addEventListener('hashchange', route);

  // Google-Drive-Abgleich
  const verbunden = await warVerbunden();
  statusBeimStart(verbunden);
  autoSyncStarten();
  if (eingerichtet() && verbunden) gisLaden().catch(() => { /* offline – egal */ });
  const navDaten = document.querySelector('#nav a[data-r="daten"]');
  const badge = () => {
    const z = aktuellerStatus().zustand;
    navDaten.textContent = 'Daten' + ({ ok: ' ☁✓', laeuft: ' ☁…', anmelden: ' ☁', passwort: ' ☁🔒', fehler: ' ☁⚠' }[z] || '');
  };
  syncEreignis.addEventListener('status', badge);
  badge();
  // Neue Daten von einem anderen Gerät → Seite neu zeichnen (aber nicht mitten in einem offenen Dialog)
  syncEreignis.addEventListener('daten', () => {
    const neu = () => (document.querySelector('dialog[open]') ? setTimeout(neu, 1500) : neuZeichnen());
    neu();
  });

  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service Worker:', e));
}

start();
