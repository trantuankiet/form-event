require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');

const db = require('./src/db');
const compositor = require('./src/compositor');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// Can thiet khi chay sau reverse proxy (Render, Nginx...) de req.protocol
// nhan dung 'https' thay vi 'http'
app.set('trust proxy', true);

// Uu tien BASE_URL neu admin da set thu cong trong bien moi truong.
// Neu KHONG set (hoac quen set khi deploy), tu dong lay domain that
// tu chinh request dang goi toi (vd form-event-mpea.onrender.com),
// tranh bi fallback nham ve localhost khi len production.
function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

// Dam bao thu muc data ton tai
fs.mkdirSync(path.join(__dirname, 'data', 'photos'), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '10mb' })); // chu ky base64 co the hoi lon
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 tieng
  })
);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/photos', express.static(compositor.PHOTOS_DIR));

// ---------- Trang kiosk (form + chu ky) ----------
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});

// ---------- API: nhan form + chu ky, ghep anh, sinh QR ----------
app.post('/api/submit', async (req, res) => {
  try {
    const { name, phone, agency, signature } = req.body;

    if (!name || !phone || !agency || !signature) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc.' });
    }

    const id = nanoid(10);
    const photoFile = await compositor.composePhoto({ id, signatureDataUrl: signature });

    db.insertEntry({
      id,
      name: name.trim(),
      phone: phone.trim(),
      agency: agency.trim(),
      photoFile,
    });

    const photoPageUrl = `${getBaseUrl(req)}/photo/${id}`;
    const qrDataUrl = await QRCode.toDataURL(photoPageUrl, { width: 400, margin: 1 });

    res.json({ id, qrDataUrl, photoPageUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Có lỗi khi xử lý ảnh, vui lòng thử lại.' });
  }
});

// ---------- Trang xem/tai anh (mo khi quet QR bang dien thoai) ----------
app.get('/photo/:id', (req, res) => {
  const entry = db.getEntry(req.params.id);
  if (!entry) return res.status(404).send('Không tìm thấy ảnh.');

  const baseUrl = getBaseUrl(req);
  res.render('photo', {
    imageUrl: `${baseUrl}/photos/${entry.photo_file}`,
    pageUrl: `${baseUrl}/photo/${entry.id}`,
    downloadUrl: `${baseUrl}/download/${entry.id}`,
    name: entry.name,
  });
});

// ---------- Tai anh ve may (buoc Content-Disposition de force download) ----------
app.get('/download/:id', (req, res) => {
  const entry = db.getEntry(req.params.id);
  if (!entry) return res.status(404).send('Không tìm thấy ảnh.');
  const filePath = path.join(compositor.PHOTOS_DIR, entry.photo_file);
  res.download(filePath, `anh-su-kien-${entry.id}.png`);
});

// =====================================================================
// ADMIN
// =====================================================================
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login');
}

app.get('/admin', (req, res) => res.redirect('/admin/dashboard'));

app.get('/admin/login', (req, res) => {
  res.render('admin_login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard');
  }
  res.render('admin_login', { error: 'Mat khau khong dung.' });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.get('/admin/dashboard', requireAdmin, (req, res) => {
  const hasCustomFrame = compositor.hasCustomFrame();
  res.render('admin_dashboard', {
    count: db.countEntries(),
    hasCustomFrame,
    frameUrl: `/admin/frame-preview?ts=${Date.now()}`,
    resetStatus: req.query.reset || null,
  });
});

app.get('/admin/frame-preview', requireAdmin, (req, res) => {
  const framePath = compositor.hasCustomFrame()
    ? compositor.FRAME_PATH
    : path.join(__dirname, 'assets', 'default-frame.png');
  res.sendFile(framePath);
});

app.post('/admin/upload-frame', requireAdmin, upload.single('frame'), async (req, res) => {
  try {
    if (!req.file) return res.redirect('/admin/dashboard');
    await compositor.saveFrame(req.file.path);
    fs.unlink(req.file.path, () => {});
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).send('Có lỗi khi tải lên frame.');
  }
});

app.post('/admin/reset', requireAdmin, (req, res) => {
  try {
    db.deleteAllEntries();
    compositor.clearAllPhotos();
    res.redirect('/admin/dashboard?reset=success');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/dashboard?reset=error');
  }
});

app.get('/admin/export', requireAdmin, async (req, res) => {
  const entries = db.getAllEntries();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Danh sach');
  sheet.columns = [
    { header: 'STT', key: 'stt', width: 6 },
    { header: 'Ten', key: 'name', width: 28 },
    { header: 'So dien thoai', key: 'phone', width: 18 },
    { header: 'Dai ly', key: 'agency', width: 28 },
    { header: 'Thoi gian', key: 'created_at', width: 22 },
  ];

  entries.forEach((e, idx) => {
    sheet.addRow({
      stt: idx + 1,
      name: e.name,
      phone: e.phone,
      agency: e.agency,
      created_at: e.created_at,
    });
  });
  sheet.getRow(1).font = { bold: true };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', 'attachment; filename="danh-sach-su-kien.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

app.listen(PORT, () => {
  console.log(`Server dang chay tai http://localhost:${PORT}`);
  if (process.env.BASE_URL) {
    console.log(`BASE_URL (co dinh, dung cho QR/OG tags): ${process.env.BASE_URL}`);
  } else {
    console.log('BASE_URL chua duoc set - se tu dong lay domain that tu request (khuyen nghi van nen set BASE_URL tren production de dam bao chinh xac).');
  }
});
