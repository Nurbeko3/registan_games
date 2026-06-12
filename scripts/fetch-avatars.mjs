// Downloads the pixel/robot avatar art into public/avatars/*.svg so the app
// stays fully OFFLINE-FIRST (no runtime calls to the DiceBear API).
//
//   node scripts/fetch-avatars.mjs
//
// Sources (both free for commercial use, no attribution required):
//   • pixel-art — DiceBear, CC0 1.0          https://www.dicebear.com/styles/pixel-art/
//   • bottts    — Pablo Stanley, free com.   https://www.dicebear.com/styles/bottts/
//
// Seeds are CURATED — changing one changes that character's face. Re-run to
// regenerate; files are committed so this is a content tool, not a build step.

import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/avatars/', import.meta.url).pathname;
const API = 'https://api.dicebear.com/9.x';

/** id → [style, query] (id matches src/data/cosmetics.ts AVATARS). */
const AVATARS = {
  kid: ['pixel-art', 'seed=Timur&hatProbability=0'],
  boy: ['pixel-art', 'seed=Bek&hatProbability=0'],
  girl: ['pixel-art', 'seed=Zarina&hatProbability=0'],
  wizard: ['pixel-art', 'seed=Merlin&hatProbability=100&hatColor=3633e0'],
  astronaut: ['bottts', 'seed=Cosmo&baseColor=90caf9'],
  robot: ['bottts', 'seed=Byte&baseColor=ffb300'],
  alien: ['bottts', 'seed=Zorg&baseColor=66bb6a'],
  spark: ['bottts', 'seed=Bolt&baseColor=ef5350'],
  nova: ['bottts', 'seed=Luna&baseColor=ab47bc'],
};

mkdirSync(OUT, { recursive: true });
for (const [id, [style, query]] of Object.entries(AVATARS)) {
  const url = `${API}/${style}/svg?${query}`;
  const res = await fetch(url);
  if (!res.ok) { console.error(`FAIL ${id}: ${res.status} ${url}`); process.exitCode = 1; continue; }
  const svg = await res.text();
  writeFileSync(`${OUT}${id}.svg`, svg);
  console.log(`✓ ${id}.svg  (${style}, ${svg.length}b)`);
}
