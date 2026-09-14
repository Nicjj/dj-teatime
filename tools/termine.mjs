// Holt die Gig-Termine aus dem öffentlichen Google-Kalender "Gigs" und
// schreibt sie nach termine.json. Die Startseite liest nur diese Datei,
// Besucher haben also nie direkten Kontakt zu Google.
//
// Läuft automatisch in .github/workflows/pages.yml vor jedem Deploy (Node 24).
// Lokal zum Testen:  node tools/termine.mjs
//
// Feldkonvention im Kalender:
//   Titel        = Venue
//   Ort          = Stadt (eine volle Adresse geht auch, die Stadt wird herausgelöst)
//   Beschreibung = Ticket-Link (der erste Link darin wird übernommen)

import { writeFileSync } from 'node:fs';

const KALENDER_ID = process.env.GIGS_KALENDER_ID
  || '29baaf0c1dec094f8f4b48fe8d335b024f74e40712649aa70fed4d9ac84e0594@group.calendar.google.com';
const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(KALENDER_ID)}/public/basic.ics`;
const ZIEL = new URL('../termine.json', import.meta.url);
const ZEITZONE = 'Europe/Berlin';
const MAX_TERMINE = 30;

async function holeKalender() {
  let letzterFehler;
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await fetch(ICS_URL);
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const text = await antwort.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Antwort ist kein Kalender');
      return text;
    } catch (fehler) {
      letzterFehler = fehler;
      await new Promise(r => setTimeout(r, 2000 * versuch));
    }
  }
  // Absichtlich hart abbrechen: dann bleibt die zuletzt veröffentlichte
  // Fassung der Seite online, statt dass eine leere Terminliste erscheint.
  throw new Error(`Kalender nicht abrufbar (${ICS_URL}): ${letzterFehler.message}`);
}

function textEntschaerfen(wert) {
  return wert
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function leseEreignisse(ics) {
  // Lange Zeilen sind in iCal umgebrochen, Folgezeilen beginnen mit Leerzeichen
  const zeilen = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const ereignisse = [];
  let aktuell = null;
  for (const zeile of zeilen) {
    if (zeile === 'BEGIN:VEVENT') { aktuell = {}; continue; }
    if (zeile === 'END:VEVENT') { if (aktuell) ereignisse.push(aktuell); aktuell = null; continue; }
    if (!aktuell) continue;
    const m = zeile.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
    if (!m) continue;
    const [, name, parameter, wert] = m;
    if (!(name in aktuell)) aktuell[name] = { parameter, wert };
  }
  return ereignisse;
}

// Wanduhrzeit in Berlin für einen Zeitpunkt, z. B. "2026-09-18T13:00"
function berlinZeit(datum) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZEITZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(datum).map(t => [t.type, t.value])
  );
  return `${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}`;
}

// ISO-Zeitpunkt mit Berliner Versatz, z. B. "2026-09-18T13:00:00+02:00"
function berlinIso(datum) {
  const wand = berlinZeit(datum);
  const alsUtc = Date.parse(wand + ':00Z');
  const versatzMin = Math.round((alsUtc - datum.getTime()) / 60000);
  const vz = versatzMin >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(versatzMin) / 60)).padStart(2, '0');
  const min = String(Math.abs(versatzMin) % 60).padStart(2, '0');
  return `${wand}:00${vz}${h}:${min}`;
}

function leseZeitpunkt(feld) {
  if (!feld) return null;
  const { parameter, wert } = feld;
  // Ganztägig: VALUE=DATE:20260916
  if (/VALUE=DATE(?!-)/.test(parameter) || /^\d{8}$/.test(wert)) {
    const t = `${wert.slice(0, 4)}-${wert.slice(4, 6)}-${wert.slice(6, 8)}`;
    return { wand: t, iso: t, ganztags: true };
  }
  const m = wert.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const [, j, mo, t, h, mi, s, z] = m;
  if (z === 'Z') {
    const datum = new Date(Date.UTC(+j, +mo - 1, +t, +h, +mi, +s));
    return { wand: berlinZeit(datum), iso: berlinIso(datum), ganztags: false };
  }
  // Mit TZID oder ohne Zone: als Berliner Wanduhrzeit übernehmen
  const wand = `${j}-${mo}-${t}T${h}:${mi}`;
  return { wand, iso: `${wand}:00`, ganztags: false };
}

// Google füllt den Ort gern als volle Adresse aus. Für die Anzeige reicht die Stadt.
function stadtAus(ort) {
  if (!ort) return '';
  const plzStadt = ort.match(/\b\d{5}\s+([^,]+)/);
  if (plzStadt) return plzStadt[1].trim();
  return ort.split(',')[0].trim();
}

function ticketAus(ereignis) {
  const kandidaten = [ereignis.URL?.wert, ereignis.DESCRIPTION?.wert].filter(Boolean).map(textEntschaerfen);
  for (const k of kandidaten) {
    const m = k.match(/https?:\/\/[^\s"'<>]+/);
    if (m) return m[0].replace(/[).,;]+$/, '');
  }
  return '';
}

const ics = await holeKalender();
const jetzt = berlinZeit(new Date());
const heute = jetzt.slice(0, 10);

const termine = leseEreignisse(ics)
  .filter(e => (e.STATUS?.wert || '').toUpperCase() !== 'CANCELLED')
  .map(e => {
    const titel = textEntschaerfen(e.SUMMARY?.wert || '').trim();
    const start = leseZeitpunkt(e.DTSTART);
    const ende = leseZeitpunkt(e.DTEND) || start;
    const adresse = textEntschaerfen(e.LOCATION?.wert || '').trim();
    return { titel, start, ende, adresse, ticket: ticketAus(e) };
  })
  // "Busy" liefert Google, wenn der Kalender nur frei/beschäftigt freigibt.
  // Solche Einträge haben weder Venue noch Ort und gehören nicht auf die Seite.
  .filter(t => t.titel && t.titel !== 'Busy' && t.start)
  // Vergangene Termine ausblenden. Ganztägige enden laut iCal am Folgetag.
  .filter(t => t.ende.ganztags ? t.ende.wand > heute : t.ende.wand > jetzt)
  .sort((a, b) => a.start.wand.localeCompare(b.start.wand))
  .slice(0, MAX_TERMINE)
  .map(t => ({
    titel: t.titel,
    ort: stadtAus(t.adresse),
    adresse: t.adresse,
    start: t.start.wand,
    startIso: t.start.iso,
    ende: t.ende.wand,
    ganztags: t.start.ganztags,
    ticket: t.ticket,
  }));

const ausgabe = { stand: new Date().toISOString(), termine };
writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 2) + '\n');
console.log(`${termine.length} kommende Termine nach termine.json geschrieben.`);
for (const t of termine) console.log(`  ${t.start}  ${t.titel}  ${t.ort}${t.ticket ? '  [Tickets]' : ''}`);
