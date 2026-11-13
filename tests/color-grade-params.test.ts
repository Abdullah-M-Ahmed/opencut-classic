import test from "node:test";
import assert from "node:assert/strict";
import { colorGradeUniforms } from "../apps/web/src/effects/definitions/color-grade-params.ts";

test("neutral settings result in identity uniforms", () => {
  assert.deepEqual(colorGradeUniforms({}), {
    u_exposure: 0,
    u_contrast: 0,
    u_saturation: 1,
    u_temperature: 0,
    u_tint: 0,
    u_gamma: 1,
  });
});

test("user inputs are converted and bounded for the GPU", () => {
  assert.deepEqual(colorGradeUniforms({
    exposure: 4, contrast: -50, saturation: 250,
    temperature: 25, tint: -50, gamma: 0.2,
  }), {
    u_exposure: 2,
    u_contrast: -0.5,
    u_saturation: 2,
    u_temperature: 0.25,
    u_tint: -0.5,
    u_gamma: 0.5,
  });
});

test("invalid inputs safely fall back to neutral values", () => {
  assert.deepEqual(colorGradeUniforms({
    exposure: NaN, contrast: "oops", saturation: Infinity,
    temperature: null, tint: -Infinity, gamma: undefined,
  }), colorGradeUniforms({}));
});
