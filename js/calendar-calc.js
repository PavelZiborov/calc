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

// Схема-превью (SVG): постер + 3 блока + N рекламных полей, с размерами (как у Coral).
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
    const nF = calState.fields;
    const gap = 10;            // зазор под пружину
    const totalH = pH + bH * 3 + fH * nF + gap * (3 + nF);
    const scaleW = 150, scale = scaleW / W;
    const svgW = scaleW + 110, svgH = totalH * scale + 20;
    const x = 6, col = "#9aa0aa", fill = "#fff", stroke = "#c4c9d2";
    let y = 10, parts = [], labels = [];
    const rect = (h, label) => {
        const hh = h * scale;
        parts.push(`<rect x="${x}" y="${y.toFixed(1)}" width="${scaleW}" height="${hh.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`);
        if (label) labels.push({ y: y + hh / 2, text: label });
        y += hh;
    };
    const spring = () => {
        parts.push(`<rect x="${x}" y="${y.toFixed(1)}" width="${scaleW}" height="${(gap * scale).toFixed(1)}" fill="none"/>`);
        // пунктир пружины
        parts.push(`<line x1="${x}" y1="${(y + gap * scale / 2).toFixed(1)}" x2="${x + scaleW}" y2="${(y + gap * scale / 2).toFixed(1)}" stroke="${col}" stroke-width="1.4" stroke-dasharray="3 2"/>`);
        y += gap * scale;
    };
    // отверстие постера
    parts.push(`<circle cx="${x + scaleW / 2}" cy="${(y + 4).toFixed(1)}" r="2" fill="none" stroke="${col}"/>`);
    rect(pH, `Постер ${d.poster[0]}×${d.poster[1]} мм`); spring();
    rect(bH, `Календарный блок ${d.block[0]}×${d.block[1]} мм`); spring();
    rect(bH, ""); spring();
    rect(bH, ""); if (nF) spring();
    for (let i = 0; i < nF; i++) { rect(fH, i === 0 ? `Рекламное поле ${d.field[0]}×${d.field[1]} мм` : ""); if (i < nF - 1) spring(); }
    const lblSvg = labels.map(l => `
        <line x1="${x + scaleW}" y1="${l.y.toFixed(1)}" x2="${x + scaleW + 14}" y2="${l.y.toFixed(1)}" stroke="${col}" stroke-width="1"/>
        <text x="${x + scaleW + 18}" y="${(l.y + 3).toFixed(1)}" font-size="8" fill="${col}">${calEsc(l.text)}</text>`).join("");
    host.innerHTML = `<svg viewBox="0 0 ${svgW} ${Math.ceil(svgH)}" width="${svgW}" style="width:${svgW}px;max-width:100%;height:auto;max-height:420px">${parts.join("")}${lblSvg}</svg>`;
    host.style.display = "flex";
    host.style.width = "100%";
    host.style.minWidth = "200px";
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
            <div class="cal-picker-colors"><div class="cal-picker-colors-title" id="calPickerColorsTitle"></div><div class="cal-picker-colors-grid" id="calPickerColorsGrid"></div></div>
            <div class="cal-picker-preview"><div id="calPickerBig" class="cal-picker-big"></div></div>
        </div>
        <div class="cal-picker-foot"><span id="calPickerCaption" class="cal-picker-caption"></span><button class="cal-pick-select" onclick="calPickConfirm()">Выбрать</button></div>
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
    if (!calPickColorName && s.colors.length) calPickColorName = s.colors[0].color;
    if (title) title.textContent = calPickColorName ? `Цвет: ${calPickColorName}` : "";
    grid.innerHTML = s.colors.map(c => {
        const img = c.imageUrl ? `<img src="${calEsc(c.imageUrl)}" alt="">` : `<span class="cal-color-swatch" style="background:${calColorHex(c.color)}"></span>`;
        return `<button type="button" class="cal-color-thumb${c.color === calPickColorName ? " is-active" : ""}" title="${calEsc(c.color)}"
            onmouseenter="calPickHover('${calEsc(c.color).replace(/'/g, "\\'")}')" onclick="calPickHover('${calEsc(c.color).replace(/'/g, "\\'")}')">${img}</button>`;
    }).join("");
    calPickHover(calPickColorName);
}
function calPickHover(color) {
    calPickColorName = color;
    const data = calState.blocksData;
    const s = (data.series || []).find(x => x.name === calPickSeries);
    const c = s && s.colors.find(x => x.color === color);
    const big = document.getElementById("calPickerBig");
    const title = document.getElementById("calPickerColorsTitle");
    if (title) title.textContent = color ? `Цвет: ${color}` : "";
    if (big) big.innerHTML = c && c.imageUrl ? `<img src="${calEsc(c.imageUrl)}" alt="">` : `<span class="cal-big-swatch" style="background:${calColorHex(color)}"></span>`;
    document.querySelectorAll("#calPickerColorsGrid .cal-color-thumb").forEach(b => b.classList.toggle("is-active", b.title === color));
    const cap = document.getElementById("calPickerCaption");
    if (cap && c) cap.textContent = `${(data && data.year) || ""} · ${c.name}`.trim();
}
function calPickConfirm() {
    const data = calState.blocksData;
    const s = (data.series || []).find(x => x.name === calPickSeries);
    const c = s && s.colors.find(x => x.color === calPickColorName);
    if (c) { calState.block = { name: c.name, series: s.name, color: c.color }; calUpdateBlockLabel(); calComputePrice(); }
    calClosePicker();
}
