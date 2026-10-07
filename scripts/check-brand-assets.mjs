import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Catch packaging failures and opaque rectangles before they reach a phone.
const dir = 'assets/generated';
const files = (await fs.readdir(dir)).filter(name => /^(nav|feature|direction|utility|badge)-.*\.png$/.test(name));
assert.equal(files.length, 28, 'Expected 28 UI icons');
let bytes = 0;
for (const name of files) {
  const file = path.join(dir, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, info.height, `${name}: must be square`);
  let visible = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 100) visible++;
      if (x < 8 || y < 8 || x >= info.width - 8 || y >= info.height - 8) {
        assert.equal(alpha, 0, `${name}: artwork touches the safe border`);
      }
    }
  }
  const coverage = visible / (info.width * info.height);
  assert(coverage > 0.2 && coverage < 0.8, `${name}: empty or opaque/cropped artwork (${coverage})`);
  bytes += (await fs.stat(file)).size;
}
assert(bytes < 1_200_000, `Icon budget exceeded: ${bytes} bytes`);
assert((await fs.stat(path.join(dir, 'family-hero.webp'))).size < 250_000, 'Hero budget exceeded');

async function checkReferences(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { await checkReferences(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    const content = await fs.readFile(file, 'utf8');
    for (const [, relative] of content.matchAll(/require\(['"]([^'"]*assets\/generated\/[^'"]+)['"]\)/g)) {
      await fs.access(path.resolve(path.dirname(file), relative));
    }
  }
}
await checkReferences('src');
console.log(`28 icons: transparency, safe borders, coverage and references OK; ${(bytes / 1024).toFixed(0)} KiB total.`);
