# OpenCut Desktop (Windows preview)

This is a desktop window for the existing OpenCut Classic editing engine. It is an Electron-based desktop application, not a newly recreated editor UI. The editor's workspaces, media import, playback, timeline, project management and export come from OpenCut Classic.

## Desktop layout

- Horizontal Media, Audio, Text, Stickers, Effects, Transition, Captions and Adjust tabs
- Central Player with existing live canvas renderer
- Clip inspector with contextual controls
- Full-width resizable timeline below the player
- Dark visual language and compact header
- Existing keyboard shortcuts and drag-and-drop workflows retained

Some tabs (for example Transition) still contain upstream placeholders; the screenshot reference is a visual direction, not a claim of full CapCut features.

## Running for development

Prerequisites: Node.js 22+, Bun and project dependencies.

From the repository root:

```bash
bun install
bun run --cwd apps/desktop-electron dev
```

The desktop launcher automatically starts the local Next.js dev server and opens the projects page. Set `OPENCUT_WEB_URL=http://127.0.0.1:3000` only if you have already started the web server manually.

## Windows installer

The repository's **Desktop Windows Preview** GitHub Actions workflow attempts to compile the web app and create an `.exe` installer. If the workflow succeeds, download the **OpenCut-Desktop-Windows-preview** artifact from that run. This installer is currently *unsigned* and may trigger Windows SmartScreen warnings.

For manual packaging:

```bash
bun install
bun run build:web
bun run --cwd apps/desktop-electron package:windows
```

It produces files in `apps/desktop-electron/dist/`.

## Architecture and limitations

- The packaged app launches a **local** Next.js process bound to `127.0.0.1`.
- Electron's renderer uses sandboxing, context isolation and disabled Node integration.
- The existing local browser project store continues to be used inside Electron.
- The legacy web source expects environment fields for cloud services. The launcher supplies non-secret local placeholders to satisfy its startup schema. Those placeholders do **not** provide a working cloud database, Redis, Marble CMS or Freesound account.
- The runtime must be built and verified on Windows before it can be called release-ready.
- Some upstream browser media APIs and GPU features may require additional Electron-specific testing.
- This work does **not** provide native GPUI rendering or claim improved performance compared to a regular Chromium editor.
- The separately developed color-grading Rust shader requires building and linking the local `opencut-wasm` package. The published npm package lacks that new shader.

## Release criteria

Before distributing the installer as stable, confirm project import, autosave and reopen, 1080p playback, captions, color grade, multiple audio/video tracks, MP4 export with sound, file path safety, and correct rendering under at least NVIDIA and Intel GPUs.

This preview uses OpenCut's existing MIT-licensed code and keeps the fork's attribution. Branding should not imply official affiliation with CapCut.
