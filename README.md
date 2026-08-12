# DJ TEATIME — Website

Artist-Website für DJ Teatime (Hard Techno / Tekno, Dresden).

## Aufbau

Die komplette Seite ist **eine einzige, in sich geschlossene Datei**: `index.html`.
Kein Build-Schritt, keine Abhängigkeiten, kein CDN — Bilder sind als Data-URIs eingebettet.

Das heißt: Die Seite läuft auf jedem Webserver, indem man `index.html` dorthin kopiert.

## Lokal ansehen

```
node server.js
```

Dann `http://localhost:5599` öffnen.

(Die Datei direkt per Doppelklick zu öffnen funktioniert auch, aber ein echter Server
verhält sich genauso wie später im Livebetrieb.)

## Links auf der Seite

- Instagram: https://www.instagram.com/teatime_music_/
- SoundCloud: https://on.soundcloud.com/PkZfJisJTeEny8Lj9
- Booking: teaatime-music@gmail.com

YouTube und Spotify sollen später dazukommen — die Social-Leiste im Footer
ist so aufgebaut, dass weitere Links einfach ergänzt werden können.

## Offen

- Termine ("Steep Times") stehen aktuell auf Platzhalter. Geplant ist, sie aus einer
  veröffentlichten Google-Tabelle zu laden, damit sie ohne Code-Änderung gepflegt
  werden können.
- About-Text und Brew-Log-Einträge enthalten noch Platzhaltertexte.
