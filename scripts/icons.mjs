// Sinh favicon + icon ứng dụng từ biểu tượng vector assets/imgs/logo-mark.svg
// Dùng: npm run icons   (đọc src/static/imgs/logo-mark.svg, ghi vào assets/imgs/)
//
// Kết quả (assets/imgs/):
//   favicon.svg            — tab trình duyệt (trình duyệt hiện đại)
//   favicon.ico            — 16/32/48 px cho trình duyệt cũ, Windows
//   apple-touch-icon.png   — 180 px, màn hình chính iPhone/iPad
//   icon-192.png, icon-512.png — Android / cài web lên desktop (site.webmanifest)
import fs from "fs";
import path from "path";
import sharp from "sharp";

import { STATIC, DIST_IMGS } from "./paths.mjs";
const IMG = DIST_IMGS;
fs.mkdirSync(IMG, { recursive: true });
const BG = "#0a0a0a";

// Lấy phần vẽ bên trong logo-mark.svg để lồng vào khung vuông
const mark = fs.readFileSync(path.join(STATIC, "imgs", "logo-mark.svg"), "utf8");
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<!--[\s\S]*?-->/g, "");

// Khung vuông nền tối, biểu tượng cắt bớt hai đầu mái cho to, rõ ở kích thước nhỏ.
// pad = tỷ lệ lề (icon "maskable" của Android cần vùng an toàn rộng hơn)
function squareSvg({ pad = 0.1, radius = 0.18 } = {}) {
    const S = 512;
    const crop = { x: 118, y: 120, w: 630, h: 360 };
    const w = S * (1 - 2 * pad);
    const h = (w * crop.h) / crop.w;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
<rect width="${S}" height="${S}" rx="${S * radius}" fill="${BG}"/>
<svg x="${(S - w) / 2}" y="${(S - h) / 2 + S * 0.02}" width="${w}" height="${h}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" fill="none">${inner}</svg>
</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// ICO chứa nhiều ảnh PNG (định dạng được Windows/trình duyệt hỗ trợ)
function ico(pngs) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);
    header.writeUInt16LE(1, 2);
    header.writeUInt16LE(pngs.length, 4);
    let offset = 6 + 16 * pngs.length;
    const entries = pngs.map(({ size, data }) => {
        const e = Buffer.alloc(16);
        e.writeUInt8(size >= 256 ? 0 : size, 0);
        e.writeUInt8(size >= 256 ? 0 : size, 1);
        e.writeUInt16LE(1, 4); // planes
        e.writeUInt16LE(32, 6); // bpp
        e.writeUInt32LE(data.length, 8);
        e.writeUInt32LE(offset, 12);
        offset += data.length;
        return e;
    });
    return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const tabIcon = squareSvg({ pad: 0.06, radius: 0.2 });
fs.writeFileSync(path.join(IMG, "favicon.svg"), tabIcon);
fs.writeFileSync(path.join(IMG, "favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tabIcon, size) })))));
// iOS tự bo góc → dùng nền vuông đầy đủ
fs.writeFileSync(path.join(IMG, "apple-touch-icon.png"), await png(squareSvg({ pad: 0.12, radius: 0 }), 180));
// Android/desktop: maskable, lề rộng để không bị cắt khi hệ điều hành bo tròn
const appIcon = squareSvg({ pad: 0.16, radius: 0 });
fs.writeFileSync(path.join(IMG, "icon-192.png"), await png(appIcon, 192));
fs.writeFileSync(path.join(IMG, "icon-512.png"), await png(appIcon, 512));
console.log("✓ favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png");
