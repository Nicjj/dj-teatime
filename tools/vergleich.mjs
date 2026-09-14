// Vergleicht die frisch abgerufenen Termine und Releases mit der gerade
// veröffentlichten Fassung und schreibt "geaendert=true" oder
// "geaendert=false" für den Workflow. So wird die Seite nur dann neu
// veröffentlicht, wenn sich im Kalender oder auf SoundCloud wirklich etwas
// getan hat, obwohl alle fünf Minuten geprüft wird.
//
// Fehlt eine der frischen Dateien, war die Quelle gerade nicht erreichbar.
// Dann wird sie einfach übersprungen.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const LIVE_BASIS = process.env.LIVE_BASIS || 'https://nicjj.github.io/dj-teatime/';

const PRUEFUNGEN = [
  {
    name: 'Termine',
    frisch: 'termine.json',
    live: 'termine.json',
    auszug: d => d.termine,
  },
  {
    name: 'Releases',
    frisch: 'pruefung-releases.json',
    live: 'releases.json',
    // Die Prüfung holt nur die Trackliste, keine Cover. Verglichen werden
    // deshalb nur die Felder, die in beiden Fassungen stehen.
    auszug: d => d.releases.map(({ titel, url, datum, minuten, genre }) => ({ titel, url, datum, minuten, genre })),
  },
];

async function liveFassung(pfad) {
  try {
    // Zeitstempel in der Adresse, damit kein Zwischenspeicher eine alte Fassung liefert
    const antwort = await fetch(`${LIVE_BASIS}${pfad}?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
    return antwort.ok ? await antwort.json() : null;
  } catch {
    return null;
  }
}

let geaendert = false;
for (const p of PRUEFUNGEN) {
  const datei = new URL(`../${p.frisch}`, import.meta.url);
  if (!existsSync(datei)) {
    console.log(`${p.name}: nicht abgerufen, übersprungen.`);
    continue;
  }
  const neu = p.auszug(JSON.parse(readFileSync(datei, 'utf8')));
  const alt = await liveFassung(p.live);
  let anders = true;
  // Veröffentlichte Fassung nicht lesbar: sicherheitshalber neu veröffentlichen
  try { anders = JSON.stringify(neu) !== JSON.stringify(p.auszug(alt)); } catch {}
  console.log(`${p.name}: ${anders ? 'geändert' : 'unverändert'}`);
  geaendert ||= anders;
}

console.log(geaendert ? 'Die Seite wird neu veröffentlicht.' : 'Nichts zu tun.');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `geaendert=${geaendert}\n`);
