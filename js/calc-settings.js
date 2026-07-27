// --- НАСТРОЙКИ КАЛЬКУЛЯТОРА (staff) ---
// Модель настроек калькулятора: размер печатного листа, зазор/поля,
// списки материалов (бумаги/цветность/ламинация/постпечать) и правила
// «какие материалы показывать для какого типа продукции».
//
// ФАЗА 1 (эта версия): всё живёт на клиенте (localStorage) и сразу влияет на
// то, что клиент считает локально (изделий на SRA3, layout) и на выпадашки.
// Флаг hqExcluded у бумаги пока только хранится — на серверный расчёт себест.
// HQ он повлияет после интеграции n8n/Postgres (ФАЗА 2, бэкенд-деливери).
//
// Персистентность спроектирована под API: loadCalcSettings() сначала пытается
// GET с сервера (если задан CALC_SETTINGS_API), иначе берёт localStorage;
// saveCalcSettings() пишет и туда, и туда.

const CALC_SETTINGS_STORAGE_KEY = "calc_settings_v1";
// Когда бэкенд будет готов — сюда прописать URL вебхука load/save (ФАЗА 2).
const CALC_SETTINGS_API = null;

// Типы продукции (совпадают с тем, что генерит updateType())
const CALC_SHEET_PRODUCTS = ["Визитка", "Листовка", "Открытка", "Наклейка", "Стикерпак", "Буклет", "Карточка", "Меню"];
const CALC_CATALOG_PRODUCTS = ["Каталог", "Презентация"];
const CALC_STICKER_PRODUCTS = ["Наклейка", "Стикерпак"];

let calcSettings = null; // кэш активных настроек

function _idsOf(pairs) {
    return (pairs || []).map(p => p[1]);
}

// Построить дефолтную модель из текущих массивов calculator-data.js
function defaultCalcSettings() {
    // Бумаги: объединяем полный список и самоклейки (в т.ч. HQ-варианты)
    const paperMap = new Map();
    (papersFull || []).forEach(([name, id]) => paperMap.set(id, { id, name, hqExcluded: false }));
    (stickerPapers || []).forEach(([name, id]) => {
        if (!paperMap.has(id)) {
            // «_hq» варианты — бумага не учитывается в себестоимости HQ
            paperMap.set(id, { id, name, hqExcluded: /_hq$/i.test(id) });
        }
    });

    const colorMap = new Map();
    [...(colorOptions || []), ...(stickerColorOptions || [])].forEach(([name, id]) => {
        if (!colorMap.has(id)) colorMap.set(id, { id, name });
    });

    const lamMap = new Map();
    [...(lamOptions || []), ...(stickerLamOptions || [])].forEach(([name, id]) => {
        if (!lamMap.has(id)) lamMap.set(id, { id, name });
    });

    // Постпечать — отдельная категория (пока справочно, для будущего расчёта)
    const postpress = [
        { id: "cut", name: "Резка" },
        { id: "rounding", name: "Скругление углов" },
        { id: "plotter", name: "Плоттерная резка" },
    ];

    const stickerPaperIds = _idsOf(stickerPapers);
    const fullPaperIds = _idsOf(papersFull);
    const stickerColorIds = _idsOf(stickerColorOptions);
    const fullColorIds = _idsOf(colorOptions);
    const stickerLamIds = _idsOf(stickerLamOptions);
    const fullLamIds = _idsOf(lamOptions);

    const rule = (isSticker) => ({
        papers: isSticker ? [...stickerPaperIds] : [...fullPaperIds],
        colors: isSticker ? [...stickerColorIds] : [...fullColorIds],
        laminations: isSticker ? [...stickerLamIds] : [...fullLamIds],
    });

    const productRules = {};
    CALC_SHEET_PRODUCTS.forEach(p => { productRules[p] = rule(CALC_STICKER_PRODUCTS.includes(p)); });
    CALC_CATALOG_PRODUCTS.forEach(p => { productRules[p] = rule(false); });

    return {
        version: 1,
        sheet: { width: 320, height: 450, gap: 2, margin: 5, marginPlotter: 15 },
        materials: {
            papers: Array.from(paperMap.values()),
            colors: Array.from(colorMap.values()),
            laminations: Array.from(lamMap.values()),
            postpress,
        },
        productRules,
    };
}

// Аккуратно слить сохранённое с дефолтом (чтобы новые поля не терялись)
function mergeCalcSettings(saved) {
    const def = defaultCalcSettings();
    if (!saved || typeof saved !== "object") return def;
    const out = {
        version: def.version,
        sheet: { ...def.sheet, ...(saved.sheet || {}) },
        materials: {
            papers: Array.isArray(saved.materials?.papers) ? saved.materials.papers : def.materials.papers,
            colors: Array.isArray(saved.materials?.colors) ? saved.materials.colors : def.materials.colors,
            laminations: Array.isArray(saved.materials?.laminations) ? saved.materials.laminations : def.materials.laminations,
            postpress: Array.isArray(saved.materials?.postpress) ? saved.materials.postpress : def.materials.postpress,
        },
        productRules: { ...def.productRules, ...(saved.productRules || {}) },
    };
    return out;
}

function getCalcSettings() {
    if (!calcSettings) calcSettings = loadCalcSettingsSync();
    return calcSettings;
}

function loadCalcSettingsSync() {
    try {
        const raw = localStorage.getItem(CALC_SETTINGS_STORAGE_KEY);
        return mergeCalcSettings(raw ? JSON.parse(raw) : null);
    } catch (_) {
        return defaultCalcSettings();
    }
}

// Асинхронная загрузка: пробуем API (ФАЗА 2), иначе localStorage
async function loadCalcSettings() {
    if (CALC_SETTINGS_API && currentUser?.role === "staff") {
        try {
            const resp = await fetchWithTimeout(`${CALC_SETTINGS_API}?action=load`, { headers: authHeaders() });
            if (resp.ok) {
                const data = await resp.json();
                const payload = Array.isArray(data) ? data[0] : data;
                if (payload && payload.settings) {
                    calcSettings = mergeCalcSettings(payload.settings);
                    try { localStorage.setItem(CALC_SETTINGS_STORAGE_KEY, JSON.stringify(calcSettings)); } catch (_) {}
                    applyCalcSettings();
                    return calcSettings;
                }
            }
        } catch (_) { /* тихо падаем в localStorage */ }
    }
    calcSettings = loadCalcSettingsSync();
    applyCalcSettings();
    return calcSettings;
}

async function saveCalcSettings(next) {
    calcSettings = mergeCalcSettings(next);
    try { localStorage.setItem(CALC_SETTINGS_STORAGE_KEY, JSON.stringify(calcSettings)); } catch (_) {}
    applyCalcSettings();
    if (CALC_SETTINGS_API && currentUser?.role === "staff") {
        try {
            await fetchWithTimeout(CALC_SETTINGS_API, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ action: "save", settings: calcSettings }),
            });
        } catch (_) { /* сохранили локально — не блокируем UI */ }
    }
    return calcSettings;
}

function resetCalcSettings() {
    calcSettings = defaultCalcSettings();
    try { localStorage.removeItem(CALC_SETTINGS_STORAGE_KEY); } catch (_) {}
    applyCalcSettings();
    return calcSettings;
}

// Применить числовые параметры листа к глобальным переменным расчёта
function applyCalcSettings() {
    const s = getCalcSettings();
    if (typeof SRA3_W !== "undefined") { try { SRA3_W = Number(s.sheet.width) || SRA3_W; } catch (_) {} }
    if (typeof SRA3_H !== "undefined") { try { SRA3_H = Number(s.sheet.height) || SRA3_H; } catch (_) {} }
}

// Параметры листа для calcLayout
function getSheetParams() {
    const s = getCalcSettings().sheet;
    return {
        width: Number(s.width) || 320,
        height: Number(s.height) || 450,
        gap: Number(s.gap) >= 0 ? Number(s.gap) : 2,
        margin: Number(s.margin) >= 0 ? Number(s.margin) : 5,
        marginPlotter: Number(s.marginPlotter) >= 0 ? Number(s.marginPlotter) : 15,
    };
}

// Правило для типа продукции (с дефолтом, если тип новый)
function getProductRule(productName) {
    const s = getCalcSettings();
    const r = s.productRules[productName];
    if (r) return r;
    const isSticker = CALC_STICKER_PRODUCTS.includes(productName);
    return {
        papers: s.materials.papers.filter(p => isSticker ? /^sticker_/.test(p.id) : true).map(p => p.id),
        colors: s.materials.colors.map(c => c.id),
        laminations: s.materials.laminations.map(l => l.id),
    };
}

// Вернуть [name, id] пары материала данного типа, отфильтрованные по списку id
// и в порядке этого списка. kind: 'papers' | 'colors' | 'laminations'
function materialOptionsFor(kind, allowedIds) {
    const list = getCalcSettings().materials[kind] || [];
    const byId = new Map(list.map(m => [m.id, m]));
    const out = [];
    (allowedIds || []).forEach(id => {
        const m = byId.get(id);
        if (m) out.push([m.name, m.id]);
    });
    return out;
}

// Первый доступный id из списка, либо предпочтительный, если он в списке
function preferredOrFirst(allowedIds, preferredId) {
    if (preferredId && allowedIds.includes(preferredId)) return preferredId;
    return allowedIds[0] || "";
}
