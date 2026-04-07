import config from '../config.js';

/** Remove emoji / pictographs so Edge TTS reads clean words (Unicode props need modern browsers). */
export function stripForEdgeTts(text) {
  if (!text) return '';
  try {
    return text
      .replace(/\p{Extended_Pictographic}/gu, ' ')
      .replace(/\uFE0F/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return text
      .replace(/[^\w\s.,!?'"/\-—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

/**
 * Synthesize with the same Microsoft Edge consumer stack as Python edge_tts (via Backend).
 */
export async function fetchFairyTtsBlob(text, { voice, signal } = {}) {
  const v =
    voice ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FAIRY_TTS_VOICE) ||
    'en-US-JennyNeural';
  const res = await fetch(`${config.apiBaseUrl}/tts/edge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: v,
      chatbotId: config.chatbotId,
    }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.detail || `TTS failed (${res.status})`);
  }
  return res.blob();
}
