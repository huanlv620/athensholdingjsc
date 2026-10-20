// Kiểm tra ảnh dự án + album thi công + video: dự án nào đủ ảnh, ảnh nào chưa có chú thích, ảnh nào đang ẩn, thư mục nào chưa dùng.
// Dùng: npm run kiem-tra-anh   (thêm -- --chi-tiet để xem từng ảnh bị ẩn kèm lý do)
// Chỉ đọc, không sửa file nào.
import fs from "fs";
import path from "path";
import { PROJECTS, HOME_SLIDES, ALBUMS, VIDEOS, VIDEO_SRC_DIR, MEDIA_IGNORE } from "../src/data.mjs";
import { MEDIA } from "./paths.mjs";
import { resolveProjectImages, listImages } from "./project-images.mjs";

if (!fs.existsSync(MEDIA)) {
    console.error(`✗ Không thấy thư mục ảnh gốc ${MEDIA}`);
    process.exit(1);
}
const DETAIL = process.argv.includes("--chi-tiet");

let shown = 0, autoCount = 0, hidden = 0;
const warnings = [];
console.log("\nDỰ ÁN                             HIỂN THỊ  CHƯA CHÚ THÍCH  ẨN   THƯ MỤC");
// Album thi công (trang Thi công & Xưởng) quản lý y như dự án → in chung bảng
for (const p of [...PROJECTS, ...ALBUMS]) {
    const r = resolveProjectImages(p, MEDIA);
    shown += r.list.length;
    autoCount += r.auto.length;
    hidden += r.skipped.length;
    console.log(
        `${p.name.padEnd(34)}${String(r.list.length).padStart(5)}${String(r.auto.length || "").padStart(12)}${String(r.skipped.length || "").padStart(8)}   ${p.src}`
    );
    if (!r.total) warnings.push(`${p.name}: thư mục "${p.src}" không có ảnh nào`);
    r.missing.forEach((f) => warnings.push(`${p.name}: có chú thích cho "${f}" nhưng file không còn trong thư mục`));
    if (r.auto.length) warnings.push(`${p.name}: ${r.auto.length} ảnh chưa có chú thích riêng → ${r.auto.join(", ")}`);
    if (DETAIL) r.skipped.forEach((f) => console.log(`      ẩn  ${f}  — ${p.skip[f]}`));
}
console.log(`\nTổng: ${shown} ảnh hiển thị trên ${PROJECTS.length} dự án + ${ALBUMS.length} album · ${autoCount} chưa có chú thích · ${hidden} ảnh ẩn`);

// Thư mục có ảnh nhưng không dự án nào dùng
const used = new Set([...PROJECTS.map((p) => p.src), ...ALBUMS.map((a) => a.src), ...HOME_SLIDES.map((s) => s.src)].map((d) => path.normalize(d)));

// Video gốc chưa khai báo trong VIDEOS
const videoRoot = path.join(MEDIA, VIDEO_SRC_DIR);
const declared = new Set(VIDEOS.map((v) => path.normalize(v.src)));
const videoFiles = fs.readdirSync(videoRoot, { recursive: true }).filter((f) => /\.(mp4|mov)$/i.test(f));
const unusedVideos = videoFiles.filter((f) => !declared.has(path.normalize(f)));
VIDEOS.filter((v) => !fs.existsSync(path.join(videoRoot, v.src))).forEach((v) => warnings.push(`Video "${v.file}": không thấy file gốc ${v.src}`));
console.log(`Video: ${VIDEOS.length} video đang hiển thị`);
const unused = [];
(function walk(dir) {
    for (const d of fs.readdirSync(path.join(MEDIA, dir), { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const rel = path.join(dir, d.name);
        const n = listImages(path.join(MEDIA, rel)).length;
        const key = rel.replaceAll("\\", "/");
        if (n && !used.has(path.normalize(rel)) && !(key in MEDIA_IGNORE)) unused.push(`${key} (${n} ảnh)`);
        walk(rel);
    }
})("");
const ignored = Object.entries(MEDIA_IGNORE);
if (ignored.length) console.log(`\nThư mục cố ý bỏ qua (MEDIA_IGNORE):\n${ignored.map(([d, r]) => `   - ${d}: ${r}`).join("\n")}`);
if (unused.length) console.log(`\nThư mục có ảnh nhưng CHƯA thuộc dự án nào:\n${unused.map((u) => "   - " + u).join("\n")}`);
if (unusedVideos.length) console.log(`\nVideo gốc CHƯA đưa lên web (thêm vào VIDEOS trong data.mjs):\n${unusedVideos.map((f) => "   - " + f).join("\n")}`);
if (warnings.length) console.log(`\nCần xem lại:\n${warnings.map((w) => "   - " + w).join("\n")}`);
if (!unused.length && !warnings.length && !unusedVideos.length) console.log("\n✓ Mọi ảnh đều đã có dự án và chú thích.");
