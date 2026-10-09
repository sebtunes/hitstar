# 🎵 SongClash

Eine von Hitster inspirierte Musik-Quiz-App (Expo/React Native): Errate **Titel**, **Interpret** und das **Erscheinungsjahr** eines Songs – je schneller du antwortest, desto mehr Punkte gibt es (Kahoot-Prinzip). Antworten kannst du per Tastatur **oder Spracheingabe** 🎤.

## Projektstruktur

```
server/   Node.js-WebSocket-Gameserver (Raum-Codes, Punkte, Timer, Spotify)
app/      Expo-App (Solo & Online-Multiplayer, Spracheingabe)
```

## Punkte

| Leistung | Punkte |
|---|---|
| Titel richtig | 300 |
| Interpret richtig | 200 |
| Beide richtig | + bis zu 500 Bonus (skaliert mit Restzeit: `Restzeit / 15s × 500`) |
| Jahr richtig | +100 |

Falsch geraten = 0 Punkte für die Runde. Ein Spielfehler im Titel/Interpret (Tippfehler, "feat."-Angaben, Umlaute) wird per unscharfem Match verziehen.

## Server auf dem Heimserver betreiben

Der Server ist ein reiner Node-Prozess ohne Datenbank. Er läuft dort, wo er von außen erreichbar ist – idealerweise auf deinem Heimserver.

```bash
cd server
npm install
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=yyy npm start   # Port 8787 (PORT env)
```

Ohne Spotify-Keys läuft der Server mit einer eingebauten Demo-Songliste (funktioniert sofort; ohne `previewUrl` zeigt die App die Rate-Frage ohne Audio).

### Aus dem Internet erreichbar machen

1. **Port-Freigabe:** Im Router den Port (z. B. 8787/TCP) an die interne IP des Heimservers weiterleiten.
2. **DynDNS:** Falls keine feste IP: kostenlosen DynDNS-Namen einrichten (z. B. DuckDNS, MyFritz).
3. **HTTPS ist Pflicht:** iOS und Android verweigern unsichere Verbindungen; die Spracheingabe braucht ohnehin TLS. Am einfachsten mit **Caddy** als Reverse-Proxy vor dem Node-Server – Let's-Encrypt-Zertifikate gibt es automatisch:

   ```
   musik.example.com {
       reverse_proxy localhost:8787
   }
   ```

   Caddy braucht dafür Port 80/443 frei und einen DNS-Namen, der auf deine öffentliche IP zeigt.
4. **Dauerbetrieb:** `pm2 start src/index.js --name songclash` oder eine systemd-Unit.

### Alternative ohne offene Ports

Für private Runden: **Tailscale** auf dem Heimserver + auf allen Spieler-Handys. Alle Geräte sind dann im selben virtuellen Netz, die App verbindet sich mit `http://<tailscale-ip>:8787`. Kein Port-Freigabe, kein Zertifikat nötig (in der App dann `ws://` statt `wss://` verwenden – aktuell setzt die App `wss://` voraus, siehe `app/src/screens/HomeScreen.js`).

## App starten (Entwicklung)

```bash
cd app
npm install
npm start        # Expo Dev Server, QR-Code scannen
```

In der App: Server-Adresse (z. B. `musik.example.com`) eintragen, Namen wählen, Raum erstellen oder mit 5-stelligem Code joinen. Solo-Modus läuft komplett ohne Server.

## Spielablauf

- **Host** erstellt Raum → 5-stelliger Code → Spieler treten bei → Host startet.
- Pro Runde: 15 Sekunden Zeit, alle Spieler antworten parallel.
- Auflösung zeigt Titel/Interpret/Jahr und die Punkte.
- Nach 10 Runden (einstellbar, 1–30) Endstand.

## Nächste Schritte / Ideen

- Spotify-Preview-URLs (30s-Snippets) – viele Songs haben aktuell keine `preview_url` mehr; Alternative: iTunes Search API (kostenlos, mit Snippets)
- Host-Steuerelement "Nächste Runde" / Auto-Advance
- Endstand-Screen mit Scoreboard im Multiplayer
- Streaks & Emoji-Reaktionen
