// --- Мобильное меню разделов (дропдаун в шапке) ---
function toggleNavMenu(force) {
    const nav = document.getElementById("tabsNav");
    const toggle = document.getElementById("navMenuToggle");
    if (!nav) return;
    const open = typeof force === "boolean" ? force : !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
}
function closeNavMenu() {
    toggleNavMenu(false);
}
// Клик вне шапки — закрываем меню
document.addEventListener("click", (event) => {
    const nav = document.getElementById("tabsNav");
    if (!nav || !nav.classList.contains("is-open")) return;
    if (event.target.closest("#tabsNav") || event.target.closest("#navMenuToggle")) return;
    closeNavMenu();
});

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function switchTab(id, trigger = null) {
    closeNavMenu();
    const target = document.getElementById(id);
    if (!target) return;

    const currentTab = document.querySelector('.tab-content.active');
    if (currentTab) {
        tabScrollPositions[currentTab.id] = window.scrollY || window.pageYOffset || 0;
        if (currentTab.id === "search-tab" && typeof saveAdvKanbanScrollState === "function") {
            saveAdvKanbanScrollState();
        }
        if (currentTab.id !== "deal-tab") lastNonDealTabId = currentTab.id;
    }

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    target.classList.add('active');
    // Полноэкранный режим канбана (блокировка скролла страницы) — только на вкладке «Заказы БД».
    if (id !== "db-orders-tab") document.body.classList.remove("db-kanban-active");

    const activeBtn = trigger
        || (typeof event !== "undefined" ? event.currentTarget : null)
        || document.querySelector(`.tab-btn[data-tab-target="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    try {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, id);
    } catch (_) {}

    requestAnimationFrame(() => {
        window.scrollTo(0, tabScrollPositions[id] || 0);
        if (typeof applyCrmViewLayoutClass === "function") applyCrmViewLayoutClass();
        if (id === "search-tab" && typeof runAdvSearchOnTabOpen === "function") {
            runAdvSearchOnTabOpen();
        }
    });
}

function restoreAppUiState() {
    if (currentUser.role !== "staff" && currentUser.role !== "client") return;

    const savedTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || "main-tab";

    if (savedTab === "search-tab" && currentUser.role === "staff") {
        // активной делаем вкладку под текущий режим: Канбан → доска, Заказы → список
        const isKanban = typeof getCrmViewMode === "function" && getCrmViewMode() === "kanban";
        const btn = document.getElementById(isKanban ? "kanban-nav-btn" : "adv-tab-btn")
            || document.getElementById("adv-tab-btn");
        if (btn) {
            switchTab("search-tab", btn);
            return;
        }
    }

    if (savedTab === "deal-tab" && typeof readOpenDealState === "function") {
        const saved = readOpenDealState();
        if (saved?.dealId && typeof restoreOpenDealTab === "function") {
            restoreOpenDealTab();
            return;
        }
    }
}
function fillOptions(id, data, def) { let el = document.getElementById(id); el.innerHTML = ""; data.forEach(i => { let o = document.createElement("option"); o.value = i[1]; o.text = i[0]; if (i[0] === def) o.selected = true; el.appendChild(o); }); }
function fillFormatOptions(p) { let el = document.getElementById("format"); el.innerHTML = ""; let data = (p === "Наклейка") ? stickerFormats : (p === "Стикерпак" ? stickerPackFormats : commonFormats); for (let k in data) { let o = document.createElement("option"); o.value = k; o.text = Array.isArray(data[k]) ? `${k} (${data[k][0]}x${data[k][1]} мм)` : data[k]; el.appendChild(o); } }
function setFormat() { let f = document.getElementById("format").value, p = document.getElementById("product").value; let d = (p === "Наклейка") ? stickerFormats : (p === "Стикерпак" ? stickerPackFormats : commonFormats); if(d[f] && Array.isArray(d[f])){ document.getElementById("width").value = d[f][0]; document.getElementById("height").value = d[f][1]; } calcLayout(); }
function customFormat() { document.getElementById("format").value = "custom"; calcLayout(); }
function calcLayout() {
    let w = Number(document.getElementById("width").value), h = Number(document.getElementById("height").value);
    const sp = (typeof getSheetParams === "function") ? getSheetParams() : { width: SRA3_W, height: SRA3_H, gap: 2, margin: 5, marginPlotter: 15 };
    let p = document.getElementById("product").value;
    let m = (p === "Наклейка" && document.getElementById("cutMethod").value === "plotter") ? sp.marginPlotter : sp.margin, g = sp.gap;
    let ww = sp.width - (m * 2), wh = sp.height - (m * 2);
    let r1 = Math.floor((ww + g) / (w + g)) * Math.floor((wh + g) / (h + g));
    let r2 = Math.floor((ww + g) / (h + g)) * Math.floor((wh + g) / (w + g));
    document.getElementById("layout").value = Math.max(r1, r2) || 0;
    updateSchematic();
}

// Интерактивная схема-превью: пропорции прямоугольника = ширина/высота изделия
function updateSchematic() {
    const rect = document.getElementById("previewRect");
    if (!rect) return;
    const w = parseFloat(document.getElementById("width")?.value) || 0;
    const h = parseFloat(document.getElementById("height")?.value) || 0;
    const wl = document.getElementById("previewWidthLabel");
    const hl = document.getElementById("previewHeightLabel");
    if (wl) wl.textContent = w ? `${w} мм` : "—";
    if (hl) hl.textContent = h ? `${h} мм` : "—";
    if (w > 0 && h > 0) {
        const maxDim = 150; // макс. сторона прямоугольника в px
        const ratio = w / h;
        let rw, rh;
        if (ratio >= 1) { rw = maxDim; rh = maxDim / ratio; }
        else { rh = maxDim; rw = maxDim * ratio; }
        rect.style.width = `${Math.round(rw)}px`;
        rect.style.height = `${Math.round(rh)}px`;
    }
}
function updateType() {
    let t = document.getElementById("type").value, p = document.getElementById("product"); p.innerHTML = "";
    const sheetProducts = (typeof CALC_SHEET_PRODUCTS !== "undefined") ? CALC_SHEET_PRODUCTS : ["Визитка", "Листовка", "Открытка", "Наклейка", "Стикерпак", "Буклет", "Карточка", "Меню"];
    const catalogProducts = (typeof CALC_CATALOG_PRODUCTS !== "undefined") ? CALC_CATALOG_PRODUCTS : ["Каталог", "Презентация"];
    if(t === "sheet"){
        sheetProducts.forEach(x => p.add(new Option(x, x)));
        document.getElementById("catalogFields").style.display = "none"; document.getElementById("catalogPaper").style.display = "none";
        document.getElementById("sheetBlock").style.display = "block"; document.getElementById("layoutContainer").style.display = "block";
        document.getElementById("processOptions").style.display = "block";
        handleProductChange();
    } else {
        catalogProducts.forEach(x => p.add(new Option(x, x)));
        document.getElementById("catalogFields").style.display = "block"; document.getElementById("catalogPaper").style.display = "block";
        document.getElementById("sheetBlock").style.display = "none"; document.getElementById("layoutContainer").style.display = "none";
        document.getElementById("processOptions").style.display = "none";
        // бумаги обложки/блока — из правила для каталога
        if (typeof getProductRule === "function") {
            const rule = getProductRule(catalogProducts[0]);
            const paperPairs = materialOptionsFor("papers", rule.papers);
            fillMaterialSelect("paperCover", paperPairs, preferredOrFirst(rule.papers, "paper_300"));
            fillMaterialSelect("paperBlock", paperPairs, preferredOrFirst(rule.papers, "paper_150"));
        } else {
            fillOptions("paperCover", papersFull, "Бумага 300 гр."); fillOptions("paperBlock", papersFull, "Бумага 150 гр.");
        }
        fillFormatOptions("default"); document.getElementById("format").value = "A4"; setFormat();
    }
}

// Заполнить <select> парами [название, id], выбрать по id
function fillMaterialSelect(id, pairs, selectedId) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    (pairs || []).forEach(([name, val]) => {
        const o = document.createElement("option");
        o.value = val; o.text = name;
        if (val === selectedId) o.selected = true;
        el.appendChild(o);
    });
}

function handleProductChange() {
    let p = document.getElementById("product").value, t = document.getElementById("type").value;
    if (t !== "sheet") return;
    const isSticker = (p === "Наклейка" || p === "Стикерпак");
    document.getElementById("roundingContainer").style.display = isSticker ? "none" : "flex";

    // Списки материалов берём из настроек калькулятора (правила по типу продукции)
    if (typeof getProductRule === "function") {
        const rule = getProductRule(p);
        fillMaterialSelect("paper", materialOptionsFor("papers", rule.papers), preferredOrFirst(rule.papers, isSticker ? "sticker_paper" : "paper_300"));
        fillMaterialSelect("colorSheet", materialOptionsFor("colors", rule.colors), preferredOrFirst(rule.colors, "color_4_0"));
        fillMaterialSelect("lamSheet", materialOptionsFor("laminations", rule.laminations), preferredOrFirst(rule.laminations, "lam_none"));
    } else {
        // fallback на статические массивы
        if (isSticker) { fillOptions("paper", stickerPapers, "Самоклейка бумажная"); fillOptions("colorSheet", stickerColorOptions, "4+0"); fillOptions("lamSheet", stickerLamOptions, "Без ламинации"); }
        else { fillOptions("paper", papersFull, "Бумага 300 гр."); fillOptions("colorSheet", colorOptions, "4+0"); fillOptions("lamSheet", lamOptions, "Без ламинации"); }
    }
    fillFormatOptions(p);

    if (isSticker) {
        document.getElementById("format").value = (p === "Наклейка" ? "A5" : "A4");
        document.getElementById("stickerCutGroup").style.display = (p === "Наклейка") ? "block" : "none";
        document.getElementById("simpleCutGroup").style.display = (p === "Стикерпак") ? "none" : (p === "Наклейка" ? "none" : "block");
    } else {
        document.getElementById("simpleCutGroup").style.display = "block"; document.getElementById("stickerCutGroup").style.display = "none";
        document.getElementById("format").value = (p === "Визитка" ? "90x50" : "A5");
    }
    setFormat();
}

function validatePages() { if (document.getElementById("binding").value === "staple") { let p = document.getElementById("pages"); p.value = Math.ceil(p.value / 4) * 4; } }

function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSelectedOptionText(id) {
    const el = document.getElementById(id);
    if (!el || !el.selectedOptions || el.selectedOptions.length === 0) return "";
    return (el.selectedOptions[0].text || "").trim();
}

function formatLaminationPart(laminationText) {
    const normalized = (laminationText || "").trim();
    const hasLamination = normalized && !/^без\s*ламинац/i.test(normalized) && normalized !== "lam_none";
    return hasLamination ? `ламинация ${normalized}` : "";
}

function normalizePaperText(paperText) {
    let t = (paperText || "").trim();
    // Приводим к виду "бумага 100 гр." (как в примере пользователя)
    if (/^Бумага\s+/i.test(t)) {
        t = t.replace(/^Бумага\s+/i, "");
        return `бумага ${t}`;
    }
    if (!t) return "";
    return t.charAt(0).toLowerCase() + t.slice(1);
}

function buildFullNameForSheet() {
    // Формат: "<изделие> <размер>, <цветность>, <бумага>, <доп.характеристики>"
    const product = document.getElementById("product")?.value || "";
    const formatVal = document.getElementById("format")?.value || "";
    const w = Number(document.getElementById("width")?.value);
    const h = Number(document.getElementById("height")?.value);
    const size = (formatVal === "custom") ? `${w}x${h} мм` : formatVal;

    const colorText = getSelectedOptionText("colorSheet");
    const paperText = getSelectedOptionText("paper");
    const paperPart = normalizePaperText(paperText);

    const laminationPart = formatLaminationPart(getSelectedOptionText("lamSheet"));

    const extras = [];

    // Скругление углов показывается только если видим блок roundingContainer
    const roundingContainer = document.getElementById("roundingContainer");
    const roundingEl = document.getElementById("rounding");
    if (roundingContainer && roundingContainer.style.display !== "none" && roundingEl && roundingEl.checked) {
        extras.push("скругление углов");
    }

    // Плоттерная резка есть только в сценарии "Наклейка" (когда виден stickerCutGroup)
    const stickerCutGroup = document.getElementById("stickerCutGroup");
    const cutEl = document.getElementById("cut");
    const cutMethodEl = document.getElementById("cutMethod");
    if (stickerCutGroup && stickerCutGroup.style.display !== "none" && cutEl && cutEl.checked && cutMethodEl && cutMethodEl.value === "plotter") {
        extras.push("плоттерная резка");
    }

    const lamPartWithComma = laminationPart ? `, ${laminationPart}` : "";
    const extrasPart = extras.length ? ", " + extras.join(", ") : "";
    return `${product} ${size}, ${colorText}, ${paperPart}${lamPartWithComma}${extrasPart}`;
}

function buildFullNameForCatalog() {
    // Формат: "Каталог А5; 32 полосы; Обложка Бумага 300 гр., ламинация ...; Блок: Бумага 150 гр.; сборка на скобы"
    const product = document.getElementById("product")?.value || "";
    const formatVal = document.getElementById("format")?.value || "";
    const w = Number(document.getElementById("width")?.value);
    const h = Number(document.getElementById("height")?.value);
    const size = (formatVal === "custom") ? `${w}x${h} мм` : formatVal;

    const pages = Number(document.getElementById("pages")?.value || 0);
    const paperCover = getSelectedOptionText("paperCover");
    const coverLaminationPart = formatLaminationPart(getSelectedOptionText("lamCover"));
    const coverPart = coverLaminationPart ? `${paperCover}, ${coverLaminationPart}` : paperCover;
    const paperBlock = getSelectedOptionText("paperBlock");
    const binding = document.getElementById("binding")?.value;
    const bindingText = binding === "spring" ? "сборка на пружину" : "сборка на скобы";

    return `${product} ${size}; ${pages} полосы; Обложка ${coverPart}; Блок: ${paperBlock}; ${bindingText}`;
}

async function copyCustomerOrderText() {
    const textarea = document.getElementById("customerOrderText");
    const btn = document.getElementById("copyCustomerOrderBtn");
    if (!textarea) return;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textarea.value);
        } else {
            textarea.select();
            document.execCommand("copy");
            textarea.setSelectionRange(0, 0);
        }

        if (btn) {
            const oldText = btn.innerText;
            btn.innerText = "Скопировано";
            setTimeout(() => { btn.innerText = oldText; }, 1500);
        }
    } catch (e) {
        alert("Не удалось скопировать текст");
        console.error(e);
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const CYRILLIC_TO_LATIN = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "Zh", З: "Z", И: "I", Й: "Y",
    К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F",
    Х: "H", Ц: "Ts", Ч: "Ch", Ш: "Sh", Щ: "Sch", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
    ґ: "g", Ґ: "G", є: "ye", Є: "Ye", і: "i", І: "I", ї: "yi", Ї: "Yi"
};

function transliterateFileNamePart(value) {
    return String(value || "")
        .split("")
        .map(ch => CYRILLIC_TO_LATIN[ch] ?? ch)
        .join("");
}

function toSafeUploadFileName(name, fallback = "file") {
    const normalized = String(name || "").normalize("NFC").trim();
    if (!normalized) return `${fallback}.bin`;

    const lastDot = normalized.lastIndexOf(".");
    let base = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
    let ext = lastDot > 0 ? normalized.slice(lastDot + 1) : "";

    ext = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (ext === "jpeg") ext = "jpg";

    base = transliterateFileNamePart(base)
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/[^\w\s.\-+()]/g, "_")
        .replace(/[\s_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 150);

    if (!base) base = fallback;

    return ext ? `${base}.${ext}` : base;
}

function extractSra3SheetsFromTechInfo(techInfoHtml) {
    // Пытаемся вытащить число "листов SRA3" из server HTML.
    const html = String(techInfoHtml || "");
    const m1 = html.match(/(\d[\d\s]*)\s*листов?\s*SRA3/i);
    if (m1 && m1[1]) return Number(String(m1[1]).replace(/\s+/g, ""));
    const m2 = html.match(/SRA3[^0-9]{0,40}(\d[\d\s]*)/i);
    if (m2 && m2[1]) return Number(String(m2[1]).replace(/\s+/g, ""));
    return null;
}

function toFiniteNumber(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatCostBreakdown(costDetails, fallbackHtml = "") {
    if (costDetails && typeof costDetails === "object") {
        const parts = [
            ["Бумага", costDetails.paper],
            ["Печать", costDetails.print],
            ["Лам", costDetails.lamination],
            ["Резка", costDetails.cut],
            ["Сборка", costDetails.manual],
            ["Скругление", costDetails.rounding]
        ]
            .filter(([, value]) => Number(value) > 0)
            .map(([label, value]) => `${label}: ${Math.round(Number(value)).toLocaleString('ru-RU')} ₽`);

        return parts.join(" | ");
    }

    return fallbackHtml || "";
}

function getCatalogDivisorBySize(width, height) {
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    // Для каталогов используем "увеличение" до ближайшего формата:
    // A6 -> /16, A5 -> /8, всё что больше A5 -> /4 (A4 и крупнее)
    if (shortSide <= 105 && longSide <= 148) return 16;
    if (shortSide <= 148 && longSide <= 210) return 8;
    return 4;
}

function calculateSra3Sheets(type, tirazh, layout) {
    if (type === "sheet") {
        if (!layout || layout <= 0) return null;
        return Math.ceil(tirazh / layout);
    }

    // Каталоги: листов SRA3 = ceil((полосы / коэффициент формата) * тираж)
    const pages = Number(document.getElementById("pages")?.value);
    const width = Number(document.getElementById("width")?.value);
    const height = Number(document.getElementById("height")?.value);
    if (!pages || !width || !height || !tirazh) return null;

    const divisor = getCatalogDivisorBySize(width, height);
    return Math.ceil((pages / divisor) * tirazh);
}

function buildCustomerCopyText() {
    const fullName = lastCalcData?.fullName || lastCalcData?.name || "";
    const qty = Number(lastCalcData?.qty ?? 0);
    const priceOne = Number(lastCalcData?.pricePerOne ?? 0);
    const total = Number(lastCalcData?.total ?? 0);
    if (total > 0 && priceOne > 0) {
        return `${fullName}\n${qty} шт - ${total.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ₽ (${priceOne.toFixed(2)} ₽/шт)`;
    }
    if (priceOne > 0) {
        return `${fullName}\n${qty} шт - (${priceOne.toFixed(2)} ₽/шт)`;
    }
    return `${fullName}\n—`;
}

function formatPriceTotal(total) {
    return Number(total).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function refreshSelectedPriceUI(labelPrefix = null) {
    if (!lastCalcData) return;

    const pOne = Number(lastCalcData.pricePerOne ?? lastCalcData.priceOne ?? 0);
    const total = Number(lastCalcData.total ?? 0);
    const mult = lastCalcData.selectedMultiplier;
    const prefix = labelPrefix || (mult != null ? "Рекомендованная цена" : "Рекомендованная цена");
    const label = mult != null ? `${prefix} (x${mult})` : prefix;

    document.getElementById("recMultiplierLabel").innerText = label;
    document.getElementById("recPriceVal").innerHTML = `${formatPriceTotal(total)} ₽ <small>(${pOne.toFixed(2)} ₽/шт)</small>`;
}

function roundSelectedPrice(decimals) {
    if (!lastCalcData) return;

    const qty = Number(lastCalcData.qty ?? document.getElementById("tirazh")?.value ?? 0);
    const currentPOne = Number(lastCalcData.pricePerOne ?? lastCalcData.priceOne ?? 0);
    if (!qty || !currentPOne) return;

    const factor = Math.pow(10, decimals);
    const roundedPOne = Math.round(currentPOne * factor) / factor;
    const roundedTotal = Number((roundedPOne * qty).toFixed(2));

    lastCalcData.pricePerOne = roundedPOne;
    lastCalcData.priceOne = roundedPOne;
    lastCalcData.total = roundedTotal;

    refreshSelectedPriceUI("Выбранная цена");
    syncStaffTechAndCopyUI();
    if (typeof syncInlineEditInputs === "function") syncInlineEditInputs();
}

// Наценка — ряд кнопок-коэффициентов в синем блоке: серверные (x1.6…x2) +
// фиксированные дополнительные (x2.5, x3, x4, x5), считаемые от себестоимости.
const EXTRA_MARKUP_COEFS = [2.5, 3, 4, 5];

function makeCoefBtn(mult, selectedMultiplier) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rec-coef-btn";
    b.textContent = `x${mult}`;
    b.dataset.mult = String(mult);
    if (selectedMultiplier != null && Number(mult) === Number(selectedMultiplier)) b.classList.add("is-active");
    return b;
}

function renderMarkupSelect(markupList, costTotal, selectedMultiplier) {
    window.currentMarkupList = Array.isArray(markupList) ? markupList : [];
    window.currentCostTotal = Number(costTotal) || 0;

    const wrap = document.getElementById("markupCoefBtns");
    const row = document.getElementById("markupCoefRow");
    if (!wrap) return;

    wrap.innerHTML = "";
    const serverMults = new Set(window.currentMarkupList.map(m => Number(m.multiplier)));

    // Серверные наценки
    window.currentMarkupList.forEach((m, idx) => {
        const b = makeCoefBtn(m.multiplier, selectedMultiplier);
        b.dataset.idx = String(idx);
        b.title = `${Number(m.total).toLocaleString('ru-RU')} ₽ (${Number(m.perOne).toFixed(2)} ₽/шт)`;
        b.onclick = () => selectMarkupByIndex(idx);
        wrap.appendChild(b);
    });

    // Дополнительные коэффициенты (считаются от себестоимости на клиенте)
    const cost = window.currentCostTotal;
    const qty = getCalcQty();
    EXTRA_MARKUP_COEFS.forEach(coef => {
        if (serverMults.has(coef)) return;
        const b = makeCoefBtn(coef, selectedMultiplier);
        if (cost > 0) {
            const total = cost * coef;
            b.title = `${Math.round(total).toLocaleString('ru-RU')} ₽ (${qty ? (total / qty).toFixed(2) : "—"} ₽/шт)`;
        }
        b.onclick = () => selectExtraCoef(coef);
        wrap.appendChild(b);
    });

    if (row) row.style.display = window.currentMarkupList.length ? "" : "none";
}

function selectMarkupByIndex(idx) {
    const m = window.currentMarkupList && window.currentMarkupList[idx];
    if (!m) return;
    updateSelectedPrice(m.perOne, m.total, m.multiplier);
    highlightActiveCoef(m.multiplier);
    syncInlineEditInputs();
}

// Дополнительный коэффициент: цена = себестоимость × коэффициент
function selectExtraCoef(coef) {
    const cost = Number(window.currentCostTotal ?? lastCalcData?.costTotal ?? 0);
    if (!lastCalcData || !(coef > 0) || !(cost > 0)) return;
    const qty = getCalcQty();
    const total = Number((cost * coef).toFixed(2));
    const pOne = qty ? total / qty : 0;
    updateSelectedPrice(pOne, total, coef);
    highlightActiveCoef(coef);
    syncInlineEditInputs();
}

function highlightActiveCoef(mult) {
    document.querySelectorAll("#markupCoefBtns .rec-coef-btn").forEach(b => {
        b.classList.toggle("is-active", mult != null && Number(b.dataset.mult) === Number(mult));
    });
}

// Совместимость: старый обработчик дропдауна больше не используется.
function handleMarkupSelectChange() {}

function getCalcQty() {
    return Number(lastCalcData?.qty ?? document.getElementById("tirazh")?.value ?? 0) || 0;
}

// --- Инлайн-редактирование цены (шестерёнка делает блок редактируемым) ---
function toggleInlinePriceEdit(event) {
    if (event) event.stopPropagation();
    if (currentUser.role !== "staff" || !lastCalcData) return;
    const box = document.querySelector(".rec-price-box");
    const editing = box ? box.classList.toggle("is-editing") : false;
    const val = document.getElementById("recPriceVal");
    const edit = document.getElementById("recPriceEdit");
    const gear = document.getElementById("recPriceGear");
    if (val) val.hidden = !!editing;
    if (edit) edit.hidden = !editing;
    if (gear) gear.classList.toggle("is-active", !!editing);
    if (editing) {
        syncInlineEditInputs();
        const t = document.getElementById("editTotal");
        if (t) { t.focus(); t.select(); }
    }
}

// Выйти из режима редактирования (напр. при новом расчёте)
function exitInlinePriceEdit() {
    const box = document.querySelector(".rec-price-box");
    if (box) box.classList.remove("is-editing");
    const val = document.getElementById("recPriceVal");
    const edit = document.getElementById("recPriceEdit");
    const gear = document.getElementById("recPriceGear");
    if (val) val.hidden = false;
    if (edit) edit.hidden = true;
    if (gear) gear.classList.remove("is-active");
}

function syncInlineEditInputs() {
    const pOne = Number(lastCalcData?.pricePerOne ?? lastCalcData?.priceOne ?? 0);
    const total = Number(lastCalcData?.total ?? 0);
    const totEl = document.getElementById("editTotal");
    const perEl = document.getElementById("editPerOne");
    if (totEl && document.activeElement !== totEl) totEl.value = total ? total.toFixed(2) : "";
    if (perEl && document.activeElement !== perEl) perEl.value = pOne ? pOne.toFixed(2) : "";
}

function applyManualPerOne() {
    const v = parseFloat(document.getElementById("editPerOne")?.value);
    if (!lastCalcData || !(v > 0)) return;
    const qty = getCalcQty();
    updateSelectedPrice(v, Number((v * qty).toFixed(2)), null);
    highlightActiveCoef(null);
    syncInlineEditInputs();
}

function applyManualTotal() {
    const v = parseFloat(document.getElementById("editTotal")?.value);
    if (!lastCalcData || !(v > 0)) return;
    const qty = getCalcQty();
    const pOne = qty ? v / qty : 0;
    updateSelectedPrice(pOne, Number(v.toFixed(2)), null);
    highlightActiveCoef(null);
    syncInlineEditInputs();
}

function enableFullNameEdit() {
    const input = document.getElementById("staffFullNameInput");
    const text = document.getElementById("staffFullNameVal");

    if (!input || !text) return;

    input.value = lastCalcData?.fullName || lastCalcData?.name || "";
    text.style.display = "none";
    input.style.display = "block";
    input.focus();
    input.select();
}

function saveFullNameEdit() {
    const input = document.getElementById("staffFullNameInput");
    const text = document.getElementById("staffFullNameVal");

    if (!input || !lastCalcData) return;

    if (input.dataset.cancelEdit === "1") {
        input.dataset.cancelEdit = "";
        if (text) text.style.display = "";
        input.style.display = "none";
        syncStaffTechAndCopyUI();
        return;
    }

    const val = input.value.trim();
    if (val) {
        lastCalcData.fullName = val;
    }

    if (text) text.style.display = "";
    input.style.display = "none";
    syncStaffTechAndCopyUI();
}

function cancelFullNameEdit() {
    const input = document.getElementById("staffFullNameInput");
    const text = document.getElementById("staffFullNameVal");

    if (input) input.dataset.cancelEdit = "1";
    if (text) text.style.display = "";
    if (input) input.style.display = "none";
    syncStaffTechAndCopyUI();
}

function syncStaffTechAndCopyUI() {
    if (currentUser.role !== 'staff') return;
    if (!lastCalcData) return;

    const fullNameValEl = document.getElementById("staffFullNameVal");
    const sra3ValEl = document.getElementById("staffSra3Val");
    const markupValEl = document.getElementById("staffMarkupVal");
    const costBreakdownEl = document.getElementById("staffCostBreakdownVal");
    const costHqEl = document.getElementById("staffCostHqVal");
    const textareaEl = document.getElementById("customerOrderText");

    if (fullNameValEl) fullNameValEl.innerText = lastCalcData.fullName || lastCalcData.name || "";
    const fullNameInputEl = document.getElementById("staffFullNameInput");
    if (fullNameInputEl && fullNameInputEl.style.display !== "none") {
        fullNameInputEl.value = lastCalcData.fullName || lastCalcData.name || "";
    }
    if (sra3ValEl) sra3ValEl.innerText = (lastCalcData.sra3Sheets != null) ? String(lastCalcData.sra3Sheets) : "—";
    if (markupValEl) markupValEl.innerText = (lastCalcData.selectedMultiplier != null) ? `x${lastCalcData.selectedMultiplier}` : "—";
    if (costBreakdownEl) {
        const costTotal = Number(lastCalcData?.costTotal ?? NaN);
        const breakdownHtml = lastCalcData.costBreakdownHtml || "";
        if (Number.isFinite(costTotal)) {
            // Полная себестоимость + скобки с составом
            costBreakdownEl.innerHTML = `${costTotal.toLocaleString('ru-RU')} ₽ (${breakdownHtml})`;
        } else {
            costBreakdownEl.innerHTML = breakdownHtml || "—";
        }
    }
    if (costHqEl) {
        const costHQ = Number(lastCalcData?.costHQ ?? NaN);
        costHqEl.innerText = Number.isFinite(costHQ) ? `${Math.round(costHQ).toLocaleString('ru-RU')} ₽` : "—";
    }
    if (textareaEl) textareaEl.value = buildCustomerCopyText();
}

function renderStaffTechAndCopyUI() {
    const techContentEl = document.getElementById("techContent");
    if (!techContentEl) return;

    techContentEl.innerHTML = `
        <div class="section-title" style="margin-top: 0;">Для отправки заказчику</div>
        <div style="display:flex; align-items:stretch; gap:10px; margin-top:8px;">
            <textarea id="customerOrderText" rows="3" readonly
                style="display:none;"></textarea>
            <button id="copyCustomerOrderBtn" onclick="copyCustomerOrderText()" 
                style="margin:0; width:auto; align-self:flex-start; padding:10px 12px; font-size:12px; border-radius:6px;">Скопировать текст для заказчика</button>
        </div>

        <div class="section-title" style="margin-top: 18px;">Технические характеристики</div>
        <div style="margin-top: 8px; font-size: 14px; color: #333;">
            <div style="margin-bottom: 6px;">
                <span id="staffFullNameVal" onclick="enableFullNameEdit()" title="Нажмите, чтобы изменить"
                    style="display:block; cursor:text; border-bottom:1px dashed #b8c7d9;"></span>
                <input id="staffFullNameInput" type="text" onblur="saveFullNameEdit()" onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); } else if (event.key === 'Escape') { event.preventDefault(); cancelFullNameEdit(); }" style="display:none; margin-top:6px;">
            </div>
            <div style="margin-bottom: 6px;"><b>Количество листов SRA3:</b> <span id="staffSra3Val"></span></div>
            <div style="margin-bottom: 6px;"><b>Наценка:</b> <span id="staffMarkupVal"></span></div>
            <div style="margin-bottom: 6px;"><b>Себестоимость:</b> <span id="staffCostBreakdownVal"></span></div>
            <div style="margin-bottom: 6px;"><b>Себестоимость HQ:</b> <span id="staffCostHqVal"></span></div>
        </div>
    `;

    syncStaffTechAndCopyUI();
}

function updateSelectedPrice(pOne, total, mult) {
    // Обновляем данные для сохранения
    if (lastCalcData) {
        lastCalcData.total = total;
        // Обновляем оба поля, т.к. часть логики использует разные названия
        lastCalcData.pricePerOne = pOne;
        lastCalcData.priceOne = pOne;
        lastCalcData.selectedMultiplier = mult;
        refreshSelectedPriceUI("Выбранная цена");
        syncStaffTechAndCopyUI();
    }
}

