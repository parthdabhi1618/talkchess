/**
 * Deterministic eval → HSL color pipeline.
 * NEVER touches the LLM. Based purely on centipawn delta.
 *
 * Hue: 120° (green) → 0° (red) using tanh saturation curve.
 * Small deltas near 0 stay near green; beyond ±300cp saturates to red.
 */

export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Centipawn delta thresholds (from mover's perspective, positive = improvement) */
const THRESHOLDS: Record<MoveClassification, number> = {
  best: 0.1,         // < 0.1 pawns worse than best
  good: 0.3,         // < 0.3
  inaccuracy: 0.5,   // < 0.5
  mistake: 1.0,      // < 1.0
  blunder: Infinity, // >= 1.0
};

export function classifyMove(evalDelta: number): MoveClassification {
  // evalDelta = eval_before - eval_after (positive = good move)
  // We care about how much worse the move was vs the best move
  const loss = Math.max(0, -evalDelta); // centipawns lost (in pawns)
  if (loss < THRESHOLDS.best) return 'best';
  if (loss < THRESHOLDS.good) return 'good';
  if (loss < THRESHOLDS.inaccuracy) return 'inaccuracy';
  if (loss < THRESHOLDS.mistake) return 'mistake';
  return 'blunder';
}

/**
 * Maps eval delta (in pawns, from mover's perspective) to an HSL hue.
 * 120° = green (great move), 0° = red (blunder).
 * Uses tanh saturation — small deltas stay near green.
 */
export function evalDeltaToHue(evalDelta: number): number {
  // evalDelta: positive = good for mover, negative = bad
  // Clamp to [-3, 3] pawns range for saturation
  const SATURATION_SCALE = 1.5; // tanh reaches ~0.9 at 1.5 pawns
  const loss = Math.max(0, -evalDelta); // only care about losses
  const saturated = Math.tanh(loss / SATURATION_SCALE);
  // Map [0, 1] → hue [120°, 0°]
  return 120 * (1 - saturated);
}

export function evalDeltaToColor(evalDelta: number): string {
  const hue = evalDeltaToHue(evalDelta);
  return `hsl(${hue.toFixed(1)}, 85%, 45%)`;
}

/** For mate scores: white winning = +10, black winning = -10 (normalized) */
export function mateScoreToEval(mateIn: number): number {
  return mateIn > 0 ? 10 : -10;
}

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  best: 'hsl(120, 85%, 40%)',
  good: 'hsl(85, 75%, 40%)',
  inaccuracy: 'hsl(50, 90%, 45%)',
  mistake: 'hsl(25, 90%, 50%)',
  blunder: 'hsl(0, 85%, 50%)',
};

export const CLASSIFICATION_SYMBOLS: Record<MoveClassification, string> = {
  best: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};
