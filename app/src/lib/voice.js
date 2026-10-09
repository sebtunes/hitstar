import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export function initVoice(onResult, onError) {
  const cleanup = useSpeechRecognitionEvent({
    result: (event) => {
      const text = event?.results?.[0]?.transcript || "";
      if (text) onResult(text);
    },
    error: (event) => onError(event?.error?.message || "Spracherkennungsfehler"),
  });
  return cleanup;
}

export async function startListening(lang = "de-DE") {
  const supported = await ExpoSpeechRecognitionModule.supportsSpeechRecognition();
  if (!supported) throw new Error("Spracherkennung auf diesem Gerät nicht verfügbar");
  ExpoSpeechRecognitionModule.start({
    lang,
    interimResults: true,
    continuous: false,
  });
}

export async function stopListening() {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {}
}
