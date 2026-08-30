/**
 * Icon Generation Script
 * 
 * Converts resources/icons/app-source.svg → resources/icons/app.ico
 * Uses sharp (already in dependencies) for SVG→PNG→ICO conversion.
 * 
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'resources', 'icons');
const SVG_SOURCE = path.join(ICONS_DIR, 'app-source.svg');
const ICO_OUTPUT = path.join(ICONS_DIR, 'app.ico');
const PNG_OUTPUT = path.join(ICONS_DIR, 'app.png');

// ICO file format: we'll generate PNGs at multiple sizes and pack them
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generateIcons() {
  console.log('Generating production icons from SVG source...\n');

  if (!fs.existsSync(SVG_SOURCE)) {
    console.error(`SVG source not found: ${SVG_SOURCE}`);
    console.error('Please create resources/icons/app-source.svg first.');
    process.exit(1);
  }

  // Generate PNG at each size
  const pngBuffers = [];
  for (const size of ICON_SIZES) {
    const png = await sharp(SVG_SOURCE)
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buffer: png });
    console.log(`  ✓ Generated ${size}x${size} PNG`);
  }

  // Generate large PNG for installer
  const largePng = await sharp(SVG_SOURCE)
    .resize(512, 512)
    .png()
    .toBuffer();
  fs.writeFileSync(PNG_OUTPUT, largePng);
  console.log(`  ✓ Generated 512x512 PNG (app.png)`);

  // Pack into ICO format
  // ICO format: header(6) + dir entries(16 each) + image data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: ICO
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  // Directory entries + image data
  let dataOffset = 6 + (pngBuffers.length * 16);
  const dirEntries = [];
  const imageData = [];

  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size < 256 ? size : 0, 0);  // Width
    entry.writeUInt8(size < 256 ? size : 0, 1);  // Height
    entry.writeUInt8(0, 2);        // Color palette
    entry.writeUInt8(0, 3);        // Reserved
    entry.writeUInt16LE(1, 4);     // Color planes
    entry.writeUInt16LE(32, 6);    // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8);  // Image data size
    entry.writeUInt32LE(dataOffset, 12);    // Data offset

    dirEntries.push(entry);
    imageData.push(buffer);
    dataOffset += buffer.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...imageData]);
  fs.writeFileSync(ICO_OUTPUT, icoBuffer);

  console.log(`\n✅ Generated ${ICO_OUTPUT}`);
  console.log(`   ${pngBuffers.length} sizes packed: ${ICON_SIZES.join(', ')}px`);
  console.log(`   Total ICO size: ${(icoBuffer.length / 1024).toFixed(1)} KB`);
}

generateIcons().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
