import type { EffectDefinition } from "@/effects/types";
import { colorGradeUniforms } from "./color-grade-params";

export const colorGradeEffectDefinition: EffectDefinition = {
  type: "color-grade",
  name: "Color Grading",
  keywords: ["color", "grade", "exposure", "contrast", "saturation", "temperature", "tint", "gamma"],
  params: [
    { key: "exposure", label: "Exposure (stops)", type: "number", default: 0, min: -2, max: 2, step: 0.05 },
    { key: "contrast", label: "Contrast", type: "number", default: 0, min: -100, max: 100, step: 1 },
    { key: "saturation", label: "Saturation", type: "number", default: 100, min: 0, max: 200, step: 1 },
    { key: "temperature", label: "Temperature", type: "number", default: 0, min: -100, max: 100, step: 1 },
    { key: "tint", label: "Tint", type: "number", default: 0, min: -100, max: 100, step: 1 },
    { key: "gamma", label: "Gamma", type: "number", default: 1, min: 0.5, max: 2, step: 0.01 },
  ],
  renderer: {
    passes: [{
      shader: "color-grade",
      uniforms: ({ effectParams }) => colorGradeUniforms(effectParams),
    }],
  },
};
