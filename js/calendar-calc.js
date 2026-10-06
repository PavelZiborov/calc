// --- Калькулятор квартального календаря (расчёт на нашем бэкенде) ---
const CAL_CALC_URL   = CLIENTS_URL.replace(/\/clients$/, "/calendar/calc");
const CAL_BLOCKS_URL = CLIENTS_URL.replace(/\/clients$/, "/calendar/blocks");

const calState = { size: "мини", fields: 0, block: null, blocksData: null, dims: null };

// Цвет-название → hex (для свотчей, пока нет картинок блоков).
const CAL_COLOR_HEX = {
    "белый": "#f3f4f6", "серый": "#b8bcc4", "серебристо-белый": "#e7eaef", "серебристо-голубой": "#cdd9e6",
    "голубой": "#a9cde8", "небесно-голубой": "#9fcdf0", "зеленый": "#bcd9b4", "весенне-зеленый": "#c6e2b3",
    "зеленовато-белый": "#e4efe0", "желтый": "#f3e3a6", "солнечно-желтый": "#f7df8a", "желтовато-белый": "#f4eed9",
    "бежевый": "#ece3cf", "золотисто-белый": "#f0e7cf", "красновато-белый": "#f2e2e0", "розовый": "#eccfd8",
    "сиреневый": "#d9cfe6", "абсолютно-сиреневый": "#cdbfe0", "оранжевый": "#f3d2a6", "леденцы": "#e9dcef",
};
function calColorHex(name) {
    const k = String(name || "").toLowerCase().trim();
    if (CAL_COLOR_HEX[k]) return CAL_COLOR_HEX[k];
    for (const key in CAL_COLOR_HEX) if (k.includes(key)) return CAL_COLOR_HEX[key];
    return "#dfe3ea";
}
function calMoney(v) { return (Math.round((Number(v) || 0) * 100) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function calInit() {
    const sz = document.getElementById("calSize"); if (sz) calState.size = sz.value;
    const fl = document.getElementById("calFields"); if (fl) calState.fields = Number(fl.value) || 0;
    if (!calState.block) calLoadBlocks(true); else { calUpdateBlockLabel(); calOnChange(); }
}
function calOnChange() {
    calState.size = document.getElementById("calSize")?.value || "мини";
    calState.fields = Number(document.getElementById("calFields")?.value || 0);
    // Размер влияет на список блоков (мини/миди/макси) — сбрасываем блок, если сменили размер.
    if (calState.blocksData && calState.blocksData.sizeCode && calState.blocksData.sizeCode !== calState.size) {
        calState.block = null;
        calLoadBlocks(true);
        return;
    }
    calRenderPreview();
    calComputePrice();
}
async function calLoadBlocks(pickDefault) {
    try {
        const r = await fetchWithTimeout(CAL_BLOCKS_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ size: calState.size }),
        }, 20000).then(x => x.json());
        // Показываем только блоки, для которых есть превью из архива. Цвета/серии без
        // картинки (их реально не было в архиве) не выводим — ни плитки, ни свотчи.
        if (r && Array.isArray(r.series)) {
            r.series = r.series
                .map(s => ({ ...s, colors: (s.colors || []).filter(c => c.imageUrl) }))
                .filter(s => s.colors.length);
        }
        calState.blocksData = r;
        if (pickDefault && Array.isArray(r.series) && r.series.length) {
            const s0 = r.series[0];
            const c0 = (s0.colors && s0.colors[0]) || null;
            if (c0) calState.block = { name: c0.name, series: s0.name, color: c0.color };
        }
        calUpdateBlockLabel();
    } catch (e) { console.error("calLoadBlocks", e); }
    calRenderPreview();
    calComputePrice();
}
function calUpdateBlockLabel() {
    const el = document.getElementById("calBlockLabel");
    if (!el) return;
    if (calState.block) {
        const dot = `<span class="cal-swatch" style="background:${calColorHex(calState.block.color)}"></span>`;
        el.innerHTML = `${dot}${calEsc(calState.block.series)}${calState.block.color ? " · " + calEsc(calState.block.color) : ""}`;
    } else el.textContent = "Выберите дизайн блока";
}
function calEsc(v) { return (typeof escapeHtml === "function") ? escapeHtml(String(v == null ? "" : v)) : String(v == null ? "" : v); }

// Схема-превью (SVG): постер + 3 блока, под каждым блоком — рекламное поле (как у Coral).
function calRenderPreview() {
    const host = document.getElementById("previewItem");
    if (!host) return;
    document.getElementById("previewLayout") && (document.getElementById("previewLayout").style.display = "none");
    document.getElementById("previewCaption") && (document.getElementById("previewCaption").textContent = "Схема квартального календаря");
    const DIMS = {
        "мини":  { poster: [297, 210], block: [297, 145], field: [297, 65] },
        "миди":  { poster: [335, 250], block: [335, 160], field: [335, 65] },
        "макси": { poster: [370, 290], block: [370, 170], field: [370, 65] },
    };
    const d = DIMS[calState.size] || DIMS["мини"];
    const W = d.poster[0], pH = d.poster[1], bH = d.block[1], fH = d.field[1];
    const nF = Math.max(0, Math.min(3, calState.fields));
    // Поля навешиваются снизу вверх: при 1 поле — только под нижним блоком, при 3 — под каждым.
    const hasField = i => i >= (3 - nF);
    const scaleW = 150, scale = scaleW / W, gap = 13 * scale;   // gap — зазор под пружину
    // Высота: постер + 3 блока + поля + 3 пружины (перед каждым блоком).
    const totalH = (pH + bH * 3 + fH * nF) * scale + gap * 3 + 16;
    const x = 8, labelX = x + scaleW + 16;
    const stroke = "#6b7280", spr = "#4b5563";
    const POSTER = "#d4d8df", FIELD = "#b7bcc6", BLK = ["#ffffff", "#e7eaef"];
    let y = 8, parts = [], labels = [];
    const rect = (h, fill, label) => {
        const hh = h * scale;
        parts.push(`<rect x="${x}" y="${y.toFixed(1)}" width="${scaleW}" height="${hh.toFixed(1)}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`);
        if (label) labels.push({ y: y + hh / 2, name: label[0], dims: label[1] });
        y += hh;
    };
    const spring = () => {
        const n = 9, w = scaleW / n, yc = y + gap / 2;
        for (let i = 0; i < n; i++)
            parts.push(`<path d="M ${(x + i * w).toFixed(1)} ${(y + 1).toFixed(1)} Q ${(x + i * w + w / 2).toFixed(1)} ${(yc + 3).toFixed(1)} ${(x + (i + 1) * w).toFixed(1)} ${(y + 1).toFixed(1)}" fill="none" stroke="${spr}" stroke-width="1.3"/>`);
        y += gap;
    };
    // Постер (с отверстием для подвеса).
    rect(pH, POSTER, [`Постер`, `${d.poster[0]}×${d.poster[1]} мм`]);
    parts.push(`<circle cx="${x + scaleW / 2}" cy="${(y - pH * scale + 8).toFixed(1)}" r="3" fill="#fff" stroke="${stroke}" stroke-width="1.2"/>`);
    for (let i = 0; i < 3; i++) {
        spring();
        rect(bH, BLK[i % 2], i === 0 ? [`Календарный блок`, `${d.block[0]}×${d.block[1]} мм`] : null);
        if (hasField(i)) rect(fH, FIELD, (nF && !labels.some(l => l.name === "Рекламное поле")) ? [`Рекламное поле`, `${d.field[0]}×${d.field[1]} мм`] : null);
    }
    const svgH = Math.ceil(y + 8);
    const lblSvg = labels.map(l => `
        <line x1="${x + scaleW}" y1="${l.y.toFixed(1)}" x2="${labelX - 4}" y2="${l.y.toFixed(1)}" stroke="${stroke}" stroke-width="1"/>
        <text x="${labelX}" y="${(l.y - 2).toFixed(1)}" font-size="11" font-weight="600" fill="#374151">${calEsc(l.name)}</text>
        <text x="${labelX}" y="${(l.y + 11).toFixed(1)}" font-size="10.5" fill="#6b7280">${calEsc(l.dims)}</text>`).join("");
    const svgW = labelX + 140;
    host.innerHTML = `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" style="width:100%;height:auto;max-height:480px">${parts.join("")}${lblSvg}</svg>`;
    host.style.display = "flex";
    host.style.width = "100%";
    host.style.justifyContent = "center";
    host.style.alignItems = "flex-start";
}

async function calComputePrice() {
    const qty = Math.max(1, Math.round(Number(document.getElementById("tirazh")?.value || 1)));
    const valEl = document.getElementById("recPriceVal");
    try {
        const r = await fetchWithTimeout(CAL_CALC_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ size: calState.size, fields: calState.fields, block: calState.block?.name, tirazh: qty }),
        }, 20000).then(x => x.json());
        if (!r || r.error) throw new Error(r && r.error);
        calState.dims = r.dims;
        // Показ цены в общем блоке результата.
        if (valEl) valEl.textContent = `${calMoney(r.total)} ₽`;
        const sub = document.getElementById("recMultiplierLabel");
        if (sub) sub.textContent = `${calMoney(r.perUnit)} ₽ за штуку${r.hasBlockPrice ? "" : " · нет цены блока!"}`;
        // Прячем листовые элементы управления ценой.
        ["recPriceGear", "markupCoefRow", "recRoundRow", "recPriceEdit"].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = "none"; });
        document.getElementById("resultMain") && (document.getElementById("resultMain").style.display = "block");
        // lastCalcData — чтобы работала кнопка «Добавить в расчёт».
        const sizeLabel = { "мини": "Мини", "миди": "Стандарт", "макси": "Макси" }[calState.size] || calState.size;
        const fieldsLabel = calState.fields === 0 ? "без полей" : (calState.fields === 1 ? "1 реклам. поле" : "3 реклам. поля");
        const blk = calState.block ? `, блок ${calState.block.series}${calState.block.color ? " " + calState.block.color : ""}` : "";
        const name = `Квартальный календарь ${sizeLabel}, ${fieldsLabel}${blk}`;
        window.lastCalcData = {
            name, fullName: name, qty, total: r.total, priceOne: r.perUnit, pricePerOne: r.perUnit,
            costTotal: r.breakdown ? Math.round(r.breakdown.costPerUnit * qty) : null,
            costHQ: null, sra3Sheets: null,
        };
        const addBtn = document.getElementById("addToSheetBtn"); if (addBtn) addBtn.style.display = "";
    } catch (e) {
        console.error("calComputePrice", e);
        if (valEl) valEl.textContent = "— ₽";
    }
}

// ---- Модалка «Дизайн блока» (как у Coral) ----
let calPickSeries = null, calPickColorName = null;
function calOpenBlockPicker() {
    let ov = document.getElementById("calPickerOverlay");
    if (!ov) {
        ov = document.createElement("div");
        ov.id = "calPickerOverlay";
        ov.className = "client-card-overlay cal-picker-overlay";
        ov.setAttribute("onclick", "if (event.target===this) calClosePicker()");
        document.body.appendChild(ov);
    }
    ov.innerHTML = `<div class="cal-picker">
        <div class="cal-picker-head"><h3>Дизайн блока</h3><button class="client-card-close" onclick="calClosePicker()" aria-label="Закрыть">&times;</button></div>
        <div class="cal-picker-body">
            <div class="cal-picker-series" id="calPickerSeries"></div>
            <div class="cal-picker-colors"><div class="cal-picker-colors-title" id="calPickerColorsTitle"></div><div class="cal-picker-colors-grid" id="calPickerColorsGrid" onmouseleave="calPickPreview(calPickColorName)"></div></div>
            <div class="cal-picker-preview"><div id="calPickerCaption" class="cal-picker-big-caption"></div><div id="calPickerBig" class="cal-picker-big"></div></div>
        </div>
        <div class="cal-picker-foot"><button class="cal-pick-select" onclick="calPickConfirm()">Выбрать</button></div>
    </div>`;
    ov.style.display = "flex";
    calRenderPicker();
}
function calClosePicker() { const ov = document.getElementById("calPickerOverlay"); if (ov) ov.style.display = "none"; }
function calRenderPicker() {
    const data = calState.blocksData;
    const seriesHost = document.getElementById("calPickerSeries");
    if (!data || !Array.isArray(data.series) || !data.series.length) {
        if (seriesHost) seriesHost.innerHTML = `<p class="cal-picker-empty">Нет блоков для этого размера.</p>`;
        return;
    }
    // Группировка: мелованные / офсетные.
    const coated = [], offset = [];
    data.series.forEach(s => (/офсет/i.test(s.name) ? offset : coated).push(s));
    if (!calPickSeries) calPickSeries = (calState.block && calState.block.series) || data.series[0].name;
    const grp = (title, arr) => arr.length ? `<div class="cal-picker-grp-title">${calEsc(title)}</div>` + arr.map(s =>
        `<button type="button" class="cal-series-row${s.name === calPickSeries ? " is-active" : ""}" onclick="calPickSelectSeries('${calEsc(s.name).replace(/'/g, "\\'")}')">${calEsc(s.name)}${s.name === calPickSeries ? ' <svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>' : ""}</button>`).join("") : "";
    seriesHost.innerHTML = grp("Мелованные блоки", coated) + grp("Офсетные блоки", offset);
    calRenderPickerColors();
}
function calPickSelectSeries(name) { calPickSeries = name; calPickColorName = null; calRenderPicker(); }
function calRenderPickerColors() {
    const data = calState.blocksData;
    const s = (data.series || []).find(x => x.name === calPickSeries);
    const grid = document.getElementById("calPickerColorsGrid");
    const title = document.getElementById("calPickerColorsTitle");
    if (!s) { if (grid) grid.innerHTML = ""; return; }
    // Выбранный цвет (подтверждается кликом). Если прежний отсутствует в серии — берём первый.
    if (!s.colors.some(c => c.color === calPickColorName)) calPickColorName = s.colors.length ? s.colors[0].color : null;
    grid.innerHTML = s.colors.map(c => {
        const img = c.imageUrl ? `<img src="${calEsc(c.imageUrl)}" alt="">` : `<span class="cal-color-swatch" style="background:${calColorHex(c.color)}"></span>`;
        const cn = calEsc(c.color).replace(/'/g, "\\'");
        return `<button type="button" class="cal-color-thumb${c.color === calPickColorName ? " is-active" : ""}" title="${calEsc(c.color)}"
            onmouseenter="calPickPreview('${cn}')" onclick="calPickSelect('${cn}')">${img}</button>`;
    }).join("");
    calPickPreview(calPickColorName);   // большое превью — выбранного цвета
}
// Наведение — только показать большое превью (выбор НЕ меняется).
function calPickPreview(color) {
    const data = calState.blocksData;
    const s = (data.series || []).find(x => x.name === calPickSeries);
    const c = s && s.colors.find(x => x.color === color);
    const big = document.getElementById("calPickerBig");
    const title = document.getElementById("calPickerColorsTitle");
    const cap = document.getElementById("calPickerCaption");
    if (title) title.textContent = color ? `Цвет: ${color}` : "";
    if (big) big.innerHTML = c && c.imageUrl ? `<img src="${calEsc(c.imageUrl)}" alt="">` : `<span class="cal-big-swatch" style="background:${calColorHex(color)}"></span>`;
    if (cap) cap.textContent = c ? c.name : "";
}
// Клик — подтвердить выбор цвета (рамка остаётся на выбранном).
function calPickSelect(color) {
    calPickColorName = color;
    document.querySelectorAll("#calPickerColorsGrid .cal-color-thumb").forEach(b => b.classList.toggle("is-active", b.title === color));
    calPickPreview(color);
}
function calPickConfirm() {
    const data = calState.blocksData;
    const s = (data.series || []).find(x => x.name === calPickSeries);
    const c = s && s.colors.find(x => x.color === calPickColorName);
    if (c) { calState.block = { name: c.name, series: s.name, color: c.color }; calUpdateBlockLabel(); calComputePrice(); }
    calClosePicker();
}
