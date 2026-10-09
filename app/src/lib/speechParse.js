import { normalize, similarity } from "./match.js";

export function parseSpeech(text, song) {
  const raw = String(text || "").trim();
  if (!raw || !song) return null;

  const title = normalize(song.title);
  const artist = normalize(song.artist);
  const words = normalize(raw).split(" ").filter(Boolean);

  if (words.length === 0) return null;

  let best = { score: -1, title: "", artist: "" };

  const whole = normalize(raw);
  const wholeTitle = similarity(whole, title);
  const wholeArtist = similarity(whole, artist);
  if (wholeTitle > 0.7) best = { score: wholeTitle, title: song.title, artist: "" };
  if (wholeArtist > 0.7 && wholeArtist > best.score) best = { score: wholeArtist, title: "", artist: song.artist };

  for (let i = 1; i < words.length; i++) {
    const partA = words.slice(0, i).join(" ");
    const partB = words.slice(i).join(" ");
    if (!partA || !partB) continue;

    const aTitle = similarity(partA, title) + similarity(partB, artist);
    const aArtist = similarity(partA, artist) + similarity(partB, title);
    const maxScore = Math.max(aTitle, aArtist);
    if (maxScore > best.score) {
      best =
        aTitle >= aArtist
          ? { score: aTitle, title: words.slice(0, i).join(" "), artist: words.slice(i).join(" ") }
          : { score: aArtist, title: words.slice(i).join(" "), artist: words.slice(0, i).join(" ") };
    }
  }

  const singleWordAsTitle = similarity(whole, title);
  if (singleWordAsTitle > 0.6 && singleWordAsTitle > best.score) {
    best = { score: singleWordAsTitle, title: raw, artist: "" };
  }

  if (best.score < 0.5) return { title: raw, artist: "" };

  if (similarity(normalize(best.title), title) < 0.5 && best.title) best.title = best.title;
  return best;
}
