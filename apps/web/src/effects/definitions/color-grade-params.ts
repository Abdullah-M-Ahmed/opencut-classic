/** Pure, bounded conversion of user controls into GPU color-grade uniforms. */
export const COLOR_GRADE_DEFAULTS = Object.freeze({
  exposure: 0,
  contrast: 0,
  saturation: 100,
  temperature: 0,
  tint: 0,
  gamma: 1,
});

function boundedNumber(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

export function colorGradeUniforms(params: Record<string, unknown>) {
  return {
    u_exposure: boundedNumber(params.exposure, COLOR_GRADE_DEFAULTS.exposure, -2, 2),
    u_contrast: boundedNumber(params.contrast, COLOR_GRADE_DEFAULTS.contrast, -100, 100) / 100,
    u_saturation: boundedNumber(params.saturation, COLOR_GRADE_DEFAULTS.saturation, 0, 200) / 100,
    u_temperature: boundedNumber(params.temperature, COLOR_GRADE_DEFAULTS.temperature, -100, 100) / 100,
    u_tint: boundedNumber(params.tint, COLOR_GRADE_DEFAULTS.tint, -100, 100) / 100,
    u_gamma: boundedNumber(params.gamma, COLOR_GRADE_DEFAULTS.gamma, 0.5, 2),
  };
}
