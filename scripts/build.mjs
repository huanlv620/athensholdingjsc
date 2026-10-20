// Sinh toàn bộ website tĩnh ra thư mục gốc repo: index.html, du-an/*.html, 404.html, sitemap.xml, robots.txt,
// site.webmanifest, _headers, _redirects, assets/js/*.js + chép src/static/ (font, logo) sang assets/
// Dùng: npm run build   (chạy npm run images trước để có scripts/state/images.json)
// Tên miền: SITE.url trong data.mjs, hoặc ghi đè: SITE_URL=https://ten-mien.vn node build.mjs ..
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { minify as minifyJs } from "terser";
import subsetFont from "subset-font";
import { SITE, ADDRESS_TEXT, PROJECTS, CAT_FILTERS, HOME_SLIDES, ALBUMS, VIDEOS, VIDEO_GROUPS, REDIRECTS } from "../src/data.mjs";
import { PROJECT_VARIANTS, THUMB_VARIANTS, HOME_VARIANTS, SITE_VARIANTS, ALBUM_THUMB_VARIANTS, POSTER_VARIANTS, OG_SIZE, WEBP_MAX_WIDTH } from "./image-sizes.mjs";
import { ROOT, STYLES, CLIENT_JS, STATIC, IMAGES_MANIFEST, LASTMOD_FILE, DIST, DIST_ASSETS, DIST_IMGS, DIST_JS, DIST_VIDEOS } from "./paths.mjs";

const SITE_URL = (process.env.SITE_URL || SITE.url).replace(/\/+$/, "");
// Đường dẫn gốc của website trên máy chủ: "/" khi có tên miền riêng, "/athensholdingjsc/" trên GitHub Pages
const BASE_PATH = new URL(SITE_URL + "/").pathname;
const IMAGES = JSON.parse(fs.readFileSync(IMAGES_MANIFEST, "utf8"));
// Danh sách ảnh từng dự án do images.mjs tính (mọi ảnh trong thư mục nguồn, trừ `skip`)
for (const p of PROJECTS) if (IMAGES.lists?.[p.slug]) p.imgs = IMAGES.lists[p.slug];
// Album ảnh thực tế (khởi công, công trường) — cũng do images.mjs tính
const ALBUM = Object.fromEntries(ALBUMS.map((a) => [a.key, { ...a, imgs: IMAGES.albumLists?.[a.key] ?? a.imgs }]));
// Ngày theo giờ Việt Nam (toISOString là UTC → build trước 7h sáng sẽ ra ngày hôm trước)
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const isPortrait = ({ w, h }) => h / w > 0.85;

if (SITE.urlPlaceholder && !process.env.SITE_URL) {
    console.warn(
        `\n⚠  Tên miền chưa xác nhận: ${SITE_URL}\n` +
            "   canonical, ảnh chia sẻ Facebook/Zalo, sitemap và robots.txt đều dùng địa chỉ này.\n" +
            "   Sửa SITE.url + urlPlaceholder: false trong data.mjs, hoặc build với SITE_URL=https://ten-mien-that.vn\n"
    );
}

const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const hash = (s) => createHash("md5").update(s).digest("hex").slice(0, 8);
const projectUrl = (p) => `${SITE_URL}/du-an/${p.slug}.html`;

/* =========================================================
   CSS: gộp + nén, nhúng thẳng vào <head> (≈7 KB gzip) → không có yêu cầu CSS chặn hiển thị
   ========================================================= */
function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, "") // bỏ comment
        .replace(/\s+/g, " ") // gộp khoảng trắng
        .replace(/\s*([{};,>~])\s*/g, "$1") // bỏ khoảng trắng quanh ký tự cú pháp
        .replace(/:\s+/g, ":")
        .replace(/;}/g, "}")
        .trim();
}

// CSS phụ thuộc dữ liệu, sinh RIÊNG cho từng trang: slider đúng số ảnh của trang + bộ lọc (chỉ trang chủ).
// Trước đây mọi trang mang quy tắc cho slider 48 ảnh (~460 selector) → điện thoại khựng lúc mở trang.
function dynamicCss(max, withFilter) {
    const each = (fn) => Array.from({ length: max }, (_, i) => fn(i + 1)).join(",");
    const rules = [];
    if (max < 1) return "";
    for (let i = 2; i <= max; i++) rules.push(`.s-${i}:checked~.slider__viewport .slider__track{transform:translateX(-${(i - 1) * 100}%)}`);
    rules.push(`${each((i) => `.s-${i}:checked~.slider__nav .slider__arrows:nth-child(${i})`)}{display:flex}`);
    rules.push(`${each((i) => `.s-${i}:checked~.slider__bar .slider__current span:nth-child(${i})`)}{display:inline}`);
    rules.push(`${each((i) => `.s-${i}:checked~.slider__bar .slider__dots label:nth-child(${i})`)}{width:5.6rem;background:var(--gold)}`);
    rules.push(`${each((i) => `.s-${i}:checked~.slider__thumbs label:nth-child(${i})`)}{opacity:1}`);
    rules.push(`${each((i) => `.s-${i}:checked~.slider__thumbs label:nth-child(${i})::after`)}{border-color:var(--gold)}`);
    rules.push(`${each((i) => `.slider--hero>.s-${i}:checked~.slider__viewport .slider__slide:nth-child(${i}) img`)}{animation:kenburns 14s ease-out both}`);
    rules.push(`${each((i) => `.slider--hero>.s-${i}:checked~.slider__viewport .slider__slide:nth-child(${i}) .hero__caption`)}{opacity:1;transform:none}`);
    rules.push(`${each((i) => `.slider--hero>.s-${i}:checked~.slider__bar .slider__dots label:nth-child(${i})`)}{background:#e6c77d}`);

    if (!withFilter) return rules.join("");
    const keys = CAT_FILTERS.map(([k]) => k);
    rules.push(`${keys.map((k) => `#f-${k}:checked~.filter__tabs label[for="f-${k}"]`).join(",")}{color:var(--gold)}`);
    rules.push(`${keys.map((k) => `#f-${k}:checked~.filter__tabs label[for="f-${k}"]::after`).join(",")}{transform:scaleX(1)}`);
    rules.push(`${keys.map((k) => `#f-${k}:focus-visible~.filter__tabs label[for="f-${k}"]`).join(",")}{outline:2px solid var(--gold);outline-offset:4px}`);
    const cats = keys.filter((k) => k !== "all");
    rules.push(`${cats.map((k) => `#f-${k}:checked~.grid .card:not(.cat-${k})`).join(",")}{display:none}`);
    return rules.join("");
}

/* ---------- Font: chỉ giữ ký tự website cần (font tiêu đề nằm trên đường găng LCP) ----------
   Giữ trọn bảng chữ tiếng Việt + ASCII để khách gõ gì vào form cũng đúng font, cộng mọi ký tự có trong
   nội dung (data.mjs, build.mjs, chú thích ảnh). Font gốc đầy đủ vẫn ở src/static/fonts/. */
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String.fromCodePoint(a + i)).join("");
const FONT_TEXT = [
    range(0x20, 0x7e),
    "ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúý",
    range(0x102, 0x103), range(0x110, 0x111), range(0x128, 0x129), range(0x168, 0x169),
    range(0x1a0, 0x1a1), range(0x1af, 0x1b0), range(0x1ea0, 0x1ef9),
    "̣̀́̃̉", // dấu thanh dạng tổ hợp (một số bàn phím gõ kiểu này)
    "–—‘’“”…•→←·₫©",
    ...[path.join(ROOT, "src", "data.mjs"), fileURLToPath(import.meta.url), IMAGES_MANIFEST].map((f) => fs.readFileSync(f, "utf8").normalize("NFC")),
].join("");
const FONT_DIR = path.join(DIST_ASSETS, "fonts");
const FONT_V = {}; // tên file → mã nội dung, gắn ?v= để cache 1 năm mà vẫn cập nhật được
fs.mkdirSync(FONT_DIR, { recursive: true });
for (const f of fs.readdirSync(path.join(STATIC, "fonts")).filter((f) => f.endsWith(".woff2"))) {
    const out = await subsetFont(fs.readFileSync(path.join(STATIC, "fonts", f)), FONT_TEXT, { targetFormat: "woff2" });
    fs.writeFileSync(path.join(FONT_DIR, f), out);
    FONT_V[f] = hash(out);
}
const fontUrl = (base, f) => `${base}assets/fonts/${f}?v=${FONT_V[f]}`;

const CSS = minifyCss(["reset.css", "base.css", "style.css"].map((f) => fs.readFileSync(path.join(STYLES, f), "utf8")).join("\n"));
// CSS gốc trỏ font bằng "../fonts/" (như thể nằm trong assets/css/) → khi nhúng vào HTML phải đổi theo vị trí trang
const cssFor = (base, slides = 0, filter = false) =>
    (CSS + dynamicCss(slides, filter)).replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, f) => `url("${fontUrl(base, f)}")`);

/* =========================================================
   JS: site.js (nhỏ, tải defer) + search-index.js (chỉ tải khi mở ô tìm kiếm)
   ========================================================= */
const SEARCH_INDEX = [
    ...PROJECTS.map((p) => ({
        name: p.name,
        cat: p.catLabel,
        keys: [CAT_FILTERS.filter(([k]) => p.cats.includes(k)).map(([, l]) => l).join(" "), p.services, p.location, p.desc].filter(Boolean).join(" "),
        url: `du-an/${p.slug}.html`,
        img: `assets/imgs/projects/${p.slug}/1-xs.webp`,
    })),
    { name: "Dịch vụ thiết kế & thi công", cat: "Trang chủ", keys: "dich vu kien truc noi that canh quan thi cong tron goi", url: "#dich-vu" },
    { name: "Thi công & Xưởng sản xuất", cat: "Trang", keys: "thi cong cong truong xuong san xuat noi that khoi cong dong tho video ban giao hinh anh", url: "thi-cong.html" },
    { name: "Liên hệ", cat: "Trang chủ", keys: `lien he dia chi so dien thoai zalo email form tu van ${SITE.phone} ${SITE.email}`, url: "#lien-he" },
];
fs.mkdirSync(DIST_JS, { recursive: true });
const searchIndexJs = `/* Tự sinh bởi scripts/build.mjs */\nwindow.SEARCH_INDEX = ${JSON.stringify(SEARCH_INDEX)};\n`;
fs.writeFileSync(path.join(DIST_JS, "search-index.js"), searchIndexJs);
const SITE_CONFIG = {
    searchIndex: `assets/js/search-index.js?v=${hash(searchIndexJs)}`,
    email: SITE.email,
    formEndpoint: SITE.formEndpoint,
    analyticsId: SITE.analyticsId,
    fbPixelId: SITE.fbPixelId,
    tiktokPixelId: SITE.tiktokPixelId,
    googleAdsId: SITE.googleAdsId,
    googleAdsLead: SITE.googleAdsLead,
};
// Nén JS bằng terser: bỏ comment/khoảng trắng, rút gọn tên biến
const siteSource = `var SITE_CONFIG = ${JSON.stringify(SITE_CONFIG)};\n${fs.readFileSync(CLIENT_JS, "utf8")}`;
const siteJs = `/* Tự sinh bởi scripts/build.mjs — không sửa trực tiếp, sửa src/scripts/site.client.js */\n${(await minifyJs(siteSource, { compress: true, mangle: true })).code}\n`;
fs.writeFileSync(path.join(DIST_JS, "site.js"), siteJs);
const JS_VERSION = hash(siteJs);

/* ---------- Nén HTML: bỏ comment + thụt lề (giữ nguyên nội dung) ---------- */
const minifyHtml = (html) =>
    html
        .replace(/<!--(?!\s*\[)[\s\S]*?-->/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");

// lastmod trong sitemap chỉ đổi khi NỘI DUNG trang (<main>) thực sự đổi — không phải mỗi lần build
const lastmodOld = fs.existsSync(LASTMOD_FILE) ? JSON.parse(fs.readFileSync(LASTMOD_FILE, "utf8")) : {};
const lastmod = {};
function writePage(file, html, url) {
    const out = minifyHtml(html);
    fs.writeFileSync(file, out);
    if (!url) return;
    const main = (out.match(/<main[\s\S]*<\/main>/) || [out])[0].replace(/\?v=\w+/g, "");
    const h = hash(main);
    lastmod[url] = lastmodOld[url]?.hash === h ? lastmodOld[url] : { hash: h, date: TODAY };
}

/* =========================================================
   Ảnh responsive: <picture> AVIF (nhẹ nhất) + WebP dự phòng
   ========================================================= */
// Ảnh gốc nhỏ hơn cỡ danh nghĩa thì các bản lớn trùng nhau → ghi đúng chiều rộng thật, bỏ bản trùng
function realVariants(variants, size) {
    const seen = new Set();
    return variants
        .map(([suffix, w]) => [suffix, Math.min(w, size.w)])
        .filter(([, w]) => !seen.has(w) && seen.add(w));
}
const srcsetOf = (stem, variants, ext) => variants.map(([suffix, w]) => `${stem}${suffix}.${ext} ${w}w`).join(", ");

// stem: đường dẫn không gồm hậu tố/đuôi (vd ../assets/imgs/projects/x/1); size: { w, h, c } từ images.json
// Màu chủ đạo c làm nền giữ chỗ trong lúc ảnh đang tải.
// defer: chưa gắn đường dẫn ảnh (data-*) — site.js gắn khi slide sắp được xem (ảnh slider ngoài khung hình)
function picture({ stem, variants, size, sizes, alt = "", cls = "", lazy = true, priority = false, defer = false }) {
    const v = realVariants(variants, size);
    // WebP chỉ là dự phòng cho trình duyệt cũ (không đọc AVIF) → chỉ có ở các cỡ ≤ WEBP_MAX_WIDTH
    // (xét theo cỡ danh nghĩa như images.mjs, không theo chiều rộng thật, để không trỏ tới file không tồn tại)
    const small = variants.filter(([, w]) => w <= WEBP_MAX_WIDTH);
    const webp = realVariants(small.length ? small : variants.slice(0, 1), size);
    const fallback = webp[webp.length - 1][0];
    const a = defer ? "data-" : "";
    return `<picture><source type="image/avif" ${a}srcset="${srcsetOf(stem, v, "avif")}" sizes="${sizes}"><img ${a}src="${stem}${fallback}.webp" ${a}srcset="${srcsetOf(stem, webp, "webp")}" sizes="${sizes}" alt="${esc(alt)}" width="${size.w}" height="${size.h}"${cls ? ` class="${cls}"` : ""} style="background-color:${size.c}"${priority ? ' fetchpriority="high"' : ""}${lazy && !priority ? ' loading="lazy"' : ""} decoding="async"></picture>`;
}

/* =========================================================
   Khung chung: head / header / CTA / footer
   ========================================================= */
function head({ title, desc, canonical, og, ogType = "website", base, jsonld, preload, noindex = false, slides = 0, filter = false }) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- SEO -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="robots" content="${noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}">
    <meta name="author" content="${SITE.name}">
    <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)">
    <meta name="color-scheme" content="dark light">

    <!-- Tải trước: ảnh LCP (AVIF; trình duyệt không hỗ trợ sẽ bỏ qua) + font tiêu đề (dòng chữ lớn đầu trang là LCP).
         Font nội dung không preload để khỏi tranh băng thông; chữ hiện ngay bằng font dự phòng đã căn kích thước. -->
    ${preload ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcsetOf(preload.stem, realVariants(preload.variants, preload.size), "avif")}" imagesizes="${preload.sizes}" fetchpriority="high">` : ""}
    <link rel="preload" as="font" type="font/woff2" href="${fontUrl(base, "noto-serif-display-latin.woff2")}" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="${fontUrl(base, "noto-serif-display-vietnamese.woff2")}" crossorigin>

    <!-- Theme sáng/tối: áp dụng lựa chọn đã lưu trước khi vẽ trang (tránh nháy màu) -->
    <script>
        (function () {
            var KEY = "athens-theme", root = document.documentElement;
            try { var saved = localStorage.getItem(KEY); if (saved) root.setAttribute("data-theme", saved); } catch (e) {}
            document.addEventListener("click", function (e) {
                if (!e.target.closest("[data-theme-toggle]")) return;
                var current = root.getAttribute("data-theme") ||
                    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
                var next = current === "light" ? "dark" : "light";
                root.setAttribute("data-theme", next);
                try { localStorage.setItem(KEY, next); } catch (e) {}
            });
        })();
    </script>

    <!-- CSS nhúng (nguồn: assets/css/reset.css, base.css, style.css) -->
    <style>${cssFor(base, slides, filter)}</style>

    ${canonical ? `<link rel="canonical" href="${canonical}">\n    <link rel="alternate" hreflang="vi" href="${canonical}">\n    <link rel="alternate" hreflang="x-default" href="${canonical}">` : ""}
    <link rel="icon" href="${base}favicon.ico" sizes="48x48">
    <link rel="icon" href="${base}assets/imgs/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${base}assets/imgs/apple-touch-icon.png">
    <link rel="manifest" href="${base}site.webmanifest">

    ${
        og
            ? `<!-- Open Graph: ảnh JPG 1200×630 để Facebook, Zalo, Messenger hiển thị ổn định -->
    <meta property="og:type" content="${ogType}">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:site_name" content="${SITE.name}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${og.url}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="${OG_SIZE.w}">
    <meta property="og:image:height" content="${OG_SIZE.h}">
    <meta property="og:image:alt" content="${esc(og.alt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${og.url}">`
            : ""
    }
    ${jsonld ? `<script type="application/ld+json">\n${json(jsonld)}\n    </script>` : ""}
</head>`;
}

// Logo: biểu tượng vector (assets/imgs/logo-mark.svg) + chữ
const logo = (base, lazy = false) =>
    `<img class="logo__mark" src="${base}assets/imgs/logo-mark.svg" alt="" width="88" height="40"${lazy ? ' loading="lazy"' : ""}><span class="logo__text">ATHENS<small>Holding JSC</small></span>`;

// base: đường dẫn tới gốc website ("./", "../" hoặc "/"). Link trang chủ trỏ thẳng tới thư mục gốc
// (khớp canonical "/"), không dùng "index.html" để tránh 2 địa chỉ cho cùng một trang.
function header({ base, active }) {
    const home = base;
    const link = (href, label, key) =>
        `<li><a href="${href}" class="nav__link${active === key ? " is-active" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a></li>`;
    return `<body>
    <a class="skip-link" href="#noi-dung">Bỏ qua tới nội dung chính</a>

    <!-- ============ HEADER ============ -->
    <header class="header">
        <div class="container header__inner">
            <a href="${home}" class="logo" aria-label="${SITE.name} – Trang chủ">${logo(base)}</a>

            <!-- Menu mobile: checkbox (chạy cả khi không có JS) — focus bàn phím được, viền focus hiện trên nút burger -->
            <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Mở menu" aria-controls="main-nav">
            <label for="nav-toggle" class="nav-burger" aria-hidden="true"><span></span><span></span><span></span></label>

            <nav class="nav" id="main-nav" aria-label="Điều hướng chính">
                <ul class="nav__list">
                    ${link(home, "Trang chủ", "home")}
                    <li class="nav__item--mega">
                        <a href="${home}#du-an" class="nav__link${active === "project" ? " is-active" : ""}">Dự án</a>
                        <div class="mega">
                            ${CAT_FILTERS.slice(1)
                                .map(([k, label]) => {
                                    const list = PROJECTS.filter((p) => p.cats[0] === k);
                                    return `<div class="mega__col">
                                <p class="mega__title">${esc(label)}</p>
                                <ul>
                                    ${list
                                        .slice(0, 4)
                                        .map((p) => `<li><a href="${base}du-an/${p.slug}.html">${esc(p.name)}</a></li>`)
                                        .join("\n                                    ")}
                                </ul>
                                <a href="${base}du-an/${list[0].slug}.html" class="mega__all">Xem dự án →</a>
                            </div>`;
                                })
                                .join("\n                            ")}
                        </div>
                    </li>
                    ${link(`${home}#dich-vu`, "Dịch vụ", "services")}
                    ${link(`${base}thi-cong.html`, "Thi công", "build")}
                    ${link(`${home}#ve-athens`, "Về Athens", "about")}
                    ${link(`${home}#lien-he`, "Liên hệ", "contact")}
                </ul>
            </nav>

            <div class="header__tools">
                <button type="button" class="icon-btn theme-btn" data-theme-toggle aria-label="Chuyển chế độ sáng / tối" title="Chế độ sáng / tối">
                    <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                    <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
                </button>
                <input type="checkbox" id="search-toggle" class="search-toggle" aria-label="Mở tìm kiếm" aria-controls="site-search">
                <label for="search-toggle" class="icon-btn" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </label>
                <form class="search" id="site-search" role="search" action="${home}#du-an" method="get">
                    <label for="q" class="sr-only">Tìm kiếm dự án</label>
                    <div class="search__field">
                        <svg class="search__glass" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                        <input type="search" id="q" name="q" placeholder="Tìm dự án: biệt thự, nội thất…" enterkeyhint="search">
                        <button type="button" class="search__clear" aria-label="Xoá nội dung tìm kiếm" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
                    </div>
                </form>
            </div>
        </div>
    </header>
`;
}

/* ---------- Mạng xã hội (SITE.social trong data.mjs) ---------- */
const SOCIAL_ICONS = {
    Facebook: '<path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.2V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z"/>',
    TikTok: '<path d="M16.5 3c.4 2.3 1.9 3.8 4.2 4v3.2c-1.6 0-3-.5-4.2-1.3v6.6a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.3a2.4 2.4 0 1 0 1.5 2.2V3h3.2Z"/>',
    Zalo: '<path d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.6 3.4 6.1L5 21l4.1-2.2c.9.2 1.9.3 2.9.3 5.5 0 10-3.6 10-8s-4.5-8-10-8Z"/><path d="M7.6 7.8h7.2l-7 6.6h7.4" fill="none" stroke="var(--social-ink, #0a0a0a)" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
};
const socialLinks = (cls = "") =>
    `<ul class="social${cls ? ` ${cls}` : ""}">${SITE.social
        .map(
            (s) =>
                `<li><a href="${s.url}" target="_blank" rel="noopener" aria-label="${esc(s.label)} – ${SITE.name}" title="${esc(s.label)}"><svg viewBox="0 0 24 24" aria-hidden="true">${SOCIAL_ICONS[s.name] || ""}</svg></a></li>`
        )
        .join("")}</ul>`;

/* ---------- Nút liên hệ nổi (góc phải dưới, luôn hiện khi cuộn) ---------- */
const FAB_ICONS = {
    phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1Z"/>',
    messenger: '<path d="M12 2C6.4 2 2 6.1 2 11.4c0 2.9 1.4 5.4 3.6 7.1V22l3.3-1.8c1 .3 2 .4 3.1.4 5.6 0 10-4.1 10-9.4S17.6 2 12 2Zm1 12.6-2.6-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.3 5.7Z"/>',
};
const tiktok = SITE.social.find((s) => s.name === "TikTok");
function fab() {
    const btn = (cls, href, label, icon, ext = true) =>
        `<li><a class="fab__btn fab__btn--${cls}" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""} aria-label="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span class="fab__label" aria-hidden="true">${label}</span></a></li>`;
    return `<!-- ============ NÚT LIÊN HỆ NỔI ============ -->
    <nav class="fab" aria-label="Liên hệ nhanh">
        <ul>
            ${tiktok ? btn("tiktok", tiktok.url, "TikTok Athens", SOCIAL_ICONS.TikTok) : ""}
            ${btn("messenger", SITE.messenger, "Chat Facebook", FAB_ICONS.messenger)}
            ${btn("zalo", SITE.zalo, "Chat Zalo", SOCIAL_ICONS.Zalo)}
            ${btn("call", `tel:${SITE.phoneHref}`, `Gọi ${SITE.phone}`, FAB_ICONS.phone, false)}
        </ul>
    </nav>`;
}

// Form tư vấn: câu hỏi dạng nút bấm chọn (thấy hết lựa chọn, 1 chạm là xong) — chỉ bắt buộc tên + SĐT.
// Nguồn khách (Facebook, Google…) không hỏi mà tự ghi nhận từ link quảng cáo — xem site.client.js
const FORM_CHOICES = [
    { name: "type", q: "Bạn đang quan tâm", opts: ["Biệt thự", "Lâu đài – Tân cổ điển", "Nhà phố", "Nhà vườn", "Nội thất", "Resort – Khách sạn"] },
    { name: "service", q: "Bạn cần Athens", opts: ["Thiết kế", "Thi công", "Thiết kế + thi công trọn gói", "Cải tạo"] },
    { name: "budget", q: "Ngân sách dự kiến", opts: ["Dưới 500 triệu", "500 triệu – 1 tỷ", "1 – 2 tỷ", "2 – 3 tỷ", "3 – 5 tỷ", "Trên 5 tỷ", "Chưa rõ"] },
    { name: "timeline", q: "Dự định bắt đầu", opts: ["Trong 3 tháng", "3 – 6 tháng", "Sau 6 tháng", "Đang tham khảo"] },
];
// Trang dự án → chọn sẵn loại công trình tương ứng danh mục
const CAT_TO_FORM = {
    villa: { type: "Biệt thự" },
    classic: { type: "Lâu đài – Tân cổ điển" },
    garden: { type: "Nhà vườn" },
    townhouse: { type: "Nhà phố" },
    interior: { type: "Nội thất" },
    resort: { type: "Resort – Khách sạn" },
};

// Nhóm nút chọn: radio thật (bàn phím, trình đọc màn hình dùng được) trang trí thành nút bo tròn
function choiceGroup({ name, q, opts }, picked = "") {
    return `<fieldset class="choice">
                        <legend>${q}</legend>
                        <div class="choice__opts">
                            ${opts
                                .map(
                                    (o) =>
                                        `<label><input type="radio" name="${name}" value="${esc(o)}"${o === picked ? " checked" : ""}><span>${esc(o)}</span></label>`
                                )
                                .join("\n                            ")}
                        </div>
                    </fieldset>`;
}

function cta(level = "h2", subject = "", preset = {}) {
    return `        <!-- ============ LIÊN HỆ ============ -->
        <section class="cta" id="lien-he" aria-labelledby="cta-heading">
            <div class="container cta__inner">
                <div class="cta__intro">
                    <${level} id="cta-heading" class="cta__title">Hãy bắt đầu<span class="gold">.</span></${level}>
                    <p class="cta__company">${SITE.legalName}</p>
                    <address class="cta__info">
                        <div><span>Địa chỉ</span>${ADDRESS_TEXT}</div>
                        <div><span>Điện thoại · Zalo</span><a href="tel:${SITE.phoneHref}">${SITE.phone}</a></div>
                        <div><span>Email</span><a href="mailto:${SITE.email}">${SITE.email}</a></div>
                    </address>
                    <div class="cta__actions">
                        <a href="tel:${SITE.phoneHref}" class="btn">Gọi ${SITE.phone}</a>
                        <a href="${SITE.zalo}" class="btn btn--ghost" target="_blank" rel="noopener">Nhắn Zalo</a>
                    </div>
                    <div class="cta__social">
                        <span>Theo dõi Athens</span>
                        ${socialLinks()}
                    </div>
                </div>

                <!-- Form tư vấn: gửi qua formEndpoint (nếu cấu hình) hoặc mở email soạn sẵn — xem site.client.js -->
                <form class="contact-form" action="mailto:${SITE.email}" method="post" enctype="text/plain" data-contact novalidate>
                    <div class="contact-form__head">
                        <p class="contact-form__title">Nhận tư vấn miễn phí</p>
                        <p class="contact-form__lead">Chọn nhanh vài thông tin, kiến trúc sư Athens sẽ gọi lại tư vấn phương án và dự toán sơ bộ.</p>
                        <ul class="contact-form__perks">
                            <li>Miễn phí</li>
                            <li>Không ràng buộc</li>
                            <li>Bảo mật thông tin</li>
                        </ul>
                    </div>

                    ${FORM_CHOICES.map((g) => choiceGroup(g, preset[g.name])).join("\n\n                    ")}

                    <div class="contact-form__contact">
                        <div class="field">
                            <label for="cf-name">Họ và tên</label>
                            <input id="cf-name" name="name" autocomplete="name" placeholder="Nguyễn Văn A" required>
                        </div>
                        <div class="field">
                            <label for="cf-phone">Số điện thoại / Zalo</label>
                            <input id="cf-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxx" pattern="[0-9 .+]{9,15}" required>
                        </div>
                        <div class="field field--wide">
                            <label for="cf-location">Địa điểm xây dựng <small>(không bắt buộc)</small></label>
                            <input id="cf-location" name="location" autocomplete="address-level1" placeholder="VD: Quỳnh Lưu, Nghệ An">
                        </div>
                        <div class="field field--wide">
                            <label for="cf-msg">Ghi chú <small>(không bắt buộc)</small></label>
                            <textarea id="cf-msg" name="message" rows="2" placeholder="Diện tích đất, số tầng, phong cách yêu thích…">${esc(subject)}</textarea>
                        </div>
                    </div>
                    <input type="hidden" name="source">

                    <button type="submit" class="btn btn--block contact-form__submit">Nhận tư vấn miễn phí <span aria-hidden="true">→</span></button>
                    <p class="contact-form__status" role="status" aria-live="polite"></p>
                    <p class="contact-form__alt">Cần gấp? Gọi <a href="tel:${SITE.phoneHref}">${SITE.phone}</a> hoặc <a href="${SITE.zalo}" target="_blank" rel="noopener">nhắn Zalo</a></p>
                </form>
            </div>
        </section>`;
}

function footer(base) {
    return `
    <!-- ============ FOOTER ============ -->
    <footer class="footer">
        <div class="container footer__inner">
            <a href="${base}" class="logo logo--sm" aria-label="${SITE.name} – Trang chủ">${logo(base, true)}</a>
            <div class="footer__company">
                <p class="footer__legal">${SITE.legalName}</p>
                <p class="footer__copy">${ADDRESS_TEXT} · <a href="tel:${SITE.phoneHref}">${SITE.phone}</a> · <a href="mailto:${SITE.email}">${SITE.email}</a></p>
            </div>
            <div class="footer__end">
                ${socialLinks("social--sm")}
                <p class="footer__copy">© ${new Date().getFullYear()} ${SITE.name}</p>
            </div>
        </div>
    </footer>
    ${fab()}
    <script src="${base}assets/js/site.js?v=${JS_VERSION}" defer></script>
</body>
</html>
`;
}

/* =========================================================
   Slider CSS thuần (radio + label). Ảnh slide 2..n hoãn tải (defer) — site.js gắn khi sắp xem.
   ========================================================= */
function slider({ id, label, slides, variant = "", thumbs = true, overlay = "", caption }) {
    const n = slides.length;
    const inputs = slides
        .map((_, i) => `<input type="radio" name="${id}" id="${id}-${i + 1}" class="slider__radio s-${i + 1}"${i === 0 ? " checked" : ""} aria-label="Ảnh ${i + 1} / ${n}">`)
        .join("\n                ");
    const items = slides
        .map(
            (s, i) => `<li class="slider__slide" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
                        <figure>
                            ${picture({ stem: s.stem, variants: s.variants, size: s.size, sizes: s.sizes, alt: s.alt, cls: s.portrait ? "is-portrait" : "", priority: i === 0, defer: i > 0 })}
                            ${caption ? caption(s) : `<figcaption aria-hidden="true">${esc(s.alt)}</figcaption>`}
                        </figure>
                    </li>`
        )
        .join("\n                    ");
    const arrows = slides
        .map((_, i) => {
            const prev = ((i - 1 + n) % n) + 1;
            const next = ((i + 1) % n) + 1;
            return `<div class="slider__arrows" aria-hidden="true"><label for="${id}-${prev}" class="slider__arrow slider__arrow--prev" title="Ảnh trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></label><label for="${id}-${next}" class="slider__arrow slider__arrow--next" title="Ảnh tiếp theo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></label></div>`;
        })
        .join("\n                    ");
    // Nhiều ảnh thì bỏ chấm (tràn hàng) — đã có bộ đếm + dải ảnh nhỏ để chọn
    const dots = n <= 12 ? slides.map((_, i) => `<label for="${id}-${i + 1}" title="Ảnh ${i + 1}"></label>`).join("") : "";
    const counter = slides.map((_, i) => `<span>${pad(i + 1)}</span>`).join("");
    const thumbList = thumbs
        ? `
                <div class="slider__thumbs" aria-hidden="true">
                    ${slides.map((s, i) => `<label for="${id}-${i + 1}">${picture({ stem: s.stem, variants: s.thumbVariants, size: s.size, sizes: "120px" })}</label>`).join("\n                    ")}
                </div>`
        : "";
    return `<div class="slider ${variant ? `slider--${variant}` : ""}" role="region" aria-roledescription="carousel" aria-label="${esc(label)}"${variant === "hero" ? " data-autoplay" : ""}>
                ${inputs}
                <div class="slider__viewport">
                    <ul class="slider__track">
                    ${items}
                    </ul>
                </div>${overlay}
                <div class="slider__nav">
                    ${arrows}
                </div>
                <div class="slider__bar">
                    <p class="slider__count"><span class="slider__current">${counter}</span> / ${pad(n)}</p>
                    <div class="slider__dots" aria-hidden="true">${dots}</div>
                </div>${thumbList}
            </div>`;
}

// Ảnh dự án cho slider: bản lớn cho khung chính, bản -xs cho ảnh nhỏ bên dưới
const projectImgs = (p, base) =>
    p.imgs.map(([, alt], i) => {
        const size = IMAGES.projects[p.slug][i];
        return {
            alt,
            stem: `${base}assets/imgs/projects/${p.slug}/${i + 1}`,
            variants: PROJECT_VARIANTS.slice(1),
            thumbVariants: [...THUMB_VARIANTS, ...PROJECT_VARIANTS.slice(0, 1)], // 240px; màn hình mật độ cao dùng 400px
            sizes: "(max-width: 1279px) 100vw, 1200px",
            size,
            portrait: isPortrait(size),
        };
    });

const ICON_PHOTOS = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/></svg>`;

function card(p, base, { level = "h3", featured = false } = {}) {
    const sizes = featured ? "(max-width: 599px) 92vw, (max-width: 991px) 92vw, 800px" : "(max-width: 599px) 92vw, (max-width: 991px) 46vw, 400px";
    const meta = [p.services, p.city].filter(Boolean).map(esc).join(" · ");
    return `<li class="card${featured ? " card--featured" : ""} ${p.cats.map((c) => `cat-${c}`).join(" ")}">
                            <a href="${base}du-an/${p.slug}.html" class="card__link">
                                <div class="card__media">
                                    <span class="card__badge">${esc(p.catLabel)}</span>
                                    ${picture({
                                        stem: `${base}assets/imgs/projects/${p.slug}/1`,
                                        variants: PROJECT_VARIANTS.slice(0, featured ? 3 : 2),
                                        size: IMAGES.projects[p.slug][0],
                                        sizes,
                                        alt: `${p.imgs[0][1]} – ${p.name}`,
                                    })}
                                    <span class="card__count">${ICON_PHOTOS}${p.imgs.length} ảnh</span>
                                </div>
                                <${level} class="card__title">${esc(p.name)}</${level}>
                                <p class="card__meta">${meta}</p>
                            </a>
                        </li>`;
}

/* ---------- Dữ liệu có cấu trúc: doanh nghiệp xây dựng địa phương (SEO tìm kiếm khu vực) ---------- */
const ORG = {
    "@type": ["HomeAndConstructionBusiness", "Organization"],
    "@id": `${SITE_URL}/#org`,
    name: SITE.name,
    legalName: SITE.legalName,
    alternateName: SITE.legalName,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/assets/imgs/icon-512.png`,
    image: `${SITE_URL}/assets/imgs/og/home.jpg`,
    email: SITE.email,
    telephone: SITE.phoneHref,
    address: {
        "@type": "PostalAddress",
        streetAddress: SITE.address.street,
        addressLocality: SITE.address.locality,
        addressRegion: SITE.address.region,
        addressCountry: "VN",
    },
    areaServed: [{ "@type": "AdministrativeArea", name: SITE.address.region }, { "@type": "Country", name: "Việt Nam" }],
    knowsAbout: ["Thiết kế kiến trúc", "Thiết kế nội thất", "Thi công xây dựng", "Biệt thự", "Nhà phố", "Cảnh quan sân vườn"],
    contactPoint: { "@type": "ContactPoint", telephone: SITE.phoneHref, contactType: "customer service", availableLanguage: "vi" },
    sameAs: SITE.social.map((s) => s.url),
};

/* =========================================================
   TRANG CHỦ
   ========================================================= */
const SERVICES = [
    { title: "Thiết kế kiến trúc", text: "Biệt thự, nhà phố, nhà vườn, lâu đài tân cổ điển và khu nghỉ dưỡng — may đo theo khu đất và gia chủ.", img: ["projects", "biet-thu-rung-thong", 1] },
    { title: "Thiết kế nội thất", text: "Từ hiện đại tối giản đến Đông Dương, tân cổ điển — đồng bộ từ vật liệu, ánh sáng đến đồ rời.", img: ["projects", "noi-that-go-oc-cho", 1] },
    { title: "Cảnh quan sân vườn", text: "Hồ cá koi, non bộ, vườn Nhật, hồ bơi tràn — đưa thiên nhiên vào từng không gian sống.", img: ["projects", "tam-hop-vien", 2] },
    { title: "Thi công trọn gói", text: "Đội ngũ kỹ sư giám sát tại công trường, bàn giao chìa khóa trao tay đúng tiến độ.", img: ["albums", "cong-truong", 1] },
];

// Ảnh nền thẻ dịch vụ: lấy lại ảnh dự án / ảnh album thi công đã xuất
function serviceImg([kind, dir, n], base) {
    const isProject = kind === "projects";
    const size = IMAGES[kind][dir][n - 1];
    const variants = isProject ? PROJECT_VARIANTS.slice(0, 2) : SITE_VARIANTS.slice(0, 1);
    const stem = `${base}assets/imgs/${kind}/${dir}/${n}`;
    return picture({ stem, variants, size, sizes: "(max-width: 599px) 92vw, (max-width: 1199px) 46vw, 300px" });
}

// Thẻ video: ban đầu chỉ là ảnh bìa (lazy) + nút phát; bấm mới tải video (site.client.js).
// Không có JS thì liên kết vẫn mở thẳng file video.
// Cỡ ảnh bìa theo lưới .videos: điện thoại 2,25 thẻ/màn (~42vw), máy tính bảng 3,3 thẻ (~28vw), máy tính 4–5 cột (≤290px)
const POSTER_SIZES = "(max-width: 599px) 42vw, (max-width: 991px) 28vw, (max-width: 1199px) 23vw, 290px";
function videoCard(v, base) {
    const stem = `${base}assets/videos/${v.file}`;
    const set = (ext) => POSTER_VARIANTS.map(([suffix, w]) => `${stem}${suffix}.${ext} ${w}w`).join(", ");
    return `<figure class="video">
                        <a class="video__facade" href="${stem}.mp4" data-video aria-label="Phát video: ${esc(v.title)}">
                            <picture><source type="image/avif" srcset="${set("avif")}" sizes="${POSTER_SIZES}"><img src="${stem}.webp" srcset="${set("webp")}" sizes="${POSTER_SIZES}" alt="" width="540" height="960" loading="lazy" decoding="async"></picture>
                            <span class="video__play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>
                        </a>
                        <figcaption><span>${VIDEO_GROUPS[v.group]}</span>${esc(v.title)}</figcaption>
                    </figure>`;
}

function buildHome() {
    const base = "./";
    const bySlug = Object.fromEntries(PROJECTS.map((p) => [p.slug, p]));
    const heroSlides = HOME_SLIDES.map((s, i) => ({
        alt: s.alt,
        project: bySlug[s.project],
        stem: `${base}assets/imgs/home/${i + 1}`,
        variants: HOME_VARIANTS,
        sizes: "100vw",
        size: IMAGES.home[i],
    }));
    // Mỗi slide trang chủ dẫn sang dự án tương ứng
    const heroCaption = (s) =>
        s.project ? `<figcaption class="hero__caption"><a href="${base}du-an/${s.project.slug}.html"><span>${esc(s.project.catLabel)}</span>${esc(s.project.name)} →</a></figcaption>` : "";
    const overlay = `
                <div class="hero__content">
                    <div class="container">
                        <p class="eyebrow">${SITE.name} — Kiến trúc · Nội thất · Thi công trọn gói</p>
                        <h1 class="hero__title">Kiến tạo không gian<br> sống đẳng cấp<span class="gold">.</span></h1>
                        <p class="hero__lead">Từ biệt thự hiện đại, lâu đài tân cổ điển đến nhà vườn Á Đông và khu nghỉ dưỡng — Athens thiết kế và thi công trọn gói những ngôi nhà mang dấu ấn riêng của gia chủ.</p>
                        <div class="hero__actions">
                            <a href="#du-an" class="btn">Khám phá dự án</a>
                            <a href="#lien-he" class="btn btn--ghost btn--light">Nhận tư vấn</a>
                        </div>
                    </div>
                </div>`;

    const filterInputs = CAT_FILTERS.map(([k], i) => `<input type="radio" name="filter" id="f-${k}" class="filter__input"${i === 0 ? " checked" : ""}>`).join("\n                    ");
    const filterTabs = CAT_FILTERS.map(([k, l]) => `<label for="f-${k}">${l}</label>`).join("\n                        ");

    // Trang chủ chỉ hiện phần tóm tắt: 6 ảnh đầu album công trường + video đánh dấu home — đầy đủ ở thi-cong.html
    const photos = ALBUM["cong-truong"].imgs
        .slice(0, 6)
        .map(([, alt], i) => {
            const sizes = i === 0 ? "(max-width: 991px) 100vw, 800px" : "(max-width: 991px) 50vw, 400px";
            return `<li>
                        <figure>
                            ${picture({ stem: `${base}assets/imgs/albums/cong-truong/${i + 1}`, variants: [...ALBUM_THUMB_VARIANTS, ...SITE_VARIANTS], size: IMAGES.albums["cong-truong"][i], sizes, alt })}
                            <figcaption aria-hidden="true">${esc(alt)}</figcaption>
                        </figure>
                    </li>`;
        })
        .join("\n                    ");
    const videos = VIDEOS.filter((v) => v.home)
        .map((v) => videoCard(v, base))
        .join("\n                    ");

    const jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            ORG,
            { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: SITE.name, inLanguage: "vi-VN", publisher: { "@id": `${SITE_URL}/#org` } },
            {
                "@type": "ItemList",
                name: "Dự án tiêu biểu",
                itemListElement: PROJECTS.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: projectUrl(p), name: p.name })),
            },
        ],
    };

    const html = `${head({
        title: `${SITE.name} — Thiết kế & Thi công Biệt thự, Nội thất`,
        // ≤ 155 ký tự để Google không cắt
        desc: `Thiết kế & thi công trọn gói biệt thự, lâu đài tân cổ điển, nhà phố, nhà vườn, nội thất tại Nghệ An và toàn quốc. Xem ${PROJECTS.length} dự án của Athens.`,
        canonical: `${SITE_URL}/`,
        og: { url: `${SITE_URL}/assets/imgs/og/home.jpg`, alt: HOME_SLIDES[0].alt },
        base,
        preload: heroSlides[0],
        slides: HOME_SLIDES.length,
        filter: true,
        jsonld,
    })}
${header({ base, active: "home" })}
    <main id="noi-dung">
        <!-- ============ HERO SLIDER ============ -->
        <section class="hero" aria-label="Giới thiệu">
            ${slider({ id: "hero", label: "Hình ảnh nổi bật", slides: heroSlides, variant: "hero", thumbs: false, overlay, caption: heroCaption })}
        </section>

        <!-- ============ PROJECTS ============ -->
        <section class="projects" id="du-an" aria-labelledby="projects-heading">
            <div class="container">
                <div class="section-head">
                    <p class="eyebrow">Portfolio · ${PROJECTS.length} dự án</p>
                    <h2 id="projects-heading" class="section-title section-title--xl">Dự án<span class="gold">.</span></h2>
                    <p class="section-lead">Tuyển chọn các công trình biệt thự, nhà phố, nhà vườn, nội thất và nghỉ dưỡng do Athens thiết kế và thi công.</p>
                </div>

                <div class="filter">
                    ${filterInputs}

                    <div class="filter__tabs" role="group" aria-label="Lọc dự án theo loại hình">
                        ${filterTabs}
                    </div>

                    <!-- Tab "Tất cả": chỉ hiện vài dự án đầu, bấm "Xem tất cả" mới hiện đủ (CSS thuần, không cần JS) -->
                    <input type="checkbox" id="f-more" class="filter__input">
                    <ul class="grid">
                        ${PROJECTS.map((p, i) => card(p, base, { featured: i === 0 })).join("\n                        ")}
                    </ul>
                    <label for="f-more" class="btn btn--ghost filter__more">Xem tất cả ${PROJECTS.length} dự án</label>
                </div>
            </div>
        </section>

        <!-- ============ DỊCH VỤ ============ -->
        <section class="services" id="dich-vu" aria-labelledby="services-heading">
            <div class="container">
                <p class="eyebrow">Dịch vụ</p>
                <h2 id="services-heading" class="section-title">Trọn gói từ ý tưởng đến bàn giao<span class="gold">.</span></h2>
                <div class="services__grid">
                    ${SERVICES.map(
                        (s, i) => `<article class="service">
                        ${serviceImg(s.img, base)}
                        <span class="service__num">${pad(i + 1)}</span>
                        <h3 class="service__title">${s.title}</h3>
                        <p>${s.text}</p>
                    </article>`
                    ).join("\n                    ")}
                </div>
            </div>
        </section>

        <!-- ============ TRIẾT LÝ ============ -->
        <section class="philosophy" id="ve-athens" aria-labelledby="philosophy-heading">
            <div class="container">
                <p class="eyebrow">Về Athens</p>
                <h2 id="philosophy-heading" class="section-title">Triết lý thiết kế<span class="gold">.</span></h2>
                <div class="philosophy__list">
                    <article class="pillar">
                        <span class="pillar__num">01</span>
                        <h3 class="pillar__title">Thiết kế bắt đầu từ con người</h3>
                        <p>Chúng tôi lắng nghe cách mỗi gia đình sinh hoạt, nghỉ ngơi và đón khách trước khi đặt nét vẽ đầu tiên.</p>
                    </article>
                    <article class="pillar">
                        <span class="pillar__num">02</span>
                        <h3 class="pillar__title">Tôn trọng bối cảnh &amp; khí hậu</h3>
                        <p>Ánh sáng, gió, vật liệu địa phương và cảnh quan là chất liệu chính cho mỗi công trình.</p>
                    </article>
                    <article class="pillar">
                        <span class="pillar__num">03</span>
                        <h3 class="pillar__title">Bền vững theo thời gian</h3>
                        <p>Giải pháp kỹ thuật chuẩn mực, thi công tỉ mỉ và giá trị lâu dài cho gia chủ.</p>
                    </article>
                </div>
                <ul class="stats">
                    <li><strong>15+</strong><span>Năm kinh nghiệm</span></li>
                    <li><strong>120+</strong><span>Dự án hoàn thành</span></li>
                    <li><strong>25</strong><span>Tỉnh thành</span></li>
                    <li><strong>60+</strong><span>Kiến trúc sư &amp; kỹ sư</span></li>
                </ul>
            </div>
        </section>

        <!-- ============ THI CÔNG THỰC TẾ ============ -->
        <section class="build" id="thi-cong" aria-labelledby="build-heading">
            <div class="container">
                <div class="build__head">
                    <div>
                        <p class="eyebrow">Công trường</p>
                        <h2 id="build-heading" class="section-title">Thi công thực tế<span class="gold">.</span></h2>
                    </div>
                    <p class="section-lead">Hình ảnh và video ghi lại tại xưởng sản xuất, công trường và các buổi bàn giao nhà cho gia chủ.</p>
                </div>
                <ul class="photos">
                    ${photos}
                </ul>
                <div class="videos">
                    ${videos}
                </div>
                <p class="build__more"><a href="${base}thi-cong.html" class="btn btn--ghost">Xem toàn bộ: xưởng, khởi công, công trường →</a></p>
            </div>
        </section>

${cta()}
    </main>
${footer(base)}`;
    writePage(path.join(DIST, "index.html"), html, `${SITE_URL}/`);
}

/* =========================================================
   TRANG CHI TIẾT DỰ ÁN
   ========================================================= */
function buildProject(p, idx) {
    const base = "../";
    const url = projectUrl(p);
    const slides = projectImgs(p, base);
    const prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length];
    const next = PROJECTS[(idx + 1) % PROJECTS.length];
    const related = [
        ...PROJECTS.filter((x) => x !== p && x.cats.some((c) => p.cats.includes(c))),
        ...PROJECTS.filter((x) => x !== p && !x.cats.some((c) => p.cats.includes(c))),
    ].slice(0, 3);

    const jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "Dự án", item: `${SITE_URL}/#du-an` },
                    { "@type": "ListItem", position: 3, name: p.name, item: url },
                ],
            },
            {
                "@type": "CreativeWork",
                "@id": `${url}#project`,
                name: p.name,
                headline: p.name,
                description: p.desc,
                url,
                genre: p.catLabel,
                ...(p.year && { dateCreated: p.year }),
                inLanguage: "vi-VN",
                image: [`${SITE_URL}/assets/imgs/og/${p.slug}.jpg`, ...p.imgs.map((_, i) => `${SITE_URL}/assets/imgs/projects/${p.slug}/${i + 1}-sm.webp`)],
                ...(p.location && {
                    locationCreated: { "@type": "Place", name: p.location, address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "VN" } },
                }),
                creator: { "@id": `${SITE_URL}/#org` },
            },
            ORG,
        ],
    };

    const html = `${head({
        // Giữ title ≤ 60 ký tự để Google không cắt
        title: `${p.name} – ${p.catLabel}${p.city ? ` tại ${p.city}` : ""} | Athens`,
        desc: p.desc,
        canonical: url,
        og: { url: `${SITE_URL}/assets/imgs/og/${p.slug}.jpg`, alt: p.imgs[0][1] },
        ogType: "article",
        base,
        preload: slides[0],
        slides: slides.length,
        jsonld,
    })}
${header({ base, active: "project" })}
    <main id="noi-dung">
        <article class="project">
            <!-- ============ TIÊU ĐỀ ============ -->
            <header class="project__head">
                <div class="container">
                    <nav class="breadcrumb" aria-label="Breadcrumb">
                        <ol>
                            <li><a href="${base}">Trang chủ</a></li>
                            <li><a href="${base}#du-an">Dự án</a></li>
                            <li aria-current="page">${esc(p.name)}</li>
                        </ol>
                    </nav>
                    <p class="eyebrow">${[p.catLabel, p.location].filter(Boolean).map(esc).join(" · ")}</p>
                    <h1 class="project__title">${esc(p.name)}<span class="gold">.</span></h1>
                    <p class="project__lead">${esc(p.lead)}</p>
                </div>
            </header>

            <!-- ============ SLIDER ============ -->
            <section class="project__gallery" aria-label="Thư viện ảnh ${esc(p.name)}">
                <div class="container">
                    ${slider({ id: "gallery", label: `Thư viện ảnh ${p.name}`, slides })}
                </div>
            </section>

            <!-- ============ NỘI DUNG ============ -->
            <div class="container project__body">
                <div class="project__content">
                    <section aria-labelledby="overview-heading">
                        <h2 id="overview-heading" class="project__h2">Tổng quan dự án</h2>
                        ${p.overview.map((t) => `<p>${esc(t)}</p>`).join("\n                        ")}
                    </section>
                    <section aria-labelledby="solution-heading">
                        <h2 id="solution-heading" class="project__h2">Giải pháp thiết kế</h2>
                        <ul class="checklist">
                            ${p.solutions.map((t) => `<li>${esc(t)}</li>`).join("\n                            ")}
                        </ul>
                    </section>
                </div>

                <aside class="project__aside" aria-labelledby="info-heading">
                    <h2 id="info-heading" class="project__h2">Thông tin dự án</h2>
                    <dl class="specs">
                        ${[
                            ["Chủ đầu tư", p.client],
                            ["Địa điểm", p.location],
                            ["Loại hình", p.catLabel],
                            ["Diện tích", p.area],
                            ["Năm", p.year],
                            ["Hạng mục", p.services],
                            ["Hình ảnh", `${p.imgs.length} phối cảnh`],
                        ]
                            .filter(([, v]) => v)
                            .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
                            .join("\n                        ")}
                    </dl>
                    <a href="#lien-he" class="btn btn--block">Tư vấn dự án tương tự</a>
                </aside>
            </div>

            <!-- ============ ĐIỀU HƯỚNG DỰ ÁN ============ -->
            <nav class="pager container" aria-label="Dự án khác">
                <a href="./${prev.slug}.html" class="pager__link" rel="prev"><span>← Dự án trước</span><strong>${esc(prev.name)}</strong></a>
                <a href="./${next.slug}.html" class="pager__link pager__link--next" rel="next"><span>Dự án tiếp theo →</span><strong>${esc(next.name)}</strong></a>
            </nav>
        </article>

        <!-- ============ LIÊN QUAN ============ -->
        <section class="related" aria-labelledby="related-heading">
            <div class="container">
                <h2 id="related-heading" class="section-title">Dự án liên quan<span class="gold">.</span></h2>
                <ul class="grid">
                    ${related.map((r) => card(r, base)).join("\n                    ")}
                </ul>
            </div>
        </section>

${cta("h2", `Tôi quan tâm dự án tương tự "${p.name}".`, CAT_TO_FORM[p.cats[0]])}
    </main>
${footer(base)}`;
    writePage(path.join(DIST, "du-an", `${p.slug}.html`), html, url);
}

/* =========================================================
   404 + chuyển hướng trang cũ
   ========================================================= */
// 404 có thể hiện ở bất kỳ đường dẫn nào → dùng đường dẫn tuyệt đối từ gốc website (BASE_PATH)
/* =========================================================
   TRANG THI CÔNG & XƯỞNG — hành trình một công trình: xưởng → khởi công → công trường → bàn giao
   Nội dung lấy từ VIDEOS (theo group) + ALBUMS trong data.mjs
   ========================================================= */
const STAGES = [
    { key: "xuong", title: "Xưởng sản xuất", lead: "Nội thất gỗ được Athens gia công tại xưởng riêng với dây chuyền máy CNC — kiểm soát chất lượng từng tấm ván trước khi lắp đặt tại nhà gia chủ." },
    { key: "khoi-cong", title: "Lễ khởi công – động thổ", lead: "Mỗi công trình bắt đầu bằng lễ động thổ trang trọng cùng gia chủ. Kỹ sư Athens có mặt từ ngày đầu tiên và theo sát đến ngày bàn giao.", album: "khoi-cong" },
    { key: "cong-truong", title: "Công trường", lead: "Từ đào móng, đổ bê tông đến hoàn thiện — kỹ sư giám sát trực tiếp, đúng bản vẽ và đúng tiến độ đã cam kết.", album: "cong-truong" },
    { key: "ban-giao", title: "Bàn giao", lead: "Khoảnh khắc trao chìa khóa — ngôi nhà hoàn thiện đúng như bản thiết kế gia chủ đã duyệt." },
];
const GALLERY_PREVIEW = 12; // số ảnh hiện sẵn mỗi album, còn lại bấm "Xem thêm"

// Lưới ảnh album: mỗi ảnh là liên kết tới bản lớn → site.client.js mở trình xem ảnh (lightbox)
function gallery(album, base) {
    const items = album.imgs
        .map(([, alt], i) => {
            const stem = `${base}assets/imgs/albums/${album.key}/${i + 1}`;
            return `<li${i >= GALLERY_PREVIEW ? " data-extra" : ""}><a href="${stem}.avif" data-lightbox="${album.key}" data-caption="${esc(alt)}">
                            ${picture({ stem, variants: [...ALBUM_THUMB_VARIANTS, ...SITE_VARIANTS.slice(0, 1)], size: IMAGES.albums[album.key][i], sizes: "(max-width: 599px) 50vw, (max-width: 991px) 33vw, 300px", alt })}
                        </a></li>`;
        })
        .join("\n                        ");
    const more = album.imgs.length - GALLERY_PREVIEW;
    return `<ul class="gallery"${more > 0 ? ` data-more="Xem thêm ${more} ảnh"` : ""}>
                        ${items}
                    </ul>`;
}

function buildConstruction() {
    const base = "./";
    const url = `${SITE_URL}/thi-cong.html`;
    const cover = ALBUM["khoi-cong"];
    const sections = STAGES.map((st, n) => {
        const vids = VIDEOS.filter((v) => v.group === st.key);
        const album = st.album && ALBUM[st.album];
        const counts = [vids.length && `${vids.length} video`, album && `${album.imgs.length} ảnh`].filter(Boolean).join(" · ");
        return `<section class="stage" id="${st.key}" aria-labelledby="${st.key}-heading">
                <div class="container">
                    <div class="build__head">
                        <div>
                            <p class="eyebrow">${pad(n + 1)} — ${counts}</p>
                            <h2 id="${st.key}-heading" class="section-title">${st.title}<span class="gold">.</span></h2>
                        </div>
                        <p class="section-lead">${st.lead}</p>
                    </div>
                    ${vids.length ? `<div class="videos">\n                        ${vids.map((v) => videoCard(v, base)).join("\n                        ")}\n                    </div>` : ""}
                    ${album ? gallery(album, base) : ""}
                    ${st.key === "ban-giao" ? `<p class="build__more"><a href="${base}#du-an" class="btn btn--ghost">Xem các dự án đã hoàn thiện →</a></p>` : ""}
                </div>
            </section>`;
    }).join("\n\n            ");

    const jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "Thi công & Xưởng", item: url },
                ],
            },
            ...VIDEOS.map((v) => ({
                "@type": "VideoObject",
                name: v.title,
                description: `${VIDEO_GROUPS[v.group]} — ${v.title}. Video thực tế của ${SITE.name}.`,
                thumbnailUrl: `${SITE_URL}/assets/videos/${v.file}.webp`,
                contentUrl: `${SITE_URL}/assets/videos/${v.file}.mp4`,
                uploadDate: fs.statSync(path.join(DIST_VIDEOS, `${v.file}.mp4`)).mtime.toISOString().slice(0, 10), // ngày nén video — ổn định giữa các lần build
            })),
        ],
    };

    const html = `${head({
        title: `Thi công & Xưởng sản xuất – Hình ảnh, video thực tế | ${SITE.name}`,
        desc: `Xưởng nội thất, lễ khởi công, công trường và bàn giao thực tế của ${SITE.name}: ${VIDEOS.length} video, ${ALBUMS.reduce((n, a) => n + ALBUM[a.key].imgs.length, 0)} ảnh tại Nghệ An.`,
        canonical: url,
        og: { url: `${SITE_URL}/assets/imgs/albums/khoi-cong/1-sm.webp`, alt: cover.imgs[0][1] },
        base,
        jsonld,
    })}
${header({ base, active: "build" })}
    <main id="noi-dung">
        <header class="project__head">
            <div class="container">
                <nav class="breadcrumb" aria-label="Breadcrumb">
                    <ol>
                        <li><a href="${base}">Trang chủ</a></li>
                        <li aria-current="page">Thi công & Xưởng</li>
                    </ol>
                </nav>
                <p class="eyebrow">Thi công thực tế</p>
                <h1 class="project__title">Từ xưởng đến công trình<span class="gold">.</span></h1>
                <p class="project__lead">Không chỉ thiết kế — Athens tự sản xuất nội thất và trực tiếp thi công. Hình ảnh, video dưới đây được ghi lại tại xưởng và công trường thật của chúng tôi.</p>
                <nav class="stage-nav" aria-label="Các giai đoạn">
                    ${STAGES.map((st, n) => `<a href="#${st.key}"><span>${pad(n + 1)}</span>${st.title}</a>`).join("\n                    ")}
                </nav>
            </div>
        </header>

            ${sections}

${cta()}
    </main>
${footer(base)}`;
    writePage(path.join(DIST, "thi-cong.html"), html, url);
}

function build404() {
    const base = BASE_PATH;
    const html = `${head({ title: `Không tìm thấy trang | ${SITE.name}`, desc: "Trang bạn tìm không tồn tại hoặc đã được chuyển sang địa chỉ mới. Xem các dự án biệt thự, nhà phố, nội thất của Athens Holding JSC.", base, noindex: true })}
${header({ base, active: "" })}
    <main id="noi-dung" class="notfound">
        <div class="container">
            <p class="eyebrow">Lỗi 404</p>
            <h1 class="notfound__title">Không tìm thấy trang<span class="gold">.</span></h1>
            <p class="section-lead">Trang này không tồn tại hoặc đã được chuyển sang địa chỉ mới. Bạn có thể xem các dự án hoặc liên hệ trực tiếp với chúng tôi.</p>
            <div class="cta__actions">
                <a href="${base}#du-an" class="btn">Xem dự án</a>
                <a href="tel:${SITE.phoneHref}" class="btn btn--ghost">Gọi ${SITE.phone}</a>
            </div>
            <ul class="notfound__links">
                ${CAT_FILTERS.slice(1)
                    .map(([k, l]) => {
                        const p = PROJECTS.find((x) => x.cats[0] === k);
                        return `<li><a href="${base}du-an/${p.slug}.html">${esc(l)}: ${esc(p.name)} →</a></li>`;
                    })
                    .join("\n                ")}
            </ul>
        </div>
    </main>
${footer(base)}`;
    writePage(path.join(DIST, "404.html"), html);
}

// Trang cũ → trang mới. _redirects cho 301 thật (Cloudflare Pages / Netlify); trang HTML chuyển hướng
// làm dự phòng cho hosting không đọc _redirects (GitHub Pages…)
function buildRedirects() {
    const lines = [];
    for (const [old, to] of Object.entries(REDIRECTS)) {
        const target = to ? `${BASE_PATH}du-an/${to}.html` : `${BASE_PATH}#du-an`;
        lines.push(`${BASE_PATH}du-an/${old}.html ${target} 301`, `${BASE_PATH}du-an/${old} ${target} 301`);
        const rel = to ? `./${to}.html` : "../#du-an";
        fs.writeFileSync(
            path.join(DIST, "du-an", `${old}.html`),
            `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Đã chuyển trang</title><meta name="robots" content="noindex"><link rel="canonical" href="${new URL(SITE_URL).origin}${target}"><meta http-equiv="refresh" content="0;url=${rel}"></head><body><p>Trang đã chuyển: <a href="${rel}">tiếp tục</a></p></body></html>\n`
        );
    }
    fs.writeFileSync(path.join(DIST, "_redirects"), `# Tự sinh bởi scripts/build.mjs (REDIRECTS trong src/data.mjs)\n${BASE_PATH}index.html ${BASE_PATH} 301\n${lines.join("\n")}\n`);
}

/* =========================================================
   sitemap, robots, manifest, _headers
   ========================================================= */
function buildSeoFiles() {
    const urls = [
        { loc: `${SITE_URL}/`, imgs: [`${SITE_URL}/assets/imgs/og/home.jpg`, ...HOME_SLIDES.map((_, i) => `${SITE_URL}/assets/imgs/home/${i + 1}-sm.webp`)], pr: "1.0" },
        {
            loc: `${SITE_URL}/thi-cong.html`,
            imgs: ALBUMS.flatMap((a) => ALBUM[a.key].imgs.map((_, i) => `${SITE_URL}/assets/imgs/albums/${a.key}/${i + 1}-sm.webp`)),
            pr: "0.7",
        },
        ...PROJECTS.map((p) => ({ loc: projectUrl(p), imgs: p.imgs.map((_, i) => `${SITE_URL}/assets/imgs/projects/${p.slug}/${i + 1}-sm.webp`), pr: "0.8" })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
    .map(
        (u) => `    <url>
        <loc>${u.loc}</loc>
        <lastmod>${lastmod[u.loc].date}</lastmod>
        <priority>${u.pr}</priority>
${u.imgs.map((img) => `        <image:image><image:loc>${img}</image:loc></image:image>`).join("\n")}
    </url>`
    )
    .join("\n")}
</urlset>
`;
    fs.writeFileSync(path.join(DIST, "sitemap.xml"), xml);
    fs.writeFileSync(LASTMOD_FILE, JSON.stringify(lastmod, null, 1) + "\n");

    // Manifest: cài web lên màn hình chính điện thoại / desktop
    const manifest = {
        name: SITE.name,
        short_name: "Athens",
        description: "Thiết kế & thi công trọn gói biệt thự, nhà phố, nội thất",
        lang: "vi",
        start_url: "./",
        display: "standalone",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
            { src: "assets/imgs/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "assets/imgs/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
    };
    fs.writeFileSync(path.join(DIST, "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
    // Trình duyệt luôn tìm /favicon.ico ở gốc website
    fs.copyFileSync(path.join(DIST_IMGS, "favicon.ico"), path.join(DIST, "favicon.ico"));
    fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

    // Cache trình duyệt (Cloudflare Pages / Netlify đọc file này; GitHub Pages bỏ qua):
    // font + JS có ?v= → lưu 1 năm; ảnh/video đổi tên khi thay nội dung hiếm → 30 ngày + làm mới nền; HTML luôn kiểm tra lại
    fs.writeFileSync(
        path.join(DIST, "_headers"),
        `# Tự sinh bởi scripts/build.mjs
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/js/*
  Cache-Control: public, max-age=31536000, immutable
/assets/imgs/*
  Cache-Control: public, max-age=2592000, stale-while-revalidate=604800
/assets/videos/*
  Cache-Control: public, max-age=2592000, stale-while-revalidate=604800
/favicon.ico
  Cache-Control: public, max-age=2592000
/*.html
  Cache-Control: public, max-age=0, must-revalidate
/
  Cache-Control: public, max-age=0, must-revalidate
`
    );
}

/* ---------- Chạy ---------- */
// Logo + giấy phép font (src/static/) → assets/; file .woff2 đã được cắt gọn và ghi ở phần Font phía trên
fs.cpSync(STATIC, DIST_ASSETS, { recursive: true, filter: (f) => !f.endsWith(".woff2") });
const projectDir = path.join(DIST, "du-an");
fs.mkdirSync(projectDir, { recursive: true });
// Xoá trang không còn trong data.mjs và không nằm trong danh sách chuyển hướng
const keep = new Set([...PROJECTS.map((p) => `${p.slug}.html`), ...Object.keys(REDIRECTS).map((s) => `${s}.html`)]);
for (const f of fs.readdirSync(projectDir)) if (f.endsWith(".html") && !keep.has(f)) fs.rmSync(path.join(projectDir, f));

buildHome();
buildConstruction();
PROJECTS.forEach(buildProject);
build404();
buildRedirects();
buildSeoFiles();
console.log(`✓ ${2 + PROJECTS.length} trang + 404 + ${Object.keys(REDIRECTS).length} chuyển hướng · tên miền ${SITE_URL}`);
