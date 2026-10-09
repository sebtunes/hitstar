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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startListening(lang = "de-DE", attempts = 3) {
  const supported = await ExpoSpeechRecognitionModule.supportsSpeechRecognition();
  if (!supported) throw new Error("Spracherkennung auf diesem Gerät nicht verfügbar");

  try {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) throw new Error("Mikrofon-/Spracherkennungsberechtigung fehlt");
  } catch (e) {
    if (String(e?.message || e).includes("Berechtigung")) throw e;
  }

  for (let i = 0; i < attempts; i++) {
    try {
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
      });
      return;
    } catch (e) {
      const msg = String(e?.message || e);
      if (/runtime|not ready|busy/i.test(msg) && i < attempts - 1) {
        await sleep(500);
        continue;
      }
      throw new Error(msg);
    }
  }
}

export async function stopListening() {
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch {}
}
