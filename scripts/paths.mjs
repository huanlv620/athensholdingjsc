// Đường dẫn dùng chung cho mọi script — tự suy ra từ vị trí file này, không phụ thuộc thư mục đang đứng
import path from "path";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ✏️ Nguồn (sửa tay)
export const SRC = path.join(ROOT, "src");
export const STYLES = path.join(SRC, "styles"); // reset.css, base.css, style.css
export const CLIENT_JS = path.join(SRC, "scripts", "site.client.js");
export const STATIC = path.join(SRC, "static"); // chép nguyên vào dist/assets/

// 🗂️ Ảnh/video gốc (nặng, không lên git)
export const MEDIA = path.join(ROOT, "_nguon-anh");

// ⚙️ Bộ nhớ của công cụ (có lên git để máy khác build ra kết quả giống hệt)
export const STATE = path.join(ROOT, "scripts", "state");
export const IMAGES_MANIFEST = path.join(STATE, "images.json"); // kích thước + màu + mã kiểm tra từng ảnh
export const LASTMOD_FILE = path.join(STATE, "lastmod.json"); // ngày cập nhật từng trang cho sitemap

// 🚀 Website đã build — thư mục để deploy
export const DIST = path.join(ROOT, "dist");
export const DIST_ASSETS = path.join(DIST, "assets");
export const DIST_IMGS = path.join(DIST_ASSETS, "imgs");
export const DIST_VIDEOS = path.join(DIST_ASSETS, "videos");
export const DIST_JS = path.join(DIST_ASSETS, "js");
