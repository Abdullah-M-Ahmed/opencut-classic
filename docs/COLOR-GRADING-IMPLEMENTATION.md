# Color Grading Engineering Increment

This development branch adds the first color grading shader to OpenCut Classic's existing effect registry and Rust/wgpu compositor.

## Implemented

- GPU color grade with exposure, contrast, saturation, temperature, tint, and gamma controls.
- Input sanitization with bounded defaults.
- Color effect registration in the existing UI effect library.
- Gaussian blur shader sampling optimization with a three-sigma radius and a 30-pixel maximum.

## Integration requirements

**This is not yet an end-to-end tested production feature.** The upstream published `opencut-wasm` npm package does **not** contain the new color-grade shader. A local Rust WASM rebuild and local package linking are required:

1. Follow the root README prerequisites for Rust, `wasm-pack`, and Bun.
2. Run `bun run build:wasm` from the repository root.
3. Follow the root README's `bun link` directions to link the locally built `rust/wasm/pkg` package into `apps/web`.
4. Run `bun dev:web` and verify GPU support and the Color Grading effect in preview.
5. Verify exported footage retains the exact effect stack and correct audio/video timing.

## Known limitations

- Color adjustments operate in the editor's existing display-encoded RGB pipeline, not a scene-linear/HDR/ACES workflow.
- GPU compilation, end-to-end export, and real-device performance have not been verified in the current environment.
- Added AI background removal, motion tracking, and caption workflows are **not** included in this increment.
- This development branch has not been merged into `main`.

## Test

With Node.js 22+, run:

```bash
node --experimental-strip-types --test tests/color-grade-params.test.ts
```

This validates parameter normalization only; it does not verify the GPU result.
