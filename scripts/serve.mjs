// Máy chủ tĩnh để xem thử website (thư mục gốc) trên máy: npm run preview → mở http://localhost:8080
// Đổi cổng: npm run preview -- 3000
// Mô phỏng hosting thật: "/" và "/du-an/" trả về index.html, không có file thì trả 404.html.
import http from "http";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { DIST } from "./paths.mjs";

const ROOT = DIST;
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".mp4": "video/mp4",
    ".xml": "application/xml",
    ".txt": "text/plain; charset=utf-8",
};

// Đọc _headers (định dạng Cloudflare Pages / Netlify) để xem thử đúng chính sách cache như khi deploy
const HEADER_RULES = [];
if (fs.existsSync(path.join(ROOT, "_headers"))) {
    let cur = null;
    for (const line of fs.readFileSync(path.join(ROOT, "_headers"), "utf8").split("\n")) {
        if (!line.trim() || line.startsWith("#")) continue;
        if (!/^\s/.test(line)) {
            const re = new RegExp("^" + line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
            HEADER_RULES.push((cur = { re, headers: {} }));
        } else if (cur) {
            const [k, ...v] = line.trim().split(":");
            cur.headers[k.trim()] = v.join(":").trim();
        }
    }
}
const headersFor = (url) => Object.assign({}, ...HEADER_RULES.filter((r) => r.re.test(url)).map((r) => r.headers));

http.createServer((req, res) => {
    const extra = headersFor(new URL(req.url, "http://x").pathname);
    for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
    let file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    let status = 200;
    if (!fs.existsSync(file)) {
        file = path.join(ROOT, "404.html");
        status = 404;
    }
    const type = TYPES[path.extname(file)] || "application/octet-stream";
    const size = fs.statSync(file).size;
    // Hỗ trợ Range để tua video
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range && status === 200) {
        const start = Number(range[1] || 0);
        const end = range[2] ? Number(range[2]) : size - 1;
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
        return fs.createReadStream(file, { start, end }).pipe(res);
    }
    // Nén gzip cho file chữ như hosting thật (để số đo dung lượng sát thực tế)
    if (/text|javascript|json|xml|svg|manifest/.test(type) && /gzip/.test(req.headers["accept-encoding"] || "")) {
        const body = zlib.gzipSync(fs.readFileSync(file));
        res.writeHead(status, { "Content-Type": type, "Content-Encoding": "gzip", "Content-Length": body.length, Vary: "Accept-Encoding" });
        return res.end(body);
    }
    res.writeHead(status, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Xem thử: http://localhost:${PORT}`));
