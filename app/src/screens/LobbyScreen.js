import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { connect, onMessage, send, disconnect } from "../lib/socket.js";

export default function LobbyScreen({ session, onLeave }) {
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(session.mode === "host");

  useEffect(() => {
    let mounted = true;
    connect(session.wsUrl)
      .then(() => {
        if (session.mode === "host") send("create", { hostName: session.name });
        else send("join", { code: session.joinCode, name: session.name });
      })
      .catch(() => setError("Verbindung fehlgeschlagen – Server-Adresse prüfen"));

    const off = onMessage((msg) => {
      if (!mounted) return;
      if (msg.type === "created" || msg.type === "joined") {
        setLobby(msg);
        setIsHost(msg.hostId && msg.type === "created" ? true : session.mode === "host");
      }
      if (msg.type === "lobby") setLobby((prev) => ({ ...prev, ...msg }));
      if (msg.type === "round") {
        setLobby((prev) => ({ ...prev, started: true, roundMsg: msg }));
      }
      if (msg.type === "error") setError(msg.message);
    });
    return () => {
      mounted = false;
      off();
      disconnect();
    };
  }, []);

  if (lobby?.started) return <GameScreen session={session} initialRound={lobby.roundMsg} onLeave={onLeave} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Warteraum</Text>
      {lobby && (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Raum-Code</Text>
          <Text style={styles.code}>{lobby.code}</Text>
          <Text style={styles.hint}>Teile den Code mit deinen Freunden!</Text>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={lobby?.players || []}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <Text style={styles.player}>🎤 {item.name}</Text>}
        style={{ width: "100%", marginTop: 16 }}
      />
      {isHost && lobby && (
        <TouchableOpacity style={styles.startButton} onPress={() => send("start", { rounds: 10 })}>
          <Text style={styles.startButtonText}>Spiel starten ({lobby.players?.length} Spieler)</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onLeave}>
        <Text style={styles.leave}>Zurück</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", padding: 24, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 24 },
  codeBox: { backgroundColor: "#1a1a2e", borderRadius: 16, padding: 24, alignItems: "center", width: "100%" },
  codeLabel: { color: "#9aa", fontSize: 12, textTransform: "uppercase" },
  code: { color: "#fff", fontSize: 40, fontWeight: "900", letterSpacing: 6, marginVertical: 8 },
  hint: { color: "#7c4dff", fontSize: 13 },
  error: { color: "#ff6b6b", marginTop: 12 },
  player: { color: "#dde", fontSize: 18, padding: 8 },
  startButton: { backgroundColor: "#7c4dff", borderRadius: 12, padding: 16, marginTop: 24, width: "100%", alignItems: "center" },
  startButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  leave: { color: "#889", marginTop: 24 },
});
