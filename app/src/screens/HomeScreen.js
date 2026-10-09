import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import LobbyScreen from "./LobbyScreen.js";
import GameScreen from "./GameScreen.js";
import SoloScreen from "./SoloScreen.js";

export default function HomeScreen() {
  const [screen, setScreen] = useState("home");
  const [wsUrl, setWsUrl] = useState("");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState(null);

  if (screen === "lobby") return <LobbyScreen session={session} onLeave={() => setScreen("home")} />;
  if (screen === "game") return <GameScreen session={session} onLeave={() => setScreen("home")} />;
  if (screen === "solo") return <SoloScreen onLeave={() => setScreen("home")} />;

  const startOnline = (mode) => {
    if (!name.trim()) return;
    const url = wsUrl.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!url) return;
    setSession({ wsUrl: `wss://${url}`, name, joinCode: joinCode.trim().toUpperCase(), mode });
    setScreen("lobby");
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>🎵 SongClash</Text>
      <Text style={styles.subtitle}>Errate Titel, Interpreten und das Jahr – je schneller, desto mehr Punkte!</Text>

      <View style={styles.section}>
        <TextInput style={styles.input} placeholder="Dein Name" placeholderTextColor="#888" value={name} onChangeText={setName} />
        <TextInput
          style={styles.input}
          placeholder="Server-Adresse (z.B. musik.example.com)"
          placeholderTextColor="#888"
          value={wsUrl}
          onChangeText={setWsUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={() => startOnline("host")}>
            <Text style={styles.buttonText}>Raum erstellen</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="RAUM-CODE"
            placeholderTextColor="#888"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
            maxLength={5}
          />
          <TouchableOpacity style={[styles.button, styles.joinButton]} onPress={() => startOnline("join")}>
            <Text style={styles.buttonText}>Beitreten</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.soloButton} onPress={() => setScreen("solo")}>
        <Text style={styles.soloButtonText}>Alleine spielen 🎧</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", padding: 24, justifyContent: "center" },
  title: { fontSize: 36, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 8 },
  subtitle: { color: "#9aa", textAlign: "center", marginBottom: 32, fontSize: 14 },
  section: { backgroundColor: "#1a1a2e", borderRadius: 16, padding: 16 },
  row: { flexDirection: "row", gap: 8, marginTop: 12 },
  input: { backgroundColor: "#0f0f1a", color: "#fff", borderRadius: 10, padding: 14, fontSize: 16, flex: 1 },
  codeInput: { flex: 0.6, letterSpacing: 3, textAlign: "center", fontWeight: "700" },
  button: { backgroundColor: "#7c4dff", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", flex: 1 },
  joinButton: { flex: 0.4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  soloButton: { marginTop: 24, alignItems: "center" },
  soloButtonText: { color: "#7c4dff", fontSize: 16, fontWeight: "700" },
});
