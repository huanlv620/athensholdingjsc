// Nén video cho web + tạo ảnh bìa, theo VIDEOS trong data.mjs
// Dùng: npm run videos   (thêm -- --force để nén lại toàn bộ) — cần ffmpeg trong PATH
//
// Kết quả: dist/assets/videos/<file>.mp4  (H.264 cao 960px, CRF 28, faststart → phát được khi đang tải)
//          dist/assets/videos/<file>.webp (ảnh bìa giây thứ 3, đã cắt viền đen)
// Chỉ nén lại khi chưa có file hoặc file gốc mới hơn file đã nén.
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import sharp from "sharp";
import { VIDEOS, VIDEO_SRC_DIR } from "../src/data.mjs";
import { MEDIA, DIST_VIDEOS } from "./paths.mjs";

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

const ffmpeg = (...a) => execFileSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", ...a], { stdio: "inherit" });

for (const v of VIDEOS) {
    const src = path.join(SRC, v.src);
    const mp4 = path.join(OUT, `${v.file}.mp4`);
    const poster = path.join(OUT, `${v.file}.webp`);
    const fresh = fs.existsSync(mp4) && fs.existsSync(poster) && fs.statSync(mp4).mtimeMs >= fs.statSync(src).mtimeMs;
    if (fresh && !FORCE) {
        console.log(`= ${v.file} (không đổi)`);
        continue;
    }
    const tmp = `${mp4}.tmp.mp4`;
    ffmpeg("-i", src, "-vf", "scale=-2:960", "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-ac", "2", "-movflags", "+faststart", tmp);
    fs.renameSync(tmp, mp4);

    const frame = path.join(OUT, `${v.file}.frame.png`);
    ffmpeg("-ss", "3", "-i", mp4, "-frames:v", "1", "-vf", "scale=540:-2", frame);
    await sharp(fs.readFileSync(frame)).trim({ background: "#000", threshold: 30 }).webp({ quality: 72 }).toFile(poster);
    fs.rmSync(frame);
    console.log(`✓ ${v.file} (${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB)`);
}
