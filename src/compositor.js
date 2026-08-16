const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FRAME_PATH = path.join(DATA_DIR, 'frame.png');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

const FRAME_WIDTH = parseInt(process.env.FRAME_WIDTH || '1080', 10);
const FRAME_HEIGHT = parseInt(process.env.FRAME_HEIGHT || '1350', 10);
const SIG_X = parseInt(process.env.SIGNATURE_X || '290', 10);
const SIG_Y = parseInt(process.env.SIGNATURE_Y || '1000', 10);
const SIG_W = parseInt(process.env.SIGNATURE_WIDTH || '500', 10);
const SIG_H = parseInt(process.env.SIGNATURE_HEIGHT || '200', 10);

function frameExists() {
  return fs.existsSync(FRAME_PATH);
}

/**
 * Ghep chu ky (base64 PNG, nen trong suot) len giua frame co dinh.
 * Tra ve duong dan file anh ket qua (trong data/photos).
 */
async function composePhoto({ id, signatureDataUrl }) {
  if (!frameExists()) {
    throw new Error('Chua co frame nao duoc upload trong trang quan tri.');
  }

  const base64 = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
  const sigBuffer = Buffer.from(base64, 'base64');

  // Resize chu ky vua khung, giu ti le, nen trong suot
  const resizedSig = await sharp(sigBuffer)
    .resize({
      width: SIG_W,
      height: SIG_H,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  const frameBuffer = await sharp(FRAME_PATH)
    .resize(FRAME_WIDTH, FRAME_HEIGHT, { fit: 'cover' })
    .toBuffer();

  const outFileName = `${id}.png`;
  const outPath = path.join(PHOTOS_DIR, outFileName);

  await sharp(frameBuffer)
    .composite([{ input: resizedSig, left: SIG_X, top: SIG_Y }])
    .png()
    .toFile(outPath);

  return outFileName;
}

async function saveFrame(uploadedFilePath) {
  await sharp(uploadedFilePath)
    .resize(FRAME_WIDTH, FRAME_HEIGHT, { fit: 'cover' })
    .png()
    .toFile(FRAME_PATH);
}

module.exports = {
  composePhoto,
  saveFrame,
  frameExists,
  FRAME_PATH,
  PHOTOS_DIR,
};
