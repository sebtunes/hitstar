const ITUNES_URL = "https://itunes.apple.com/search";

export async function fetchPreviewUrl(title, artist) {
  try {
    const query = `${artist} ${title}`;
    const url = `${ITUNES_URL}?term=${encodeURIComponent(query)}&entity=song&limit=5`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    for (const result of data.results || []) {
      if (result.previewUrl) {
        return {
          previewUrl: result.previewUrl,
          year: (result.releaseDate || "").slice(0, 4),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
