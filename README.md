# Tidewood Isle

A cozy 3D island game for the browser: comb the beach, build a home block by block, decorate it, fish, garden, befriend the neighbours and adopt pets. The island itself is drawn soft and rounded (rolling ground, round trees, pillowy characters, rounded shells, campfires and small decorations); walls, floors and the larger furniture you build with are blocks.

## Play

Play online at https://blakells.dev/tidewood-isle/ (served by GitHub Pages from the `main` branch; every push updates it within a minute or so).

To play from your own computer, either double-click `index.html`, or run the small server and open http://localhost:8123:

```bash
node serve.js
```

Three.js (r128, MIT licence) is bundled in `js/vendor/`, so the game needs nothing from the network once the page has loaded. Progress saves automatically in the browser (`localStorage`), separately on each device.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk (Shift to run, Space to jump / swim up) |
| Q / E, or right-drag | Turn the camera |
| Z / C | Tilt the camera down / up |
| Scroll, or - / = | Zoom |
| Click | Use tool: dig, chop, mine, pick up shells, cast the rod, greet animals and neighbours |
| Right-click (or X, or Ctrl+click) | Place the held block, open doors, light fires, sit, eat |
| R | Rotate furniture before placing |
| Shift + right-click | Place a block against a door, chest or other usable thing |
| V | Keep roofs visible indoors (for ceiling work) |
| F | Use the nearest thing |
| G | Wave |
| 1–9 | Hotbar slot |
| Tab | Backpack and crafting |
| J / O / N / P / H / M | Journal, outfit, map, photo mode, help, sound |
| Middle-click | Pick the block you are pointing at from your backpack |

## What there is to do

- **Make it yours**: name yourself and your island, then pick hair, headwear, outfit and colours (press O any time).
- **Fruit trees**: apples, oranges, peaches and cherries hang under the trees. Click a tree without the axe to shake them down; they grow back.
- **Balloons**: presents drift over the island now and then. Click one to pop it.
- **Island collection**: show Clementine each new fish, shell and bug; milestones earn gifts.
- **Wave**: press G near a neighbour or a pet.
- **Wish on a star**: press G when a shooting star crosses the night sky; star fragments wash up the next morning and can be crafted into a star lamp.
- **Footprints**: you, your pets and the neighbours leave trails across the sand.
- **Visitors**: some mornings Bramble the travelling tinker sets up on the beach with three special offers until evening.

- **Build**: 40 building blocks (planks, bricks, painted boards, coloured plaster, floor tiles, bamboo, shingles, slabs, stairs, glass), doors and windows. Step under a roof and it lifts away so you can decorate inside.
- **Decorate**: about 70 furniture and decor pieces — beds, sofas, lamps, rugs, wall art, string lights, a stove, a bathtub, a wardrobe, a hammock, a tent, a telescope, a music box, and little keepsakes such as a teddy bear, a garden gnome, a mushroom lamp and a sand buddy.
- **Beachcomb**: eight kinds of shells wash up each morning, plus driftwood, coconuts, messages in bottles and sparkling buried treasure.
- **Fish**: 13 fish across the sea and the lagoon, some only at night. Grill them over a campfire.
- **Pets**: cats, dogs, bunnies, crabs, ducklings and foxes wander the island. Feed one its favourite snack three times to adopt it.
- **Neighbours**: Juniper, Otis and Clementine live in huts around the island. Chat, run favours and give gifts to earn friendship presents. Marlow the otter runs the trading post.
- **Bugs**: a bug net comes in your backpack; catch six kinds of butterfly by day and glowbugs by night.
- **Garden and cook**: plant seeds and saplings (rain helps them grow), then cook the harvest at a campfire or stove.
- **Sail**: build a rowboat and paddle out to the lighthouse islet in the north-west, where the old keeper left a chest.
- **Cozy things**: day and night, rain showers and rainbows, shooting stars, a minimap that marks your home, a to-do list, a journal, a playful line for every fish and bug you catch, and a coziness rating for your home when you sleep.

## Files

- `index.html`, `style.css` — page and HUD styling
- `js/` — the game, split by job (`world.js` island generator, `mesher.js` chunk meshes, `blocks.js` / `items.js` data, `interact.js` building, `fishing.js`, `pets.js`, `villagers.js`, `ui.js`, `save.js`, `audio.js`, …)
- `serve.js` — tiny static server for playing locally
- `play.html` — the same game as a page fragment for publishing as a Claude artifact (it loads Three.js from a CDN instead)
