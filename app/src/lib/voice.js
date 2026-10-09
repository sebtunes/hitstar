import Voice from "@react-native-voice/voice";
import { Platform } from "react-native";

export function initVoice(onResult, onError) {
  Voice.onSpeechResults = (e) => {
    const text = e.value?.[0] || "";
    onResult(text);
  };
  Voice.onSpeechError = (e) => onError(e.error?.message || "Speech error");
  return async () => {
    try {
      await Voice.stop();
    } catch {}
    try {
      await Voice.destroy();
    } catch {}
    Voice.destroy = Voice.destroy?.bind(Voice);
  };
}

export async function startListening(lang = "de-DE") {
  const supported = await Voice.isSpeechAvailable();
  if (!supported) throw new Error("Spracherkennung auf diesem Gerät nicht verfügbar");
  await Voice.start(lang);
}

export async function stopListening() {
  try {
    await Voice.stop();
  } catch {}
}
