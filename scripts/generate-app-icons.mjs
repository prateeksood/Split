/**
 * Generates all required Expo app icon assets from the master logo PNG.
 * Usage: node scripts/generate-app-icons.mjs <path-to-source-logo.png>
 */
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '../apps/mobile/assets');

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error('Usage: node scripts/generate-app-icons.mjs <path-to-source-logo.png>');
  process.exit(1);
}

const sizes = [
  // icon.png — used by iOS and the Expo launcher (must be 1024x1024, no transparency)
  { file: 'icon.png', size: 1024, background: '#0B0B10' },
  // adaptive-icon.png — Android foreground layer (1024x1024, safe zone is center 66%)
  { file: 'adaptive-icon.png', size: 1024, background: null },
  // splash-icon.png — shown on the splash screen (200x200 centered)
  { file: 'splash-icon.png', size: 200, background: null },
  // favicon.png — browser tab icon for the web build
  { file: 'favicon.png', size: 48, background: '#0B0B10' },
];

for (const { file, size, background } of sizes) {
  let pipeline = sharp(src).resize(size, size, { fit: 'contain' });

  if (background) {
    pipeline = pipeline.flatten({ background });
  }

  const out = join(assetsDir, file);
  await pipeline.png().toFile(out);
  console.log(`✓ ${file} (${size}x${size})`);
}

console.log('\nAll assets written to apps/mobile/assets/');
