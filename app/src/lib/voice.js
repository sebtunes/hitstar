import Voice from "@react-native-voice/voice";

export function initVoice(onResult, onError) {
  const resultHandler = (e) => {
    const text = e.value?.[0] || "";
    if (text) onResult(text);
  };
  const errorHandler = (e) => onError(e?.error?.message || e?.error?.code || "Speech error");
  const startHandler = () => {};
  const endHandler = () => {};

  Voice.onSpeechResults = resultHandler;
  Voice.onSpeechPartialResults = resultHandler;
  Voice.onSpeechError = errorHandler;
  Voice.onSpeechStart = startHandler;
  Voice.onSpeechEnd = endHandler;

  return async () => {
    Voice.onSpeechResults = null;
    Voice.onSpeechPartialResults = null;
    Voice.onSpeechError = null;
    Voice.onSpeechStart = null;
    Voice.onSpeechEnd = null;
    try { await Voice.destroy(); } catch {}
  };
}

export async function startListening(lang = "de-DE") {
  const supported = await Voice.isSpeechAvailable();
  if (!supported) throw new Error("Spracherkennung auf diesem Gerät nicht verfügbar");
  try { await Voice.stop(); } catch {}
  await Voice.start(lang);
}

export async function stopListening() {
  try { await Voice.stop(); } catch {}
  try { await Voice.cancel(); } catch {}
}
