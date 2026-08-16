const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FRAME_PATH = path.join(DATA_DIR, 'frame.png');
const DEFAULT_FRAME_PATH = path.join(__dirname, '..', 'assets', 'default-frame.png');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

const FRAME_WIDTH = parseInt(process.env.FRAME_WIDTH || '1080', 10);
const FRAME_HEIGHT = parseInt(process.env.FRAME_HEIGHT || '1350', 10);
const SIG_X = parseInt(process.env.SIGNATURE_X || '290', 10);
const SIG_Y = parseInt(process.env.SIGNATURE_Y || '1000', 10);
const SIG_W = parseInt(process.env.SIGNATURE_WIDTH || '500', 10);
const SIG_H = parseInt(process.env.SIGNATURE_HEIGHT || '200', 10);

// Frame do admin upload co ton tai khong (frame that cua su kien)
function hasCustomFrame() {
  return fs.existsSync(FRAME_PATH);
}

// Duong dan frame se dung de ghep anh: uu tien frame admin, neu chua co thi dung frame mau
function getActiveFramePath() {
  return hasCustomFrame() ? FRAME_PATH : DEFAULT_FRAME_PATH;
}

/**
 * Ghép chữ ký (base64 PNG, nền trong suốt) lên giữa frame.
 * Ưu tiên dùng frame admin đã upload; nếu chưa có thì dùng frame mẫu mặc định.
 * Trả về đường dẫn file ảnh kết quả (trong data/photos).
 */
async function composePhoto({ id, signatureDataUrl }) {
  const activeFramePath = getActiveFramePath();

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

  const frameBuffer = await sharp(activeFramePath)
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
  hasCustomFrame,
  FRAME_PATH,
  PHOTOS_DIR,
};
