// Ortsliste (offline) für die Gegend um Bangkok, Pattaya und Hua Hin – nur ungefähre Mittelpunkte.
// Format: [Name, Breite, Länge, 'Schreibweise2|Schreibweise3']
import { db } from './db.js';
import { state } from './store.js';

export const ORTE = [
  // --- Bangkok allgemein + Stadtteile ---
  ['Bangkok', 13.756, 100.502, 'Krung Thep|BKK'],
  ['Siam', 13.746, 100.535, 'Pathum Wan|Pathumwan'],
  ['Sukhumvit', 13.737, 100.560, 'Asok|Asoke'],
  ['Nana', 13.740, 100.555],
  ['Thong Lo', 13.732, 100.583, 'Thonglor|Thonglo|Thong Lor'],
  ['Ekkamai', 13.720, 100.585, 'Ekamai'],
  ['Phra Khanong', 13.715, 100.591, 'Prakanong|Phrakhanong'],
  ['On Nut', 13.705, 100.601, 'Onnut|On Nuch'],
  ['Bang Na', 13.668, 100.605, 'Bangna'],
  ['Udom Suk', 13.680, 100.610, 'Udomsuk'],
  ['Bearing', 13.661, 100.602],
  ['Silom', 13.728, 100.534],
  ['Sathorn', 13.720, 100.530, 'Sathon'],
  ['Bang Rak', 13.730, 100.524, 'Bangrak'],
  ['Khlong Toei', 13.712, 100.556, 'Klong Toey|Khlong Toey|Klongtoey'],
  ['Yan Nawa', 13.696, 100.543, 'Yannawa'],
  ['Rama 3', 13.690, 100.530, 'Rama III'],
  ['Bang Kho Laem', 13.693, 100.503],
  ['Rat Burana', 13.682, 100.506, 'Ratburana'],
  ['Thonburi', 13.725, 100.486, 'Thon Buri'],
  ['Khlong San', 13.730, 100.508, 'Klongsan|Khlongsan'],
  ['Bang Khun Thian', 13.660, 100.435, 'Bangkhuntian'],
  ['Chom Thong', 13.687, 100.468],
  ['Phasi Charoen', 13.715, 100.437, 'Phasicharoen'],
  ['Bang Khae', 13.712, 100.405, 'Bang Kae|Bangkae|Bangkhae'],
  ['Nong Khaem', 13.705, 100.350, 'Nongkhaem'],
  ['Bang Bon', 13.663, 100.369, 'Bangbon'],
  ['Taling Chan', 13.777, 100.457, 'Talingchan'],
  ['Bang Phlat', 13.794, 100.505, 'Bangphlat|Bang Plat'],
  ['Bangkok Noi', 13.770, 100.468],
  ['Bang Sue', 13.809, 100.537, 'Bangsue|Bang Su'],
  ['Chatuchak', 13.828, 100.560, 'Jatujak|Jatuchak|Chatuchak Market|Mo Chit|Mochit'],
  ['Lat Phrao', 13.816, 100.608, 'Ladprao|Lad Prao|Latphrao|Ladphrao'],
  ['Huai Khwang', 13.776, 100.579, 'Huay Kwang|Huai Kwang|Huaykwang'],
  ['Ratchada', 13.785, 100.574, 'Ratchadaphisek|Ratchadapisek|Ratchadaphisek Road'],
  ['Din Daeng', 13.770, 100.552, 'Dindaeng'],
  ['Victory Monument', 13.765, 100.538, 'Anusawari'],
  ['Phaya Thai', 13.780, 100.542, 'Phayathai'],
  ['Ratchathewi', 13.759, 100.534],
  ['Pratunam', 13.751, 100.541],
  ['Dusit', 13.777, 100.520],
  ['Phra Nakhon', 13.756, 100.495, 'Rattanakosin'],
  ['Khao San', 13.759, 100.497, 'Khaosan|Khao San Road'],
  ['Chinatown', 13.740, 100.509, 'Yaowarat'],
  ['Pom Prap', 13.752, 100.513],
  ['Ramkhamhaeng', 13.756, 100.625, 'Ramkhamheang|Ramkhamhaeng Road'],
  ['Bang Kapi', 13.766, 100.647, 'Bangkapi|Happyland'],
  ['Wang Thonglang', 13.780, 100.605, 'Wangthonglang'],
  ['Bueng Kum', 13.800, 100.660, 'Buengkum|Bueng Kum'],
  ['Saphan Sung', 13.770, 100.690, 'Saphansung'],
  ['Suan Luang', 13.730, 100.651, 'Suanluang'],
  ['Prawet', 13.717, 100.694, 'Pravet|Srinakarin|Srinagarindra|Seacon'],
  ['Lat Krabang', 13.722, 100.759, 'Latkrabang|Ladkrabang|Lad Krabang'],
  ['Suvarnabhumi', 13.690, 100.750, 'Suvarnabhumi Airport|Suwannaphum'],
  ['Min Buri', 13.813, 100.748, 'Minburi'],
  ['Ramintra', 13.870, 100.650, 'Ram Inthra|Ramindra'],
  ['Khlong Sam Wa', 13.860, 100.704, 'Klong Sam Wa'],
  ['Nong Chok', 13.855, 100.862, 'Nongchok'],
  ['Khan Na Yao', 13.828, 100.678, 'Khannayao'],
  ['Bang Khen', 13.873, 100.596, 'Bangkhen'],
  ['Lak Si', 13.887, 100.578, 'Laksi'],
  ['Don Mueang', 13.913, 100.592, 'Don Muang|Donmueang|Donmuang'],
  ['Sai Mai', 13.919, 100.645, 'Saimai'],

  // --- Umland Bangkok ---
  ['Nonthaburi', 13.862, 100.514, 'Nonburi'],
  ['Pak Kret', 13.913, 100.498, 'Pakkret|Pak Kred'],
  ['Muang Thong Thani', 13.913, 100.548, 'Muang Thong|Impact Arena'],
  ['Bang Bua Thong', 13.910, 100.424, 'Bangbuathong'],
  ['Bang Yai', 13.836, 100.358, 'Bangyai'],
  ['Bang Kruai', 13.806, 100.473, 'Bangkruai'],
  ['Pathum Thani', 14.020, 100.525, 'Pathumthani'],
  ['Rangsit', 13.985, 100.616, 'Future Park'],
  ['Thanyaburi', 14.000, 100.735],
  ['Lam Luk Ka', 13.972, 100.745, 'Lamlukka'],
  ['Khlong Luang', 14.065, 100.650, 'Klong Luang|Thammasat Rangsit'],
  ['Samut Prakan', 13.599, 100.597, 'Samutprakan|Samut Prakarn|Samutprakarn|Pak Nam|Paknam'],
  ['Bang Phli', 13.604, 100.706, 'Bangphli|Bang Plee|Bangplee'],
  ['Phra Pradaeng', 13.659, 100.533, 'Phrapradaeng|Bang Krachao'],
  ['Bang Bo', 13.587, 100.837, 'Bangbo|Bang Boh'],
  ['Bang Sao Thong', 13.588, 100.796],
  ['Bang Pu', 13.515, 100.660, 'Bangpu'],
  ['Samut Sakhon', 13.547, 100.274, 'Samutsakhon|Mahachai|Maha Chai'],
  ['Krathum Baen', 13.653, 100.258, 'Krathumbaen'],
  ['Ban Phaeo', 13.588, 100.107],
  ['Nakhon Pathom', 13.819, 100.062, 'Nakhonpathom'],
  ['Sam Phran', 13.725, 100.215, 'Samphran'],
  ['Salaya', 13.800, 100.320, 'Phutthamonthon|Mahidol Salaya'],
  ['Kamphaeng Saen', 14.010, 99.975, 'Kamphaengsaen'],
  ['Ayutthaya', 14.353, 100.568, 'Ayuthaya|Ayudhya|Ayuthaya City'],
  ['Bang Pa-in', 14.230, 100.580, 'Bang Pa In|Bangpain'],
  ['Wang Noi', 14.226, 100.719, 'Wangnoi'],
  ['Ang Thong', 14.590, 100.455, 'Angthong'],
  ['Saraburi', 14.528, 100.910],
  ['Lopburi', 14.800, 100.615, 'Lop Buri'],
  ['Nakhon Nayok', 14.204, 101.213, 'Nakhonnayok'],
  ['Chachoengsao', 13.690, 101.077, 'Chachoengsao City|Paet Riu'],
  ['Bang Khla', 13.725, 101.207],
  ['Prachinburi', 14.050, 101.370, 'Prachin Buri'],
  ['Kabin Buri', 13.985, 101.715, 'Kabinburi'],
  ['Suphan Buri', 14.474, 100.117, 'Suphanburi'],
  ['Kanchanaburi', 14.020, 99.532, 'Kanchanaburi City|Kanburi'],
  ['Tha Muang', 13.963, 99.636],
  ['Ratchaburi', 13.536, 99.817, 'Rachaburi'],
  ['Photharam', 13.692, 99.851],
  ['Ban Pong', 13.818, 99.877, 'Banpong'],
  ['Damnoen Saduak', 13.518, 99.955, 'Damnoen Saduak Floating Market'],
  ['Samut Songkhram', 13.409, 100.000, 'Samutsongkhram|Mae Klong|Maeklong'],
  ['Amphawa', 13.425, 99.956],

  // --- Ostküste: Chonburi / Pattaya / Rayong ---
  ['Bang Pakong', 13.503, 100.975, 'Bangpakong'],
  ['Phanat Nikhom', 13.448, 101.184, 'Phanatnikhom'],
  ['Chon Buri', 13.361, 100.985, 'Chonburi|Chonburi City'],
  ['Ban Bueng', 13.315, 101.105, 'Banbueng'],
  ['Bang Saen', 13.283, 100.916, 'Bangsaen'],
  ['Si Racha', 13.174, 100.931, 'Sriracha|Siracha|Sri Racha'],
  ['Laem Chabang', 13.083, 100.885, 'Laemchabang'],
  ['Bang Lamung', 13.047, 100.926, 'Banglamung'],
  ['Naklua', 12.970, 100.900, 'Na Klua|Wongamat|Wong Amat'],
  ['Pattaya', 12.927, 100.877, 'Phatthaya|Pattaya City|Walking Street|Beach Road|Second Road|Central Pattaya'],
  ['Pratumnak', 12.912, 100.868, 'Pratamnak|Phra Tamnak'],
  ['East Pattaya', 12.927, 100.935, 'Nong Prue|Nongprue|Darkside|Dark Side|Siam Country Club|Mabprachan|Pong'],
  ['Jomtien', 12.880, 100.875, 'Jomtien Beach|Chomtien'],
  ['Na Jomtien', 12.810, 100.900, 'Najomtien'],
  ['Huai Yai', 12.830, 100.980, 'Huay Yai'],
  ['Koh Larn', 12.918, 100.783, 'Ko Lan|Koh Lan|Coral Island'],
  ['Bang Saray', 12.745, 100.910, 'Bang Sare|Bangsaray|Bangsare'],
  ['Sattahip', 12.665, 100.900],
  ['U-Tapao', 12.680, 101.005, 'Utapao|U Tapao'],
  ['Ban Chang', 12.725, 101.060, 'Banchang'],
  ['Map Ta Phut', 12.705, 101.155, 'Map Tha Phut|Maptaphut'],
  ['Rayong', 12.682, 101.276, 'Rayong City'],
  ['Ban Phe', 12.625, 101.440, 'Banphe'],
  ['Koh Samet', 12.567, 101.450, 'Ko Samet|Samet'],
  ['Klaeng', 12.778, 101.652],

  // --- Westküste: Phetchaburi / Hua Hin / Prachuap ---
  ['Phetchaburi', 13.111, 99.944, 'Petchaburi|Phetburi|Petburi'],
  ['Ban Laem', 13.215, 99.980, 'Banlaem'],
  ['Tha Yang', 12.966, 99.895, 'Thayang'],
  ['Cha-am', 12.799, 99.967, 'Chaam|Cha Am'],
  ['Hua Hin', 12.568, 99.958, 'Huahin|Hua-Hin|Hua Hin City|Hin Lek Fai|Nong Kae'],
  ['Khao Takiab', 12.515, 99.985, 'Khao Takiap|Takiab'],
  ['Pranburi', 12.390, 99.910, 'Pran Buri'],
  ['Pak Nam Pran', 12.383, 99.996, 'Paknampran'],
  ['Sam Roi Yot', 12.195, 99.982, 'Samroiyot|Sam Roi Yod'],
  ['Kui Buri', 12.073, 99.857, 'Kuiburi'],
  ['Prachuap Khiri Khan', 11.812, 99.797, 'Prachuap|Prachuab|Prachuap Khirikhan'],
];

// Die Gegenden, die dich interessieren – Mittelpunkt + Umkreis in km
export const REGIONEN = [
  { name: 'Bangkok', lat: 13.756, lng: 100.502, radius: 150 },
  { name: 'Pattaya', lat: 12.927, lng: 100.877, radius: 100 },
  { name: 'Hua Hin', lat: 12.568, lng: 99.958, radius: 100 },
];

const kompakt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// Suchindex: alle Schreibweisen, längste zuerst (damit „East Pattaya“ vor „Pattaya“ greift)
const INDEX = ORTE
  .flatMap(([name, lat, lng, alias = '']) => [name, ...alias.split('|').filter(Boolean)].map(n => ({ k: kompakt(n), ort: name, lat, lng })))
  .filter(e => e.k.length >= 4)
  .sort((a, b) => b.k.length - a.k.length);

// Großräumige Namen (Stadt Bangkok, Provinzen) – ein genauerer Ort im selben Text hat Vorrang.
const GROB = new Set(['Bangkok', 'Prachuap Khiri Khan', 'Chon Buri', 'Phetchaburi', 'Samut Prakan', 'Nonthaburi', 'Pathum Thani',
  'Rayong', 'Nakhon Pathom', 'Samut Sakhon', 'Ayutthaya', 'Chachoengsao', 'Ratchaburi', 'Kanchanaburi', 'Samut Songkhram', 'Saraburi']);

/** Ort im Text finden (z. B. „live in Bang Na, Bangkok“ → Bang Na). */
export function findeOrt(text) {
  const t = kompakt(text);
  if (!t) return null;
  // alle Treffer; Schreibweisen, die nur Teil eines längeren Treffers sind („pattaya“ in „eastpattaya“), fallen weg
  const treffer = INDEX.filter(x => t.includes(x.k));
  const echte = treffer.filter(x => !treffer.some(y => y !== x && y.k.length > x.k.length && y.k.includes(x.k)));
  const e = echte.find(x => !GROB.has(x.ort)) || echte[0];
  return e ? { ort: e.ort, lat: e.lat, lng: e.lng } : null;
}

/** Ort genau nach Namen (aus der Auswahlliste). */
export function ortNachName(name) {
  const k = kompakt(name);
  const e = INDEX.find(x => x.k === k);
  return e ? { ort: e.ort, lat: e.lat, lng: e.lng } : findeOrt(name);
}

/** Luftlinie in km. */
export function km(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

export const kmText = d => (d < 10 ? `ca. ${Math.max(1, Math.round(d))} km` : `ca. ${Math.round(d / 5) * 5} km`);

// Liegen zwei Punkte auf verschiedenen Seiten des Golfs (Pattaya-Seite ↔ Hua-Hin-Seite), führt die Straße
// oben um den Golf herum (über den Süden Bangkoks). Grobe Schätzung: Weg über diesen Punkt × 1,3.
const GOLF_UMWEG = { lat: 13.65, lng: 100.45 };
const golfSeite = p => (p.lat < 13.45 && p.lng > 100.55 ? 'ost' : p.lat < 13.45 && p.lng < 100.3 ? 'west' : null);

/** Entfernung mit Umweg-Schätzung: { d: km für Vergleich/Anzeige, luft: Luftlinie, umweg: true/false } */
export function strecke(a, b) {
  const luft = km(a, b);
  const sa = golfSeite(a), sb = golfSeite(b);
  if (sa && sb && sa !== sb) return { d: (km(a, GOLF_UMWEG) + km(GOLF_UMWEG, b)) * 1.3, luft, umweg: true };
  return { d: luft, luft, umweg: false };
}

/** Anzeige wie „ca. 105 km“ oder „ca. 290 km (Straße um den Golf, Luftlinie 105 km)“. */
export function streckeText(s) {
  return s.umweg ? `${kmText(s.d)} (Straße um den Golf, Luftlinie ${Math.round(s.luft / 5) * 5} km)` : kmText(s.d);
}

export function naechsterOrt(lat, lng) {
  let best = null;
  for (const [ort, la, ln] of ORTE) {
    const d = km({ lat, lng }, { lat: la, lng: ln });
    if (!best || d < best.d) best = { ort, lat: la, lng: ln, d };
  }
  return best;
}

/** Wo wohnt die Person (ungefähr)? Von Hand zugeordnet hat Vorrang, sonst aus dem Wohnort-Text. */
export function ortVon(p) {
  if (p.wohnort?.manuell && p.wohnort.lat != null) return { ort: p.wohnort.ort, lat: p.wohnort.lat, lng: p.wohnort.lng, manuell: true };
  const text = p.fakten?.wohnort?.wert;
  return text ? findeOrt(text) : null;
}

/** Strecke Person ↔ mein Standort (oder null). */
export function streckeZu(p) {
  const o = ortVon(p);
  return o && state.standort ? strecke(state.standort, o) : null;
}

/** Entfernung Person ↔ mein Standort in km (mit Golf-Umweg), oder null. */
export function entfernung(p) {
  return streckeZu(p)?.d ?? null;
}

// ---------- Mein Standort (nur auf diesem Gerät gespeichert) ----------

export async function standortSetzen(s) {
  state.standort = s;
  if (s) await db.put('meta', s, 'standort'); else await db.del('meta', 'standort');
}

/** GPS-Position abfragen. */
export function gpsAbfragen() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) { rej(new Error('Dieses Gerät kann den Standort nicht ermitteln.')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const n = naechsterOrt(lat, lng);
        const name = n && n.d < 30 ? `GPS (bei ${n.ort})` : 'GPS';
        res({ lat, lng, name, zeit: new Date().toISOString() });
      },
      err => rej(new Error(err.code === 1 ? 'Standortzugriff wurde nicht erlaubt.' : 'Standort konnte nicht ermittelt werden.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  });
}
