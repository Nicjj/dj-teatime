/* Baut das HTML für Termine und Releases auf der Startseite.

   Wird an zwei Stellen benutzt, damit beide immer genau dasselbe erzeugen:
   - im Browser (index.html), wenn termine.json und releases.json geladen sind
   - beim Veröffentlichen von tools/vorrendern.mjs, das Termine und Releases
     schon fertig ins HTML schreibt. So sieht Google sie ohne JavaScript, und
     beim Laden der Seite springt nichts.
   Deshalb hier kein Zugriff auf document oder window. */
var TT = (function(){
  "use strict";

  var NAME = 'DJ TeaTime';
  var WOCHENTAG = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  var MONAT = ['Jan','Feb','März','Apr','Mai','Juni','Juli','Aug','Sep','Okt','Nov','Dez'];
  var MONAT_LANG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  /* Ohne Klick stehen drei Termine da, ab dem vierten gibt es "Mehr Termine".
     Bei den Releases das neueste groß und vier weitere: das füllt am Handy
     zwei Reihen und am Desktop genau das 4er-Raster neben der großen Kachel. */
  var SICHTBAR_TERMINE = 3;
  var SICHTBAR_RELEASES = 5;

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* Kurzer Fingerabdruck der angezeigten Daten. Stimmt er im Browser mit dem
     vorab geschriebenen HTML überein, bleibt das HTML stehen: kein Neuaufbau,
     kein Flackern der Cover. */
  function signatur(wert){
    var s = JSON.stringify(wert), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function berlinJetzt(){
    var t = {};
    new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Berlin', year:'numeric', month:'2-digit',
      day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'})
      .formatToParts(new Date()).forEach(function(p){ t[p.type] = p.value; });
    return t.year+'-'+t.month+'-'+t.day+'T'+t.hour+':'+t.minute;
  }

  /* ---------------- Termine ---------------- */

  /* Vergangene Termine ausblenden, falls die Datei schon ein paar Stunden alt ist */
  function kommendeTermine(daten){
    var jetzt = berlinJetzt(), heute = jetzt.slice(0,10);
    return ((daten && daten.termine) || []).filter(function(t){
      return t.ganztags ? t.ende > heute : t.ende > jetzt;
    });
  }

  function datumText(t){
    var j = +t.start.slice(0,4), m = +t.start.slice(5,7), d = +t.start.slice(8,10);
    var s = WOCHENTAG[new Date(Date.UTC(j, m-1, d)).getUTCDay()] + ' ' + d + '. ' + MONAT[m-1] + ' ' + j;
    if (!t.ganztags) s += ' &middot; ' + t.start.slice(11,16) + ' Uhr';
    return s;
  }

  function termineHtml(liste){
    var sig = signatur(liste);
    if (!liste.length) {
      return '<div class="tba" data-signatur="' + sig + '"><div class="big">Gerade keine Termine angekündigt</div>'
        + '<p>Neue Gigs erscheinen hier automatisch. Für Booking-Anfragen: '
        + '<a href="#booking">schreib mir</a>.</p></div>';
    }
    var zeilen = liste.map(function(t, i){
      var ticket = /^https?:\/\//.test(t.ticket || '')
        ? '<div class="act"><a class="btn ghost" href="' + esc(t.ticket) + '" target="_blank" rel="noopener"><span>Tickets</span></a></div>'
        : '';
      return '<div class="show' + (i >= SICHTBAR_TERMINE ? ' weitere' : '') + '"><div>'
        + '<div class="date">' + datumText(t) + '</div>'
        + '<div class="venue">' + esc(t.titel) + '</div>'
        + (t.ort ? '<div class="city">' + esc(t.ort) + '</div>' : '')
        + '</div>' + ticket + '</div>';
    }).join('');
    var knopf = liste.length > SICHTBAR_TERMINE
      ? '<div class="termine-aktion"><button type="button" class="btn" id="termine-mehr" aria-expanded="false" aria-controls="termin-liste">'
        + '<span>Mehr Termine ansehen</span></button></div>'
      : '';
    return '<div class="termin-liste" id="termin-liste" data-signatur="' + sig + '">' + zeilen + '</div>' + knopf;
  }

  /* Für Suchmaschinen: jeder Termin als schema.org MusicEvent */
  function termineLd(liste){
    return liste.map(function(t){
      var e = {
        '@context':'https://schema.org', '@type':'MusicEvent',
        name:NAME + ' @ ' + t.titel, startDate:t.startIso,
        eventStatus:'https://schema.org/EventScheduled',
        eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',
        location:{'@type':'Place', name:t.titel, address:t.adresse || t.ort || t.titel},
        performer:{'@type':'MusicGroup', name:NAME}
      };
      if (t.ticket) e.offers = {'@type':'Offer', url:t.ticket};
      return e;
    });
  }

  /* ---------------- Releases ---------------- */

  function releaseListe(daten){
    return ((daten && daten.releases) || []).filter(function(r){
      return /^https:\/\/soundcloud\.com\//.test(r.url || '');
    });
  }

  /* Kleine Kacheln bekommen den abgekürzten Monat. Jeder Teil bricht nur als
     Ganzes um, damit nie ein einzelnes "Min" in der nächsten Zeile steht. */
  function releaseZeile(r, lang){
    var teile = [];
    if (lang && r.genre) teile.push(esc(r.genre));
    var m = /^(\d{4})-(\d{2})/.exec(r.datum || '');
    if (m) teile.push((lang ? MONAT_LANG : MONAT)[+m[2] - 1] + ' ' + m[1]);
    if (r.minuten) teile.push(r.minuten + ' Min');
    return teile.map(function(t){ return '<span class="nw">' + t + '</span>'; }).join(' &middot; ');
  }

  /* Nur die Kacheln. Ein Track ohne Cover bekommt im Browser ein gezeichnetes
     Ersatzmotiv, das braucht die Zeichenfunktion der Seite. */
  function releasesHtml(liste){
    return liste.map(function(r, i){
      var neu = i === 0;
      var bild = /^releases\/[\w.-]+$/.test(r.bild || '')
        ? '<img src="' + r.bild + '"'
          + (r.bildKlein ? ' srcset="' + r.bildKlein + ' 300w, ' + r.bild + ' 500w"' : '')
          + ' sizes="' + (neu ? '(min-width:820px) 560px, calc(100vw - 40px)' : '(min-width:820px) 270px, calc(50vw - 27px)') + '"'
          + ' width="500" height="500" alt="Cover: ' + esc(r.titel) + '" loading="lazy" decoding="async">'
        : '';
      return '<a class="rel' + (neu ? ' neu' : '') + (i >= SICHTBAR_RELEASES ? ' weitere' : '') + '"'
        + ' href="' + esc(r.url) + '" target="_blank" rel="noopener">'
        +   '<div class="art">' + bild
        +     (neu ? '<span class="tag">Neu</span>' : '')
        +     '<span class="play" aria-hidden="true"></span></div>'
        +   '<div class="meta"><div class="t">' + esc(r.titel) + '</div>'
        +     '<div class="s">' + releaseZeile(r, neu) + '</div></div>'
        + '</a>';
    }).join('');
  }

  function releasesKnopf(liste){
    return liste.length > SICHTBAR_RELEASES
      ? '<button type="button" class="btn" id="releases-mehr" aria-expanded="false" aria-controls="relgrid">'
        + '<span>Mehr Releases ansehen</span></button>'
      : '';
  }

  /* Für Suchmaschinen: jedes Release als schema.org MusicRecording.
     basis = Adresse der Seite, damit die Cover-Adressen vollständig sind. */
  function releasesLd(liste, basis){
    return liste.map(function(r){
      var e = {
        '@context':'https://schema.org', '@type':'MusicRecording',
        name:r.titel, url:r.url, byArtist:{'@type':'MusicGroup', name:NAME}
      };
      if (r.datum) e.datePublished = r.datum.slice(0, 10);
      if (r.minuten) e.duration = 'PT' + r.minuten + 'M';
      if (r.genre) e.genre = r.genre;
      if (r.bild) e.image = basis + r.bild;
      return e;
    });
  }

  return {
    signatur: signatur,
    kommendeTermine: kommendeTermine, termineHtml: termineHtml, termineLd: termineLd,
    releaseListe: releaseListe, releasesHtml: releasesHtml, releasesKnopf: releasesKnopf, releasesLd: releasesLd
  };
})();
