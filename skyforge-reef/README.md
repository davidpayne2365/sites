# Skyforge Reef

An underwater block world. You are a little clownfish swimming a coral-reef ocean. No menus, no HUD, no map.

- **Live URL:** not deployed yet (see "Deploying" below)
- **Branch:** built on `ccr-b43ac4e4-0atb7n`; `main` is what goes live once merged and uploaded

## How to play

| | Touch (phone / tablet) | Mouse + keyboard |
|---|---|---|
| Swim | Hold your finger on the screen | Hold left button, or **W** |
| Steer | Slide that finger around (the further you slide, the faster you turn) | Move the mouse (click first to capture it), or arrow keys |
| Grab / let go | Tap with a **second finger** while swimming | **Right-click**, or **F** |
| First / third person | **Double-tap** | **V** |
| Up / down / back / sideways | | Space / Shift / S / A D |

Everything is multi-touch friendly: one finger swims and steers, a second finger grabs or lets go.

A white outline shows which block you are aiming at. Swim up to a block (anything solid: coral, sand, treasure, ruins), grab it, and carry it in your mouth for as long as you like.
Let go in open water and it sinks gently and lands as a block in the world. Let go right against a surface and it snaps on, so you can build.

## What is in the ocean

- Reef plateaus with branching, brain, tube, table and fan corals, anemones and coral fronds.
- Kelp forests, sea grass, a deep trench, rocky seamounts and walls round the edge.
- Marble ruins with treasure, a sunken ship, glowing sea lanterns in the dark.
- A pile of loose coloured blocks right in front of where you start.
- Schools of fish and drifting jellyfish. Sunlight shafts, a rippling surface above you, caustics, bubbles, sound made in code.

## The blocks are quarter size

One block is 0.25 world units, a quarter of the old full-size block (so 4 x 4 x 4 of them fill an old block). The world is 384 x 112 x 384 of these blocks (96 x 28 x 96 units). The fish itself is built from the same quarter-size cubes.

## Textures

Both texture packs from the other Skyforge sites are used:

- **HD photo textures** (Poly Haven, CC0, 256 px) for sand, rocks, ruins and ship timber. They flow across the world, so sand looks like one surface.
- **Colourful block packs** (Kenney Voxel Pack + Minetest Game) for corals, wool, kelp and treasure. Each tiny cube shows the whole picture so every little block is visible.

Only the textures actually used are copied here (about 0.5 MB). Licences are in `textures/blocks/license-kenney.txt` and `textures/minetest/licenses/`.

## Files

- `index.html` - the page and the one-off "tap to dive" intro.
- `js/blocks.js` - block types and which texture each uses.
- `js/world.js` - the grid of blocks, world generation (fixed seed), ray casting.
- `js/mesher.js` - turns blocks into meshes, shading and the underwater water-light shader.
- `js/textures.js` - loads all pictures into one texture array.
- `js/fx.js` - surface, light shafts, drifting specks, bubbles.
- `js/fish.js` - your clownfish, school fish, jellyfish.
- `js/audio.js` - synthesized sound (no audio files).
- `js/main.js` - controls, swimming, grabbing, cameras, the game loop.
- `vendor/three.module.min.js` - Three.js r160 (MIT), included so the site works with no outside downloads.

## Run it locally

```sh
cd skyforge-reef
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying

Same as the other sites: upload this folder as its own Cloudflare Worker (static assets). It is a plain static site, no build step.
Changes you make in the ocean (moved blocks) are not saved; reloading gives the same fresh ocean.
