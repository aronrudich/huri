export const COLORS = {
  primary: "#2F6BFF",
  primaryDark: "#1E4FCC",
  surface: "#0B1220",
  surfaceMid: "#121A2E",
  soft: "#F5F7FB",
  text: "#0B1220",
  mute: "#6B7691",
  border: "#E3E8F2",
  amber: "#F5A524",
  amberSoft: "#FFF4DC",
  success: "#16A34A",
};

// Frame durations matched to narration paragraph word counts at ~0.385s/word, 30fps.
export const SCENES = {
  intro: 150,        // 5s
  messages: 440,     // 14.6s
  carTab: 277,       // 9.2s
  blocking: 750,     // 25s
  queue: 312,        // 10.4s
  buttons: 474,      // 15.8s
  spotZero: 254,     // 8.5s
  lot: 220,          // 7.3s
  profile: 220,      // 7.3s
  problem: 510,      // 17s
  closing: 347,      // 11.6s
} as const;
