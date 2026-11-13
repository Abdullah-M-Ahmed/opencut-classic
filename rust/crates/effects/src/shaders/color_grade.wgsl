// Color correction in the existing display-encoded RGB pipeline.
// This is a creative grade, not a scene-linear or ACES transform.
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    direction: vec2f,
    scalars: vec4f,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: EffectUniforms;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let source = textureSample(input_texture, input_sampler, input.tex_coord);
    if (source.a <= 0.000001) {
        return source;
    }
    let exposure = uniforms.direction.x;
    let contrast = uniforms.direction.y;
    let saturation = uniforms.scalars.x;
    let temperature = uniforms.scalars.y;
    let tint = uniforms.scalars.z;
    let gamma = max(0.5, uniforms.scalars.w);

    var rgb = source.rgb * exp2(exposure);
    rgb = (rgb - vec3f(0.5)) * (1.0 + contrast) + vec3f(0.5);
    let luminance = dot(rgb, vec3f(0.2126, 0.7152, 0.0722));
    rgb = mix(vec3f(luminance), rgb, saturation);
    rgb += vec3f(
        temperature * 0.08 + tint * 0.05,
        -tint * 0.08,
        -temperature * 0.08 + tint * 0.05
    );
    rgb = pow(clamp(rgb, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / gamma));
    return vec4f(rgb, source.a);
}
