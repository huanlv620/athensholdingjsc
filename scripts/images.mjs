// Xuất ảnh web từ ảnh gốc trong _nguon-anh/ theo cấu hình ở data.mjs
// Dùng: npm run images   (thêm -- --force để xuất lại toàn bộ)
//
// Kết quả trong assets/imgs/ (mỗi cỡ có .avif; cỡ ≤ WEBP_MAX_WIDTH có thêm .webp dự phòng — cỡ ở image-sizes.mjs):
//   assets/imgs/projects/<slug>/<n>[-lg|-sm|-xs]   ảnh dự án
//   assets/imgs/home/<n>[-lg|-sm]                  slider trang chủ
//   assets/imgs/albums/<album>/<n>[-t|-sm]          ảnh khởi công, công trường (ALBUMS)
//   assets/imgs/og/<slug>.jpg, og/home.jpg         ảnh chia sẻ Facebook/Zalo 1200×630
//   scripts/state/images.json — kích thước + màu chủ đạo từng ảnh (build.mjs dùng để ghi width/height,
//   tô nền giữ chỗ khi ảnh tải chậm) + mã kiểm tra để lần sau bỏ qua ảnh không đổi.
//
// An toàn: kiểm tra đủ ảnh nguồn (_nguon-anh/) TRƯỚC khi ghi bất cứ thứ gì; mỗi file ghi qua file tạm rồi mới
// đổi tên → chạy lỗi giữa chừng (hoặc máy không có _nguon-anh/) không làm mất ảnh đang dùng.
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import sharp from "sharp";
import { PROJECTS, HOME_SLIDES, ALBUMS } from "../src/data.mjs";
import { PROJECT_VARIANTS, THUMB_VARIANTS, HOME_VARIANTS, SITE_VARIANTS, ALBUM_THUMB_VARIANTS, OG_SIZE, WEBP_MAX_WIDTH } from "./image-sizes.mjs";
import { MEDIA, DIST_IMGS, IMAGES_MANIFEST } from "./paths.mjs";
import { resolveProjectImages } from "./project-images.mjs";

const FORCE = process.argv.includes("--force");
const SRC = MEDIA;
const OUT = DIST_IMGS;
const MANIFEST = IMAGES_MANIFEST;
const WEBP_QUALITY = 72;
const AVIF_QUALITY = 50; // AVIF q50 ≈ WebP q72 về độ nét nhưng nhẹ hơn
// Slider trang chủ nằm dưới lớp phủ tối → nén mạnh hơn mà mắt không thấy khác, ảnh LCP nhẹ hơn ~30%
const HERO_QUALITY = { webp: 64, avif: 40 };
const CONCURRENCY = 4;
sharp.cache(false); // Windows: tránh khoá file khi ghi đè

/* ---------- 1. Lập danh sách việc + kiểm tra ảnh nguồn ---------- */
const jobs = []; // { group, key, src, outBase, variants, og }
const missing = [];
function add(group, key, dir, file, outBase, variants, og) {
    const src = path.join(SRC, dir, file);
    if (!fs.existsSync(src)) missing.push(`${dir}/${file}`);
    const q = group === "home" ? HERO_QUALITY : { webp: WEBP_QUALITY, avif: AVIF_QUALITY };
    jobs.push({ group, key, src, outBase, variants, og, q, dedupe: group.startsWith("projects/") });
}
// Ảnh dự án = mọi ảnh trong thư mục nguồn (trừ `skip`) — xem project-images.mjs
const projectLists = {};
for (const p of PROJECTS) {
    projectLists[p.slug] = p.imgs = resolveProjectImages(p, SRC).list;
    p.imgs.forEach(([file], i) =>
        add(`projects/${p.slug}`, i, p.src, file, path.join(OUT, "projects", p.slug, String(i + 1)), PROJECT_VARIANTS, i === 0 && path.join(OUT, "og", `${p.slug}.jpg`))
    );
    // Ảnh nhỏ cho slider: nhóm việc riêng → thêm/đổi cỡ ảnh nhỏ không phải mã hoá lại ảnh lớn
    p.imgs.forEach(([file], i) => add(`thumbs/${p.slug}`, i, p.src, file, path.join(OUT, "projects", p.slug, String(i + 1)), THUMB_VARIANTS));
}
HOME_SLIDES.forEach((s, i) => add("home", i, s.src, s.file, path.join(OUT, "home", String(i + 1)), HOME_VARIANTS, i === 0 && path.join(OUT, "og", "home.jpg")));
// Album ảnh thực tế (khởi công, công trường): cũng lấy mọi ảnh trong thư mục, trừ `skip`
const albumLists = {};
for (const a of ALBUMS) {
    albumLists[a.key] = resolveProjectImages(a, SRC).list;
    albumLists[a.key].forEach(([file], i) => add(`albums/${a.key}`, i, a.src, file, path.join(OUT, "albums", a.key, String(i + 1)), SITE_VARIANTS));
    // Ảnh nhỏ cho lưới album: nhóm việc riêng như thumbs/ của dự án
    albumLists[a.key].forEach(([file], i) => add(`albumThumbs/${a.key}`, i, a.src, file, path.join(OUT, "albums", a.key, String(i + 1)), ALBUM_THUMB_VARIANTS));
}

if (!fs.existsSync(SRC)) {
    console.error(`✗ Không thấy thư mục ảnh gốc ${SRC} — giữ nguyên ảnh hiện có, không xuất gì.`);
    process.exit(1);
}
if (missing.length) {
    console.error(`✗ Thiếu ${missing.length} ảnh nguồn (sửa data.mjs hoặc chép ảnh vào _nguon-anh/). Chưa ghi file nào:`);
    missing.forEach((m) => console.error("   - " + m));
    process.exit(1);
}

/* ---------- 2. Xuất ảnh (bỏ qua ảnh không đổi) ---------- */
const old = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const [gKind, gSlug] = [(g) => g.split("/")[0], (g) => g.split("/")[1]];
const bucket = (m, group) => (group.includes("/") ? m[gKind(group)]?.[gSlug(group)] : m[group]);
const oldEntry = (group, i) => bucket(old, group)?.[i];

// Mã kiểm tra: đổi ảnh nguồn, đổi cỡ hay chất lượng → xuất lại
function hashOf(job) {
    const st = fs.statSync(job.src);
    return createHash("md5")
        .update(JSON.stringify([path.relative(SRC, job.src), st.size, st.mtimeMs, job.variants, job.q, Boolean(job.og), OG_SIZE]))
        .digest("hex")
        .slice(0, 12);
}

const hasWebp = (width) => width <= WEBP_MAX_WIDTH;
// Ảnh dự án: ảnh gốc hẹp hơn cỡ danh nghĩa thì các bản lớn trùng nhau, build.mjs chỉ dùng bản đầu (realVariants)
// → không xuất bản trùng. Album không bỏ: trình xem ảnh mở thẳng bản lớn nhất (<n>.avif).
// width: chiều rộng ảnh đã xuất (manifest); chưa biết thì coi như đủ mọi cỡ
function variantsOf(job, width) {
    if (!job.dedupe || !width) return job.variants;
    const seen = new Set();
    return job.variants.filter(([, w]) => !seen.has(Math.min(w, width)) && seen.add(Math.min(w, width)));
}
const outputsOf = (job, width) => [
    ...variantsOf(job, width).flatMap(([s, w]) => [`${job.outBase}${s}.avif`, ...(hasWebp(w) ? [`${job.outBase}${s}.webp`] : [])]),
    ...(job.og ? [job.og] : []),
];

// Ghi qua file tạm rồi đổi tên: không bao giờ để lại file hỏng/dở dang
async function writeAtomic(pipeline, file) {
    const tmp = `${file}.tmp`;
    await pipeline.toFile(tmp);
    fs.renameSync(tmp, file);
}

async function exportImage(job) {
    const img = sharp(job.src).rotate(); // xoay theo EXIF
    fs.mkdirSync(path.dirname(job.outBase), { recursive: true });
    const { info } = await img.clone().resize({ width: job.variants.at(-1)[1], withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    await Promise.all(
        variantsOf(job, info.width).flatMap(([suffix, width]) => {
            const resized = img.clone().resize({ width, withoutEnlargement: true });
            return [
                hasWebp(width) && writeAtomic(resized.clone().webp({ quality: job.q.webp, effort: 5, smartSubsample: true }), `${job.outBase}${suffix}.webp`),
                writeAtomic(resized.clone().avif({ quality: job.q.avif, effort: 4 }), `${job.outBase}${suffix}.avif`),
            ];
        })
    );
    if (job.og) {
        fs.mkdirSync(path.dirname(job.og), { recursive: true });
        await writeAtomic(img.clone().resize(OG_SIZE.w, OG_SIZE.h, { fit: "cover", position: "attention" }).jpeg({ quality: 80, mozjpeg: true }), job.og);
    }
    const { dominant: d } = await img.clone().resize(32).stats();
    const hex = (v) => Math.round(v * 0.85).toString(16).padStart(2, "0"); // tối đi chút cho hợp nền tối
    return { w: info.width, h: info.height, c: `#${hex(d.r)}${hex(d.g)}${hex(d.b)}` };
}

let encoded = 0;
const results = new Array(jobs.length);
let next = 0;
await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
        while (next < jobs.length) {
            const idx = next++;
            const job = jobs[idx];
            const hash = hashOf(job);
            const prev = oldEntry(job.group, job.key);
            if (!FORCE && prev?.hash === hash && outputsOf(job, prev.w).every((f) => fs.existsSync(f))) {
                results[idx] = prev;
                continue;
            }
            results[idx] = { ...(await exportImage(job)), hash };
            encoded++;
            if (encoded % 20 === 0) console.log(`  … đã xuất ${encoded} ảnh`);
        }
    })
);

/* ---------- 3. Ghi manifest + dọn file thừa ---------- */
// lists: danh sách ảnh + chú thích đã tính → build.mjs dùng, không cần thư mục _nguon-anh khi build
const manifest = { projects: {}, thumbs: {}, albums: {}, albumThumbs: {}, home: [], lists: projectLists, albumLists };
jobs.forEach((job, i) => {
    if (job.group.includes("/")) (manifest[gKind(job.group)][gSlug(job.group)] ||= [])[job.key] = results[i];
    else manifest[job.group][job.key] = results[i];
});
fs.writeFileSync(MANIFEST, JSON.stringify(manifest));

// Chỉ xoá SAU khi mọi ảnh mới đã xuất xong: thư mục dự án đã bỏ + file vượt số ảnh hiện tại
const keep = new Set(jobs.flatMap((job, i) => outputsOf(job, results[i].w)).map((f) => path.resolve(f)));
let removed = 0;
for (const dir of ["projects", "home", "albums", "og"]) {
    const base = path.join(OUT, dir);
    if (!fs.existsSync(base)) continue;
    for (const f of fs.readdirSync(base, { recursive: true })) {
        const full = path.resolve(base, f);
        if (fs.statSync(full).isFile() && !keep.has(full)) {
            fs.rmSync(full);
            removed++;
        }
    }
    for (const d of fs.readdirSync(base)) {
        const full = path.join(base, d);
        if (fs.statSync(full).isDirectory() && !fs.readdirSync(full).length) fs.rmdirSync(full);
    }
}
console.log(`✓ ${jobs.length} ảnh: xuất mới ${encoded}, giữ nguyên ${jobs.length - encoded}, xoá ${removed} file thừa`);
