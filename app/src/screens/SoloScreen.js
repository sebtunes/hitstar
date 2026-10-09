import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { initVoice, startListening, stopListening } from "../lib/voice.js";
import { fetchPreviewUrl } from "../lib/itunes.js";
import { parseSpeech } from "../lib/speechParse.js";
import { useAudioPlayer } from "expo-audio";
import { normalize, fuzzyMatch } from "../lib/match.js";
import { SOLO_SONGS } from "../lib/soloSongs.js";

const ANSWER_SECONDS = 15;
const TOTAL_ROUNDS = 10;

function PreviewPlayer({ song, playing, paused }) {
  const player = useAudioPlayer(song?.previewUrl ? { uri: song.previewUrl } : undefined);

  useEffect(() => {
    if (!player || !playing) return;
    try {
      if (paused) player.pause();
      else player.play();
    } catch {}
  }, [song?.previewUrl, playing, paused]);

  if (!playing) return null;
  if (paused) return <Text style={styles.pausedHint}>⏸ Musik pausiert – sprich jetzt!</Text>;
  return <ActivityIndicator color="#7c4dff" style={{ marginBottom: 12 }} />;
}

export default function SoloScreen({ onLeave }) {
  const [roundIdx, setRoundIdx] = useState(0);
  const [songs, setSongs] = useState([]);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [timeLeft, setTimeLeft] = useState(ANSWER_SECONDS);
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [listening, setListening] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loadError, setLoadError] = useState("");
  const roundStartRef = useRef(Date.now());
  const currentRef = useRef(null);

  useEffect(() => {
    const shuffled = [...SOLO_SONGS].sort(() => Math.random() - 0.5).slice(0, TOTAL_ROUNDS);
    setSongs(shuffled.map((s) => ({ ...s, previewUrl: null, loading: true })));
    roundStartRef.current = Date.now();
    const cleanup = initVoice(
      (text) => {
        setListening(false);
        if (!text) return;
        const parsed = parseSpeech(text, currentRef.current);
        if (parsed?.title) setTitle((prev) => prev || parsed.title);
        if (parsed?.artist) setArtist((prev) => prev || parsed.artist);
        if (!parsed?.title && !parsed?.artist) setTitle(text);
      },
      () => setListening(false)
    );
    return () => cleanup && cleanup();
  }, []);

  const current = songs[roundIdx];
  currentRef.current = current;

  useEffect(() => {
    if (!current || feedback || current.previewUrl !== null) return;
    let cancelled = false;
    (async () => {
      const result = await fetchPreviewUrl(current.title, current.artist);
      if (cancelled) return;
      if (!result) {
        setLoadError("Snippet nicht gefunden – rate aus dem Gedächtnis!");
        setSongs((prev) => {
          const copy = [...prev];
          copy[roundIdx] = { ...copy[roundIdx], previewUrl: undefined, loading: false };
          return copy;
        });
        return;
      }
      setSongs((prev) => {
        const copy = [...prev];
        copy[roundIdx] = { ...copy[roundIdx], previewUrl: result.previewUrl, loading: false };
        return copy;
      });
    })();
    return () => { cancelled = true; };
  }, [roundIdx, current?.previewUrl, feedback]);

  useEffect(() => {
    if (!current || finished) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartRef.current) / 1000);
      const left = Math.max(0, ANSWER_SECONDS - elapsed);
      setTimeLeft(left);
      if (left === 0) submit(true);
    }, 250);
    return () => clearInterval(interval);
  }, [current, title, artist, year]);

  const submit = (timeout = false) => {
    if (!current || feedback) return;
    const elapsedMs = Date.now() - roundStartRef.current;
    const speed = Math.max(0, ANSWER_SECONDS * 1000 - elapsedMs) / (ANSWER_SECONDS * 1000);
    const titleOk = fuzzyMatch(normalize(title), normalize(current.title));
    const artistOk = fuzzyMatch(normalize(artist), normalize(current.artist));
    const yearOk = String(year).trim() === String(current.year);
    let points = 0;
    if (titleOk) points += 300;
    if (artistOk) points += 200;
    if (titleOk && artistOk) points += Math.round(500 * speed);
    if (yearOk) points += 100;
    if (titleOk && artistOk) setScore((s) => s + points);
    setFeedback({ titleOk, artistOk, yearOk, points: titleOk && artistOk ? points : 0, correct: titleOk && artistOk, timeout });
  };

  const next = () => {
    if (roundIdx + 1 >= songs.length) {
      setFinished(true);
      return;
    }
    setRoundIdx((i) => i + 1);
    setTitle(""); setArtist(""); setYear("");
    setFeedback(null);
    setLoadError("");
    setTimeLeft(ANSWER_SECONDS);
    roundStartRef.current = Date.now();
  };

  const toggleVoice = async () => {
    if (!current) return;
    try {
      if (listening) {
        await stopListening();
        setListening(false);
      } else {
        setListening(true);
        await startListening("de-DE");
      }
    } catch {
      setListening(false);
    }
  };

  if (finished) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🏁 Runde vorbei!</Text>
        <Text style={styles.bigScore}>{score} Punkte</Text>
        <TouchableOpacity style={styles.submit} onPress={onLeave}>
          <Text style={styles.submitText}>Fertig</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!current) return <View style={styles.container}><Text style={styles.info}>Lade…</Text></View>;

  const playing = !feedback && Boolean(current.previewUrl);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundLabel}>Solo · Runde {roundIdx + 1} / {songs.length}</Text>
        <Text style={styles.score}>Score: {score}</Text>
        <View style={styles.timerBar}>
          <View style={[styles.timerFill, { width: `${(timeLeft / ANSWER_SECONDS) * 100}%` }]} />
        </View>
      </View>

      {!feedback ? (
        <>
          <Text style={styles.prompt}>Hörst du den Song? 🎧</Text>
          {playing ? (
            <PreviewPlayer song={current} playing={playing} paused={listening} />
          ) : (
            <Text style={styles.hint}>{loadError || "Lade Snippet…"}</Text>
          )}
          <TextInput style={styles.input} placeholder="Titel" placeholderTextColor="#666" value={title} onChangeText={setTitle} />
          <TouchableOpacity style={[styles.micButton, listening && styles.micActive]} onPress={toggleVoice}>
            <Text style={styles.micText}>{listening ? "● Sprich jetzt… (tippen zum Stoppen)" : "🎤 Titel & Interpret einsprechen"}</Text>
          </TouchableOpacity>
          {listening && <Text style={styles.voiceHint}>Sag z. B. „Bohemian Rhapsody von Queen" – Reihenfolge egal!</Text>}
          <TextInput style={styles.input} placeholder="Interpret" placeholderTextColor="#666" value={artist} onChangeText={setArtist} />
          <TextInput style={styles.input} placeholder="Jahr (Bonus!)" placeholderTextColor="#666" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          <TouchableOpacity style={styles.submit} onPress={() => submit(false)}>
            <Text style={styles.submitText}>Antworten!</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.reveal}>
          <Text style={styles.songTitle}>{current.title}</Text>
          <Text style={styles.songArtist}>{current.artist} · {current.year}</Text>
          <Text style={feedback.correct ? styles.correct : styles.wrong}>
            {feedback.timeout ? "⏰ Zeit abgelaufen!" : feedback.correct ? `✅ +${feedback.points} Punkte` : "❌ Falsch"}
            {feedback.yearOk ? " · Jahr: +100" : ""}
          </Text>
          <TouchableOpacity style={styles.submit} onPress={next}>
            <Text style={styles.submitText}>{roundIdx + 1 >= songs.length ? "Ergebnis" : "Nächste Runde"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f1a", padding: 24, paddingTop: 60 },
  header: { marginBottom: 24 },
  roundLabel: { color: "#9aa", fontSize: 14 },
  score: { color: "#7c4dff", fontSize: 16, fontWeight: "700", marginVertical: 6 },
  timerBar: { height: 8, backgroundColor: "#1a1a2e", borderRadius: 4, overflow: "hidden" },
  timerFill: { height: 8, backgroundColor: "#7c4dff" },
  prompt: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint: { color: "#667", fontSize: 13, marginBottom: 16 },
  pausedHint: { color: "#ff9800", fontSize: 14, fontWeight: "700", marginBottom: 12, textAlign: "center" },
  voiceHint: { color: "#9aa", fontSize: 12, marginBottom: 12, textAlign: "center" },
  input: { backgroundColor: "#1a1a2e", color: "#fff", borderRadius: 10, padding: 14, fontSize: 16, marginBottom: 12 },
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
  title: { color: "#fff", fontSize: 28, fontWeight: "800", marginBottom: 16 },
  bigScore: { color: "#7c4dff", fontSize: 48, fontWeight: "900", marginBottom: 32 },
});
