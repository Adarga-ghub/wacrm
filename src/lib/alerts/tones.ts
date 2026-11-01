"use client";

/**
 * Message-alert tones, synthesized with the Web Audio API so there are
 * no audio assets to ship or cache. Each tone is a short sequence of
 * enveloped notes (sine/triangle + optional harmonic) — soft attack,
 * exponential decay — which reads as "professional chime" rather than
 * "game beep".
 */

export type ToneId = "chime" | "crystal" | "bell" | "pop" | "rise";

export const TONES: { id: ToneId; label: string; description: string }[] = [
  { id: "chime", label: "Chime", description: "Two soft ascending notes" },
  { id: "crystal", label: "Crystal", description: "Bright, short glass ping" },
  { id: "bell", label: "Bell", description: "Warm bell with a long tail" },
  { id: "pop", label: "Pop", description: "Discreet bubble pop" },
  { id: "rise", label: "Rise", description: "Three-note rising alert" },
];

interface Note {
  freq: number;
  /** Seconds from the tone's start. */
  at: number;
  /** Decay length in seconds. */
  dur: number;
  type?: OscillatorType;
  /** Relative gain of this note (0–1). */
  gain?: number;
  /** Add a quiet overtone at this frequency multiple (bell-like). */
  harmonic?: number;
  /** Glide to this frequency over the note (pop/bubble). */
  glideTo?: number;
}

const PATTERNS: Record<ToneId, Note[]> = {
  chime: [
    { freq: 880, at: 0, dur: 0.35, type: "sine", gain: 0.9 },
    { freq: 1318.5, at: 0.13, dur: 0.55, type: "sine", gain: 0.8 },
  ],
  crystal: [
    { freq: 2093, at: 0, dur: 0.25, type: "sine", gain: 0.6, harmonic: 2 },
    { freq: 2637, at: 0.07, dur: 0.4, type: "sine", gain: 0.45 },
  ],
  bell: [
    { freq: 659.3, at: 0, dur: 1.4, type: "sine", gain: 0.9, harmonic: 2.76 },
  ],
  pop: [
    { freq: 420, at: 0, dur: 0.14, type: "sine", gain: 1, glideTo: 980 },
  ],
  rise: [
    { freq: 784, at: 0, dur: 0.22, type: "triangle", gain: 0.8 },
    { freq: 988, at: 0.12, dur: 0.22, type: "triangle", gain: 0.8 },
    { freq: 1175, at: 0.24, dur: 0.45, type: "triangle", gain: 0.85 },
  ],
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Browsers (iOS Safari and Android Chrome especially) keep an
 * AudioContext suspended until a user gesture. Call this from any
 * tap/click so later, gesture-less alerts can actually make sound.
 */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state === "suspended") void c.resume().catch(() => {});
}

/** Play a tone. `volume` is 0–1. Never throws. */
export function playTone(id: ToneId, volume = 0.7): void {
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    const pattern = PATTERNS[id] ?? PATTERNS.chime;
    const master = c.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * 0.5;
    master.connect(c.destination);
    const t0 = c.currentTime + 0.02;

    for (const n of pattern) {
      const partials: { freq: number; gain: number }[] = [
        { freq: n.freq, gain: n.gain ?? 1 },
      ];
      if (n.harmonic) {
        partials.push({ freq: n.freq * n.harmonic, gain: (n.gain ?? 1) * 0.25 });
      }
      for (const p of partials) {
        const osc = c.createOscillator();
        const env = c.createGain();
        osc.type = n.type ?? "sine";
        const start = t0 + n.at;
        const end = start + n.dur;
        osc.frequency.setValueAtTime(p.freq, start);
        if (n.glideTo) {
          osc.frequency.exponentialRampToValueAtTime(
            p.freq * (n.glideTo / n.freq),
            end,
          );
        }
        env.gain.setValueAtTime(0.0001, start);
        env.gain.exponentialRampToValueAtTime(p.gain, start + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(env);
        env.connect(master);
        osc.start(start);
        osc.stop(end + 0.05);
      }
    }
  } catch {
    // Audio is best-effort — never let a sound failure break the inbox.
  }
}
