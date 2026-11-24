// Bedienung des Drive-Abgleichs: Anmelden, Passwort abfragen, Status anzeigen.
import { h, toast } from './util.js';
import { dialog } from './dialoge.js';
import * as drive from './drive.js';
import { synchronisieren, passwortSetzen, BrauchtPasswort, aktuellerStatus, syncEreignis } from './sync.js';
import { FalschesPasswort } from './tresor.js';

async function passwortDialog(e) {
  const p1 = h('input', { type: 'password', autocomplete: e.neu ? 'new-password' : 'current-password' });
  const p2 = e.neu ? h('input', { type: 'password', autocomplete: 'new-password' }) : null;
  const zeigen = h('input', { type: 'checkbox', onchange: ev => {
    const t = ev.target.checked ? 'text' : 'password';
    p1.type = t;
    if (p2) p2.type = t;
  } });
  const fehler = h('p', { class: 'fehler' });
  const r = await dialog(e.neu ? 'Passwort für Google Drive festlegen' : 'Passwort eingeben', [
    e.neu
      ? h('p', {}, 'Mit diesem Passwort werden alle Daten verschlüsselt, bevor sie in dein Google Drive gehen. Du brauchst es auf jedem weiteren Gerät (Handy, Tablet) einmal.')
      : h('p', {}, 'In deinem Google Drive liegen schon verschlüsselte Daten. Gib das Passwort ein, das du beim ersten Gerät festgelegt hast.'),
    e.neu && h('p', { class: 'warn klein' }, 'Wichtig: Schreib das Passwort sicher auf. Ohne Passwort sind die Daten in Drive nicht mehr lesbar – das kann niemand wiederherstellen.'),
    h('label', {}, 'Passwort', p1),
    p2 && h('label', {}, 'Passwort wiederholen', p2),
    h('label', { class: 'haken' }, zeigen, 'Passwort anzeigen'),
    fehler,
  ], [
    { text: 'Abbrechen', wert: null },
    {
      text: 'OK', klasse: 'primaer', wert: true,
      pruefen: async () => {
        if (e.neu) {
          if (p1.value.length < 8) { fehler.textContent = 'Bitte mindestens 8 Zeichen.'; return false; }
          if (p1.value !== p2.value) { fehler.textContent = 'Die beiden Eingaben sind nicht gleich.'; return false; }
        } else if (!p1.value) { fehler.textContent = 'Bitte das Passwort eingeben.'; return false; }
        fehler.textContent = 'Einen Moment …';
        try {
          await passwortSetzen(p1.value, e.neu ? null : e.umschlag);
          return true;
        } catch (err) {
          fehler.textContent = err instanceof FalschesPasswort ? 'Das Passwort ist falsch.' : err.message;
          return false;
        }
      },
    },
  ]);
  return r === true;
}

/** Abgleichen mit allem, was dazugehört (Anmeldung, Passwort). Muss durch einen Tipp ausgelöst werden. */
export async function jetztSynchronisieren() {
  if (!drive.eingerichtet()) { toast('Google Drive ist noch nicht eingerichtet (Client-ID fehlt).', 5000); return false; }
  for (let versuch = 0; versuch < 4; versuch++) {
    try {
      await synchronisieren();
      toast('Mit Google Drive abgeglichen ✓');
      return true;
    } catch (e) {
      if (e instanceof drive.BrauchtAnmeldung) {
        try { await drive.anmelden(); } catch (err) { toast(err.message, 6000); return false; }
        continue;
      }
      if (e instanceof BrauchtPasswort) {
        if (!(await passwortDialog(e))) return false;
        continue;
      }
      toast('Abgleich fehlgeschlagen: ' + e.message, 6000);
      return false;
    }
  }
  return false;
}

/** Kleine Statuszeile mit Knopf (für Übersicht und Daten-Seite). */
export function syncLeiste({ immer = false } = {}) {
  const el = h('div', { class: 'zeile klein sync-leiste' });
  let erstesMal = true;
  function zeichne() {
    // Seite gewechselt → Leiste ist weg → nicht mehr zuhören
    if (!erstesMal && !el.isConnected) { syncEreignis.removeEventListener('status', zeichne); return; }
    erstesMal = false;
    const s = aktuellerStatus();
    if (!immer && (s.zustand === 'aus' || s.zustand === 'ok' || s.zustand === 'laeuft')) { el.replaceChildren(); el.hidden = true; return; }
    el.hidden = false;
    const symbol = { ok: '☁ ✓', laeuft: '☁ …', anmelden: '☁', passwort: '☁ 🔒', fehler: '☁ ⚠', aus: '☁' }[s.zustand] || '☁';
    el.replaceChildren(
      h('span', {}, `${symbol} Google Drive: ${s.text}`),
      drive.eingerichtet() && s.zustand !== 'laeuft' && s.zustand !== 'aus' && h('button', { onclick: () => jetztSynchronisieren() }, s.zustand === 'ok' ? 'Jetzt abgleichen' : 'Abgleichen'));
  }
  syncEreignis.addEventListener('status', zeichne);
  zeichne();
  return el;
}
