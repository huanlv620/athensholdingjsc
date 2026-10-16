# Website Athens Holding JSC

Website tĩnh (HTML/CSS/JS thuần, không cần máy chủ) cho **Công ty TNHH Tư vấn Đầu tư và Xây dựng Athens Việt Nam**.
Toàn bộ trang được sinh tự động từ dữ liệu trong `src/` bằng các script Node trong `scripts/`, kết quả nằm ở `dist/`.

## Cấu trúc thư mục

```
athens-holding-jsc/
├── src/                     ✏️ NGUỒN — chỉ sửa ở đây
│   ├── data.mjs               nội dung: thông tin công ty, mạng xã hội, 36 dự án, ảnh, video, chuyển hướng
│   ├── styles/                reset.css · base.css (font, màu, theme) · style.css (giao diện)
│   ├── scripts/site.client.js JS chạy trên trình duyệt: menu, slider, tìm kiếm, video, form
│   └── static/                chép nguyên vào dist/assets/: fonts/, imgs/logo-mark.svg
├── scripts/                 ⚙️ CÔNG CỤ
│   ├── build.mjs              sinh HTML, sitemap, robots, _headers, _redirects… vào dist/
│   ├── images.mjs             xuất ảnh AVIF/WebP nhiều cỡ + ảnh chia sẻ JPG từ _nguon-anh/
│   ├── videos.mjs             nén video (cần ffmpeg)
│   ├── icons.mjs              sinh favicon + icon ứng dụng từ logo-mark.svg
│   ├── serve.mjs              máy chủ xem thử dist/ trên máy
│   ├── image-sizes.mjs        cỡ ảnh dùng chung (sửa ở đây duy nhất)
│   ├── paths.mjs              đường dẫn dùng chung
│   └── state/                 bộ nhớ của công cụ: images.json, lastmod.json (giữ trên git)
├── _nguon-anh/              🗂️ ảnh/video gốc 1,4 GB — KHÔNG lên git, chỉ giữ trên máy
└── dist/                    🚀 WEBSITE ĐỂ DEPLOY — tự sinh, không sửa tay
```

## Lệnh

Cài lần đầu: `npm install` (Node 20 trở lên).

| Lệnh | Việc |
|---|---|
| `npm run build` | Sinh lại toàn bộ trang vào `dist/` (vài giây) |
| `npm run images` | Xuất ảnh — chỉ ảnh mới/đổi (lần đầu ~13 phút, sau đó vài giây). `npm run images -- --force` để xuất lại hết |
| `npm run videos` | Nén video mới/đổi (cần ffmpeg) |
| `npm run icons` | Sinh lại favicon/icon sau khi sửa logo |
| `npm run preview` | Xem thử tại http://localhost:8080 |
| `npm run all` | Chạy cả 4 bước trên theo thứ tự |

> Mở thẳng file `dist/index.html` sẽ không bấm sang trang khác được (link trỏ `./`) — hãy dùng `npm run preview`.

## Việc thường làm

**Sửa thông tin công ty, mạng xã hội** → `SITE` trong `src/data.mjs` → `npm run build`.

**Thêm dự án mới**
1. Chép thư mục ảnh vào `_nguon-anh/` (ví dụ `_nguon-anh/VILLA/Villa Moi/`).
2. Thêm một mục vào `PROJECTS` trong `src/data.mjs`: `slug` (không dấu, gạch ngang), `name`, `cats`, `src` (thư mục ảnh),
   `imgs` = danh sách `["tên-file.jpg", "mô tả ảnh"]` — ảnh đầu tiên là ảnh đại diện.
3. `npm run images` rồi `npm run build`.

**Đổi tên miền** → sửa `SITE.url`, đặt `urlPlaceholder: false` → `npm run build`
(hoặc build tạm: `SITE_URL=https://ten-mien.vn npm run build`).

**Đổi/bỏ một trang** → trang cũ nên thêm vào `REDIRECTS` để chuyển hướng 301, giữ thứ hạng Google.

## Deploy

Khuyên dùng **Cloudflare Pages** (miễn phí, không giới hạn băng thông, có máy chủ ở Hà Nội/TP.HCM):
- Kết nối repo GitHub, **Build command**: để trống, **Build output directory**: `dist`.
- File `dist/_headers` (cache) và `dist/_redirects` (chuyển hướng 301) được áp dụng tự động. Netlify cũng đọc 2 file này.
- GitHub Pages chạy được nhưng bỏ qua `_headers`/`_redirects` (cache ngắn, chuyển hướng bằng trang HTML dự phòng).

Ảnh và video đã tối ưu nằm sẵn trong `dist/` (có trên git) nên hosting không cần chạy script nào.

Sau khi lên mạng: thêm website vào **Google Search Console**, gửi `sitemap.xml`.

## Cần hoàn thiện trước khi chạy chính thức

- [ ] Tên miền thật (`SITE.url`) — hiện là tên miền tạm, build sẽ cảnh báo.
- [ ] Kiểm tra link Messenger `SITE.messenger` mở đúng khung chat Fanpage.
- [ ] (Tuỳ chọn) `SITE.formEndpoint` — nhận form tư vấn thẳng vào email qua Formspree.
- [ ] (Tuỳ chọn) `SITE.analyticsId` — mã Google Analytics 4.
- [ ] Xác minh tên/mô tả 36 dự án và số liệu "15+ năm, 120+ dự án…" trong trang chủ.

## Ghi chú kỹ thuật

- Ảnh: AVIF cho mọi cỡ; WebP (dự phòng trình duyệt cũ) chỉ ở cỡ ≤ 960px. Ảnh có màu nền giữ chỗ + tải chậm;
  slide 2..n của slider chỉ tải khi sắp xem.
- CSS nhúng thẳng vào HTML; JS ~3 KB (gzip), chỉ mục tìm kiếm chỉ tải khi mở ô tìm kiếm.
- Font tự host: Be Vietnam Pro (nội dung) + Noto Serif Display (tiêu đề, `font-display: optional` để không nhảy bố cục).
- Trang vẫn dùng được khi tắt JS (slider, bộ lọc, menu chạy bằng CSS), trừ ảnh slide 2..n và form gửi thẳng.
