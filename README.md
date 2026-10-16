# Website Athens Holding JSC

Website tĩnh HTML/CSS thuần (không cần máy chủ) cho **Công ty TNHH Tư vấn Đầu tư và Xây dựng Athens Việt Nam**.

Website nằm ngay ở **thư mục gốc** (`index.html`, `du-an/`, `assets/`…): push lên nhánh `main` là GitHub Pages hiển thị luôn.
Các trang được sinh tự động từ dữ liệu trong `src/` bằng các script Node trong `scripts/`.

## Cấu trúc thư mục

```
athens-holding-jsc/
├── index.html, 404.html     🚀 WEBSITE — tự sinh bởi npm run build, không sửa tay
├── du-an/                     36 trang dự án (+ trang chuyển hướng cho địa chỉ cũ)
├── assets/                    fonts/ · js/ · imgs/ (ảnh đã tối ưu) · videos/
├── sitemap.xml, robots.txt, site.webmanifest, favicon.ico, _headers, _redirects
├── _config.yml                GitHub Pages: không đưa src/, scripts/… lên web
│
├── src/                     ✏️ NGUỒN — chỉ sửa ở đây
│   ├── data.mjs               nội dung: thông tin công ty, mạng xã hội, 36 dự án, ảnh, video, chuyển hướng
│   ├── styles/                reset.css · base.css (font, màu, theme) · style.css (giao diện)
│   ├── scripts/site.client.js JS chạy trên trình duyệt: menu, slider, tìm kiếm, video, form
│   └── static/                chép nguyên vào assets/: fonts/, imgs/logo-mark.svg
├── scripts/                 ⚙️ CÔNG CỤ
│   ├── build.mjs              sinh HTML, sitemap, robots, _headers, _redirects… ra thư mục gốc
│   ├── images.mjs             xuất ảnh AVIF/WebP nhiều cỡ + ảnh chia sẻ JPG từ _nguon-anh/
│   ├── videos.mjs             nén video (cần ffmpeg)
│   ├── icons.mjs              sinh favicon + icon ứng dụng từ logo-mark.svg
│   ├── serve.mjs              máy chủ xem thử website trên máy
│   ├── image-sizes.mjs        cỡ ảnh dùng chung (sửa ở đây duy nhất)
│   ├── paths.mjs              đường dẫn dùng chung
│   └── state/                 bộ nhớ của công cụ: images.json, lastmod.json (giữ trên git)
└── _nguon-anh/              🗂️ ảnh/video gốc 1,4 GB — KHÔNG lên git, chỉ giữ trên máy
```

## Lệnh

Cài lần đầu: `npm install` (Node 20 trở lên).

| Lệnh | Việc |
|---|---|
| `npm run build` | Sinh lại toàn bộ trang (vài giây) |
| `npm run images` | Xuất ảnh — chỉ ảnh mới/đổi (lần đầu ~13 phút, sau đó vài giây). `npm run images -- --force` để xuất lại hết |
| `npm run videos` | Nén video mới/đổi (cần ffmpeg) |
| `npm run icons` | Sinh lại favicon/icon sau khi sửa logo |
| `npm run preview` | Xem thử tại http://localhost:8080 |
| `npm run all` | Chạy cả 4 bước trên theo thứ tự |

> Mở thẳng file `index.html` bằng trình duyệt sẽ không bấm sang trang khác được (link trỏ `./`) — hãy dùng `npm run preview`.

## Việc thường làm

**Sửa thông tin công ty, mạng xã hội** → `SITE` trong `src/data.mjs` → `npm run build`.

**Thêm dự án mới**
1. Chép thư mục ảnh vào `_nguon-anh/` (ví dụ `_nguon-anh/VILLA/Villa Moi/`).
2. Thêm một mục vào `PROJECTS` trong `src/data.mjs`: `slug` (không dấu, gạch ngang), `name`, `cats`, `src` (thư mục ảnh),
   `imgs` = danh sách `["tên-file.jpg", "mô tả ảnh"]` — ảnh đầu tiên là ảnh đại diện.
3. `npm run images` rồi `npm run build`.

**Đổi/bỏ một trang** → trang cũ nên thêm vào `REDIRECTS` để chuyển hướng, giữ thứ hạng Google.

## Đưa lên mạng

**GitHub Pages (đang dùng)** — https://huanlv620.github.io/athensholdingjsc/

1. Sửa nội dung trong `src/` → `npm run build` (có thêm ảnh thì chạy `npm run images` trước).
2. Commit và push lên `main` → khoảng 1 phút sau website tự cập nhật.

Cài đặt Pages giữ mặc định: *Settings → Pages → Deploy from a branch → `main` / `(root)`*.

**Có tên miền riêng:** sửa `SITE.url` trong `src/data.mjs` (vd `https://athensholding.vn`) → build → push,
rồi khai báo tên miền trong *Settings → Pages → Custom domain*.

Sau khi lên mạng: thêm website vào **Google Search Console**, gửi `sitemap.xml`.

## Cần hoàn thiện

- [ ] Tên miền riêng (`SITE.url`) — hiện dùng địa chỉ GitHub Pages.
- [ ] Kiểm tra link Messenger `SITE.messenger` mở đúng khung chat Fanpage.
- [ ] (Tuỳ chọn) `SITE.formEndpoint` — nhận form tư vấn thẳng vào email qua Formspree.
- [ ] (Tuỳ chọn) `SITE.analyticsId` — mã Google Analytics 4.
- [ ] Xác minh tên/mô tả 36 dự án và số liệu "15+ năm, 120+ dự án…" trong trang chủ.

## Ghi chú kỹ thuật

- HTML/CSS thuần; CSS nhúng thẳng vào từng trang, JS ~3 KB (gzip), chỉ mục tìm kiếm chỉ tải khi mở ô tìm kiếm.
- Ảnh: AVIF cho mọi cỡ; WebP (dự phòng trình duyệt cũ) chỉ ở cỡ ≤ 960px. Ảnh có màu nền giữ chỗ + tải chậm;
  slide 2..n của slider chỉ tải khi sắp xem.
- Font tự host: Be Vietnam Pro (nội dung) + Noto Serif Display (tiêu đề, `font-display: optional` để không nhảy bố cục).
- SEO: canonical, Open Graph (ảnh JPG 1200×630), dữ liệu cấu trúc doanh nghiệp địa phương, sitemap có ảnh.
- Trang vẫn dùng được khi tắt JS (slider, bộ lọc, menu chạy bằng CSS), trừ ảnh slide 2..n và form gửi thẳng.
- `_headers`/`_redirects` chỉ có tác dụng nếu sau này chuyển sang Cloudflare Pages / Netlify; GitHub Pages bỏ qua
  (chuyển hướng trang cũ vẫn chạy nhờ các trang HTML chuyển hướng trong `du-an/`).
