import { songs as fallbackSongs } from "./songs.js";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/v1/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

export class SongProvider {
  constructor({ clientId, clientSecret, playlists }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.playlists = playlists || [];
    this.token = null;
    this.tokenExpires = 0;
    this.cachedTracks = [];
  }

  get enabled() {
    return Boolean(this.clientId && this.clientSecret);
  }

  async ensureToken() {
    if (this.token && Date.now() < this.tokenExpires - 30_000) return this.token;
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`);
    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpires = Date.now() + data.expires_in * 1000;
    return this.token;
  }

  async searchTracks(query, limit) {
    const token = await this.ensureToken();
    const url = new URL(SPOTIFY_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("type", "track");
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
    const data = await res.json();
    return (data.tracks?.items || [])
      .filter((t) => t.preview_url && t.name && t.artists?.length)
      .map((t) => ({
        id: t.id,
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        year: (t.album?.release_date || "").slice(0, 4),
        previewUrl: t.preview_url,
        image: t.album?.images?.[0]?.url || null,
      }));
  }

  async fetchTracks(count) {
    if (this.cachedTracks.length >= count) {
      return this.cachedTracks.splice(0, count);
    }
    const tracks = [];
    if (this.enabled) {
      const decades = ["1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];
      for (const decade of decades) {
        try {
          const batch = await this.searchTracks(
            `genre:pop year:${decade.slice(0, 3)}0-${decade.slice(0, 3)}9`,
            50
          );
          tracks.push(...batch);
        } catch (err) {
          console.error("Spotify fetch error:", err.message);
          break;
        }
      }
    }
    if (tracks.length < count) {
      const demo = [...fallbackSongs];
      for (let i = demo.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [demo[i], demo[j]] = [demo[j], demo[i]];
      }
      tracks.push(...demo);
    }
    const unique = new Map();
    for (const t of tracks) unique.set(t.id, t);
    this.cachedTracks = [...unique.values()];
    return this.cachedTracks.splice(0, count);
  }
}
