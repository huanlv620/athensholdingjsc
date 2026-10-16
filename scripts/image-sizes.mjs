// Cỡ ảnh dùng chung cho images.mjs (xuất file) và build.mjs (viết srcset) — chỉ sửa ở đây.
// Mỗi cỡ: [hậu tố tên file, chiều rộng px]. Mỗi cỡ được xuất 2 định dạng: .avif và .webp.

export const PROJECT_VARIANTS = [["-xs", 400], ["-sm", 800], ["-lg", 1200], ["", 1600]];
// Ảnh nhỏ dưới slider (hiển thị ~120px): bản riêng 240px thay vì dùng -xs 400px
export const THUMB_VARIANTS = [["-t", 240]];
export const HOME_VARIANTS = [["-sm", 960], ["-lg", 1440], ["", 1920]];
export const SITE_VARIANTS = [["-sm", 600], ["", 1200]];

// WebP chỉ là dự phòng cho trình duyệt cũ không đọc được AVIF (<5% người dùng) → chỉ xuất ở cỡ ≤ 960px.
// Cỡ lớn hơn chỉ có AVIF: bớt ~80 MB ảnh mà trình duyệt hiện đại không dùng tới.
export const WEBP_MAX_WIDTH = 960;

// Ảnh chia sẻ mạng xã hội (Facebook, Zalo…): JPG vì crawler không đọc ổn định WebP/AVIF
export const OG_SIZE = { w: 1200, h: 630 };
