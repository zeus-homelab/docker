# Repo notes

This repo holds homelab docker-compose files (root `*.yml`) plus the game **Signal Lost: Hijack** in `signal-lost/`.

## Signal Lost rules
- `signal-lost/DESIGN.md` is the source of truth for the game. **Any change to the game (code, content,
  numbers, text, controls, build) is not finished until DESIGN.md is updated to match**, including a new
  line in its Changelog. Read it before making game changes.
- Game code is plain ES modules in `signal-lost/web/src/` with no build step. All content and numbers are in `data.js`.
- When you change files under `signal-lost/web/`, bump `VERSION` in `signal-lost/web/sw.js` so installed PWAs update.
- Test in headless Chromium: serve `signal-lost/web` and drive it with Playwright. `window.app` exposes the
  scene stack, and `window.__speed = N` runs N simulation steps per frame for soak tests.
- The APK is built by `.github/workflows/signal-lost-apk.yml` (Capacitor + Gradle on GitHub Actions).
