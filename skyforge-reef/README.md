# Skyforge Reef

An underwater block world. You are a little clownfish swimming a coral-reef ocean. No menus, no HUD, no map.

- **Live URL:** https://skyforge-reef.davidpayne2365.workers.dev (Cloudflare Worker `skyforge-reef`)
- **Branch:** built on `ccr-b43ac4e4-0atb7n`. The live copy was uploaded by hand from that branch; pushing to a branch does not change it.

## How to play

| | Touch (phone / tablet) | Mouse + keyboard | Gamepad |
|---|---|---|---|
| Swim | Hold your finger on the screen | Hold left button, or **W** | Trigger or A |
| Steer | Slide that finger around (the further you slide, the faster you turn) | Move the mouse (click first to capture it), or arrow keys | Stick |
| Grab / let go | Tap with a **second finger** while swimming | **Right-click**, or **F** | X or B |
| First / third person | **Double-tap** | **V** | Y |
| Change fish | Tap with **three fingers** | **K** | Bumpers |
| Photo | | **P** | Back |
| Mute | | **M** | |
| Up / down / back / sideways | | Space / Shift / S / A D | |

One finger swims and steers, a second finger grabs or lets go. Keep swimming and you slowly build up speed.

A white outline shows which block you are aiming at. Swim up to a block (anything solid: coral, sand, treasure, ruins), grab it, and carry it in your mouth for as long as you like.
Let go in open water and it sinks (light coral drifts down, gold plummets) and lands as a block in the world. Let go right against a surface and it snaps on, so you can build.

## The quest (no text, no menus)

Three coral groves have been bleached white. Over each grove's marble altar floats a see-through ghost block showing the colour it wants, and a stream of bubbles and a faint beam of light show you the way.
Carry a block of that colour to the altar and put it down: the grove blooms back into colour, a school of fish moves in, and the reef sings.
Heal all three and the whole reef celebrates, and you get the golden fish.
Every colour you need is in the pile of loose blocks near where you start (or you can pull one off the reef).

## What is in the ocean

- **Places:** reef plateaus with branching, brain, tube, table and fan corals; kelp forests; a deep trench with warm vents and glowing chimneys; seamounts with caves that end in crystal rooms and treasure; marble ruins; a sunken ship; the three bleached groves.
- **Life:** schools of fish that scatter when you swim at them, four little companions that follow you, manta rays, sea turtles, reef sharks, a whale that sings, crabs that scuttle away, jellyfish.
- **Look:** glow (bloom), colour grading, water wobble near the surface, a 12-minute day and night with a moon, glowing plankton at night, lanterns that light the blocks around them, soft shadows, sediment puffs when blocks land.
- **Sound (all made in code, no audio files):** slow generative music that gets deeper as you dive and turns dreamy at night, a muffled hum, bubbly blips, whale song, chimes when a grove heals.
- **Six fish:** clownfish, blue tang, parrotfish, sea-green, sunfish, and the golden fish you earn.
- **Saves itself** in your browser: blocks you moved, where you are, which fish, the time of day, the quest. Nothing is sent anywhere.
- **Installable:** add it to your home screen and it runs full screen and works offline.

## The blocks are quarter size

One block is 0.25 world units, a quarter of the old full-size block (so 4 x 4 x 4 of them fill an old block). The world is 384 x 112 x 384 of these blocks (96 x 28 x 96 units). The fish itself is built from the same quarter-size cubes.

## Textures

Both texture packs from the other Skyforge sites are used:

- **HD photo textures** (Poly Haven, CC0, 256 px) for sand, rocks, ruins and ship timber. They flow across the world, so sand looks like one surface.
- **Colourful block packs** (Kenney Voxel Pack + Minetest Game) for corals, wool, kelp and treasure. Each tiny cube shows the whole picture so every little block is visible.

Only the textures actually used are copied here (about 0.5 MB). Licences are in `textures/blocks/license-kenney.txt` and `textures/minetest/licenses/`.

## Files

- `index.html` - the page and the one-off "tap to dive" intro.
- `manifest.webmanifest`, `sw.js`, `icon-*.png` - make it installable and playable offline.
- `deploy/build-worker.py` - packs the site into one Cloudflare Worker (see Deploying).
- `js/blocks.js` - block types and which texture each uses.
- `js/world.js` - the grid of blocks, world generation (fixed seed), ray casting.
- `js/mesher.js` - turns blocks into meshes, shading and the underwater water-light shader.
- `js/textures.js` - loads all pictures into one texture array.
- `js/fx.js` - surface, light shafts, drifting specks, bubbles.
- `js/fish.js` - your fish (and its skins), school fish, companions, jellyfish.
- `js/creatures.js` - manta rays, turtles, sharks, the whale, and the crabs.
- `js/quest.js` - the reef-restoration quest.
- `js/save.js` - saving and loading your progress.
- `js/post.js` - glow, colour grading, water wobble, vignette.
- `js/audio.js` - synthesized sound and music (no audio files).
- `js/main.js` - controls, swimming, grabbing, cameras, the game loop.
- `vendor/three.module.min.js` - Three.js r160 (MIT), included so the site works with no outside downloads.

## Honest limits

Things a big studio game has that this does not: online multiplayer (it needs a server), a hand-modelled and animated cast and soundtrack recorded by people, and a much bigger world. Everything here is generated in code so the whole game stays about 1.5 MB.

## Run it locally

```sh
cd skyforge-reef
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying

It is a plain static site, no build step. Uploaded to Cloudflare account `davidpayne2365` as the Worker `skyforge-reef`.
This first upload was packaged as a single Worker with every file embedded inside it (about 0.5 MB compressed), because Cloudflare's usual "static assets" upload was refused from the cloud session (it needs a short-lived upload pass that the session's connection overwrites).
It behaves the same for players. To move it to normal static-assets hosting later, run `npx wrangler deploy --assets ./skyforge-reef --name skyforge-reef` from a normal computer.
Rebuild the single-file Worker with `python3 skyforge-reef/deploy/build-worker.py worker.js`.
Your progress is saved in each player's own browser, so a new upload does not wipe anyone's save.
