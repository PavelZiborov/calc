// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function switchTab(id, trigger = null) {
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

    const activeBtn = trigger
        || (typeof event !== "undefined" ? event.currentTarget : null)
        || document.querySelector(`.tab-btn[data-tab-target="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    requestAnimationFrame(() => {
        window.scrollTo(0, tabScrollPositions[id] || 0);
        if (typeof applyCrmViewLayoutClass === "function") applyCrmViewLayoutClass();
        if (id === "search-tab" && typeof runAdvSearchOnTabOpen === "function") {
            runAdvSearchOnTabOpen();
        }
    });
}
function fillOptions(id, data, def) { let el = document.getElementById(id); el.innerHTML = ""; data.forEach(i => { let o = document.createElement("option"); o.value = i[1]; o.text = i[0]; if (i[0] === def) o.selected = true; el.appendChild(o); }); }
function fillFormatOptions(p) { let el = document.getElementById("format"); el.innerHTML = ""; let data = (p === "Наклейка") ? stickerFormats : (p === "Стикерпак" ? stickerPackFormats : commonFormats); for (let k in data) { let o = document.createElement("option"); o.value = k; o.text = Array.isArray(data[k]) ? `${k} (${data[k][0]}x${data[k][1]} мм)` : data[k]; el.appendChild(o); } }
function setFormat() { let f = document.getElementById("format").value, p = document.getElementById("product").value; let d = (p === "Наклейка") ? stickerFormats : (p === "Стикерпак" ? stickerPackFormats : commonFormats); if(d[f] && Array.isArray(d[f])){ document.getElementById("width").value = d[f][0]; document.getElementById("height").value = d[f][1]; } calcLayout(); }
function customFormat() { document.getElementById("format").value = "custom"; calcLayout(); }
function calcLayout() {
    let w = Number(document.getElementById("width").value), h = Number(document.getElementById("height").value);
    let p = document.getElementById("product").value, m = (p === "Наклейка" && document.getElementById("cutMethod").value === "plotter") ? 15 : 5, g = 2;
    let ww = SRA3_W - (m * 2), wh = SRA3_H - (m * 2);
    let r1 = Math.floor((ww + g) / (w + g)) * Math.floor((wh + g) / (h + g));
    let r2 = Math.floor((ww + g) / (h + g)) * Math.floor((wh + g) / (w + g));
    document.getElementById("layout").value = Math.max(r1, r2) || 0;
}
function updateType() {
    let t = document.getElementById("type").value, p = document.getElementById("product"); p.innerHTML = "";
    if(t === "sheet"){
        ["Визитка", "Листовка", "Открытка", "Наклейка", "Стикерпак", "Буклет", "Карточка", "Меню"].forEach(x => p.add(new Option(x, x)));
        document.getElementById("catalogFields").style.display = "none"; document.getElementById("catalogPaper").style.display = "none";
        document.getElementById("sheetBlock").style.display = "block"; document.getElementById("layoutContainer").style.display = "block";
        document.getElementById("processOptions").style.display = "block";
        handleProductChange();
    } else {
        ["Каталог", "Презентация"].forEach(x => p.add(new Option(x, x)));
        document.getElementById("catalogFields").style.display = "block"; document.getElementById("catalogPaper").style.display = "block";
        document.getElementById("sheetBlock").style.display = "none"; document.getElementById("layoutContainer").style.display = "none";
        document.getElementById("processOptions").style.display = "none";
        fillOptions("paperCover", papersFull, "Бумага 300 гр."); fillOptions("paperBlock", papersFull, "Бумага 150 гр.");
        fillFormatOptions("default"); document.getElementById("format").value = "A4"; setFormat();
    }
}

function handleProductChange() {
    let p = document.getElementById("product").value, t = document.getElementById("type").value;
    if (t === "sheet") {
        document.getElementById("roundingContainer").style.display = (p === "Наклейка" || p === "Стикерпак") ? "none" : "flex";
        if (p === "Наклейка" || p === "Стикерпак") {
            fillOptions("paper", stickerPapers, "Самоклейка бумажная"); fillOptions("colorSheet", stickerColorOptions, "4+0"); fillFormatOptions(p);
                // Для наклеек оставляем только 32 мкм 1+0 и "Без ламинации"
                fillOptions("lamSheet", stickerLamOptions, "Без ламинации");
            document.getElementById("format").value = (p === "Наклейка" ? "A5" : "A4");
            document.getElementById("stickerCutGroup").style.display = (p === "Наклейка") ? "block" : "none";
            document.getElementById("simpleCutGroup").style.display = (p === "Стикерпак") ? "none" : (p === "Наклейка" ? "none" : "block");
        } else {
            fillOptions("paper", papersFull, "Бумага 300 гр."); fillOptions("colorSheet", colorOptions, "4+0"); fillFormatOptions(p);
            // Возвращаем полный список ламинаций для обычных изделий
            fillOptions("lamSheet", lamOptions, "Без ламинации");
            document.getElementById("simpleCutGroup").style.display = "block"; document.getElementById("stickerCutGroup").style.display = "none";
            document.getElementById("format").value = (p === "Визитка" ? "90x50" : "A5");
        }
        setFormat();
    }
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
}

function renderMarkupSelect(markupList, costTotal, selectedMultiplier) {
    const container = document.getElementById("markupSelectContainer");
    const select = document.getElementById("markupSelect");
    if (!container || !select) return;

    window.currentMarkupList = Array.isArray(markupList) ? markupList : [];
    select.innerHTML = "";

    window.currentMarkupList.forEach((m, idx) => {
        const o = document.createElement("option");
        o.value = String(idx);
        o.text = `Наценка x${m.multiplier} — ${Number(m.total).toLocaleString('ru-RU')} ₽ (${Number(m.perOne).toFixed(2)} ₽/шт) при себестоимости ${Number(costTotal).toLocaleString('ru-RU')} ₽`;
        if (selectedMultiplier != null && Number(m.multiplier) === Number(selectedMultiplier)) {
            o.selected = true;
        }
        select.appendChild(o);
    });

    container.style.display = window.currentMarkupList.length ? "block" : "none";
}

function handleMarkupSelectChange() {
    const select = document.getElementById("markupSelect");
    if (!select || !window.currentMarkupList) return;

    const item = window.currentMarkupList[Number(select.value)];
    if (!item) return;

    updateSelectedPrice(item.perOne, item.total, item.multiplier);
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

