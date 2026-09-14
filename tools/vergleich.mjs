// Vergleicht die frisch erzeugte termine.json mit der gerade veröffentlichten
// und schreibt "geaendert=true" oder "geaendert=false" für den Workflow.
// So wird die Seite nur dann neu veröffentlicht, wenn sich im Kalender
// wirklich etwas getan hat, obwohl alle fünf Minuten geprüft wird.

import { readFileSync, appendFileSync } from 'node:fs';

const LIVE_URL = process.env.LIVE_URL || 'https://nicjj.github.io/dj-teatime/termine.json';

const neu = JSON.parse(readFileSync(new URL('../termine.json', import.meta.url), 'utf8')).termine;

let alt = null;
try {
  // Zeitstempel in der Adresse, damit kein Zwischenspeicher eine alte Fassung liefert
  const antwort = await fetch(`${LIVE_URL}?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
  if (antwort.ok) alt = (await antwort.json()).termine;
} catch {
  // Veröffentlichte Fassung nicht lesbar: sicherheitshalber neu veröffentlichen
}

const geaendert = JSON.stringify(neu) !== JSON.stringify(alt);
console.log(geaendert
  ? 'Termine haben sich geändert, die Seite wird neu veröffentlicht.'
  : 'Keine Änderung im Kalender, nichts zu tun.');

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `geaendert=${geaendert}\n`);
