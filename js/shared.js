// Общие функции, которыми пользуются живые разделы (Заказы БД, Клиенты, Производство,
// Подрядчики, калькулятор). Вынесены из удалённых легаси-модулей crm.js и element-editor.js
// (старый раздел «Заказы (API)»/«Канбан» на n8n).

// ---- из crm.js ----
// Единый набор иконок (Tabler Icons, outline 2px). Inline-SVG через currentColor —
// иконки наследуют цвет и размер текста, единый стиль вместо разнородных эмодзи.
const ICONS = {
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" />',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />',
  x: '<path d="M18 6l-12 12" /><path d="M6 6l12 12" />',
  user: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />',
  copy: '<path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />',
  edit: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />',
  eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />',
  trash: '<path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />',
  link: '<path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" />',
  clip: '<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />',
  mail: '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" />',
  telegram: '<path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />',
  bellOff: '<path d="M9.346 5.353c.21 -.129 .428 -.246 .654 -.353a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3m-1 3h-13a4 4 0 0 0 2 -3v-3a6.996 6.996 0 0 1 1.273 -3.707" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /><path d="M3 3l18 18" />',
  alert: '<path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" />',
  check: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" />',
  box: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /><path d="M16 5.25l-8 4.5" />',
  photo: '<path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />',
  loader: '<path d="M12 3a9 9 0 1 0 9 9" />',
  send: '<path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />',
  filter: '<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227" />',
  list: '<path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" />',
  kanban: '<path d="M4 4l6 0" /><path d="M14 4l6 0" /><path d="M4 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -8" /><path d="M14 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2" />',
  printer: '<path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /><path d="M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4" />',
  scissors: '<path d="M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.6 8.6l10.4 10.4" /><path d="M8.6 15.4l10.4 -10.4" />',
  circle: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />',
  eyeOff: '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" />',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />',
  phone: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" />',
  save: '<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" />',
  camera: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />'
};

// Возвращает inline-SVG иконки. opts: { cls, spin, size } (size в px переопределяет 1.1em).
function icon(name, opts = {}) {
  const paths = ICONS[name];
  if (!paths) return '';
  const cls = 'icn' + (opts.spin ? ' icn-spin' : '') + (opts.cls ? ' ' + opts.cls : '');
  const sizeStyle = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${sizeStyle}>${paths}</svg>`;
}

// Закрытие модалок по клику на фон — но НЕ когда выделяешь текст в поле и
// случайно отпускаешь мышь за пределами окна (drag-out). Закрываем только если
// И нажатие (mousedown), И клик пришлись на сам оверлей (фон), а не на содержимое.
// Использование: на оверлее onmousedown="overlayDown(event)"
//                          onclick="if(overlayClickedSelf(event)) closeX()"
let _overlayDownTarget = null;

function overlayDown(event) { _overlayDownTarget = event.target; }

function overlayClickedSelf(event) {
    const onSelf = event.target === event.currentTarget && _overlayDownTarget === event.currentTarget;
    _overlayDownTarget = null;
    return onSelf;
}

// Функция для определения иконок и цветов статуса
function getStatusIcon(statusName) {
    const name = (statusName || "").toLowerCase().trim();
    if (!name || name === "без статуса") return { icon: icon("circle"), color: "#95a5a6", label: "Без статуса" };
    if (name === "печать") return { icon: icon("printer"), color: "#2F6BD8", label: "Печать" };
    if (name === "постпечать") return { icon: icon("scissors"), color: "#b06a1f", label: "Постпечать" };
    if (name === "завершено") return { icon: icon("check"), color: "#1F9D55", label: "Завершено" };
    return { icon: icon("box"), color: "#7a766c", label: statusName || "Статус" };
}

// Telegram-ник контакта: из явного поля telegram, иначе парсим email/имя
// (ник мог быть вписан в поле email по конвенции «mail@ya.ru @nick»).
function contactTelegramNick(contact) {
    if (!contact) return "";
    if (contact.telegram) return String(contact.telegram).replace(/^@/, "");
    return parseContactReach(contact.email).telegram || parseContactReach(contact.name).telegram || "";
}

// Чистый email контакта (поле email может содержать «email @nick»).
function contactEmailAddr(contact) {
    if (!contact) return "";
    return parseContactReach(contact.email).email || "";
}

function buildContactLabel(contact) {
    const email = contactEmailAddr(contact);
    const tgNick = contactTelegramNick(contact);
    // Имя — главное; показываем телефон, email и @ник (видно сразу, без редактирования).
    const bits = [];
    if (contact.phone) bits.push(String(contact.phone).trim());
    if (email) bits.push(email);
    if (tgNick) bits.push("@" + tgNick);
    const reach = bits.join(" · ");
    const rawName = contact.name != null ? String(contact.name).trim() : "";
    const invalid = !rawName || rawName === "NaN" || rawName === "null" || rawName === "undefined"
        || rawName === reach || rawName === email || rawName === (tgNick ? "@" + tgNick : "\0") || rawName === contact.phone;
    const name = invalid ? "" : rawName;
    const parts = [];
    if (name) parts.push(name);
    if (reach) parts.push(reach);
    return parts.join(" · ") || "(без имени)";
}

// ISO/Postgres timestamp -> "ДД.ММ.ГГГГ ЧЧ:ММ" в локальном времени.
function formatNotifySentAt(raw) {
    if (!raw) return "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    const p = n => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Маска российского номера: +7 (XXX) XXX XX XX
function maskRuPhone(input) {
    let v = String(input.value || "").replace(/\D/g, "");
    if (!v) { input.value = ""; return; }
    if (v[0] === "8") v = "7" + v.slice(1);
    if (v[0] !== "7") v = "7" + v;
    v = v.slice(0, 11);
    const r = v.slice(1); // до 10 цифр после «7»
    let out = "+7";
    if (r.length) out += " (" + r.slice(0, 3);
    if (r.length >= 3) out += ") " + r.slice(3, 6);
    if (r.length >= 6) out += " " + r.slice(6, 8);
    if (r.length >= 8) out += " " + r.slice(8, 10);
    input.value = out;
}

// «zzipp@inbox.ru @paulgt» → { email, telegram }. Любое одно тоже ок.
function parseContactReach(raw) {
    const str = String(raw || "").trim();
    let email = "";
    let telegram = "";
    const em = str.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (em) email = em[0];
    const rest = email ? str.replace(email, " ") : str;
    const tg = rest.match(/@([A-Za-z][A-Za-z0-9_]{3,31})/);
    if (tg) telegram = tg[1];
    else if (!email) {
        const bare = rest.trim().replace(/^@/, "");
        if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(bare)) telegram = bare;
    }
    return { email, telegram };
}

function showReadinessToast(message) {
    let toast = document.getElementById("readinessToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "readinessToast";
        toast.className = "readiness-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    // reflow для перезапуска анимации
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("is-visible"), 5000);
}

// ---- из element-editor.js ----
const MAX_PREVIEW_BYTES = 512000;

async function parseApiResponse(response) {
    const text = await response.text();
    if (!text || !text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
    }
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("compress failed"));
        }, mimeType, quality);
    });
}

async function loadPreviewImageSource(file) {
    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("image load failed"));
            image.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function compressPreviewImage(file) {
    if (file.size <= MAX_PREVIEW_BYTES) return file;

    const image = await loadPreviewImageSource(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const outputMime = "image/jpeg";
    const baseName = String(file.name || "preview").replace(/\.[^.]+$/, "") || "preview";
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    let quality = 0.92;

    while (width >= 64 && height >= 64) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        let blob = await canvasToBlob(canvas, outputMime, quality);
        while (blob.size > MAX_PREVIEW_BYTES && quality > 0.45) {
            quality -= 0.08;
            blob = await canvasToBlob(canvas, outputMime, quality);
        }
        if (blob.size <= MAX_PREVIEW_BYTES) {
            return new File([blob], `${baseName}.jpg`, { type: outputMime });
        }

        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
        quality = 0.88;
    }

    throw new Error("preview too large");
}

// --- Авто-превью из PDF-макета (pdf.js подгружается лениво, только при первом использовании) ---
const PDFJS_ASSET_TAG = "3.11.174";

let __pdfJsLoadPromise = null;

function ensurePdfJs() {
    const applyWorker = (lib) => {
        try { lib.GlobalWorkerOptions.workerSrc = `js/pdf.worker.min.js?p=${PDFJS_ASSET_TAG}`; } catch (e) {}
        return lib;
    };
    if (window.pdfjsLib) return Promise.resolve(applyWorker(window.pdfjsLib));
    if (__pdfJsLoadPromise) return __pdfJsLoadPromise;
    __pdfJsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `js/pdf.min.js?p=${PDFJS_ASSET_TAG}`;
        script.onload = () => {
            if (!window.pdfjsLib) { __pdfJsLoadPromise = null; reject(new Error("pdfjsLib missing after load")); return; }
            resolve(applyWorker(window.pdfjsLib));
        };
        script.onerror = () => { __pdfJsLoadPromise = null; reject(new Error("pdf.js load error")); };
        document.head.appendChild(script);
    });
    return __pdfJsLoadPromise;
}

function isPdfFile(file) {
    return !!file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""));
}

// Рендер первой страницы PDF в JPEG-файл
async function renderPdfFirstPageToImageFile(file, baseName = "preview") {
    const pdfjsLib = await ensurePdfJs();
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    try {
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const targetWidth = 1240;
        const scale = Math.min(3, Math.max(0.5, targetWidth / (base.width || targetWidth)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
        const safeBase = String(baseName || "preview").replace(/\.[^.]+$/, "") || "preview";
        return new File([blob], `${safeBase}.jpg`, { type: "image/jpeg" });
    } finally {
        try { await pdf.cleanup?.(); } catch (e) {}
        try { pdf.destroy?.(); } catch (e) {}
    }
}

async function uploadFileToYandexUrl(uploadUrl, file, mimeType = null, onProgress = null, timeoutMs = UPLOAD_TIMEOUT_MS) {
    if (typeof onProgress !== "function") {
        const response = await fetchWithTimeout(uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
                "Content-Type": mimeType || file.type || "application/octet-stream"
            }
        }, timeoutMs);

        if (!response.ok) {
            throw new Error(`Yandex upload failed (${response.status})`);
        }
        return;
    }

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.timeout = timeoutMs;
        xhr.setRequestHeader("Content-Type", mimeType || file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                onProgress(event.loaded / event.total);
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
                return;
            }
            reject(new Error(`Yandex upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Yandex upload failed"));
        xhr.ontimeout = () => reject(new Error("Yandex upload timeout"));
        xhr.send(file);
    });
}
