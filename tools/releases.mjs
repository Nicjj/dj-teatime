// Holt die Releases von Tims SoundCloud-Profil und schreibt sie nach
// releases.json, die Cover-Bilder landen im Ordner releases/. Die Startseite
// liest nur diese Dateien, Besucher haben also keinen Kontakt zu SoundCloud,
// solange sie nicht selbst auf einen Track tippen.
//
// Läuft automatisch in .github/workflows/pages.yml vor jedem Deploy (Node 24).
// Lokal zum Testen:  node tools/releases.mjs
//
//   --nur-liste   nur die Trackliste holen, keine Cover (für die Fünf-Minuten-
//                 Prüfung: eine einzige Anfrage an SoundCloud statt zwanzig)
//
// Ein neuer Track auf SoundCloud erscheint damit automatisch auf der Seite.

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PROFIL = process.env.SOUNDCLOUD_PROFIL || 'tim-irmscher';
const PROFIL_URL = `https://soundcloud.com/${PROFIL}`;
const ZIEL = new URL(`../${process.env.RELEASES_DATEI || 'releases.json'}`, import.meta.url);
const BILDER = new URL('../releases/', import.meta.url);
const NUR_LISTE = process.argv.includes('--nur-liste');
const MAX_RELEASES = 12;
// Ohne Browser-Kennung liefert SoundCloud manchmal eine abgespeckte Seite
const KOPF = { 'user-agent': 'Mozilla/5.0 (compatible; teatime-website/1.0; +https://nicjj.github.io/dj-teatime/)' };

async function hole(url, art) {
  let letzterFehler;
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await fetch(url, { headers: KOPF });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      if (art === 'json') return await antwort.json();
      if (art === 'bytes') return Buffer.from(await antwort.arrayBuffer());
      return await antwort.text();
    } catch (fehler) {
      letzterFehler = fehler;
      await new Promise(r => setTimeout(r, 1500 * versuch));
    }
  }
  throw new Error(`${url}: ${letzterFehler.message}`);
}

function entschaerfen(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// "PT01H00M22S" -> 60 (Minuten, gerundet)
function minutenAus(dauer) {
  const m = (dauer || '').match(/PT(\d+)H(\d+)M(\d+)S/);
  return m ? Math.round(+m[1] * 60 + +m[2] + +m[3] / 60) : 0;
}

// "HardTechno" -> "Hard Techno"
function genreAus(genre) {
  return entschaerfen(genre || '').replace(/([a-zäöü])([A-ZÄÖÜ])/g, '$1 $2');
}

// SoundCloud rendert die Trackliste für Suchmaschinen als schema.org-Markup
// direkt ins HTML. Das ist deutlich stabiler als die interne API der App.
function leseTracks(html) {
  const tracks = [];
  for (const block of html.split('<article class="audible"').slice(1)) {
    const teil = block.slice(0, block.indexOf('</article>'));
    const link = teil.match(/itemprop="url" href="(\/[^"]+)">([^<]*)<\/a>/);
    if (!link || !link[1].startsWith(`/${PROFIL}/`)) continue;
    tracks.push({
      titel: entschaerfen(link[2]),
      url: `https://soundcloud.com${link[1]}`,
      datum: (teil.match(/<time pubdate>([^<]+)<\/time>/) || [])[1] || '',
      minuten: minutenAus((teil.match(/itemprop="duration" content="([^"]+)"/) || [])[1]),
      genre: genreAus((teil.match(/itemprop="genre" content="([^"]*)"/) || [])[1]),
    });
  }
  return tracks;
}

async function coverFuer(track) {
  const info = await hole(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(track.url)}`, 'json');
  const gross = info.thumbnail_url || '';
  // Ohne eigenes Cover liefert SoundCloud das Profilbild, das passt nicht als Release-Cover
  if (!/\/artworks-[^/]+-t500x500\.(jpg|png)$/.test(gross)) return null;
  const endung = gross.split('.').pop();
  // Kennung aus der Bildadresse im Dateinamen: Tauscht Tim das Cover, heißt
  // die Datei anders und kein Browser zeigt noch das alte aus dem Zwischenspeicher
  const kennung = createHash('sha1').update(gross).digest('hex').slice(0, 8);
  const slug = track.url.split('/').pop().replace(/[^a-z0-9-]/gi, '').slice(0, 60);
  const bild = {};
  for (const [breite, name] of [[500, 'gross'], [300, 'klein']]) {
    const datei = `${slug}-${kennung}-${breite}.${endung}`;
    writeFileSync(new URL(datei, BILDER), await hole(gross.replace('t500x500', `t${breite}x${breite}`), 'bytes'));
    bild[name] = `releases/${datei}`;
  }
  return bild;
}

const html = await hole(`${PROFIL_URL}/tracks`, 'text');
const tracks = leseTracks(html)
  .sort((a, b) => b.datum.localeCompare(a.datum))
  .slice(0, MAX_RELEASES);

// Keine Tracks gefunden heißt fast sicher: SoundCloud hat die Seite umgebaut
// oder den Abruf blockiert. Dann lieber abbrechen, statt die Liste zu leeren.
if (!tracks.length) throw new Error(`Keine Tracks auf ${PROFIL_URL}/tracks gefunden`);

if (!NUR_LISTE) {
  mkdirSync(BILDER, { recursive: true });
  for (const track of tracks) {
    try {
      const bild = await coverFuer(track);
      if (bild) Object.assign(track, { bild: bild.gross, bildKlein: bild.klein });
    } catch (fehler) {
      // Ein fehlendes Cover ist kein Grund, alles abzubrechen: Die Seite
      // zeigt für diesen Track dann ein gezeichnetes Ersatzmotiv
      console.warn(`Cover für "${track.titel}" nicht abrufbar: ${fehler.message}`);
    }
  }
  // Cover von Tracks, die es nicht mehr gibt, oder alte Fassungen aufräumen
  const behalten = new Set(tracks.flatMap(t => [t.bild, t.bildKlein]).filter(Boolean).map(b => b.split('/').pop()));
  for (const datei of readdirSync(BILDER)) {
    if (!behalten.has(datei) && /\.(jpg|png)$/.test(datei)) unlinkSync(new URL(datei, BILDER));
  }
}

const ausgabe = { stand: new Date().toISOString(), profil: PROFIL_URL, releases: tracks };
writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 2) + '\n');
console.log(`${tracks.length} Releases nach ${ZIEL.pathname.split('/').pop()} geschrieben${NUR_LISTE ? ' (nur Liste)' : ''}.`);
for (const t of tracks) console.log(`  ${t.datum.slice(0, 10)}  ${t.titel}  ${t.minuten} Min${t.bild ? '  [Cover]' : ''}`);
