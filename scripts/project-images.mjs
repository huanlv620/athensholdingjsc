// Danh sách ảnh của một dự án = MỌI ảnh trong thư mục gốc `src`, trừ ảnh khai báo trong `skip`.
// → Thêm ảnh: chỉ cần chép vào thư mục rồi chạy `npm run images` + `npm run build`, không phải sửa code.
//
// Thứ tự hiển thị: ảnh có chú thích trong `imgs` đứng trước (đúng thứ tự khai báo, ảnh đầu = ảnh đại diện),
// sau đó là ảnh chưa có chú thích, xếp theo tên file — chú thích tự sinh "<tên dự án> – ảnh n".
// Dùng chung cho images.mjs (xuất ảnh) và audit-images.mjs (kiểm tra).
import fs from "fs";
import path from "path";

export const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const byName = (a, b) => a.localeCompare(b, "vi", { numeric: true });

export const listImages = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => IMAGE_EXT.test(f)).sort(byName) : []);

export function resolveProjectImages(p, mediaDir) {
    const files = listImages(path.join(mediaDir, p.src));
    const present = new Set(files);
    const skip = p.skip || {};
    const captioned = p.imgs.filter(([f]) => present.has(f) && !(f in skip));
    const listed = new Set(p.imgs.map(([f]) => f));
    const auto = files.filter((f) => !listed.has(f) && !(f in skip));
    let n = captioned.length;
    return {
        list: [...captioned, ...auto.map((f) => [f, `${p.name} – ảnh ${++n}`])],
        auto, // ảnh mới chưa có chú thích riêng
        missing: p.imgs.map(([f]) => f).filter((f) => !present.has(f)), // khai báo nhưng không còn trong thư mục
        skipped: Object.keys(skip).filter((f) => present.has(f)),
        total: files.length,
    };
}
