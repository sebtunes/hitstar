import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { onMessage, send } from "../lib/socket.js";
import { initVoice, startListening, stopListening } from "../lib/voice.js";

const ANSWER_SECONDS = 15;

export default function GameScreen({ session, initialRound, onLeave }) {
  const [round, setRound] = useState(initialRound || null);
  const [timeLeft, setTimeLeft] = useState(ANSWER_SECONDS);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const soundRef = useRef(null);
  const answeredRef = useRef(false);

  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === "round") {
        setRound(msg);
        answeredRef.current = false;
        setFeedback(null);
        setTitle("");
        setArtist("");
        setYear("");
        setTimeLeft(ANSWER_SECONDS);
      }
      if (msg.type === "answerAck") setFeedback(msg);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (round?.previewUrl && !soundRef.current) {
      Audio.Sound.createAsync({ uri: round.previewUrl }, { shouldPlay: true })
        .then(({ sound }) => (soundRef.current = sound))
        .catch(() => {});
    }
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [round?.round]);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [round?.round]);

  useEffect(() => {
    const cleanup = initVoice(
      (text) => {
        setListening(false);
        if (text) setTitle(text);
      },
      () => setListening(false)
    );
    return () => cleanup && cleanup();
  }, []);

  const submit = () => {
    if (answeredRef.current || !round) return;
    answeredRef.current = true;
    send("answer", { title, artist, year });
  };

  const toggleVoice = async () => {
    try {
      if (listening) {
        await stopListening();
        setListening(false);
      } else {
        setListening(true);
        await startListening("de-DE");
      }
    } catch (e) {
      setListening(false);
    }
  };

  if (!round) return <View style={styles.container}><Text style={styles.info}>Warte auf Runde…</Text></View>;

  const revealed = Boolean(round.song);
  const isLast = round.round > round.totalRounds;
  const scoreboard = round.state === "finished" ? null : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundLabel}>Runde {Math.min(round.round, round.totalRounds)} / {round.totalRounds}</Text>
        <View style={styles.timerBar}>
          <View style={[styles.timerFill, { width: `${(timeLeft / ANSWER_SECONDS) * 100}%` }]} />
        </View>
        <Text style={styles.time}>{timeLeft}s</Text>
      </View>

      {!revealed && round.state === "playing" && (
        <>
          <Text style={styles.prompt}>Was läuft da? 🎧</Text>
          <TextInput style={styles.input} placeholder="Titel" placeholderTextColor="#666" value={title} onChangeText={setTitle} />
          <TouchableOpacity style={[styles.micButton, listening && styles.micActive]} onPress={toggleVoice}>
            <Text style={styles.micText}>{listening ? "● Aufnahme…" : "🎤 Titel einsprechen"}</Text>
          </TouchableOpacity>
          <TextInput style={styles.input} placeholder="Interpret" placeholderTextColor="#666" value={artist} onChangeText={setArtist} />
          <TextInput style={[styles.input, styles.yearInput]} placeholder="Jahr (Bonus!)" placeholderTextColor="#666" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          <TouchableOpacity style={styles.submit} onPress={submit} disabled={answeredRef.current}>
            <Text style={styles.submitText}>Antworten!</Text>
          </TouchableOpacity>
        </>
      )}

      {revealed && (
        <View style={styles.reveal}>
          <Text style={styles.songTitle}>{round.song.title}</Text>
          <Text style={styles.songArtist}>{round.song.artist} · {round.song.year}</Text>
          {feedback && (
            <Text style={feedback.correct ? styles.correct : styles.wrong}>
              {feedback.correct ? `✅ Richtig! +${feedback.points} Punkte` : "❌ Leider falsch"}
              {feedback.yearOk ? " · Jahr korrekt! +100" : ""}
            </Text>
          )}
          {round.state === "playing" && (
            <TouchableOpacity style={styles.next} onPress={() => send("next", {})}>
              <Text style={styles.nextText}>Nächste Runde</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {round.state === "finished" && (
        <TouchableOpacity style={styles.submit} onPress={onLeave}>
          <Text style={styles.submitText}>Beenden</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  roundLabel: { color: "#9aa", fontSize: 14, marginBottom: 8 },
  timerBar: { height: 8, backgroundColor: "#1a1a2e", borderRadius: 4, overflow: "hidden" },
  timerFill: { height: 8, backgroundColor: "#7c4dff", borderRadius: 4 },
  time: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8, textAlign: "right" },
  prompt: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 16 },
  input: { backgroundColor: "#1a1a2e", color: "#fff", borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
  yearInput: { keyboardType: "number-pad" },
  micButton: { backgroundColor: "#2a2a4a", borderRadius: 10, padding: 14, marginBottom: 12, alignItems: "center" },
  micActive: { backgroundColor: "#ff5252" },
  micText: { color: "#fff", fontWeight: "600" },
  submit: { backgroundColor: "#7c4dff", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 18 },
  info: { color: "#9aa", textAlign: "center", marginTop: 40 },
  reveal: { alignItems: "center", marginTop: 20 },
  songTitle: { color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center" },
  songArtist: { color: "#9aa", fontSize: 18, marginTop: 8 },
  correct: { color: "#4caf50", fontSize: 18, marginTop: 16, fontWeight: "700" },
  wrong: { color: "#ff6b6b", fontSize: 18, marginTop: 16, fontWeight: "700" },
  next: { backgroundColor: "#2a2a4a", borderRadius: 12, padding: 16, marginTop: 24, width: "100%", alignItems: "center" },
  nextText: { color: "#fff", fontWeight: "700" },
});
