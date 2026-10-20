// Nén video cho web + tạo ảnh bìa, theo VIDEOS trong data.mjs
// Dùng: npm run videos   (thêm -- --force để nén lại toàn bộ) — cần ffmpeg trong PATH
//
// Kết quả: assets/videos/<file>.mp4  (H.264 cao 960px, CRF 28, faststart → phát được khi đang tải)
//          assets/videos/<file>[-sm].avif|.webp (ảnh bìa giây thứ 3, đã cắt viền đen; cỡ ở POSTER_VARIANTS)
// Chỉ nén lại khi chưa có file hoặc file gốc mới hơn file đã nén.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";
import { VIDEOS, VIDEO_SRC_DIR } from "../src/data.mjs";
import { MEDIA, DIST_VIDEOS, STATE } from "./paths.mjs";
import { POSTER_VARIANTS } from "./image-sizes.mjs";

const FORCE = process.argv.includes("--force");
const SRC = path.join(MEDIA, VIDEO_SRC_DIR);
const OUT = DIST_VIDEOS;
sharp.cache(false);

const missing = VIDEOS.filter((v) => !fs.existsSync(path.join(SRC, v.src)));
if (missing.length) {
    console.error("✗ Thiếu video nguồn, chưa ghi file nào:\n" + missing.map((v) => "   - " + v.src).join("\n"));
    process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

// Giây đã lấy ảnh bìa của từng video → đổi posterAt là tự tạo lại ảnh bìa (không phải nén lại video)
const POSTERS_FILE = path.join(STATE, "posters.json");
const posters = fs.existsSync(POSTERS_FILE) ? JSON.parse(fs.readFileSync(POSTERS_FILE, "utf8")) : {};

const ffmpeg = (...a) => execFileSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", ...a], { stdio: "inherit" });

for (const v of VIDEOS) {
    const src = path.join(SRC, v.src);
    const mp4 = path.join(OUT, `${v.file}.mp4`);
    const posterFiles = POSTER_VARIANTS.flatMap(([suffix]) => ["avif", "webp"].map((ext) => path.join(OUT, `${v.file}${suffix}.${ext}`)));
    const at = String(v.posterAt ?? 3); // giây lấy ảnh bìa (posterAt trong data.mjs)
    const mp4Fresh = fs.existsSync(mp4) && fs.statSync(mp4).mtimeMs >= fs.statSync(src).mtimeMs;
    const posterFresh = posterFiles.every((f) => fs.existsSync(f)) &&(posters[v.file] ?? "3") === at;
    if (mp4Fresh && posterFresh && !FORCE) {
        console.log(`= ${v.file} (không đổi)`);
        continue;
    }
    if (!mp4Fresh || FORCE) {
        const tmp = `${mp4}.tmp.mp4`;
        ffmpeg("-i", src, "-vf", "scale=-2:960", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", tmp);
        fs.renameSync(tmp, mp4);
    }

    const frame = path.join(OUT, `${v.file}.frame.png`);
    ffmpeg("-ss", at, "-i", mp4, "-frames:v", "1", "-vf", `scale=${POSTER_VARIANTS.at(-1)[1]}:-2`, frame);
    const trimmed = await sharp(fs.readFileSync(frame)).trim({ background: "#000", threshold: 30 }).toBuffer();
    for (const [suffix, width] of POSTER_VARIANTS) {
        const img = sharp(trimmed).resize({ width, withoutEnlargement: true });
        await img.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(OUT, `${v.file}${suffix}.avif`));
        await img.clone().webp({ quality: 72 }).toFile(path.join(OUT, `${v.file}${suffix}.webp`));
    }
    fs.rmSync(frame);
    posters[v.file] = at;
    fs.writeFileSync(POSTERS_FILE, JSON.stringify(posters, null, 1) + "\n");
    console.log(`✓ ${v.file} (${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB)`);
}
