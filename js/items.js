// Tidewood Isle — items, recipes, fish, shop stock and other data tables.
'use strict';
(function () {
  G.ITEMS = {};
  const I = (key, o) => { G.ITEMS[key] = Object.assign({ key, label: key, icon: '❔', stack: 99, kind: 'material' }, o); };

  // every placeable block is also an item
  for (let i = 1; i < G.BLOCKS.length; i++) {
    const d = G.BLOCKS[i];
    if (!d.item) continue;
    I(d.key, {
      label: d.label, icon: d.icon || null, kind: 'block', block: d.id, value: d.value || 0,
      food: d.food || 0, cat: d.cat,
    });
  }

  // ---- tools ----
  I('axe', { label: 'Driftwood Axe', icon: '🪓', kind: 'tool', tool: 'axe', stack: 1, desc: 'Chops trees and wooden things quickly.' });
  I('pickaxe', { label: 'Pebble Pick', icon: '⛏️', kind: 'tool', tool: 'pick', stack: 1, desc: 'Breaks stone and brick quickly.' });
  I('shovel', { label: 'Sand Shovel', icon: '🪏', kind: 'tool', tool: 'shovel', stack: 1, desc: 'Digs sand, soil and clay quickly.' });
  I('fishing_rod', { label: 'Bamboo Rod', icon: '🎣', kind: 'tool', tool: 'rod', stack: 1, desc: 'Click on water to cast. Click again when it splashes!' });

  I('rowboat', { label: 'Rowboat', icon: '🛶', kind: 'vehicle', stack: 1, desc: 'Right-click at the shore to launch it.' });
  I('net', { label: 'Bug Net', icon: '🥍', kind: 'tool', tool: 'net', stack: 1, desc: 'Click a butterfly or a glowbug to catch it.' });

  // ---- bugs ----
  G.BUGS = [
    { id: 'bug_sunset', label: 'Sunset Flutter', icon: '🦋', color: 0xffb347, value: 18 },
    { id: 'bug_sky', label: 'Sky Flutter', icon: '🦋', color: 0x7fc8f8, value: 18 },
    { id: 'bug_rose', label: 'Rose Flutter', icon: '🦋', color: 0xf79ac0, value: 22 },
    { id: 'bug_lemon', label: 'Lemon Flutter', icon: '🦋', color: 0xfff07a, value: 18 },
    { id: 'bug_lilac', label: 'Lilac Flutter', icon: '🦋', color: 0xc9a0f5, value: 28 },
    { id: 'bug_snow', label: 'Snowy Flutter', icon: '🦋', color: 0xffffff, value: 35 },
    { id: 'bug_glow', label: 'Glowbug', icon: '✨', color: 0xe9ff8a, value: 30 },
  ];
  for (const b of G.BUGS) I(b.id, { label: b.label, icon: b.icon, kind: 'bug', value: b.value, bug: true });

  // ---- materials ----
  I('stick', { label: 'Stick', icon: '🥢' });
  I('fiber', { label: 'Palm Fiber', icon: '🌾' });
  I('rope', { label: 'Rope', icon: '🪢' });
  I('berry', { label: 'Island Berry', icon: '🫐', kind: 'food', food: 1, value: 4 });
  I('cooked_fish', { label: 'Grilled Fish', icon: '🍢', kind: 'food', food: 3, value: 30 });
  I('fruit_salad', { label: 'Fruit Salad', icon: '🥗', kind: 'food', food: 3, value: 40 });
  I('roast_corn', { label: 'Roasted Corn', icon: '🌽', kind: 'food', food: 2, value: 35 });
  I('pet_treat', { label: 'Pet Treat', icon: '🦴', value: 5, desc: 'Every animal on the island loves these.' });
  I('seed_carrot', { label: 'Carrot Seeds', icon: '🌱', kind: 'seed', plants: 'crop_carrot', value: 3 });
  I('seed_corn', { label: 'Corn Seeds', icon: '🌱', kind: 'seed', plants: 'crop_corn', value: 4 });
  I('seed_melon', { label: 'Melon Seeds', icon: '🌱', kind: 'seed', plants: 'crop_melon', value: 6 });
  I('carrot', { label: 'Carrot', icon: '🥕', kind: 'food', food: 1, value: 14 });
  I('corn', { label: 'Corn', icon: '🌽', kind: 'food', food: 1, value: 18 });
  I('melon', { label: 'Melon', icon: '🍉', kind: 'food', food: 2, value: 30 });
  I('seafood_stew', { label: 'Seafood Stew', icon: '🍲', kind: 'food', food: 4, value: 85 });
  I('veggie_skewer', { label: 'Veggie Skewers', icon: '🍡', kind: 'food', food: 3, value: 70 });
  I('coconut_cake', { label: 'Coconut Cake', icon: '🍰', kind: 'food', food: 4, value: 75 });
  I('melon_sorbet', { label: 'Melon Sorbet', icon: '🍧', kind: 'food', food: 3, value: 90 });
  I('berry_jam', { label: 'Berry Jam', icon: '🍯', kind: 'food', food: 2, value: 40 });
  I('fish_tacos', { label: 'Fish Tacos', icon: '🌮', kind: 'food', food: 4, value: 95 });
  I('fruit_pie', { label: 'Fruit Pie', icon: '🥧', kind: 'food', food: 4, value: 80 });
  I('juice', { label: 'Orange Juice', icon: '🧃', kind: 'food', food: 2, value: 30 });
  I('boot', { label: 'Soggy Boot', icon: '🥾', value: 1, desc: 'Someone is missing this.' });

  // ---- fish ----  where: sea | lagoon | any ; time: day | night | any ; diff: reel difficulty 1-3
  G.FISH = [
    { id: 'fish_sardine', label: 'Dawn Sardine', icon: '🐟', w: 30, where: 'sea', time: 'any', value: 12, diff: 1 },
    { id: 'fish_clown', label: 'Coral Clownfish', icon: '🐠', w: 18, where: 'sea', time: 'day', value: 22, diff: 1 },
    { id: 'fish_puffer', label: 'Bubble Puffer', icon: '🐡', w: 10, where: 'sea', time: 'any', value: 40, diff: 2 },
    { id: 'fish_shrimp', label: 'Pebble Shrimp', icon: '🦐', w: 16, where: 'any', time: 'any', value: 16, diff: 1 },
    { id: 'fish_crab', label: 'Sidestep Crab', icon: '🦀', w: 10, where: 'sea', time: 'any', value: 28, diff: 2 },
    { id: 'fish_squid', label: 'Inkwell Squid', icon: '🦑', w: 7, where: 'sea', time: 'night', value: 55, diff: 2 },
    { id: 'fish_jelly', label: 'Lantern Jelly', icon: '🪼', w: 7, where: 'sea', time: 'night', value: 60, diff: 2 },
    { id: 'fish_lobster', label: 'Star Lobster', icon: '🦞', w: 4, where: 'sea', time: 'any', value: 90, diff: 3 },
    { id: 'fish_octopus', label: 'Shy Octopus', icon: '🐙', w: 3, where: 'sea', time: 'any', value: 120, diff: 3 },
    { id: 'fish_shark', label: 'Gentle Reef Shark', icon: '🦈', w: 1.5, where: 'sea', time: 'any', value: 250, diff: 3 },
    { id: 'fish_carp', label: 'Moss Carp', icon: '🐟', w: 26, where: 'lagoon', time: 'any', value: 18, diff: 1 },
    { id: 'fish_koi', label: 'Lagoon Koi', icon: '🎏', w: 8, where: 'lagoon', time: 'day', value: 75, diff: 2 },
    { id: 'fish_frog', label: 'Lily Frog', icon: '🐸', w: 10, where: 'lagoon', time: 'night', value: 35, diff: 1 },
    { id: 'boot', label: 'Soggy Boot', icon: '🥾', w: 5, where: 'any', time: 'any', value: 1, diff: 1, junk: true },
  ];
  for (const f of G.FISH) if (!f.junk) I(f.id, { label: f.label, icon: f.icon, kind: 'fish', value: f.value, fish: true });

  // What you say when you hold up a catch.
  G.QUIPS = {
    fish_sardine: 'Up bright and early, just like me!',
    fish_clown: 'No joke — it\'s a beauty!',
    fish_puffer: 'It seems a little full of itself.',
    fish_shrimp: 'A bit shrimpy, but I\'m proud all the same!',
    fish_crab: 'It tried to sidestep me. Nice try!',
    fish_squid: 'Now I can finally write that letter!',
    fish_jelly: 'It lights up my whole night!',
    fish_lobster: 'A real star of the sea!',
    fish_octopus: 'Don\'t be shy — you\'re among friends!',
    fish_shark: 'Gentle? I\'ll take its word for it!',
    fish_carp: 'No carping from me about this one!',
    fish_koi: 'No need to be koi about it!',
    fish_frog: 'Hoppily ever after!',
    bug_sunset: 'It glows like the end of a perfect day!',
    bug_sky: 'A little piece of blue sky, right in my net!',
    bug_rose: 'Everything\'s coming up roses!',
    bug_lemon: 'When life gives you lemons, catch them!',
    bug_lilac: 'I\'m lilac-ing this one a lot!',
    bug_snow: 'Snow way! What a find!',
    bug_glow: 'My night just got a little brighter!',
    shell_cockle: 'Rosy as a sunrise!',
    shell_scallop: 'Simply fan-tastic!',
    shell_conch: 'I can hear the sea in it. Then again, the sea is right there.',
    shell_whelk: 'Whelk, whelk, whelk… what have we here?',
    starfish: 'A star is born!',
    sand_dollar: 'I won\'t spend it all in one place!',
    shell_nautilus: 'Moonlight I can hold in my hands!',
    pearl_oyster: 'The world really is my oyster!',
  };
  G.quip = (id) => (G.QUIPS[id] ? ' <i>' + G.QUIPS[id] + '</i>' : '');

  // ---- beach finds spawn table ----
  G.SHELL_TABLE = [
    { id: 'shell_cockle', w: 30 }, { id: 'shell_scallop', w: 24 }, { id: 'starfish', w: 14 }, { id: 'sand_dollar', w: 12 },
    { id: 'shell_conch', w: 10 }, { id: 'shell_whelk', w: 6 }, { id: 'shell_nautilus', w: 2 }, { id: 'pearl_oyster', w: 1.2 },
  ];

  // ---- recipes ----
  G.RECIPES = [];
  const R = (out, n, ins, bench, cat) => G.RECIPES.push({ out, n, ins, bench: !!bench, cat: cat || 'basics' });
  const COOK = (out, ins) => G.RECIPES.push({ out, n: 1, ins, bench: false, fire: true, cat: 'cooking' });
  COOK('cooked_fish', { fish_sardine: 1 });
  COOK('cooked_fish', { fish_carp: 1 });
  COOK('roast_corn', { corn: 1 });
  COOK('berry_jam', { berry: 4 });
  COOK('veggie_skewer', { corn: 1, carrot: 1 });
  COOK('fish_tacos', { cooked_fish: 1, corn: 1 });
  COOK('seafood_stew', { fish_shrimp: 1, fish_sardine: 1, carrot: 1 });
  COOK('coconut_cake', { coconut: 2, berry: 2 });
  COOK('fruit_pie', { fruit_apple: 2, berry: 1 });
  COOK('fruit_pie', { fruit_peach: 2, fruit_cherry: 1 });
  COOK('melon_sorbet', { melon: 1, coconut: 1 });
  // by hand
  R('planks', 4, { log: 1 });
  R('planks', 4, { palm_log: 1 });
  R('drift_planks', 2, { driftwood: 1 });
  R('stick', 4, { planks: 1 });
  R('rope', 1, { fiber: 3 });
  R('thatch', 2, { fiber: 4 });
  R('workbench', 1, { planks: 4 });
  R('campfire', 1, { log: 2, stone: 3 });
  R('torch', 2, { stick: 1, fiber: 1 });
  R('log_seat', 1, { log: 1 });
  R('pet_treat', 2, { berry: 1, fiber: 1 });
  R('path', 4, { sand: 2, stone: 1 });
  R('sandcastle', 1, { sand: 4 });
  R('fruit_salad', 1, { berry: 2, coconut: 1 });
  R('fruit_salad', 2, { fruit_apple: 1, fruit_orange: 1, fruit_peach: 1 });
  R('juice', 1, { fruit_orange: 2 });
  // at a workbench — building
  R('cobble', 4, { stone: 4 }, 1, 'building');
  R('stone_bricks', 4, { stone: 4 }, 1, 'building');
  R('sand_bricks', 4, { sandstone: 4 }, 1, 'building');
  R('sand_bricks', 2, { sand: 4 }, 1, 'building');
  R('bricks', 4, { clay: 2 }, 1, 'building');
  R('plaster', 4, { sand: 2, clay: 1 }, 1, 'building');
  R('glass', 2, { sand: 3 }, 1, 'building');
  R('window', 2, { glass: 1, stick: 2 }, 1, 'building');
  R('door', 1, { planks: 4 }, 1, 'building');
  R('fence', 4, { stick: 4, planks: 1 }, 1, 'building');
  R('dark_planks', 4, { planks: 4, coconut: 1 }, 1, 'building');
  R('roof_red', 4, { clay: 2, flower_red: 1 }, 1, 'building');
  R('roof_blue', 4, { clay: 2, flower_blue: 1 }, 1, 'building');
  R('roof_green', 4, { clay: 2, fiber: 2 }, 1, 'building');
  R('planks_slab', 4, { planks: 2 }, 1, 'building');
  R('planks_stairs', 4, { planks: 3 }, 1, 'building');
  R('drift_slab', 4, { drift_planks: 2 }, 1, 'building');
  R('drift_stairs', 4, { drift_planks: 3 }, 1, 'building');
  R('thatch_slab', 4, { thatch: 2 }, 1, 'building');
  R('thatch_stairs', 4, { thatch: 3 }, 1, 'building');
  R('stone_slab', 4, { stone_bricks: 2 }, 1, 'building');
  R('stone_stairs', 4, { stone_bricks: 3 }, 1, 'building');
  R('roof_red_slab', 4, { roof_red: 2 }, 1, 'building');
  R('roof_red_stairs', 4, { roof_red: 3 }, 1, 'building');
  R('roof_blue_slab', 4, { roof_blue: 2 }, 1, 'building');
  R('roof_blue_stairs', 4, { roof_blue: 3 }, 1, 'building');
  // painted boards
  R('paint_white', 4, { planks: 4, flower_white: 1 }, 1, 'colors');
  R('paint_white', 4, { planks: 4, shell_cockle: 1 }, 1, 'colors');
  R('paint_red', 4, { planks: 4, flower_red: 1 }, 1, 'colors');
  R('paint_blue', 4, { planks: 4, flower_blue: 1 }, 1, 'colors');
  R('paint_yellow', 4, { planks: 4, flower_yellow: 1 }, 1, 'colors');
  R('paint_green', 4, { planks: 4, fern: 1 }, 1, 'colors');
  R('paint_pink', 4, { planks: 4, flower_pink: 1 }, 1, 'colors');
  R('paint_teal', 4, { planks: 4, seaweed: 1 }, 1, 'colors');
  // furniture
  R('rowboat', 1, { planks: 8, rope: 2 }, 1, 'furniture');
  R('chair', 1, { planks: 2, stick: 2 }, 1, 'furniture');
  R('stool', 1, { planks: 1, stick: 2 }, 1, 'furniture');
  R('table', 1, { planks: 3, stick: 2 }, 1, 'furniture');
  R('bed', 1, { planks: 4, fiber: 6 }, 1, 'furniture');
  R('chest', 1, { planks: 6 }, 1, 'furniture');
  R('crate', 1, { planks: 3 }, 1, 'furniture');
  R('bookshelf', 1, { planks: 4, fiber: 2 }, 1, 'furniture');
  R('shelf', 1, { planks: 1, stick: 1 }, 1, 'furniture');
  R('lantern', 1, { stone: 2, torch: 1 }, 1, 'furniture');
  R('tiki_torch', 1, { stick: 2, fiber: 1, coconut: 1 }, 1, 'furniture');
  R('rug_weave', 1, { fiber: 4, flower_red: 1 }, 1, 'furniture');
  R('rug_white', 1, { fiber: 4 }, 1, 'furniture');
  R('rug_sea', 1, { fiber: 4, seaweed: 1 }, 1, 'furniture');
  R('towel', 1, { fiber: 3 }, 1, 'furniture');
  R('flower_pot', 1, { clay: 1, flower_pink: 1 }, 1, 'furniture');
  R('potted_palm', 1, { clay: 2, palm_sapling: 1 }, 1, 'furniture');
  R('pet_bed', 1, { planks: 2, fiber: 4 }, 1, 'furniture');
  R('sign', 1, { planks: 1, stick: 1 }, 1, 'furniture');
  R('beach_chair', 1, { stick: 4, fiber: 4 }, 1, 'furniture');
  R('clock', 1, { planks: 1, sand_dollar: 1 }, 1, 'furniture');

  R('net', 1, { stick: 3, fiber: 4 });
  R('bedroll', 1, { fiber: 6 });
  R('tent', 1, { fiber: 8, stick: 4 });
  R('kitchen_counter', 1, { planks: 3, flower_white: 1 }, 1, 'furniture');
  R('stove', 1, { stone: 6, torch: 1 }, 1, 'furniture');
  R('dresser', 1, { planks: 4, stick: 2 }, 1, 'furniture');
  R('wardrobe', 1, { dark_planks: 6 }, 1, 'furniture');
  R('mirror', 1, { glass: 1, shell_cockle: 2 }, 1, 'furniture');
  R('hammock', 1, { stick: 4, rope: 2, fiber: 4 }, 1, 'furniture');
  R('surfboard', 1, { drift_planks: 3, flower_blue: 1 }, 1, 'furniture');
  R('life_ring', 1, { fiber: 4, flower_red: 1 }, 1, 'furniture');
  R('ship_wheel', 1, { dark_planks: 2, stick: 4 }, 1, 'furniture');
  R('bunting', 2, { rope: 1, flower_red: 1, flower_yellow: 1 }, 1, 'furniture');
  R('picnic_basket', 1, { fiber: 5, stick: 2 }, 1, 'furniture');
  R('planter', 1, { planks: 2, dirt: 1, flower_pink: 1 }, 1, 'furniture');
  R('lamp_post', 1, { stone: 4, lantern: 1 }, 1, 'furniture');
  R('star_lamp', 1, { star_fragment: 2, stone: 1 }, 1, 'furniture');
  R('teddy', 1, { fiber: 8, stick: 1 }, 1, 'furniture');
  R('gnome', 1, { stone: 3, fiber: 2, flower_red: 1 }, 1, 'furniture');
  R('mush_lamp', 1, { mushroom: 2, torch: 1 }, 1, 'furniture');
  R('sand_buddy', 1, { sand: 6, stick: 2, starfish: 1 }, 1, 'furniture');
  R('bookshelf_tall', 1, { planks: 5, fiber: 3 }, 1, 'furniture');

  R('plaster_pink', 4, { plaster: 4, flower_pink: 1 }, 1, 'colors');
  R('plaster_blue', 4, { plaster: 4, flower_blue: 1 }, 1, 'colors');
  R('plaster_yellow', 4, { plaster: 4, flower_yellow: 1 }, 1, 'colors');
  R('plaster_mint', 4, { plaster: 4, fern: 1 }, 1, 'colors');
  R('tile_white', 4, { clay: 2, sand: 1 }, 1, 'building');
  R('tile_checker', 4, { tile_white: 4, flower_blue: 1 }, 1, 'building');
  R('tile_terracotta', 4, { clay: 3 }, 1, 'building');
  R('bamboo', 4, { stick: 6 }, 1, 'building');
  R('barrel', 1, { planks: 4, stone: 1 }, 1, 'furniture');
  R('bench', 1, { planks: 3, stone: 1 }, 1, 'furniture');
  R('picnic_table', 1, { planks: 4, fiber: 2 }, 1, 'furniture');
  R('mailbox', 1, { planks: 2, flower_red: 1 }, 1, 'furniture');
  R('birdbath', 1, { stone: 5 }, 1, 'furniture');
  R('sink', 1, { planks: 3, clay: 2 }, 1, 'furniture');
  R('tiki_statue', 1, { log: 3, coconut: 1 }, 1, 'furniture');
  R('anchor', 1, { stone: 4, rope: 1 }, 1, 'furniture');

  // ---- shop ----  (price in pearls)
  G.SHOP_STOCK = [
    { id: 'pet_treat', price: 10 }, { id: 'seed_carrot', price: 8 }, { id: 'seed_corn', price: 12 }, { id: 'seed_melon', price: 18 },
    { id: 'sapling', price: 20 }, { id: 'sapling_pink', price: 45 }, { id: 'palm_sapling', price: 20 },
    { id: 'glass', price: 6 }, { id: 'bricks', price: 5 }, { id: 'paint_white', price: 4 }, { id: 'paint_teal', price: 4 }, { id: 'roof_blue', price: 6 },
  ];
  // furniture that only Marlow sells; six of these are on offer each day
  G.SHOP_SPECIALS = [
    { id: 'lamp', price: 90 }, { id: 'sofa', price: 220 }, { id: 'sofa_pink', price: 220 }, { id: 'bed_blue', price: 180 },
    { id: 'fish_tank', price: 260 }, { id: 'painting_sea', price: 120 }, { id: 'painting_palm', price: 120 },
    { id: 'beach_umbrella', price: 150 }, { id: 'rug_pink', price: 60 }, { id: 'rug_blue', price: 60 },
    { id: 'string_lights', price: 40 }, { id: 'beach_ball', price: 35 }, { id: 'fish_trophy', price: 140 },
    { id: 'bathtub', price: 240 }, { id: 'fridge', price: 200 }, { id: 'telescope', price: 280 }, { id: 'record_player', price: 190 }, { id: 'globe', price: 120 },
    { id: 'lamp_post', price: 110 }, { id: 'stove', price: 160 }, { id: 'wardrobe', price: 170 }, { id: 'hammock', price: 130 }, { id: 'surfboard', price: 95 },
    { id: 'teddy', price: 55 }, { id: 'gnome', price: 70 }, { id: 'mush_lamp', price: 85 },
  ];
  G.shopStock = function () {
    const rnd = G.makeRng(G.world.seed + G.day * 977);
    const pool = G.SHOP_SPECIALS.slice(), specials = [];
    for (let i = 0; i < 6 && pool.length; i++) specials.push(Object.assign({ special: true }, pool.splice((rnd() * pool.length) | 0, 1)[0]));
    return specials.concat(G.SHOP_STOCK);
  };
  // things the shop will buy that have no value set elsewhere
  const sellValues = { log: 3, palm_log: 3, planks: 1, stone: 2, fiber: 1, stick: 1, driftwood: 6, coconut: 8, clay: 3, mushroom: 9, flower_red: 3, flower_yellow: 3, flower_blue: 3, flower_white: 3, flower_pink: 3, flower_purple: 4, seaweed: 3, coral_pink: 10, coral_orange: 10, coral_purple: 12, rope: 4 };
  for (const k in sellValues) if (G.ITEMS[k] && !G.ITEMS[k].value) G.ITEMS[k].value = sellValues[k];

  // ---- pets ----
  G.PET_KINDS = {
    cat: { label: 'Beach Cat', icon: '🐱', likes: ['fish', 'pet_treat'], body: 0xf2b872, belly: 0xfff3dc, size: 0.8, speed: 2.6, home: 'camp', sound: 'meow' },
    dog: { label: 'Sandy Pup', icon: '🐶', likes: ['pet_treat', 'cooked_fish'], body: 0xd8a070, belly: 0xfff0d8, size: 0.95, speed: 3.0, home: 'grass', sound: 'woof' },
    bunny: { label: 'Clover Bunny', icon: '🐰', likes: ['carrot', 'berry', 'pet_treat'], body: 0xf7f2ea, belly: 0xffffff, size: 0.7, speed: 2.8, home: 'grass', sound: 'squeak' },
    crab: { label: 'Dancing Crab', icon: '🦀', likes: ['coconut', 'pet_treat'], body: 0xf07a5a, belly: 0xffb89a, size: 0.6, speed: 2.0, home: 'beach', sound: 'click' },
    duck: { label: 'Lagoon Duckling', icon: '🦆', likes: ['corn', 'berry', 'pet_treat'], body: 0xffe27a, belly: 0xfff6c9, size: 0.6, speed: 2.2, home: 'lagoon', sound: 'quack' },
    fox: { label: 'Dune Fox', icon: '🦊', likes: ['berry', 'cooked_fish', 'pet_treat'], body: 0xee8a4a, belly: 0xfff3e6, size: 0.9, speed: 3.2, home: 'hill', sound: 'yip' },
  };
  G.PET_NAMES = ['Mochi', 'Pebble', 'Coco', 'Biscuit', 'Sunny', 'Marlow', 'Pippin', 'Clementine', 'Noodle', 'Juniper', 'Peaches', 'Skipper', 'Tofu', 'Maple', 'Button', 'Sprout', 'Waffles', 'Kelp'];

  G.itemLabel = (id) => (G.ITEMS[id] ? G.ITEMS[id].label : id);
})();
