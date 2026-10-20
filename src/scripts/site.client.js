/* Script chung của website — build.mjs ghép SITE_CONFIG vào đầu file này rồi xuất ra assets/js/site.js
   (tải defer, không chặn hiển thị). Trang vẫn dùng được khi tắt JS: slider/bộ lọc/menu chạy bằng CSS.
   1. Menu mobile   2. Ảnh slider hoãn tải   3. Slider trang chủ tự chạy   4. Video tải chậm + album ảnh
   5. Tìm kiếm      6. Form liên hệ          7. Google Analytics + pixel quảng cáo (nếu cấu hình) */
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
    // Dải ảnh nhỏ: cuộn ngang để ảnh đang xem luôn nằm giữa (dự án có tới vài chục ảnh)
    function revealThumb(slider) {
        var strip = slider.querySelector(".slider__thumbs");
        var thumb = strip && strip.children[currentIndex(slider)];
        if (!thumb) return;
        strip.scrollTo({
            left: thumb.offsetLeft - strip.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2,
            behavior: reduceMotion ? "auto" : "smooth",
        });
    }
    var sliders = document.querySelectorAll(".slider");
    sliders.forEach(function (slider) {
        slider.addEventListener("change", function () { prime(slider); revealThumb(slider); });
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

    // Chỉ một video phát tại một thời điểm: bấm phát video khác → video đang phát tự dừng
    document.addEventListener("play", function (e) {
        document.querySelectorAll(".video video").forEach(function (v) {
            if (v !== e.target && !v.paused) v.pause();
        });
    }, true);

    /* ---------- 4b. Album ảnh (trang Thi công): thu gọn + trình xem ảnh phóng to ---------- */
    document.querySelectorAll(".gallery[data-more]").forEach(function (list) {
        list.classList.add("is-collapsed");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn--ghost gallery__more";
        btn.textContent = list.dataset.more;
        btn.addEventListener("click", function () {
            list.classList.remove("is-collapsed");
            btn.remove();
        });
        list.after(btn);
    });

    var lightboxLinks = document.querySelectorAll("a[data-lightbox]");
    if (lightboxLinks.length && window.HTMLDialogElement) {
        var icon = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>'; };
        var box = document.createElement("dialog");
        box.className = "lightbox";
        box.setAttribute("aria-label", "Xem ảnh");
        box.innerHTML =
            '<figure class="lightbox__figure"><img alt=""><figcaption class="lightbox__caption"><span></span><p></p></figcaption></figure>' +
            '<button type="button" class="lightbox__btn lightbox__close" aria-label="Đóng">' + icon("M6 6l12 12M18 6 6 18") + "</button>" +
            '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Ảnh trước">' + icon("M15 5l-7 7 7 7") + "</button>" +
            '<button type="button" class="lightbox__btn lightbox__next" aria-label="Ảnh tiếp theo">' + icon("M9 5l7 7-7 7") + "</button>";
        document.body.appendChild(box);
        var boxImg = box.querySelector("img");
        var boxCount = box.querySelector(".lightbox__caption span");
        var boxText = box.querySelector(".lightbox__caption p");
        var group = [], at = 0;
        var show = function (i) {
            at = (i + group.length) % group.length;
            var a = group[at];
            if (boxImg.getAttribute("src") !== a.getAttribute("href")) boxImg.classList.add("is-loading");
            boxImg.src = a.href;
            boxImg.alt = a.dataset.caption;
            boxText.textContent = a.dataset.caption;
            boxCount.textContent = (at + 1) + " / " + group.length;
            // Tải trước ảnh kế tiếp để bấm "tiếp" là hiện ngay
            new Image().src = group[(at + 1) % group.length].href;
        };
        lightboxLinks.forEach(function (a) {
            a.addEventListener("click", function (e) {
                e.preventDefault();
                group = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox="' + a.dataset.lightbox + '"]'));
                show(group.indexOf(a));
                box.showModal();
            });
        });
        box.querySelector(".lightbox__close").addEventListener("click", function () { box.close(); });
        box.querySelector(".lightbox__prev").addEventListener("click", function () { show(at - 1); });
        box.querySelector(".lightbox__next").addEventListener("click", function () { show(at + 1); });
        box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lightbox__figure")) box.close(); });
        box.addEventListener("keydown", function (e) {
            if (e.key === "ArrowLeft") show(at - 1);
            if (e.key === "ArrowRight") show(at + 1);
        });
        // Vuốt ngang trên điện thoại
        var startX = null;
        box.addEventListener("pointerdown", function (e) { startX = e.clientX; });
        box.addEventListener("pointerup", function (e) {
            if (startX === null) return;
            var dx = e.clientX - startX;
            if (Math.abs(dx) > 50) show(at + (dx < 0 ? 1 : -1));
            startX = null;
        });
        boxImg.addEventListener("load", function () { boxImg.classList.remove("is-loading"); });
        boxImg.addEventListener("error", function () { boxImg.classList.remove("is-loading"); });
        box.addEventListener("close", function () { boxImg.removeAttribute("src"); });
    }

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

        // Nút xoá riêng (thay nút × mặc định của trình duyệt): chỉ hiện khi đã gõ
        var clear = form.querySelector(".search__clear");
        function syncClear() { if (clear) clear.hidden = !input.value; }
        if (clear) clear.addEventListener("click", function () {
            input.value = "";
            syncClear();
            render();
            input.focus();
        });

        input.addEventListener("focus", loadIndex);
        input.addEventListener("input", function () { syncClear(); render(); });
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
    // Nguồn khách: không hỏi mà tự nhận từ link quảng cáo (utm_*, fbclid, gclid, ttclid) hoặc trang dẫn tới.
    // Lưu theo phiên → khách vào từ quảng cáo rồi xem vài trang mới gửi form vẫn giữ đúng nguồn.
    var visitSource = (function () {
        var KEY = "athens-source";
        try { var saved = sessionStorage.getItem(KEY); if (saved) return saved; } catch (e) {}
        var q = new URLSearchParams(location.search), src = "";
        if (q.get("utm_source")) src = [q.get("utm_source"), q.get("utm_medium"), q.get("utm_campaign")].filter(Boolean).join(" / ");
        else if (q.get("fbclid")) src = "Quảng cáo Facebook";
        else if (q.get("gclid")) src = "Quảng cáo Google";
        else if (q.get("ttclid")) src = "Quảng cáo TikTok";
        else if (document.referrer) {
            var host = new URL(document.referrer).hostname;
            if (host !== location.hostname) src = host.replace(/^(www|m|l|lm)\./, "");
        }
        src = src || "Truy cập trực tiếp";
        try { sessionStorage.setItem(KEY, src); } catch (e) {}
        return src;
    })();

    document.querySelectorAll("form[data-contact]").forEach(function (form) {
        var status = form.querySelector(".contact-form__status");
        var button = form.querySelector('button[type="submit"]');
        function say(msg, ok) {
            status.textContent = msg;
            status.className = "contact-form__status" + (ok ? " is-ok" : ok === false ? " is-error" : "");
        }
        // Báo lỗi ngay dưới ô nhập sai; gõ lại là lỗi biến mất
        function markInvalid(input, msg) {
            var field = input.closest(".field");
            var err = field.querySelector(".field__error");
            if (!err) {
                err = document.createElement("p");
                err.className = "field__error";
                err.id = input.id + "-error";
                field.appendChild(err);
                input.setAttribute("aria-describedby", err.id);
            }
            err.textContent = msg;
            field.classList.add("is-invalid");
            input.setAttribute("aria-invalid", "true");
        }
        form.addEventListener("input", function (e) {
            var field = e.target.closest(".field.is-invalid");
            if (field && e.target.checkValidity()) {
                field.classList.remove("is-invalid");
                e.target.removeAttribute("aria-invalid");
            }
        });
        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var name = form.elements.name, phone = form.elements.phone;
            var bad = [];
            if (!name.value.trim()) { markInvalid(name, "Vui lòng cho Athens biết cách xưng hô."); bad.push(name); }
            if (!phone.checkValidity()) {
                markInvalid(phone, phone.value.trim() ? "Số điện thoại chưa đúng (9–15 chữ số)." : "Vui lòng nhập số điện thoại để Athens gọi lại.");
                bad.push(phone);
            }
            if (bad.length) { say(""); bad[0].focus(); return; }

            var d = new FormData(form);
            form.elements.source.value = visitSource;
            // Nhãn tiếng Việt cho từng ô — dùng làm nội dung thư gửi về Athens
            var fields = [
                ["name", "Họ tên"], ["phone", "Điện thoại/Zalo"], ["type", "Quan tâm"], ["service", "Cần"],
                ["budget", "Ngân sách"], ["timeline", "Dự định bắt đầu"], ["location", "Địa điểm"],
                ["message", "Ghi chú"],
            ];
            var data = {};
            fields.forEach(function (f) { data[f[0]] = (d.get(f[0]) || "").trim(); });
            var leadName = data.type || data.service; // gửi kèm sự kiện Lead cho nền tảng quảng cáo
            // Chỉ liệt kê ô đã điền → thư nhận được đọc ngay không cần đoán
            var lines = fields.filter(function (f) { return data[f[0]]; }).map(function (f) { return f[1] + ": " + data[f[0]]; });
            lines.push("Nguồn: " + visitSource);
            if (SITE_CONFIG.formEndpoint) {
                // Gửi thẳng tới dịch vụ form (vd Formspree) — khách không cần mở email
                button.disabled = true;
                say("Đang gửi…");
                fetch(SITE_CONFIG.formEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                        _subject: "Yêu cầu tư vấn – " + data.name + (leadName ? " – " + leadName : ""),
                        "Nội dung": lines.join("\n"),
                        "Gửi từ trang": location.href,
                    }),
                })
                    .then(function (r) {
                        if (!r.ok) throw new Error(r.status);
                        showThanks(form, data);
                        trackLead(leadName);
                    })
                    .catch(function () {
                        say("Chưa gửi được do lỗi kết nối. Vui lòng thử lại hoặc gọi / nhắn Zalo cho Athens.", false);
                        button.disabled = false;
                    });
                return;
            }
            // Chưa cấu hình dịch vụ form → mở ứng dụng email với nội dung soạn sẵn
            var body = lines.join("\n") + "\n\n— Gửi từ: " + location.href;
            location.href = "mailto:" + SITE_CONFIG.email + "?subject=" + encodeURIComponent("Yêu cầu tư vấn – " + data.name) + "&body=" + encodeURIComponent(body);
            say("Đang mở ứng dụng email… Nếu không thấy, hãy gọi hoặc nhắn Zalo cho Athens.", true);
            trackLead(leadName);
        });
    });
    // Gửi xong: thay form bằng lời cảm ơn rõ ràng (khách biết chắc đã gửi, không bấm gửi lặp lại)
    function showThanks(form, data) {
        var box = document.createElement("div");
        box.className = "contact-form__done";
        box.setAttribute("role", "status");
        box.tabIndex = -1;
        var title = document.createElement("p");
        title.className = "contact-form__title";
        title.textContent = "Cảm ơn " + data.name + "!";
        var text = document.createElement("p");
        text.textContent = "Athens đã nhận yêu cầu và sẽ gọi lại cho bạn qua số " + data.phone + " trong thời gian sớm nhất.";
        box.appendChild(title);
        box.appendChild(text);
        form.replaceChildren(box);
        box.focus();
    }

    /* ---------- 7. Google Analytics + pixel quảng cáo (Meta, TikTok, Google Ads): chỉ tải khi có mã ----------
       Hàm stub được tạo ngay để sự kiện gọi sớm vẫn vào hàng đợi; file script thật tải sau khi trang hiện xong.
       Pixel quảng cáo tải ngay khi `load` (không đợi rảnh) để không mất lượt xem của khách thoát nhanh. */
    function addScript(src) {
        var s = document.createElement("script");
        s.async = true;
        s.src = src;
        document.head.appendChild(s);
    }
    function afterLoad(fn) {
        if (document.readyState === "complete") fn();
        else window.addEventListener("load", fn);
    }
    var gtagId = SITE_CONFIG.analyticsId || SITE_CONFIG.googleAdsId;
    if (gtagId) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag("js", new Date());
        if (SITE_CONFIG.analyticsId) window.gtag("config", SITE_CONFIG.analyticsId);
        if (SITE_CONFIG.googleAdsId) window.gtag("config", SITE_CONFIG.googleAdsId);
        afterLoad(function () {
            var load = function () { addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gtagId)); };
            if (SITE_CONFIG.googleAdsId) load(); else idle(load);
        });
    }
    if (SITE_CONFIG.fbPixelId) {
        var fbq = (window.fbq = window._fbq = function () {
            fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
        });
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        fbq("init", SITE_CONFIG.fbPixelId);
        fbq("track", "PageView");
        afterLoad(function () { addScript("https://connect.facebook.net/en_US/fbevents.js"); });
    }
    if (SITE_CONFIG.tiktokPixelId) {
        // Stub chính thức của TikTok, rút gọn: lưu lệnh vào hàng đợi cho tới khi events.js tải xong
        var ttq = (window.ttq = window.ttq || []);
        window.TiktokAnalyticsObject = "ttq";
        ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
        ttq.setAndDefer = function (t, m) { t[m] = function () { t.push([m].concat(Array.prototype.slice.call(arguments, 0))); }; };
        ttq.methods.forEach(function (m) { ttq.setAndDefer(ttq, m); });
        ttq.instance = function (id) {
            var e = ttq._i[id] || [];
            ttq.methods.forEach(function (m) { ttq.setAndDefer(e, m); });
            return e;
        };
        var ttId = SITE_CONFIG.tiktokPixelId;
        var ttSrc = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[ttId] = [];
        ttq._i[ttId]._u = ttSrc;
        ttq._t = ttq._t || {};
        ttq._t[ttId] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[ttId] = {};
        ttq.page();
        afterLoad(function () { addScript(ttSrc + "?sdkid=" + encodeURIComponent(ttId) + "&lib=ttq"); });
    }

    // Sự kiện chuyển đổi gửi tới mọi nền tảng đã gắn
    function trackLead(need) {
        if (window.fbq) window.fbq("track", "Lead", { content_name: need || "" });
        if (window.ttq) window.ttq.track("SubmitForm", { content_name: need || "" });
        if (window.gtag) {
            if (SITE_CONFIG.analyticsId) window.gtag("event", "generate_lead", { lead_source: need || "" });
            if (SITE_CONFIG.googleAdsLead) window.gtag("event", "conversion", { send_to: SITE_CONFIG.googleAdsLead });
        }
    }
    function trackContact(method) {
        if (window.fbq) window.fbq("track", "Contact", { content_name: method });
        if (window.ttq) window.ttq.track("Contact", { content_name: method });
        if (window.gtag && SITE_CONFIG.analyticsId) window.gtag("event", "contact", { method: method });
    }
    if (window.fbq || window.ttq || window.gtag) {
        document.addEventListener("click", function (e) {
            var a = e.target.closest && e.target.closest("a[href]");
            if (!a) return;
            var href = a.getAttribute("href");
            if (href.indexOf("tel:") === 0) trackContact("phone");
            else if (href.indexOf("zalo.me") !== -1) trackContact("zalo");
            else if (href.indexOf("m.me/") !== -1 || href.indexOf("messenger.com") !== -1) trackContact("messenger");
        });
    }
})();
