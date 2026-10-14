// Sinh index.html, du-an/*.html, sitemap.xml, robots.txt
// Dùng: node build.mjs <thư mục dự án>
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { SITE, PROJECTS, CAT_FILTERS, HOME_SLIDES } from "./data.mjs";

const ROOT = process.argv[2];
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n) => String(n).padStart(2, "0");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");

/* ---------- Gộp + nén CSS ---------- */
function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, "") // bỏ comment
        .replace(/\s+/g, " ") // gộp khoảng trắng
        .replace(/\s*([{};,>~])\s*/g, "$1") // bỏ khoảng trắng quanh ký tự cú pháp
        .replace(/:\s+/g, ":")
        .replace(/;}/g, "}")
        .trim();
}

const cssDir = path.join(ROOT, "assets", "css");
const cssBundle = minifyCss(["reset.css", "base.css", "style.css"].map((f) => fs.readFileSync(path.join(cssDir, f), "utf8")).join("\n"));
fs.writeFileSync(path.join(cssDir, "main.min.css"), cssBundle);
const CSS_VERSION = createHash("md5").update(cssBundle).digest("hex").slice(0, 8);

/* ---------- Nén HTML: bỏ comment + thụt lề (giữ nguyên nội dung) ---------- */
const minifyHtml = (html) =>
    html
        .replace(/<!--(?!\s*\[)[\s\S]*?-->/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
const writeHtml = (file, html) => fs.writeFileSync(file, minifyHtml(html));

/* ---------- Khung chung ---------- */
function head({ title, desc, canonical, image, base, jsonld, preload }) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- SEO -->
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="author" content="${SITE.name}">
    <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#f6f1e7" media="(prefers-color-scheme: light)">
    <meta name="color-scheme" content="dark light">

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
    <link rel="canonical" href="${canonical}">
    <link rel="alternate" hreflang="vi" href="${canonical}">
    <link rel="alternate" hreflang="x-default" href="${canonical}">
    <link rel="icon" href="${base}assets/imgs/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${base}assets/imgs/apple-touch-icon.png">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:locale" content="vi_VN">
    <meta property="og:site_name" content="${SITE.name}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:width" content="960">
    <meta property="og:image:height" content="540">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${image}">

    <!-- Tải trước: ảnh LCP + 2 font chính (tự host, không gọi dịch vụ ngoài) -->
    <link rel="preload" as="image" href="${preload}" fetchpriority="high">
    <link rel="preload" as="font" type="font/woff2" href="${base}assets/fonts/be-vietnam-pro-regular.woff2" crossorigin>
    <link rel="preload" as="font" type="font/woff2" href="${base}assets/fonts/playfair-display-var.woff2" crossorigin>

    <!-- CSS gộp + nén (nguồn: reset.css, base.css, style.css) -->
    <link rel="stylesheet" href="${base}assets/css/main.min.css?v=${CSS_VERSION}">

    <!-- Dữ liệu có cấu trúc -->
    <script type="application/ld+json">
${json(jsonld)}
    </script>
</head>`;
}

function header({ base, active }) {
    const home = `${base}index.html`;
    const link = (href, label, key) =>
        `<li><a href="${href}" class="nav__link${active === key ? " is-active" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a></li>`;
    return `<body>
    <a class="skip-link" href="#noi-dung">Bỏ qua tới nội dung chính</a>

    <!-- ============ HEADER ============ -->
    <header class="header">
        <div class="container header__inner">
            <a href="${home}" class="logo" aria-label="${SITE.name} – Trang chủ">ATHENS<span class="logo__dot">.</span></a>

            <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true">
            <label for="nav-toggle" class="nav-burger" aria-label="Mở menu"><span></span><span></span><span></span></label>

            <nav class="nav" aria-label="Điều hướng chính">
                <ul class="nav__list">
                    ${link(home, "Trang chủ", "home")}
                    <li class="nav__item--mega">
                        <a href="${home}#du-an" class="nav__link${active === "project" ? " is-active" : ""}">Dự án</a>
                        <div class="mega">
                            <div class="mega__col">
                                <p class="mega__title">Kiến trúc</p>
                                <ul>
                                    <li><a href="${base}du-an/truong-lien-cap-athens.html">Giáo dục</a></li>
                                    <li><a href="${base}du-an/athens-tower.html">Văn phòng</a></li>
                                    <li><a href="${base}du-an/athens-bay-resort.html">Khách sạn &amp; Resort</a></li>
                                    <li><a href="${base}du-an/biet-thu-ho-tay.html">Nhà ở</a></li>
                                </ul>
                                <a href="${home}#du-an" class="mega__all">Xem tất cả →</a>
                            </div>
                            <div class="mega__col">
                                <p class="mega__title">Nội thất</p>
                                <p>Không gian sống, làm việc và nghỉ dưỡng được thiết kế đến từng chi tiết.</p>
                                <a href="${base}du-an/athens-hub.html" class="mega__all">Xem dự án →</a>
                            </div>
                            <div class="mega__col">
                                <p class="mega__title">Cảnh quan</p>
                                <p>Công viên, sân vườn và không gian công cộng hài hòa với tự nhiên.</p>
                                <a href="${base}du-an/cong-vien-athens-riverside.html" class="mega__all">Xem dự án →</a>
                            </div>
                            <div class="mega__col">
                                <p class="mega__title">Quy hoạch</p>
                                <p>Quy hoạch tổng thể khu đô thị, khu nghỉ dưỡng và khu giáo dục.</p>
                                <a href="${base}du-an/athens-hill-retreat.html" class="mega__all">Xem dự án →</a>
                            </div>
                        </div>
                    </li>
                    ${link(`${home}#ve-athens`, "Về Athens", "about")}
                    ${link(`${home}#tin-tuc`, "Tin tức &amp; Báo chí", "news")}
                    ${link(`${home}#lien-he`, "Liên hệ", "contact")}
                </ul>
            </nav>

            <div class="header__tools">
                <button type="button" class="icon-btn theme-btn" data-theme-toggle aria-label="Chuyển chế độ sáng / tối" title="Chế độ sáng / tối">
                    <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                    <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
                </button>
                <input type="checkbox" id="search-toggle" class="search-toggle" aria-hidden="true">
                <label for="search-toggle" class="icon-btn" aria-label="Tìm kiếm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </label>
                <form class="search" role="search" action="${home}" method="get">
                    <label for="q" class="sr-only">Tìm kiếm dự án</label>
                    <input type="search" id="q" name="q" placeholder="Tìm dự án, tin tức…">
                </form>
                <div class="lang" aria-label="Ngôn ngữ">
                    <a href="${home}" class="lang__item is-active" hreflang="vi" lang="vi">VI</a>
                    <span aria-hidden="true">/</span>
                    <a href="${home}" class="lang__item" hreflang="en" lang="en">EN</a>
                </div>
            </div>
        </div>
    </header>
`;
}

function cta(level = "h2") {
    return `        <!-- ============ CTA ============ -->
        <section class="cta" id="lien-he" aria-labelledby="cta-heading">
            <div class="container">
                <${level} id="cta-heading" class="cta__title">Hãy bắt đầu<span class="gold">.</span></${level}>
                <address class="cta__info">
                    <p>${SITE.name} — ${SITE.city}, Việt Nam</p>
                    <p>
                        <a href="mailto:${SITE.email}">${SITE.email}</a>
                        <span aria-hidden="true">·</span>
                        <a href="tel:${SITE.phoneHref}">${SITE.phone}</a>
                    </p>
                </address>
                <a href="mailto:${SITE.email}" class="btn">Liên hệ với chúng tôi</a>
            </div>
        </section>`;
}

function footer(base) {
    return `
    <!-- ============ FOOTER ============ -->
    <footer class="footer">
        <div class="container footer__inner">
            <a href="${base}index.html" class="logo logo--sm">ATHENS<span class="logo__dot">.</span></a>
            <p class="footer__tag">Kiến trúc · Nội thất · Cảnh quan · Quy hoạch</p>
            <p class="footer__copy">© ${new Date().getFullYear()} ${SITE.name}. Ảnh minh họa: StockSnap.io &amp; Rawpixel (CC0).</p>
        </div>
    </footer>
</body>
</html>
`;
}

/* ---------- Slider CSS thuần (radio + label) ---------- */
function slider({ id, label, slides, variant = "", thumbs = true, overlay = "" }) {
    const n = slides.length;
    const inputs = slides
        .map((_, i) => `<input type="radio" name="${id}" id="${id}-${i + 1}" class="slider__radio s-${i + 1}"${i === 0 ? " checked" : ""} aria-label="Ảnh ${i + 1} / ${n}">`)
        .join("\n                ");
    const items = slides
        .map(
            (s, i) => `<li class="slider__slide" aria-roledescription="slide" aria-label="${i + 1} / ${n}">
                        <figure>
                            <img src="${s.src}" alt="${esc(s.alt)}" width="960" height="540"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">
                            ${variant === "hero" ? "" : `<figcaption>${esc(s.alt)}</figcaption>`}
                        </figure>
                    </li>`
        )
        .join("\n                    ");
    const arrows = slides
        .map((_, i) => {
            const prev = ((i - 1 + n) % n) + 1;
            const next = ((i + 1) % n) + 1;
            return `<div class="slider__arrows"><label for="${id}-${prev}" class="slider__arrow slider__arrow--prev" aria-label="Ảnh trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></label><label for="${id}-${next}" class="slider__arrow slider__arrow--next" aria-label="Ảnh tiếp theo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></label></div>`;
        })
        .join("\n                    ");
    const dots = slides.map((_, i) => `<label for="${id}-${i + 1}" aria-label="Tới ảnh ${i + 1}"></label>`).join("");
    const counter = slides.map((_, i) => `<span>${pad(i + 1)}</span>`).join("");
    const thumbList = thumbs
        ? `
                <div class="slider__thumbs">
                    ${slides.map((s, i) => `<label for="${id}-${i + 1}"><img src="${s.thumb}" alt="" width="320" height="240" loading="lazy" decoding="async"></label>`).join("\n                    ")}
                </div>`
        : "";
    return `<div class="slider ${variant ? `slider--${variant}` : ""}" role="region" aria-roledescription="carousel" aria-label="${esc(label)}">
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
                    <div class="slider__dots">${dots}</div>
                </div>${thumbList}
            </div>`;
}

const imgs = (slug, base) =>
    [1, 2, 3, 4, 5].map((i) => ({
        src: `${base}assets/imgs/projects/${slug}/${i}.webp`,
        thumb: `${base}assets/imgs/projects/${slug}/${i}-xs.webp`,
    }));

function card(p, base, level = "h3") {
    return `<li class="card ${p.cats.map((c) => `cat-${c}`).join(" ")}">
                            <a href="${base}du-an/${p.slug}.html" class="card__link">
                                <div class="card__media">
                                    <img src="${base}assets/imgs/projects/${p.slug}/1-sm.webp" srcset="${base}assets/imgs/projects/${p.slug}/1-xs.webp 320w, ${base}assets/imgs/projects/${p.slug}/1-sm.webp 640w" sizes="(max-width: 599px) 92vw, (max-width: 991px) 46vw, 400px" alt="${esc(p.alts[0])} – ${esc(p.name)}" width="640" height="480" loading="lazy" decoding="async">
                                </div>
                                <${level} class="card__title">${esc(p.name)}</${level}>
                                <p class="card__meta">${esc(p.catLabel)} · ${esc(p.city)}</p>
                            </a>
                        </li>`;
}

const ORG = {
    "@type": "Organization",
    "@id": `${SITE.url}/#org`,
    name: SITE.name,
    alternateName: "Công ty Cổ phần Athens Holding",
    url: `${SITE.url}/`,
    logo: `${SITE.url}/assets/imgs/apple-touch-icon.png`,
    email: SITE.email,
    telephone: SITE.phone,
    address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: "VN" },
};

/* ---------- Trang chủ ---------- */
function buildHome() {
    const base = "./";
    const heroSlides = HOME_SLIDES.map((alt, i) => ({
        alt,
        src: `${base}assets/imgs/projects/home/${i + 1}.webp`,
        thumb: `${base}assets/imgs/projects/home/${i + 1}-sm.webp`,
    }));
    const overlay = `
                <div class="hero__content">
                    <div class="container">
                        <p class="eyebrow">${SITE.name} — Kiến trúc · Nội thất · Cảnh quan · Quy hoạch</p>
                        <h1 class="hero__title">Kiến tạo không gian<br> sống bền vững<span class="gold">.</span></h1>
                        <p class="hero__lead">Mỗi công trình là một câu chuyện về con người và nơi chốn. Athens thiết kế những không gian giàu cảm xúc — từ trường học, văn phòng đến khu nghỉ dưỡng và nhà ở.</p>
                        <a href="#du-an" class="btn">Khám phá dự án</a>
                    </div>
                </div>`;

    const filterInputs = CAT_FILTERS.map(([k], i) => `<input type="radio" name="filter" id="f-${k}" class="filter__input"${i === 0 ? " checked" : ""}>`).join("\n                    ");
    const filterTabs = CAT_FILTERS.map(([k, l]) => `<label for="f-${k}">${l}</label>`).join("\n                        ");

    const jsonld = {
        "@context": "https://schema.org",
        "@graph": [
            ORG,
            { "@type": "WebSite", "@id": `${SITE.url}/#website`, url: `${SITE.url}/`, name: SITE.name, inLanguage: "vi-VN", publisher: { "@id": `${SITE.url}/#org` } },
            {
                "@type": "ItemList",
                name: "Dự án tiêu biểu",
                itemListElement: PROJECTS.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE.url}/du-an/${p.slug}.html`, name: p.name })),
            },
        ],
    };

    const html = `${head({
        title: `${SITE.name} — Kiến trúc, Nội thất, Cảnh quan & Quy hoạch`,
        desc: "Athens Holding JSC – đơn vị thiết kế kiến trúc, nội thất, cảnh quan và quy hoạch tại Việt Nam. Khám phá các dự án trường học, văn phòng, resort và nhà ở do Athens thực hiện.",
        canonical: `${SITE.url}/`,
        image: `${SITE.url}/assets/imgs/projects/home/1.webp`,
        base,
        preload: heroSlides[0].src,
        jsonld,
    })}
${header({ base, active: "home" })}
    <main id="noi-dung">
        <!-- ============ HERO SLIDER ============ -->
        <section class="hero" aria-label="Giới thiệu">
            ${slider({ id: "hero", label: "Hình ảnh nổi bật", slides: heroSlides, variant: "hero", thumbs: false, overlay })}
        </section>

        <!-- ============ PROJECTS ============ -->
        <section class="projects" id="du-an" aria-labelledby="projects-heading">
            <div class="container">
                <div class="section-head">
                    <p class="eyebrow">Portfolio</p>
                    <h2 id="projects-heading" class="section-title section-title--xl">Dự án<span class="gold">.</span></h2>
                    <p class="section-lead">Tuyển chọn các công trình kiến trúc, nội thất và cảnh quan tiêu biểu do Athens thực hiện trên khắp Việt Nam.</p>
                </div>

                <div class="filter">
                    ${filterInputs}

                    <div class="filter__tabs" role="group" aria-label="Lọc dự án theo loại hình">
                        ${filterTabs}
                    </div>

                    <ul class="grid">
                        ${PROJECTS.map((p) => card(p, base)).join("\n                        ")}
                    </ul>
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
                        <p>Chúng tôi lắng nghe cách mọi người sống, học tập và làm việc trước khi đặt nét vẽ đầu tiên.</p>
                    </article>
                    <article class="pillar">
                        <span class="pillar__num">02</span>
                        <h3 class="pillar__title">Tôn trọng bối cảnh &amp; khí hậu</h3>
                        <p>Ánh sáng, gió, vật liệu địa phương và cảnh quan là chất liệu chính cho mỗi công trình.</p>
                    </article>
                    <article class="pillar">
                        <span class="pillar__num">03</span>
                        <h3 class="pillar__title">Bền vững theo thời gian</h3>
                        <p>Giải pháp tối giản, vận hành hiệu quả và giá trị lâu dài cho chủ đầu tư lẫn cộng đồng.</p>
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

        <!-- ============ TIN TỨC ============ -->
        <section class="news" id="tin-tuc" aria-labelledby="news-heading">
            <div class="container">
                <div class="news__head">
                    <h2 id="news-heading" class="section-title">Tin tức &amp; Báo chí<span class="gold">.</span></h2>
                </div>
                <div class="news__list">
                    <article class="news-item">
                        <time datetime="2026-09-20">20.09.2026</time>
                        <h3><a href="./du-an/athens-bay-resort.html">Athens Bay Resort khởi công giai đoạn 2</a></h3>
                    </article>
                    <article class="news-item">
                        <time datetime="2026-08-05">05.08.2026</time>
                        <h3><a href="./du-an/truong-lien-cap-athens.html">Trường Liên cấp Athens đón năm học đầu tiên</a></h3>
                    </article>
                    <article class="news-item">
                        <time datetime="2026-06-18">18.06.2026</time>
                        <h3><a href="./du-an/athens-hill-retreat.html">Athens chia sẻ về kiến trúc vùng cao tại hội thảo ngành</a></h3>
                    </article>
                </div>
            </div>
        </section>

${cta()}
    </main>
${footer(base)}`;
    writeHtml(path.join(ROOT, "index.html"), html);
}

/* ---------- Trang chi tiết dự án ---------- */
function buildProject(p, idx) {
    const base = "../";
    const url = `${SITE.url}/du-an/${p.slug}.html`;
    const slides = imgs(p.slug, base).map((s, i) => ({ ...s, alt: p.alts[i] }));
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
                    { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${SITE.url}/` },
                    { "@type": "ListItem", position: 2, name: "Dự án", item: `${SITE.url}/#du-an` },
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
                dateCreated: p.year,
                inLanguage: "vi-VN",
                image: [1, 2, 3, 4, 5].map((i) => `${SITE.url}/assets/imgs/projects/${p.slug}/${i}.webp`),
                locationCreated: { "@type": "Place", name: p.location, address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "VN" } },
                creator: { "@id": `${SITE.url}/#org` },
            },
            ORG,
        ],
    };

    const html = `${head({
        // Giữ title ≤ 60 ký tự để Google không cắt
        title: `${p.name} – ${p.catLabel.replace("Khách sạn & ", "").split(",")[0]} tại ${p.city} | Athens`,
        desc: p.desc,
        canonical: url,
        image: `${SITE.url}/assets/imgs/projects/${p.slug}/1.webp`,
        base,
        preload: slides[0].src,
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
                            <li><a href="${base}index.html">Trang chủ</a></li>
                            <li><a href="${base}index.html#du-an">Dự án</a></li>
                            <li aria-current="page">${esc(p.name)}</li>
                        </ol>
                    </nav>
                    <p class="eyebrow">${esc(p.catLabel)} · ${esc(p.location)}</p>
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
                        <div><dt>Chủ đầu tư</dt><dd>${esc(p.client)}</dd></div>
                        <div><dt>Địa điểm</dt><dd>${esc(p.location)}</dd></div>
                        <div><dt>Loại hình</dt><dd>${esc(p.catLabel)}</dd></div>
                        <div><dt>Diện tích</dt><dd>${esc(p.area)}</dd></div>
                        <div><dt>Năm</dt><dd>${esc(p.year)}</dd></div>
                        <div><dt>Hạng mục</dt><dd>${esc(p.services)}</dd></div>
                    </dl>
                    <a href="mailto:${SITE.email}?subject=${encodeURIComponent("Tư vấn dự án tương tự " + p.name)}" class="btn btn--block">Tư vấn dự án tương tự</a>
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

${cta()}
    </main>
${footer(base)}`;
    fs.mkdirSync(path.join(ROOT, "du-an"), { recursive: true });
    writeHtml(path.join(ROOT, "du-an", `${p.slug}.html`), html);
}

/* ---------- sitemap + robots ---------- */
function buildSeoFiles() {
    const urls = [
        { loc: `${SITE.url}/`, img: `${SITE.url}/assets/imgs/projects/home/1.webp`, pr: "1.0" },
        ...PROJECTS.map((p) => ({ loc: `${SITE.url}/du-an/${p.slug}.html`, img: `${SITE.url}/assets/imgs/projects/${p.slug}/1.webp`, pr: "0.8" })),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
    .map(
        (u) => `    <url>
        <loc>${u.loc}</loc>
        <lastmod>${TODAY}</lastmod>
        <priority>${u.pr}</priority>
        <image:image><image:loc>${u.img}</image:loc></image:image>
    </url>`
    )
    .join("\n")}
</urlset>
`;
    fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml);
    fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`);
}

buildHome();
PROJECTS.forEach(buildProject);
buildSeoFiles();
console.log("Built", 1 + PROJECTS.length, "pages");
