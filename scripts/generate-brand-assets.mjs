import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'assets', 'brand-source');
const outDir = path.join(root, 'assets', 'generated');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const source = (name) => path.join(sourceDir, name);

const sources = {
  appIcon: source('app-icon.png'),
  splash: source('splash.png'),
  hero: source('family-hero.png'),
  directionStrip: source('growth-directions.png'),
  navStrip: source('navigation-icons.png'),
  utilityStrip: source('utility-icons.png'),
  featureStrip: source('feature-icons.png'),
  badgeSheet: source('achievement-badges.png'),
};
const decorManifestFile = source('manifest.json');

await fs.mkdir(outDir, { recursive: true });
await Promise.all([
  ...Object.values(sources).map((file) => fs.access(file)),
  fs.access(decorManifestFile),
]);

const png = (file) => sharp(file, { failOn: 'none' });

await png(sources.appIcon)
  .resize(1024, 1024, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9, quality: 94 })
  .toFile(path.join(outDir, 'app-icon.png'));

await png(sources.hero)
  .resize(1600, 900, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9, quality: 92 })
  .toFile(path.join(outDir, 'family-hero.png'));

await png(sources.splash)
  .resize(1080, 1920, { fit: 'cover', position: 'centre' })
  .png({ compressionLevel: 9, quality: 92 })
  .toFile(path.join(outDir, 'splash-screen.png'));

async function splitHorizontalStrip(file, names, prefix, targetSize) {
  const metadata = await png(file).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read strip metadata: ${file}`);

  for (let index = 0; index < names.length; index += 1) {
    const left = Math.floor((metadata.width * index) / names.length);
    const right = Math.floor((metadata.width * (index + 1)) / names.length);
    const width = Math.max(1, right - left);

    const crop = await png(file)
      .extract({ left, top: 0, width, height: metadata.height })
      .png()
      .toBuffer();

    await sharp(crop)
      .trim({ threshold: 8 })
      .resize(targetSize, targetSize, { fit: 'contain', background: transparent })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `${prefix}-${names[index]}.png`));
  }
}

await splitHorizontalStrip(
  sources.directionStrip,
  ['school', 'football', 'chess', 'english', 'leadership'],
  'direction',
  256,
);

// Source order: home, growth/path, book, heart/together, family/us.
await splitHorizontalStrip(
  sources.navStrip,
  ['home', 'growth', 'book', 'together', 'us'],
  'nav',
  196,
);

// Source order: calendar, microphone, checklist, mountain path, star in hands.
await splitHorizontalStrip(
  sources.utilityStrip,
  ['calendar', 'voice', 'agreements', 'goal', 'recognition'],
  'utility',
  220,
);

// Source order: home, shared path/star, book, heart/path, father-and-child.
await splitHorizontalStrip(
  sources.featureStrip,
  ['home', 'path', 'book', 'together', 'family'],
  'feature',
  220,
);

async function splitGrid(file, names, columns, rows, prefix, targetSize) {
  const metadata = await png(file).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Cannot read grid metadata: ${file}`);
  if (names.length !== columns * rows) throw new Error('Grid names count must match columns × rows');

  for (let index = 0; index < names.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = Math.floor((metadata.width * column) / columns);
    const right = Math.floor((metadata.width * (column + 1)) / columns);
    const top = Math.floor((metadata.height * row) / rows);
    const bottom = Math.floor((metadata.height * (row + 1)) / rows);

    const crop = await png(file)
      .extract({ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) })
      .png()
      .toBuffer();

    await sharp(crop)
      .trim({ threshold: 8 })
      .resize(targetSize, targetSize, { fit: 'contain', background: transparent })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, `${prefix}-${names[index]}.png`));
  }
}

await splitGrid(
  sources.badgeSheet,
  ['school', 'football', 'chess', 'english', 'adventure', 'team', 'courage', 'planner'],
  4,
  2,
  'badge',
  320,
);

// Decorative artwork is no longer cropped from decor-atlas.png. Each element is
// stored as an individual mobile-ready PNG and validated through manifest.json.
const decorManifest = JSON.parse(await fs.readFile(decorManifestFile, 'utf8'));
if (!Array.isArray(decorManifest.assets) || decorManifest.assets.length === 0) {
  throw new Error('Decor manifest must contain a non-empty assets array');
}

for (const asset of decorManifest.assets) {
  const name = String(asset?.name ?? '');
  if (!/^(decor|card)-[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid decor asset name in manifest: ${name}`);
  }

  const input = source(`${name}.png`);
  await fs.access(input);
  await png(input)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, quality: 94 })
    .toFile(path.join(outDir, `${name}.png`));
}

await fs.writeFile(
  path.join(outDir, 'decor-manifest.json'),
  JSON.stringify(
    {
      count: decorManifest.assets.length,
      assets: decorManifest.assets.map((asset) => `${asset.name}.png`),
    },
    null,
    2,
  ),
  'utf8',
);

const monochromeSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="none"/>
  <circle cx="430" cy="365" r="86" fill="#fff"/>
  <path d="M286 547 C296 438 363 389 448 400 C540 411 604 481 612 609 L638 884 L220 884 L251 646 C257 608 267 574 286 547 Z" fill="#fff"/>
  <circle cx="655" cy="455" r="63" fill="#fff"/>
  <path d="M566 583 C576 511 620 476 680 486 C745 497 789 549 794 626 L808 884 L538 884 L553 650 C555 624 560 601 566 583 Z" fill="#fff"/>
  <path d="M498 573 C556 607 615 624 672 626 C713 628 744 609 770 582" fill="none" stroke="#fff" stroke-width="58" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(monochromeSvg))
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'app-icon-monochrome.png'));

console.log(`Generated Papa & Ya assets, including ${decorManifest.assets.length} individual decor PNGs`);
