import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourceDir = path.join(root, 'assets', 'brand-source');
const outDir = path.join(root, 'assets', 'generated');
const atlasPath = path.join(sourceDir, 'brand-atlas.webp');

await fs.mkdir(outDir, { recursive: true });
await fs.access(atlasPath);

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const atlas = () => sharp(atlasPath, { failOn: 'none' });

// The source atlas keeps the generated visual system in one optimized file.
// Coordinates are intentionally fixed so install/build output is deterministic.
const regions = {
  icon: { left: 0, top: 0, width: 512, height: 512 },
  hero: { left: 512, top: 0, width: 688, height: 516 },
  splash: { left: 0, top: 512, width: 338, height: 601 },
};

await atlas()
  .extract(regions.icon)
  .resize(1024, 1024, { fit: 'cover' })
  .png({ compressionLevel: 9, palette: true, quality: 94 })
  .toFile(path.join(outDir, 'app-icon.png'));

await atlas()
  .extract(regions.hero)
  .resize(1200, 900, { fit: 'cover' })
  .png({ compressionLevel: 9, palette: true, quality: 91, colours: 256 })
  .toFile(path.join(outDir, 'family-hero.png'));

await atlas()
  .extract(regions.splash)
  .resize(540, 960, { fit: 'cover' })
  .png({ compressionLevel: 9, palette: true, quality: 91, colours: 256 })
  .toFile(path.join(outDir, 'splash-screen.png'));

const directionIcons = [
  ['school', { left: 349, top: 566, width: 109, height: 143 }],
  ['football', { left: 458, top: 522, width: 120, height: 144 }],
  ['chess', { left: 578, top: 543, width: 118, height: 131 }],
  ['english', { left: 701, top: 567, width: 114, height: 134 }],
  ['leadership', { left: 819, top: 550, width: 112, height: 122 }],
];

for (const [name, region] of directionIcons) {
  await atlas()
    .extract(region)
    .resize(220, 220, { fit: 'contain', background: transparent })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, `direction-${name}.png`));
}

const navIcons = [
  ['home', { left: 346, top: 771, width: 103, height: 134 }],
  ['growth', { left: 462, top: 754, width: 108, height: 150 }],
  ['book', { left: 578, top: 718, width: 120, height: 189 }],
  ['together', { left: 706, top: 719, width: 109, height: 172 }],
  ['us', { left: 822, top: 768, width: 107, height: 101 }],
];

for (const [name, region] of navIcons) {
  await atlas()
    .extract(region)
    .resize(180, 180, { fit: 'contain', background: transparent })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, `nav-${name}.png`));
}

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

console.log('Generated Papa & Ya visual assets from assets/brand-source/brand-atlas.webp');
