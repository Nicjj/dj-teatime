# DJ TEATIME — Website

Artist-Website für DJ Teatime (Hard Techno / Tekno, Dresden).
Live: https://nicjj.github.io/dj-teatime/

## Aufbau

Statische Seiten ohne Build-Schritt, Frameworks oder CDN: `index.html` (Start),
`about.html` (Über mich), `impressum.html`, `datenschutz.html`, `404.html`,
dazu `logos/`, `bilder/` und `releases/`. Die Dateien laufen auf jedem Webserver.

Zwei Inhalte kommen automatisch:

- **Termine** aus dem öffentlichen Google-Kalender „Gigs“ — `tools/termine.mjs`
  schreibt `termine.json` (nicht im Repo, entsteht nur beim Veröffentlichen).
  Konvention im Kalender: Titel = Venue, Ort = Stadt, Beschreibung = Ticket-Link.
- **Releases** von SoundCloud (`soundcloud.com/tim-irmscher`) — `tools/releases.mjs`
  schreibt `releases.json` und lädt die Cover nach `releases/`. Beides liegt
  zusätzlich im Repo, damit die Seite auch dann Releases zeigt, wenn SoundCloud
  gerade nicht erreichbar ist.

Besucher laden dabei nichts von Google oder SoundCloud, alles kommt von dieser Seite.

## Veröffentlichen

Die GitHub Action `.github/workflows/pages.yml` veröffentlicht bei jedem Push nach
`main`. Zusätzlich prüft sie alle fünf Minuten Kalender und SoundCloud und
veröffentlicht nur, wenn sich dort etwas geändert hat (`tools/vergleich.mjs`).

## Lokal ansehen

```
node tools/termine.mjs
node tools/releases.mjs
node server.js
```

Dann `http://localhost:5599` öffnen.

## Links auf der Seite

- Instagram: https://www.instagram.com/teatime_music_/
- SoundCloud: https://soundcloud.com/tim-irmscher
- Booking: booking.teatime.music@gmail.com

YouTube und Spotify sollen später dazukommen.
