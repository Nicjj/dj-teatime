// Schreibt Termine und Releases schon fertig in index.html, bevor die Seite
// veröffentlicht wird. Google sieht sie dann ohne JavaScript, und beim Laden
// springt nichts, weil der Platz schon belegt ist. Das HTML dafür kommt aus
// js/darstellung.js, genau wie im Browser.
//
// Läuft in .github/workflows/pages.yml nach termine.mjs und releases.mjs.
// Lokal zum Ansehen, ohne index.html zu verändern:
//   node tools/vorrendern.mjs _vorschau.html

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const WURZEL = new URL('../', import.meta.url);
const BASIS = (process.env.LIVE_BASIS || 'https://nicjj.github.io/dj-teatime/').replace(/\/?$/, '/');
const ZIEL = new URL(process.argv[2] || 'index.html', WURZEL);

const TT = vm.runInNewContext(readFileSync(new URL('js/darstellung.js', WURZEL), 'utf8') + '\n;TT');
let html = readFileSync(new URL('index.html', WURZEL), 'utf8');

function einsetzen(name, inhalt) {
  const anfang = `<!--${name}-->`, ende = `<!--/${name}-->`;
  const a = html.indexOf(anfang), e = html.indexOf(ende);
  if (a < 0 || e < a) throw new Error(`Platzhalter ${anfang} fehlt in index.html`);
  html = html.slice(0, a + anfang.length) + inhalt + html.slice(e);
}

// JSON in einem script-Block: "</" darf darin nicht vorkommen
const ld = (id, daten) => `<script type="application/ld+json" id="${id}">${JSON.stringify(daten).replace(/<\//g, '<\\/')}</script>`;
const lesen = datei => {
  const url = new URL(datei, WURZEL);
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
};

const strukturiert = [];

const termineDaten = lesen('termine.json');
if (termineDaten) {
  const liste = TT.kommendeTermine(termineDaten);
  einsetzen('TERMINE', TT.termineHtml(liste));
  strukturiert.push(ld('ld-termine', TT.termineLd(liste)));
  console.log(`Termine: ${liste.length} vorab eingesetzt`);
} else {
  console.log('Termine: keine termine.json, die Seite lädt sie im Browser');
}

const releaseDaten = lesen('releases.json');
if (releaseDaten) {
  const liste = TT.releaseListe(releaseDaten);
  if (liste.length) {
    einsetzen('RELEASES', `<div class="grid reveal" id="relgrid" data-signatur="${TT.signatur(liste)}">${TT.releasesHtml(liste)}</div>`);
    einsetzen('RELEASES-MEHR', TT.releasesKnopf(liste));
    strukturiert.push(ld('ld-releases', TT.releasesLd(liste, BASIS)));
  }
  console.log(`Releases: ${liste.length} vorab eingesetzt`);
}

einsetzen('LD', strukturiert.join('\n'));
writeFileSync(ZIEL, html);
console.log(`geschrieben: ${ZIEL.pathname.split('/').pop()}`);
