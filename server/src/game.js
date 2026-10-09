import { SongProvider } from "./spotify.js";

const ROUND_SECONDS = 20;
const ANSWER_SECONDS = 15;
const MAX_PLAYERS = 10;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class GameServer {
  constructor(config) {
    this.provider = new SongProvider(config);
    this.rooms = new Map();
    setInterval(() => this.sweepIdleRooms(), 60_000).unref();
  }

  sweepIdleRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const allIdle = room.players.every((p) => now - p.lastSeen > 300_000);
      if (allIdle || room.players.length === 0) this.rooms.delete(code);
    }
  }

  newCode() {
    let code;
    do {
      code = Array.from(
        { length: 5 },
        () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostName) {
    const code = this.newCode();
    const room = {
      code,
      hostId: null,
      players: new Map(),
      state: "lobby",
      currentRound: 0,
      totalRounds: 10,
      songs: [],
      currentSong: null,
      roundStartedAt: null,
      answerDeadline: null,
      roundResults: null,
      timer: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  join(room, { id, name }) {
    if (room.players.size >= MAX_PLAYERS) throw new Error("Room is full");
    if (room.state !== "lobby") throw new Error("Game already running");
    room.players.set(id, {
      id,
      name: (name || "Player").slice(0, 20),
      score: 0,
      lastSeen: Date.now(),
    });
    if (!room.hostId) room.hostId = id;
    return room.players.get(id);
  }

  async startGame(room, rounds) {
    if (room.state !== "lobby") return;
    room.totalRounds = Math.min(Math.max(rounds || 10, 1), 30);
    room.songs = await this.provider.fetchTracks(room.totalRounds);
    room.state = "playing";
    room.currentRound = 0;
    this.nextRound(room);
  }

  nextRound(room) {
    room.currentRound += 1;
    if (room.currentRound > room.totalRounds || room.songs.length === 0) {
      this.endGame(room);
      return;
    }
    room.currentSong = room.songs.shift();
    room.roundResults = null;
    room.roundStartedAt = Date.now();
    room.answerDeadline = room.roundStartedAt + ANSWER_SECONDS * 1000;
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => this.revealRound(room), ANSWER_SECONDS * 1000);
  }

  answer(room, player, { title, artist, year }) {
    if (room.state !== "playing" || !room.currentSong || room.roundResults) return null;
    const song = room.currentSong;
    const elapsedMs = Date.now() - room.roundStartedAt;
    const timeLeft = Math.max(0, ANSWER_SECONDS * 1000 - elapsedMs);
    const speedFactor = timeLeft / (ANSWER_SECONDS * 1000);

    const normalize = (s) =>
      (s || "").toLowerCase().replace(/[^a-z0-9äöüß ]/gi, "").replace(/\s+/g, " ").trim();

    const titleOk = fuzzyMatch(normalize(title), normalize(song.title));
    const artistOk = fuzzyMatch(normalize(artist), normalize(song.artist));
    const yearOk = year && String(year).trim() === String(song.year).trim();

    let points = 0;
    if (titleOk) points += 300;
    if (artistOk) points += 200;
    if (titleOk && artistOk) points += Math.round(500 * speedFactor);
    if (yearOk) points += 100;

    const correct = titleOk && artistOk;
    if (correct) player.score += points;

    const entry = {
      playerId: player.id,
      titleOk,
      artistOk,
      yearOk,
      correct,
      points: correct ? points : 0,
      answeredAt: Date.now(),
    };
    room.roundResults = room.roundResults || [];
    room.roundResults.push(entry);
    return entry;
  }

  maybeReveal(room) {
    if (room.state === "playing" && room.roundResults?.length >= room.players.size) {
      clearTimeout(room.timer);
      this.revealRound(room);
    }
  }

  revealRound(room) {
    if (room.state !== "playing") return;
    room.roundResults = room.roundResults || [];
    if (room.timer) clearTimeout(room.timer);
    room.timer = setTimeout(() => this.nextRound(room), ROUND_SECONDS * 1000 - (ANSWER_SECONDS * 1000) + 5000);
  }

  endGame(room) {
    room.state = "finished";
    if (room.timer) clearTimeout(room.timer);
    room.currentSong = null;
  }

  scoreboard(room) {
    return [...room.players.values()]
      .map((p) => ({ id: p.id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
  }
}

function fuzzyMatch(guess, target) {
  if (!guess || !target) return false;
  if (guess === target) return true;
  const t = target.replace(/\s+/g, " ");
  if (guess.length >= 4 && t.includes(guess)) return true;
  return similarity(guess, t) >= 0.8;
}

function similarity(a, b) {
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length, 1);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}
