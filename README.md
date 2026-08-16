# Photobooth Check-in Sự Kiện

## ⚠️ LƯU Ý QUAN TRỌNG nếu đang deploy trên Render.com free tier

Render **Free Web Service có ổ đĩa tạm thời (ephemeral filesystem)**: mọi thứ ghi
ra ổ đĩa lúc chạy — bao gồm **database SQLite, frame admin đã tải lên, ảnh khách
đã tạo** — sẽ **bị xoá sạch mỗi khi service khởi động lại** (restart, redeploy,
hoặc tự "ngủ" sau ~15 phút không có truy cập rồi "thức dậy" khi có người vào lại).

Điều này có nghĩa là:
- Nếu em upload frame thật, rồi service ngủ/thức dậy → frame biến mất, phải upload lại.
- Nếu có khách đã check-in, rồi service restart → **toàn bộ dữ liệu khách bị mất**,
  không xuất Excel được đầy đủ.
- Free tier còn có "cold start" (~30-50 giây) lần đầu sau khi ngủ dậy → khách đứng
  chờ ở iPad sẽ thấy trang bị đơ/loading lâu.

→ **Render free tier chỉ phù hợp để demo/test giao diện, KHÔNG dùng cho sự kiện
thật với khách thật.** Trước ngày 25/08, em nên chuyển sang một trong các hướng sau:
1. Nâng cấp Render lên gói trả phí + gắn **Persistent Disk** (giữ được file qua các lần restart).
2. Deploy lên VPS có SSH riêng (Oracle Cloud Free Tier...) theo hướng dẫn ở mục 3 bên dưới — dữ liệu lưu trên ổ đĩa thật của server, không bị xoá.
3. Hoặc tối thiểu: xuất Excel backup định kỳ trong lúc test để không mất dữ liệu oan.

---


Web app: khách chạm iPad → điền Tên/SĐT/Đại lý → ký tên → hệ thống ghép chữ ký vào
giữa frame cố định → sinh QR → khách quét bằng điện thoại để tải ảnh + share Facebook.
Admin có trang riêng để upload frame và xuất Excel danh sách khách.

## 1. Cài đặt local để test

```bash
npm install
cp .env.example .env     # rồi mở .env chỉnh mật khẩu, BASE_URL...
npm start
```

Mở `http://localhost:3000` (form khách) và `http://localhost:3000/admin` (trang quản trị).

## 2. Cấu hình quan trọng trong `.env`

| Biến | Ý nghĩa |
|---|---|
| `BASE_URL` | URL public thật của server (domain hoặc IP), dùng để sinh QR và Open Graph cho Facebook. **Bắt buộc đổi khi lên production**, nếu để `localhost` thì QR sẽ không quét được từ điện thoại khách. |
| `ADMIN_PASSWORD` | Mật khẩu vào trang `/admin`. |
| `SESSION_SECRET` | Chuỗi bí mật, đặt ngẫu nhiên dài. |
| `FRAME_WIDTH/HEIGHT` | Kích thước ảnh xuất ra (px). |
| `SIGNATURE_X/Y/WIDTH/HEIGHT` | Vị trí + kích thước khung chữ ký đặt trên frame (tính theo px, gốc trên-trái). Cần đo thử theo frame thật để canh giữa đúng ý đồ hoạ. |

## 3. Trang quản trị (Admin) — cách truy cập, đăng nhập, upload frame

**Đường dẫn:** `<BASE_URL>/admin` — ví dụ với Render là
`https://form-event-mpea.onrender.com/admin`
(vào thẳng `/admin` cũng tự chuyển sang `/admin/login` nếu chưa đăng nhập).

**Đăng nhập:** dùng đúng 1 mật khẩu, không cần username — chính là giá trị
`ADMIN_PASSWORD` đặt trong biến môi trường (`.env` khi chạy local, hoặc mục
**Environment** trong Render Dashboard khi deploy production). Mặc định trong
`.env.example` là `doimatkhaunay` — **bắt buộc phải đổi giá trị này trước khi
dùng thật**, đừng để mặc định.

**Sau khi đăng nhập vào `/admin/dashboard`, em sẽ thấy:**
- Số lượt khách đã check-in (real-time)
- Nút **"Xuất Excel danh sách"**
- Khung **"Frame / Background sự kiện"**: xem frame đang dùng (frame mẫu màu
  xanh nếu chưa upload, hoặc frame thật nếu đã upload) + form để tải lên/thay frame mới

**Các bước chuẩn bị trước sự kiện:**
1. Vào `/admin`, đăng nhập bằng `ADMIN_PASSWORD`.
2. Ở khung "Frame / Background sự kiện", bấm **"Chọn file"**, chọn ảnh frame
   thiết kế thật (PNG/JPG), bấm **"Tải lên / Thay frame mới"**.
3. Mở `SIGNATURE_X/Y/WIDTH/HEIGHT` trong biến môi trường, chỉnh sao cho khung
   chữ ký nằm đúng vị trí mong muốn trên frame, sau đó restart server (trên
   Render: service tự redeploy khi đổi Environment Variables).
4. Mở trang chủ `/` trên iPad (dùng chế độ Guided Access / Kiosk của iOS để khoá
   khách không thoát ra Safari khác).

> **Nếu chưa kịp upload frame thật:** hệ thống tự động dùng một **frame mẫu**
> (nền xanh, có chữ "FRAME MẪU") để khách vẫn thao tác được bình thường —
> sẽ không còn báo lỗi "chưa có frame" nữa như trước. Nhưng nhớ đổi sang frame
> thật trước khi khai mạc sự kiện.

## 4. Deploy lên server Linux (Ubuntu) — dùng PM2 + Nginx

```bash
# Trên server
sudo apt update && sudo apt install -y nodejs npm nginx
sudo npm install -g pm2

# Copy project len server, vi du vao /var/www/photobooth
cd /var/www/photobooth
npm install --omit=dev
cp .env.example .env
nano .env   # chinh BASE_URL = https://domain-cua-ban, ADMIN_PASSWORD, SESSION_SECRET

pm2 start server.js --name photobooth
pm2 save
pm2 startup   # lam theo huong dan de tu khoi dong cung server
```

### Cấu hình Nginx reverse proxy (`/etc/nginx/sites-available/photobooth`)

```nginx
server {
    listen 80;
    server_name domain-cua-ban.com;

    client_max_body_size 15m;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/photobooth /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Bắt buộc dùng HTTPS

Facebook Share Dialog và camera quét QR trên iPhone/Android hoạt động ổn định nhất
qua HTTPS. Dùng Let's Encrypt miễn phí:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d domain-cua-ban.com
```

Sau khi có HTTPS, nhớ đổi `BASE_URL=https://domain-cua-ban.com` trong `.env` rồi
`pm2 restart photobooth`.

## 5. Sau khi sự kiện kết thúc

Vào `/admin` → bấm **"Xuất Excel danh sách"** để tải file `.xlsx` gồm Tên, SĐT,
Đại lý, thời gian check-in của toàn bộ khách.

## 6. Backup dữ liệu

Toàn bộ dữ liệu (database + ảnh đã ghép + frame) nằm trong thư mục `data/`.
Nên backup định kỳ (đặc biệt ngay sau sự kiện) bằng:

```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

## 7. Cấu trúc thư mục

```
photobooth/
├── server.js              # entry point
├── src/
│   ├── db.js               # SQLite: lưu Tên/SĐT/Đại lý
│   └── compositor.js       # ghép frame + chữ ký bằng sharp
├── views/                  # trang EJS: xem ảnh, admin
├── public/                 # trang kiosk (form + ký tên) cho iPad
├── data/                   # (tạo lúc chạy) database + frame.png + ảnh khách
└── .env                    # cấu hình
```

## 8. Ghi chú vận hành cho 2 bục iPad

- Mỗi iPad chỉ cần mở `/` (trang chủ) trên Safari, bật **Guided Access**
  (Cài đặt > Trợ năng > Truy cập hướng dẫn) để khách không thoát ra ngoài.
- Sau khi hiện QR, hệ thống tự động quay lại màn hình nhập liệu sau 25 giây
  nếu không ai bấm "Xong" — tránh kẹt máy cho khách tiếp theo.
- 2 bục dùng chung 1 server nên dữ liệu gộp chung, không lo trùng/lệch số liệu
  khi xuất Excel.
