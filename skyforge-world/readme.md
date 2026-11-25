# Skyforge

A fast, open world in the browser: photo-real grass under an HD sky, and a giant fairytale castle on a hill.
Run, jump, drive, and place or break Minecraft-style blocks.

## The Giants' Castle

A giant fairytale castle, built after a fantasy-castle painting, crowns a steep, rocky, wooded crag 1300 m north of where you start, with big grey mountains close behind. Towers, halls and houses crowd the crag in rings all the way up, and more towers are set into the keep's walls.

- **Outside**: cream and sandstone round towers climb the hill in terraces.
  - The towers have stone bands, balconies, hooded windows, and steep brown or slate cone roofs with flared eaves, dormers and waving red flags.
  - The top holds a white keep with corner turrets and the great central tower with its dark spire.
  - Lower down: a timber-framed hall, a tower with a tall brown spire and a ruined gothic arch on the left, and towered sandstone walls stepping down the right.
  - Watchtowers, walls and little houses are scattered down the slopes, among rock outcrops and groves of pines.
  - A waterfall cascades from a terrace into a pool.
- **Light**: a warm, low afternoon sun in the south-west casts real shadows across the hill (not on phones), with blue haze on the mountains. At night the windows glow.
- **Life**: flocks of birds wheel over the hill, and a dragon circles the great spire.
- **The road**: a 20 m wide cobbled road starts just north of where you spawn.
  - It passes under a gatehouse arch, then switchbacks up the hill to the courtyard gate, with lanterns along the way and little towers at the hairpins.
  - It climbs one block in five, so you can gallop all the way up, then ride straight through the keep's front door.
- **Inside the keep**: four levels of giant rooms, each 96 x 96 m and 48 m tall.
  - On every level the rooms form a chain: each room has exactly one way in and one way out, and a red carpet leads through.
  - The last room of each level has a switchback staircase up to the next. The fourth level's staircase comes out on the roof.
  - Each room has a theme, and its name shows as you walk in: a statue gallery, a banquet hall, a great kitchen with a cooking fire, an armoury, a library, a chapel with stained glass, a giant's bedchamber and a throne room. The furniture is giant-sized.
  - The rooms are lit by flickering wall torches, chandeliers, candles and fires, with the warm light baked into the walls, floors and ceilings. By day, sunbeams slant in through the south and west windows.
- **The lookout**: a door on the keep roof opens into the hollow central tower.
  - A spiral staircase climbs 240 steps around a central column to a lookout with eight open arches under the spire.
  - You can ride your horse all the way up.

The castle is generated in code (`js/castle.js`) from boxes, cylinders and cones, with no 3D models. It reuses the Poly Haven textures already in `textures/photo/`, plus the Minetest bookshelf and Kenney water textures.
The birds and the dragon are in `js/life.js`, and the hoof sounds are synthesized in `js/sound.js` (no sound files).
On phones the castle uses fewer trees and rocks, a lighter mountain ring, and no shadows.
The layout is fixed, so it's the same for everyone and isn't stored in saves. You can build on it and inside it, but you can't break it.

## Your horse

A saddled palomino waits beside you at the start, facing the castle. Walk up to it and press **E** (keyboard), **A** (controller), or tap **Tap here to ride** (touch) to get on.
Riding, you gallop at 26 blocks / s (hold **Shift**, or click the left stick, to sprint at 40), leap 2.6 blocks high, and climb the castle's road and stairs. The hooves drum as you go, and the view sways with the stride. Press **E** / **B**, or tap the message, to get off.
It stays where you leave it, saved in the browser. In split screen each player has their own horse.

The horse is the rigged, animated "Toon Horse with Saddle" by flairetic (Sketchfab, CC BY 4.0), credited in `assets/CREDITS.md`.
It was ported from the castles-and-dungeons branch: `js/horses.js` places it and drives it, and `js/creatures.js` loads and animates the model.

## Run it

Open `index.html` through any static web server, for example:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

No build step is needed. three.js loads from the jsDelivr CDN.

Live at https://skyforge-world.netlify.app

A top-down 2D version, Skyforge Valley, is on the `skyforge-2d` branch (https://skyforge-valley.netlify.app).

## Controls

| Desktop | Action |
| --- | --- |
| W A S D | Move (10 blocks / s); walking into a 1-block ledge steps up onto it |
| Mouse | Look (click the game to capture the mouse) |
| Space | Jump |
| F | Fly on / off. Flying, you go the way you look (70 blocks / s, hold **Shift** for 260), straight through anything; Space rises, C sinks |
| E | Get on / off your horse; get in / out of a car (when looking at its steering wheel) |
| Right click | Place the selected block |
| Left click | Break the block you're looking at |
| 1–9, mouse wheel | Choose a favourite slot |
| Tab / Q | Open the block palette |

### Xbox controller and split screen

| Controller | Action |
| --- | --- |
| Left stick | Move |
| Right stick | Look around |
| A | Jump |
| X | Fly on / off (A rises, B sinks, click the left stick to go fast) |
| RT | Place block (hold to repeat) |
| LT | Remove block (hold to repeat) |
| LB / RB | Switch between your 9 favourite slots |
| Y | Block carousel (spinning 3D preview in the middle). LB / RB switch tabs: **Hotbar** (A puts the block in your selected slot), **Ground** (A makes it the ground), **Sky** (A switches the sky). Left / right browse, up / down jump between categories, LT / RT jump 10, B closes. |
| View | Switch split screen between side by side and top/bottom (keyboard: V) |
| Menu | Pause |

The first controller drives player 1, and the keyboard and mouse keep working too.
Connect a second controller and press any button on it to split the screen left and right.
Each controller gets its own half, camera, hotbar, and block choice, and each player sees the other as a blocky character.
Up to 4 controllers are supported (4 players split into quarters).
If a controller is unplugged, that player leaves and the screen merges back.

The game renders at full resolution, up to 4K width.
If the frame rate drops below about 50 fps, it lowers the resolution automatically and raises it again when there's headroom.

On phones and tablets, use the left thumb to move and the right thumb to look. **FLY** (top left) takes off and lands; you fly the way you look, and JUMP rises.
On-screen buttons handle jump, place, and break.

Blocks you build are saved in the browser's local storage.

## Block textures

Every block texture comes from a free texture pack; none are hand-drawn.

- `textures/photo/`: every Poly Haven texture (867 photo-scanned materials, [polyhaven.com/textures](https://polyhaven.com/textures), CC0), resized to 256x256, each available as a block. The list with names and categories is `js/photo_textures.js`. The ground is Poly Haven's Leafy Grass, and the basic Grass, Stone, Dirt, Planks, Log, Brick, and Sand blocks use photo textures. Textures download only when a block is first used or shown in the palette.
- `textures/blocks/`: Kenney's [Voxel Pack](https://kenney.nl/assets/voxel-pack) (CC0), 48x48. Includes grass, stone, woods, ores, sandstones, snow, water, lava, and wool in 16 colours.
- `textures/minetest/`: [Minetest Game](https://github.com/minetest/minetest_game) textures (media licensed CC BY-SA 3.0 by their authors; license files in `textures/minetest/licenses/`), 16x16. Includes treasure chests, TNT, bookshelves, metal and gem blocks, lamps, coral, and farmland.

Chests, the furnace, the bone box, and the steering wheel turn so their front faces you when placed.
Worlds saved with the older hand-drawn colour blocks load them as the closest wool colour, or as glass.

## Sky and ground

Open the palette (Y / Tab / BLOCKS) to change them:

- **Sky**: all 300 Poly Haven sky HDRIs (day, sunset, and night, listed in `js/skies.js`) are at the end of the palette. Pick one with A / click; lighting and haze follow its time of day. Skies download at 2K from Poly Haven when chosen.
- **Ground**: highlight any block and press X (controller), G (keyboard), or **Make it the ground** (touch) to tile it across the ground.

Both choices are saved in the browser.

### Default sky

The sky is the CC0 HDRI [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky)
from Poly Haven, loaded at 2K. If that fails to load, the game falls back to the
three.js sample skybox, then to a drawn gradient.

## Multiplayer hook points (for Firebase later)

Everything multiplayer-related is exposed on `window.Game`:

- `Game.net.onLocalBlock = (x, y, z, id) => {}` is called when this player places a block (`id > 0`) or breaks one (`id === 0`).
- `Game.net.onLocalPlayer = ({ x, y, z, yaw, pitch }, slot) => {}` is called about 10 times per second for each local player.
- `Game.world.set(x, y, z, id, 'remote')` applies a block change received from the network without echoing it back.
- `Game.players.upsert(id, { x, y, z, yaw, pitch })` / `Game.players.remove(id)` show, move, and remove other players' avatars.

All tuning values, such as speeds, jump height, and reach, are in `CFG` at the top of `js/main.js`.
