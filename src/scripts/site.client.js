/* Script chung của website — build.mjs ghép SITE_CONFIG vào đầu file này rồi xuất ra assets/js/site.js
   (tải defer, không chặn hiển thị). Trang vẫn dùng được khi tắt JS: slider/bộ lọc/menu chạy bằng CSS.
   1. Menu mobile   2. Ảnh slider hoãn tải   3. Slider trang chủ tự chạy   4. Video tải chậm
   5. Tìm kiếm      6. Form liên hệ          7. Google Analytics (nếu cấu hình) */
(function () {
    "use strict";
    var script = document.currentScript || document.querySelector('script[src*="site.js"]');
    var ROOT = new URL("../../", script.src); // gốc website, suy từ vị trí file này
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };

    /* ---------- 1. Menu mobile: đóng khi chọn mục / nhấn Esc ---------- */
    var navToggle = document.getElementById("nav-toggle");
    var searchToggle = document.getElementById("search-toggle");
    function setNav(open) {
        navToggle.checked = open;
        document.documentElement.classList.toggle("nav-open", open); // khoá cuộn trang khi menu mở (CSS)
    }
    if (navToggle) {
        navToggle.addEventListener("change", function () { setNav(navToggle.checked); });
        document.querySelectorAll(".nav a").forEach(function (a) {
            a.addEventListener("click", function () { setNav(false); });
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (navToggle && navToggle.checked) { setNav(false); navToggle.focus(); }
        if (searchToggle && searchToggle.checked) { searchToggle.checked = false; searchToggle.focus(); }
    });

    // Mở thẳng link có #muc (vd ./#lien-he): font/ảnh tải xong làm nội dung phía trên giãn ra → căn lại vị trí
    if (location.hash.length > 1) {
        var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        var startY = window.scrollY;
        if (target) {
            window.addEventListener("load", function () {
                if (Math.abs(window.scrollY - startY) < 50) target.scrollIntoView(); // người xem chưa tự cuộn
            });
        }
    }

    /* ---------- 2. Ảnh slider hoãn tải: slide 2..n chỉ tải khi sắp được xem ---------- */
    function loadSlide(slide) {
        if (!slide) return;
        slide.querySelectorAll("[data-srcset], [data-src]").forEach(function (el) {
            if (el.dataset.srcset) { el.srcset = el.dataset.srcset; el.removeAttribute("data-srcset"); }
            if (el.dataset.src) { el.src = el.dataset.src; el.removeAttribute("data-src"); }
        });
    }
    function slidesOf(slider) { return slider.querySelectorAll(".slider__slide"); }
    function currentIndex(slider) {
        var radios = slider.querySelectorAll(".slider__radio");
        for (var i = 0; i < radios.length; i++) if (radios[i].checked) return i;
        return 0;
    }
    // Tải slide đang xem + slide kế tiếp (để bấm "tiếp" là có ngay)
    function prime(slider) {
        var s = slidesOf(slider), i = currentIndex(slider);
        loadSlide(s[i]);
        loadSlide(s[(i + 1) % s.length]);
    }
    var sliders = document.querySelectorAll(".slider");
    sliders.forEach(function (slider) {
        slider.addEventListener("change", function () { prime(slider); });
        // Di chuột / chạm vào slider → chuẩn bị luôn ảnh trước & sau
        slider.addEventListener("pointerenter", function () {
            var s = slidesOf(slider), i = currentIndex(slider);
            loadSlide(s[(i - 1 + s.length) % s.length]);
        }, { once: true });
    });
    // Sau khi trang tải xong và trình duyệt rảnh → tải sẵn slide kế tiếp
    window.addEventListener("load", function () {
        idle(function () { sliders.forEach(prime); });
    });

    /* ---------- 3. Slider trang chủ tự chuyển ảnh ---------- */
    document.querySelectorAll(".slider[data-autoplay]").forEach(function (slider) {
        if (reduceMotion) return;
        var radios = slider.querySelectorAll(".slider__radio");
        var paused = false, stopped = false;
        slider.addEventListener("pointerenter", function () { paused = true; });
        slider.addEventListener("pointerleave", function () { paused = false; });
        slider.addEventListener("focusin", function () { paused = true; });
        slider.addEventListener("focusout", function () { paused = false; });
        // Người xem tự chuyển ảnh → dừng tự chạy, tôn trọng lựa chọn của họ
        slider.addEventListener("click", function (e) { if (e.isTrusted && e.target.closest("label")) stopped = true; });
        setInterval(function () {
            if (paused || stopped || document.hidden) return;
            var rect = slider.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > innerHeight) return; // đã cuộn khỏi màn hình
            var next = radios[(currentIndex(slider) + 1) % radios.length];
            loadSlide(slidesOf(slider)[(currentIndex(slider) + 2) % radios.length]);
            next.checked = true;
            next.dispatchEvent(new Event("change", { bubbles: true }));
        }, 6500);
    });

    /* ---------- 4. Video tải chậm: thay ảnh bìa bằng trình phát khi bấm ▶ ---------- */
    document.addEventListener("click", function (e) {
        var link = e.target.closest("a[data-video]");
        if (!link) return;
        e.preventDefault();
        var poster = link.querySelector("img");
        var video = document.createElement("video");
        video.src = link.href;
        video.controls = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = "auto";
        if (poster) video.poster = poster.currentSrc || poster.src;
        video.width = 540;
        video.height = 960;
        video.setAttribute("aria-label", link.getAttribute("aria-label").replace("Phát video: ", ""));
        link.replaceWith(video);
        video.focus(); // giữ vị trí bàn phím trên trình phát vừa xuất hiện
        var p = video.play();
        if (p && p.catch) p.catch(function () { video.setAttribute("data-blocked", ""); }); // trình duyệt chặn tự phát → người xem bấm play
    });

    /* ---------- 5. Tìm kiếm tức thì (chỉ mục chỉ tải khi mở ô tìm kiếm) ---------- */
    (function () {
        var form = document.querySelector(".search");
        var input = document.getElementById("q");
        if (!searchToggle || !form || !input) return;

        var list = document.createElement("ul");
        list.className = "search__results";
        list.id = "search-results";
        list.setAttribute("role", "listbox");
        list.setAttribute("aria-label", "Kết quả tìm kiếm");
        form.appendChild(list);
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-controls", "search-results");
        input.setAttribute("aria-expanded", "false");
        input.setAttribute("aria-autocomplete", "list");
        input.setAttribute("autocomplete", "off");

        var items = null, loading = null, results = [], active = -1;

        // Bỏ dấu tiếng Việt để "biet thu" khớp "Biệt thự"
        function norm(s) {
            return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
        }
        function loadIndex() {
            if (items || loading) return loading;
            loading = new Promise(function (resolve) {
                var s = document.createElement("script");
                s.src = new URL(SITE_CONFIG.searchIndex, ROOT).href;
                s.onload = function () {
                    items = (window.SEARCH_INDEX || []).map(function (it) {
                        return { it: it, name: norm(it.name), text: norm(it.name + " " + it.cat + " " + it.keys) };
                    });
                    resolve();
                    render();
                };
                s.onerror = function () { items = []; resolve(); };
                document.head.appendChild(s);
            });
            return loading;
        }

        function search(q) {
            var words = norm(q).trim().split(/\s+/).filter(Boolean);
            if (!words.length || !items) return [];
            return items
                .map(function (x) {
                    var score = 0;
                    for (var i = 0; i < words.length; i++) {
                        if (x.text.indexOf(words[i]) < 0) return null; // mọi từ đều phải khớp
                        score += x.name.indexOf(words[i]) >= 0 ? 3 : 1; // khớp tên được ưu tiên
                    }
                    if (x.name.indexOf(words.join(" ")) === 0) score += 5;
                    return { it: x.it, score: score };
                })
                .filter(Boolean)
                .sort(function (a, b) { return b.score - a.score; })
                .slice(0, 8)
                .map(function (r) { return r.it; });
        }
        function esc(s) {
            return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
        }
        function setActive(i) {
            var opts = list.querySelectorAll('[role="option"]');
            active = opts.length ? (i + opts.length) % opts.length : -1;
            opts.forEach(function (o, k) { o.setAttribute("aria-selected", k === active ? "true" : "false"); });
            if (active >= 0) {
                opts[active].scrollIntoView({ block: "nearest" });
                input.setAttribute("aria-activedescendant", opts[active].id);
            } else {
                input.removeAttribute("aria-activedescendant");
            }
        }
        function render() {
            var q = input.value.trim();
            results = search(q);
            if (!q) {
                list.innerHTML = "";
            } else if (!items) {
                list.innerHTML = '<li class="search__empty">Đang tải…</li>';
            } else if (!results.length) {
                list.innerHTML = '<li class="search__empty">Không tìm thấy kết quả cho “' + esc(q) + "”</li>";
            } else {
                list.innerHTML = results
                    .map(function (it, i) {
                        return (
                            '<li role="option" id="sr-' + i + '" aria-selected="false">' +
                            '<a href="' + new URL(it.url, ROOT).href + '" tabindex="-1">' +
                            (it.img ? '<img src="' + new URL(it.img, ROOT).href + '" alt="" width="64" height="48" loading="lazy">' : '<span class="search__icon" aria-hidden="true">→</span>') +
                            "<span><strong>" + esc(it.name) + "</strong><small>" + esc(it.cat) + "</small></span></a></li>"
                        );
                    })
                    .join("");
            }
            input.setAttribute("aria-expanded", results.length ? "true" : "false");
            setActive(results.length ? 0 : -1);
        }
        function open() {
            searchToggle.checked = true;
            loadIndex();
            setTimeout(function () { input.focus(); }, 50);
        }

        input.addEventListener("focus", loadIndex);
        input.addEventListener("input", render);
        input.addEventListener("keydown", function (e) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
        });
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (active >= 0 && results[active]) location.href = new URL(results[active].url, ROOT).href;
        });
        searchToggle.addEventListener("change", function () { if (searchToggle.checked) open(); });
        // Rê chuột vào nút tìm kiếm → tải sẵn chỉ mục (≈10 KB)
        var btn = document.querySelector('label[for="search-toggle"]');
        if (btn) btn.addEventListener("pointerenter", loadIndex, { once: true });
        // Bấm ra ngoài → đóng
        document.addEventListener("click", function (e) {
            if (searchToggle.checked && !e.target.closest(".search, .search-toggle, label[for='search-toggle']")) searchToggle.checked = false;
        });
        // Phím tắt "/" để mở tìm kiếm
        document.addEventListener("keydown", function (e) {
            if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) {
                e.preventDefault();
                open();
            }
        });
    })();

    /* ---------- 6. Form liên hệ ---------- */
    document.querySelectorAll("form[data-contact]").forEach(function (form) {
        var status = form.querySelector(".contact-form__status");
        var button = form.querySelector('button[type="submit"]');
        function say(msg, ok) {
            status.textContent = msg;
            status.className = "contact-form__status" + (ok ? " is-ok" : ok === false ? " is-error" : "");
        }
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            if (!form.checkValidity()) {
                var bad = form.querySelector(":invalid");
                say(bad && bad.name === "phone" ? "Vui lòng nhập số điện thoại hợp lệ (9–15 chữ số)." : "Vui lòng nhập họ tên và số điện thoại.", false);
                if (bad) bad.focus();
                return;
            }
            var d = new FormData(form);
            var data = {
                name: d.get("name"),
                phone: d.get("phone"),
                need: d.get("need"),
                message: d.get("message"),
                page: location.href,
            };
            if (SITE_CONFIG.formEndpoint) {
                // Gửi thẳng tới dịch vụ form (vd Formspree) — khách không cần mở email
                button.disabled = true;
                say("Đang gửi…");
                fetch(SITE_CONFIG.formEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(data),
                })
                    .then(function (r) {
                        if (!r.ok) throw new Error(r.status);
                        form.reset();
                        say("Đã gửi! Athens sẽ liên hệ lại với bạn trong thời gian sớm nhất.", true);
                    })
                    .catch(function () { say("Chưa gửi được. Vui lòng gọi hoặc nhắn Zalo cho chúng tôi.", false); })
                    .then(function () { button.disabled = false; });
                return;
            }
            // Chưa cấu hình dịch vụ form → mở ứng dụng email với nội dung soạn sẵn
            var body = "Họ tên: " + data.name + "\nĐiện thoại/Zalo: " + data.phone + "\nNhu cầu: " + data.need + "\n\n" + (data.message || "") + "\n\n— Gửi từ: " + data.page;
            location.href = "mailto:" + SITE_CONFIG.email + "?subject=" + encodeURIComponent("Yêu cầu tư vấn – " + data.name) + "&body=" + encodeURIComponent(body);
            say("Đang mở ứng dụng email… Nếu không thấy, hãy gọi hoặc nhắn Zalo cho chúng tôi.", true);
        });
    });

    /* ---------- 7. Google Analytics: chỉ tải khi có mã, sau khi trang đã hiện xong ---------- */
    if (SITE_CONFIG.analyticsId) {
        window.addEventListener("load", function () {
            idle(function () {
                var s = document.createElement("script");
                s.async = true;
                s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(SITE_CONFIG.analyticsId);
                document.head.appendChild(s);
                window.dataLayer = window.dataLayer || [];
                window.gtag = function () { window.dataLayer.push(arguments); };
                window.gtag("js", new Date());
                window.gtag("config", SITE_CONFIG.analyticsId);
            });
        });
    }
})();
