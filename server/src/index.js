import { WebSocketServer } from "ws";
import { GameServer } from "./game.js";
import { randomUUID } from "node:crypto";

const PORT = process.env.PORT || 8787;

const config = {
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
};

const engine = new GameServer(config);
const rooms = engine.rooms;

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`SongClash server listening on port ${PORT}`);
});

function send(ws, type, payload) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...payload }));
}

function broadcast(room, type, payload) {
  for (const player of room.players.values()) {
    if (player.ws && player.ws.readyState === 1) {
      send(player.ws, type, payload);
    }
  }
}

function lobbyView(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: engine.scoreboard(room),
    state: room.state,
  };
}

function roundView(room) {
  const song = room.currentSong;
  const revealed = Boolean(room.roundResults && room.state === "playing" && Date.now() > (room.answerDeadline || 0));
  return {
    round: room.currentRound,
    totalRounds: room.totalRounds,
    state: room.state,
    answerDeadline: room.answerDeadline,
    previewUrl: song?.previewUrl || null,
    song: revealed || room.state === "finished" ? song : null,
    results: revealed ? room.roundResults : null,
  };
}

wss.on("connection", (ws) => {
  let player = null;
  let room = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, "error", { message: "Invalid JSON" });
      return;
    }

    const { type } = msg;

    if (type === "create") {
      room = engine.createRoom(msg.hostName);
      player = engine.join(room, { id: randomUUID(), name: msg.hostName });
      player.ws = ws;
      room.hostId = player.id;
      send(ws, "created", lobbyView(room));
      return;
    }

    if (type === "join") {
      const target = rooms.get(String(msg.code || "").toUpperCase());
      if (!target) return send(ws, "error", { message: "Room not found" });
      try {
        player = engine.join(target, { id: randomUUID(), name: msg.name });
      } catch (err) {
        return send(ws, "error", { message: err.message });
      }
      player.ws = ws;
      room = target;
      send(ws, "joined", lobbyView(room));
      broadcast(room, "lobby", lobbyView(room));
      return;
    }

    if (!room || !engine.rooms.has(room.code)) {
      return send(ws, "error", { message: "Not in a room" });
    }

    player.lastSeen = Date.now();

    switch (type) {
      case "start": {
        if (player.id !== room.hostId) return send(ws, "error", { message: "Only host can start" });
        engine
          .startGame(room, msg.rounds)
          .then(() => broadcast(room, "round", roundView(room)))
          .catch((err) => send(ws, "error", { message: err.message }));
        break;
      }
      case "answer": {
        const entry = engine.answer(room, player, msg);
        if (entry) {
          send(ws, "answerAck", entry);
          engine.maybeReveal(room);
          if (room.roundResults && room.roundResults.length >= room.players.size) {
            broadcast(room, "round", roundView(room));
          }
        } else {
          send(ws, "error", { message: "Cannot answer now" });
        }
        break;
      }
      case "reveal": {
        if (player.id !== room.hostId) return;
        engine.revealRound(room);
        broadcast(room, "round", roundView(room));
        break;
      }
      case "next": {
        if (player.id !== room.hostId) return send(ws, "error", { message: "Only host can advance" });
        engine.nextRound(room);
        broadcast(room, "round", roundView(room));
        break;
      }
      case "state": {
        send(ws, "round", roundView(room));
        break;
      }
      default:
        send(ws, "error", { message: `Unknown message type: ${type}` });
    }
  });

  ws.on("close", () => {
    if (room && player) {
      room.players.delete(player.id);
      if (room.hostId === player.id && room.players.size > 0) {
        room.hostId = room.players.keys().next().value;
      }
      broadcast(room, "lobby", lobbyView(room));
      if (room.players.size === 0) engine.rooms.delete(room.code);
    }
  });
});
