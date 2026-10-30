# UNDERGROWTH

A topdown forest roguelike rendered with raw WebGL2 — real GLSL shaders for
lighting, fog of war, shadows and post-processing. You wake as a cube in a
forest that does not end. Kill, evolve, grow limbs, and if you dare, wake
the thing sleeping under the altar.

## Run it

The game is plain multi-file HTML/JS/GLSL. It needs to be served over HTTP
(shader files are fetched at runtime), so run any static server from this
folder:

```bash
cd undergrowth
python3 -m http.server 8080
# open http://localhost:8080
```

or `npx serve .`, or the VS Code Live Server extension. GitHub Pages works
as-is (no build step).

## Controls

| Action | Input |
| --- | --- |
| Move | Click or tap a highlighted tile beside you (8 directions) |
| Wait | Click / tap your own tile |
| Zoom | Mouse wheel, pinch, or `+` / `-` (needs an Eyes upgrade, min 2 tiles) |
| Camera | Locked at full view; follows you automatically while zoomed in |
| Restart | `R` on the game over screen |

## How it plays

- Turn-based. Every click is a turn; after you act, every enemy acts.
- Sight starts at **4 tiles** (Chebyshev radius). The world expands every
  level, sight only grows with Eyes upgrades.
- Kills drop EXP motes. Leveling up fully heals you and opens a roguelike
  evolution popup: 3 cards, body upgrades and unique upgrades.
- Every body upgrade visibly reshapes your sprite - the replaced part is
  drawn live in code (wings, tails, horns, plated hides, blade legs...).
- The forest fights back: every 3 level ups enemies evolve (tougher, and
  smarter - pattern reading, then BFS pathfinding, then interception);
  every 10 level ups they take a major form (the winged stalker learns
  knight jumps, the skitter hardens into a rook tower).
- One altar spawns per map. Stepping onto it **deliberately** triggers a
  5-second countdown, then the Ancient Dragon wakes: 2x2 body, queen
  movement, 8-block reach, and it PHASES through trees and rocks - only
  the edge of the world and living bodies can stop it. Kill it for a big
  reward; a new altar rises.

## Tech

- No framework, no build step. ES modules + raw WebGL2.
- A small console debug handle is exposed as `window.UG` (the live game
  state) — useful for testing and tinkering.
- `shaders/` contains the actual GLSL: instanced ground tiles with dynamic
  point lights and hash-dithered fog-of-war edges, lit entities, blob
  shadows, GPU point-sprite particles (additive), and a post pass
  (grade, vignette, grain, damage / evolve / boss feedback).
- The only image assets are 4 baked 16x16 sprites (`assets/`): head, body,
  legs, arms. Everything else — tiles, enemies, the dragon, the altar,
  icons, all upgrade visuals — is generated at runtime in `js/spritegen.js`.

## Folder structure

```
undergrowth/
  index.html
  css/ui.css            UI shell (DOM HUD, cards, overlays)
  assets/               the only 4 baked sprites
  shaders/              GLSL: common, tiles, quad/entity/shadow/flat,
                        particle, post
  js/
    state.js            global state + helpers
    gl.js               WebGL2 helpers (programs, textures, FBO, VAOs)
    assets.js           loads the 4 sprites, builds the tile texture array
    spritegen.js        live sprite factory (tiles, enemies, dragon, icons)
    world.js            deterministic forest gen + fog of war + altar
    camera.js           free camera / zoom-follow rules
    vfx.js              particles + event bursts
    combat.js           damage, exp, motes, death
    enemies.js          4 enemy types with unique movement patterns
    boss.js             the Ancient Dragon (2x2, queen moves, breath)
    turn.js             turn resolution + legal move targets
    upgrades.js         12 handcrafted body + 10 unique upgrades
    genbody.js          the Forge: infinite upgrade generator (from scratch)
    input.js            mouse / wheel / keys / touch
    ui.js               HUD, toasts, evolution cards, overlays
    main.js             boot, loop, render pipeline
```

## Design assumptions

- **Zoom**: range is [2, min(sight, 30)]. The camera is locked while you are
  at full view and follows you whenever the view is tighter than your sight.
  Taking a Sight upgrade while already at full view auto-expands the view.
  Zooming out is capped at 30 tiles even if your sight grows past that — and
  since the camera follows whenever zoom is below sight, a sight of 31+ keeps
  the camera following even at the 30 cap.
- **Touch**: tap to move or wait, pinch to zoom. There is no manual camera
  panning anywhere in the game.
- **Vision** is a plain Chebyshev square — trees do not block sight. An edge
  arrow shows where you are when off-screen.
- **Evolution popup**: 3 cards per level, at least one body upgrade and one
  unique upgrade when available; unique card header reads "unique upgrade".
- **Forged upgrades (infinite)**: every evolution also rolls fresh upgrades
  from a from-scratch generative engine (`js/genbody.js`). It knows the body
  part it is reshaping, picks level-scaled effects that fit it, composes a
  name from banks matched to the primary effect and the evolution tier, and
  ties the name to a forest color theme. The theme palette then drives the
  visual: the body part's base art is hidden and a seeded, code-drawn shape
  (one of five forms per part) is drawn in its place, plus an optional
  attachment. Descriptions list stats only. Names never repeat within a run.
- **Pushback**: stepping onto the altar moves you onto it for one beat,
  then back to your previous tile — the ritual cannot be triggered by
  accident, and you never end your turn on the altar.
- **Dragon**: spawns next to the altar after the 5-second countdown, moves
  every turn (queen pattern, max 8) and phases through trees, rocks and
  walls - only the world edge and living bodies block it. It breathes on
  contact for heavy damage. Killing it expands the world and relocates the
  altar, so the loop can repeat forever.
- **Enemies**: Shambler (king), Stalker (bishop), Skitter (rook, acts every
  2nd turn), Wisp (drifts over trees). They spawn in fog at 5-8 tiles and
  scale with your level.
- No audio, no save persistence — session-only runs.
