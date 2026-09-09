// js/orders-db.js — раздел «Заказы БД»: канбан заказов из СВОЕЙ базы (Heaven Print).
// Читает бэкенд (/api/clients: listDeals, getDeal, syncDealsFromCrm, syncDealElements).
// Данные наполняются вебхуками PrintOffice (/api/webhooks/printoffice) и синками.
// Канбан: колонки = статусы сделки (цвета/порядок из CRM), карточка = заказ (сделка).

const dbOrdersState = {
    deals: [],
    statuses: [],
    loading: false,
    error: "",
    query: "",
    loaded: false,
    view: "list"      // list | kanban
};
try { const v = localStorage.getItem("dbOrdersView"); if (v === "list" || v === "kanban") dbOrdersState.view = v; } catch (_) {}
dbOrdersState.filters = { statuses: new Set(), openOnly: false, debtOnly: false, employee: "", dateFrom: "", dateTo: "" };
dbOrdersState.employees = [];
dbOrdersState.page = 1;
dbOrdersState.perPage = 100;
dbOrdersState.total = 0;
dbOrdersState.pages = 1;
dbOrdersState.kanbanDeals = [];
dbOrdersState.kanbanZoom = 1;
try { const z = parseFloat(localStorage.getItem("dbKanbanZoom")); if (z >= 0.5 && z <= 1) dbOrdersState.kanbanZoom = z; } catch (_) {}
dbOrdersState.colOrder = null;   // сохранённый порядок колонок (id статусов)
try { const o = JSON.parse(localStorage.getItem("dbKanbanColOrder")); if (Array.isArray(o)) dbOrdersState.colOrder = o.map(Number).filter(Number.isFinite); } catch (_) {}

// Текущий порядок колонок: сохранённый + недостающие статусы в конце.
function dbGetColOrder() {
    const saved = Array.isArray(dbOrdersState.colOrder) ? dbOrdersState.colOrder.slice() : [];
    (dbOrdersState.statuses || []).forEach(s => {
        if (s.id != null && !saved.includes(Number(s.id))) saved.push(Number(s.id));
    });
    return saved;
}

let dbDealsSearchTimer = null;

// Дата сделки "dd-mm-yyyy" → Date (для клиентской фильтрации канбана по периоду).
function dbParseCrmDate(s) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s || "").trim());
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}
// Клиентская фильтрация канбана (открытые сделки уже ограничены сервером).
function getDbKanbanFiltered() {
    let list = dbOrdersState.kanbanDeals || [];
    const f = dbOrdersState.filters;
    const q = (dbOrdersState.query || "").trim().toLowerCase();
    if (q) list = list.filter(d => (`${d.num || ""} ${d.client_name || ""} ${d.content || ""}`).toLowerCase().includes(q));
    if (f.openOnly) list = list.filter(d => String(d.status_name || "") !== "Завершено");
    if (f.statuses && f.statuses.size) list = list.filter(d => f.statuses.has(Number(d.status_id)));
    if (f.debtOnly) list = list.filter(d => (Number(d.debt) || 0) > 0.009);
    if (f.employee) list = list.filter(d => String(d.employee_name || "") === f.employee);
    if (f.dateFrom || f.dateTo) {
        const from = f.dateFrom ? new Date(f.dateFrom) : null;
        const to = f.dateTo ? new Date(f.dateTo) : null;
        list = list.filter(d => {
            const dt = dbParseCrmDate(d.created_at_crm);
            if (!dt) return false;
            if (from && dt < from) return false;
            if (to && dt > to) return false;
            return true;
        });
    }
    return list;
}
function dbFiltersActive() {
    const f = dbOrdersState.filters;
    return (f.statuses && f.statuses.size > 0) || f.openOnly || f.debtOnly || !!f.employee || !!f.dateFrom || !!f.dateTo;
}
function updateDbSearchClearBtn() {
    const btn = document.getElementById("dbkSearchClearBtn");
    const inp = document.getElementById("dbkSearchInput");
    if (btn && inp) btn.hidden = !inp.value;
}
function clearDbSearch() {
    const inp = document.getElementById("dbkSearchInput");
    if (inp) inp.value = "";
    dbOrdersState.query = "";
    updateDbSearchClearBtn();
    dbApplyQueryOrFilters();
}
// Список: перезагрузка с сервера (пагинация/фильтры серверные). Канбан: клиентский рендер.
function dbApplyQueryOrFilters() {
    if (dbOrdersState.view === "kanban") { renderDbKanban(); }
    else { dbOrdersState.page = 1; loadDbList(); }
}
// Мобильная кнопка «Фильтры»: показать/спрятать всю панель фильтров.
function toggleDbFilters(e) {
    if (e) e.stopPropagation();
    const wrap = document.getElementById("dbFiltersWrap");
    if (!wrap) return;
    const open = wrap.classList.toggle("open");
    const btn = document.getElementById("dbFiltersBtn");
    if (btn) btn.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(() => document.addEventListener("click", dbFiltersOutside), 0);
    else { dbCloseDds(); document.removeEventListener("click", dbFiltersOutside); }
}
function dbFiltersOutside(e) {
    const wrap = document.getElementById("dbFiltersWrap");
    if (wrap && !wrap.contains(e.target)) {
        wrap.classList.remove("open");
        dbCloseDds();
        document.removeEventListener("click", dbFiltersOutside);
    }
}
// Выпадающие фильтры (Статус / Период): открыть один, закрыть остальные.
function dbCloseDds() { document.querySelectorAll("#dbFiltersBar .db-filter-dd.open").forEach(el => el.classList.remove("open")); }
function dbToggleDd(e, which) {
    if (e) e.stopPropagation();
    const dd = document.querySelector(`#dbFiltersBar .db-filter-dd[data-dd="${which}"]`);
    if (!dd) return;
    const willOpen = !dd.classList.contains("open");
    dbCloseDds();
    if (willOpen) {
        dd.classList.add("open");
        setTimeout(() => document.addEventListener("click", dbDdOutside), 0);
    }
}
function dbDdOutside(e) {
    if (!e.target.closest(".db-filter-dd")) { dbCloseDds(); document.removeEventListener("click", dbDdOutside); }
}
// Наполнение фильтров (статусы + сотрудники) — вызывается после загрузки данных.
function renderDbFilters() { renderDbFilterStatuses(); renderDbFilterEmployees(); dbUpdateFilterLabels(); updateDbFiltersBtn(); }
function renderDbFilterStatuses() {
    const host = document.getElementById("dbFilterStatusList");
    if (!host) return;
    const f = dbOrdersState.filters;
    const sel = f.statuses;
    const openRow = `<label class="dbk-filter-status dbk-filter-open"><input type="checkbox" id="dbFilterOpenOnly"${f.openOnly ? " checked" : ""} onchange="dbToggleOpenOnly(this)"><span class="dbk-filter-dot dbk-filter-dot--open" aria-hidden="true"></span>Все открытые сделки</label>`;
    const items = (dbOrdersState.statuses || []).map(s =>
        `<label class="dbk-filter-status"><input type="checkbox" value="${s.id}"${sel.has(Number(s.id)) ? " checked" : ""} onchange="applyDbFilters()"><span class="dbk-filter-dot" style="background:${escapeHtml(s.bk_color || "#dfdfdf")}"></span>${escapeHtml(s.name)}</label>`).join("");
    host.innerHTML = openRow + (items || `<div class="dbk-filter-empty">Нет статусов</div>`);
}
// «Все открытые сделки»: показать все, кроме «Завершено». Взаимоисключимо с выбором конкретных статусов.
function dbToggleOpenOnly(el) {
    const on = !!(el && el.checked);
    dbOrdersState.filters.openOnly = on;
    if (on) {
        dbOrdersState.filters.statuses = new Set();
        document.querySelectorAll("#dbFilterStatusList input[type=checkbox][value]").forEach(c => { c.checked = false; });
    }
    dbUpdateFilterLabels();
    updateDbFiltersBtn();
    dbApplyQueryOrFilters();
}
function renderDbFilterEmployees() {
    const sel = document.getElementById("dbFilterEmployee");
    if (!sel) return;
    const cur = dbOrdersState.filters.employee || "";
    const opts = ['<option value="">Все сотрудники</option>']
        .concat((dbOrdersState.employees || []).map(n => `<option value="${escapeHtml(n)}"${n === cur ? " selected" : ""}>${escapeHtml(n)}</option>`));
    sel.innerHTML = opts.join("");
    sel.value = cur;
}
function dbUpdateFilterLabels() {
    const f = dbOrdersState.filters;
    const sBtn = document.getElementById("dbStatusDdBtn");
    if (sBtn) {
        sBtn.textContent = f.openOnly ? "Открытые" : (f.statuses && f.statuses.size ? `Статус · ${f.statuses.size}` : "Статус");
        sBtn.classList.toggle("is-active", f.openOnly || !!(f.statuses && f.statuses.size));
    }
    const pBtn = document.getElementById("dbPeriodBtn");
    if (pBtn) {
        const fmt = iso => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y.slice(2)}`; };
        pBtn.textContent = (f.dateFrom || f.dateTo)
            ? `${f.dateFrom ? fmt(f.dateFrom) : "…"}–${f.dateTo ? fmt(f.dateTo) : "…"}` : "Период";
        pBtn.classList.toggle("is-active", !!(f.dateFrom || f.dateTo));
    }
}
function applyDbFilters() {
    const sel = new Set();
    document.querySelectorAll("#dbFilterStatusList input[type=checkbox][value]:checked").forEach(c => sel.add(Number(c.value)));
    // Выбор конкретного статуса отменяет режим «Все открытые сделки».
    if (sel.size) {
        dbOrdersState.filters.openOnly = false;
        const openBox = document.getElementById("dbFilterOpenOnly");
        if (openBox) openBox.checked = false;
    }
    const debt = document.getElementById("dbFilterDebtOnly");
    const emp = document.getElementById("dbFilterEmployee");
    dbOrdersState.filters.statuses = sel;
    dbOrdersState.filters.debtOnly = !!(debt && debt.checked);
    dbOrdersState.filters.employee = emp ? String(emp.value || "") : "";
    dbUpdateFilterLabels();
    updateDbFiltersBtn();
    dbApplyQueryOrFilters();
}
// Период: пресеты + ручной ввод дат.
function dbSetPeriodPreset(kind) {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    let from = null, to = today;
    if (kind === "today") from = today;
    else if (kind === "7") { from = new Date(); from.setDate(from.getDate() - 6); }
    else if (kind === "30") { from = new Date(); from.setDate(from.getDate() - 29); }
    else if (kind === "month") from = new Date(today.getFullYear(), today.getMonth(), 1);
    const f = document.getElementById("dbFilterDateFrom");
    const t = document.getElementById("dbFilterDateTo");
    if (f) f.value = from ? iso(from) : "";
    if (t) t.value = to ? iso(to) : "";
    dbApplyPeriod();
}
function dbApplyPeriod() {
    const f = document.getElementById("dbFilterDateFrom");
    const t = document.getElementById("dbFilterDateTo");
    dbOrdersState.filters.dateFrom = f && f.value ? f.value : "";
    dbOrdersState.filters.dateTo = t && t.value ? t.value : "";
    dbCloseDds();
    dbUpdateFilterLabels();
    updateDbFiltersBtn();
    dbApplyQueryOrFilters();
}
function dbClearPeriod() {
    const f = document.getElementById("dbFilterDateFrom");
    const t = document.getElementById("dbFilterDateTo");
    if (f) f.value = ""; if (t) t.value = "";
    dbApplyPeriod();
}
function resetDbFilters() {
    dbOrdersState.filters = { statuses: new Set(), openOnly: false, debtOnly: false, employee: "", dateFrom: "", dateTo: "" };
    const debt = document.getElementById("dbFilterDebtOnly");
    if (debt) debt.checked = false;
    const df = document.getElementById("dbFilterDateFrom");
    if (df) df.value = "";
    const dt = document.getElementById("dbFilterDateTo");
    if (dt) dt.value = "";
    const inp = document.getElementById("dbkSearchInput");
    if (inp) inp.value = "";
    dbOrdersState.query = "";
    updateDbSearchClearBtn();
    renderDbFilters();
    dbApplyQueryOrFilters();
}
function updateDbFiltersBtn() {
    const btn = document.getElementById("dbFiltersBtn");
    if (btn) btn.classList.toggle("has-active", dbFiltersActive());
}

function openDbOrders(trigger) {
    if (!ensureActiveSession()) return;
    switchTab("db-orders-tab", trigger || document.querySelector('.tab-btn[data-tab-target="db-orders-tab"]'));
    updateDbViewToggle();
    updateDbSearchClearBtn();
    renderDbFilters();
    refreshDbSyncStatus();   // показать/возобновить статус фоновой синхронизации элементов
    if (!dbOrdersState.loaded) loadDbDeals();
    else renderDbOrders();
}

// Переключение Список/Канбан — подгружаем данные под вид.
function setDbView(view) {
    if (view !== "list" && view !== "kanban") return;
    dbOrdersState.view = view;
    try { localStorage.setItem("dbOrdersView", view); } catch (_) {}
    updateDbViewToggle();
    loadDbDeals();
}
function toggleDbView() {
    setDbView(dbOrdersState.view === "kanban" ? "list" : "kanban");
}
function updateDbViewToggle() {
    // Одна кнопка-переключатель: показываем иконку целевого вида (куда переключимся).
    const btn = document.getElementById("dbViewToggleBtn");
    if (btn) {
        const isKanban = dbOrdersState.view === "kanban";
        btn.title = isKanban ? "Показать списком" : "Показать канбаном";
        const icList = btn.querySelector(".dbk-view-ic-list");
        const icKanban = btn.querySelector(".dbk-view-ic-kanban");
        // style.display, т.к. [hidden] на svg перебивается правилом .icn{display:…}
        if (icList) icList.style.display = isKanban ? "" : "none";     // в канбане — иконка списка (цель)
        if (icKanban) icKanban.style.display = isKanban ? "none" : ""; // в списке — иконка канбана (цель)
    }
    const zoomWrap = document.getElementById("dbZoomWrap");
    if (zoomWrap) zoomWrap.style.display = dbOrdersState.view === "kanban" ? "" : "none";
    // Канбан — на весь экран (класс на body включает полноширинную раскладку).
    const active = document.getElementById("db-orders-tab")?.classList.contains("active");
    document.body.classList.toggle("db-kanban-active", dbOrdersState.view === "kanban" && !!active);
    updateDbZoomUI();
}
function renderDbOrders() {
    updateDbViewToggle();
    if (dbOrdersState.view === "kanban") renderDbKanban();
    else renderDbList();
}

// Диспетчер загрузки по виду.
async function loadDbDeals() {
    if (dbOrdersState.view === "kanban") return loadDbKanban();
    return loadDbList();
}
async function loadDbList() {
    if (!ensureActiveSession()) return;
    dbOrdersState.loading = true;
    dbOrdersState.error = "";
    renderDbList();
    try {
        const f = dbOrdersState.filters;
        const data = await clientsApi("listDeals", {
            q: dbOrdersState.query || "",
            page: dbOrdersState.page,
            perPage: dbOrdersState.perPage,
            statusIds: f.statuses ? [...f.statuses] : [],
            openOnly: !!f.openOnly,
            debtOnly: !!f.debtOnly,
            employee: f.employee || "",
            dateFrom: f.dateFrom || "",
            dateTo: f.dateTo || ""
        });
        dbOrdersState.deals = Array.isArray(data?.deals) ? data.deals : [];
        if (Array.isArray(data?.statuses)) dbOrdersState.statuses = data.statuses;
        if (Array.isArray(data?.employees)) dbOrdersState.employees = data.employees;
        dbOrdersState.total = Number(data?.total) || 0;
        dbOrdersState.pages = Number(data?.pages) || 1;
        dbOrdersState.page = Number(data?.page) || dbOrdersState.page;
        dbOrdersState.loaded = true;
        renderDbFilters();
    } catch (e) {
        console.error("loadDbList", e);
        dbOrdersState.deals = [];
        dbOrdersState.error = "Не удалось загрузить заказы. Проверьте бэкенд (/api/clients).";
    } finally {
        dbOrdersState.loading = false;
        renderDbList();
    }
}
async function loadDbKanban() {
    if (!ensureActiveSession()) return;
    dbOrdersState.loading = true;
    dbOrdersState.error = "";
    renderDbKanban();
    try {
        const data = await clientsApi("listKanbanDeals", {});
        dbOrdersState.kanbanDeals = Array.isArray(data?.deals) ? data.deals : [];
        if (Array.isArray(data?.statuses)) dbOrdersState.statuses = data.statuses;
        // Список сотрудников для фильтра — из загруженных сделок канбана.
        const emp = [...new Set(dbOrdersState.kanbanDeals.map(d => String(d.employee_name || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
        if (emp.length) dbOrdersState.employees = emp;
        dbOrdersState.loaded = true;
        renderDbFilters();
    } catch (e) {
        console.error("loadDbKanban", e);
        dbOrdersState.kanbanDeals = [];
        dbOrdersState.error = "Не удалось загрузить канбан.";
    } finally {
        dbOrdersState.loading = false;
        renderDbKanban();
    }
}

function onDbDealsSearchInput(value) {
    dbOrdersState.query = String(value || "");
    updateDbSearchClearBtn();
    clearTimeout(dbDealsSearchTimer);
    dbDealsSearchTimer = setTimeout(() => dbApplyQueryOrFilters(), 350);
}

// Пагинация списка.
function dbGoToPage(p) {
    p = Math.max(1, Math.min(dbOrdersState.pages, Number(p) || 1));
    if (p === dbOrdersState.page) return;
    dbOrdersState.page = p;
    loadDbList();
    const host = document.getElementById("dbOrdersBody");
    if (host && host.scrollIntoView) host.scrollIntoView({ block: "start" });
}
function dbPageNumbers(page, pages) {
    const out = [];
    const win = 2;
    const start = Math.max(1, page - win), end = Math.min(pages, page + win);
    if (start > 1) { out.push(1); if (start > 2) out.push("…"); }
    for (let i = start; i <= end; i++) out.push(i);
    if (end < pages) { if (end < pages - 1) out.push("…"); out.push(pages); }
    return out;
}
function renderDbPager() {
    const page = dbOrdersState.page, pages = dbOrdersState.pages;
    if (pages <= 1) return "";
    const btn = (label, p, o = {}) => `<button type="button" class="dbk-page${o.active ? " is-active" : ""}"${o.disabled ? " disabled" : ""} onclick="dbGoToPage(${p})">${label}</button>`;
    let html = btn("«", 1, { disabled: page <= 1 }) + btn("‹", page - 1, { disabled: page <= 1 });
    dbPageNumbers(page, pages).forEach(n => {
        html += (n === "…") ? `<span class="dbk-page-ell">…</span>` : btn(String(n), n, { active: n === page });
    });
    html += btn("›", page + 1, { disabled: page >= pages }) + btn("»", pages, { disabled: page >= pages });
    return `<div class="dbk-pager">${html}</div>`;
}

// Масштаб канбана (100..50%), сохраняется в localStorage.
function setDbZoom(v) {
    let z = Math.round(parseFloat(v) * 10) / 10;
    if (!(z >= 0.5 && z <= 1)) z = Math.min(1, Math.max(0.5, z || 1));
    dbOrdersState.kanbanZoom = z;
    try { localStorage.setItem("dbKanbanZoom", String(z)); } catch (_) {}
    const board = document.querySelector("#dbOrdersBody .dbk-board");
    if (board) board.style.zoom = z;
    applyDbKanbanHeight();
    updateDbZoomUI();
}
// Шаг масштаба кнопками −/+ (50%…100%, шаг 10%).
function dbZoomStep(dir) {
    const z = (dbOrdersState.kanbanZoom || 1) + (dir > 0 ? 0.1 : -0.1);
    setDbZoom(z);
}
function updateDbZoomUI() {
    const z = dbOrdersState.kanbanZoom || 1;
    const lbl = document.getElementById("dbZoomLabel");
    if (lbl) lbl.textContent = Math.round(z * 100) + "%";
    const sel = document.getElementById("dbZoomSelect");
    if (sel) sel.value = String(Math.round(z * 10) / 10);
    document.querySelectorAll("#dbZoomWrap .dbk-zoom-btn").forEach(b => {
        const inc = /увеличить/i.test(b.getAttribute("aria-label") || "");
        b.disabled = inc ? z >= 1 - 1e-9 : z <= 0.5 + 1e-9;
    });
}
// Пересчёт высоты канбана при ресайзе окна.
window.addEventListener("resize", () => {
    if (dbOrdersState.view === "kanban" && document.getElementById("db-orders-tab")?.classList.contains("active")) {
        applyDbKanbanHeight();
    }
});

// Колонки канбана: статусы CRM (в их порядке, только непустые) + прочие статусы из данных.
function buildDbColumns(deals, statuses) {
    const byId = new Map();
    const order = [];
    (statuses || []).forEach(s => {
        if (s.id != null && !byId.has(s.id)) {
            byId.set(s.id, { id: s.id, name: s.name, bk_color: s.bk_color, text_color: s.text_color, deals: [] });
            order.push(s.id);
        }
    });
    const extra = [];
    deals.forEach(d => {
        const sid = d.status_id != null ? Number(d.status_id) : -1;
        let col = byId.get(sid);
        if (!col) {
            col = { id: sid, name: d.status_name || "Без статуса", bk_color: "", text_color: "", deals: [] };
            byId.set(sid, col);
            extra.push(sid);
        }
        col.deals.push(d);
    });
    const cols = [];
    const seen = new Set();
    // Порядок колонок — по сохранённому (перетаскиванием), все статусы даже пустые.
    dbGetColOrder().forEach(id => { const c = byId.get(id); if (c) { cols.push(c); seen.add(id); } });
    // Прочие статусы, которых нет в справочнике/порядке, — только если в них есть сделки.
    extra.forEach(id => { if (!seen.has(id)) { const c = byId.get(id); if (c && c.deals.length) cols.push(c); } });
    return cols;
}

function dbColHeadStyle(c) {
    if (!c.bk_color) return "";
    const fg = c.text_color === "white" ? "#fff" : "#1c1b19";
    return ` style="background:${escapeHtml(c.bk_color)};color:${fg}"`;
}

// Краткое описание для карточки канбана: начальные слова каждого элемента.
function dbCardSummary(content, wordsPerEl = 3) {
    const parts = String(content || "").split(/\n|;\s|·/).map(s => s.trim()).filter(Boolean);
    return parts.map(p => {
        const words = p.split(/\s+/).filter(Boolean).slice(0, wordsPerEl).join(" ");
        return p.split(/\s+/).length > wordsPerEl ? words + "…" : words;
    }).join(", ");
}
// Цвет суммы по оплате: зелёный — нет долга, оранжевый — частичная оплата, красный — не оплачено.
function dbAmountPayClass(d) {
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);
    if (debt <= 0.009) return "dbk-amt-paid";
    if (paid > 0.009) return "dbk-amt-partial";
    return "dbk-amt-debt";
}
function dbDealCardHtml(d) {
    const num = escapeHtml(String(d.num ?? d.crm_deal_id ?? ""));
    const summary = dbCardSummary(d.content);
    return `
        <div class="dbk-card" data-deal-id="${d.crm_deal_id}" draggable="true" ondragstart="dbDragStart(event, ${d.crm_deal_id})" ondragend="dbDragEnd(event)" onclick="openDbDealCard(${d.crm_deal_id})" title="Перетащите в колонку, чтобы сменить статус; клик — открыть">
            <div class="dbk-card-top">
                <span class="dbk-card-num">№ ${num}</span>
                <span class="dbk-card-amount ${dbAmountPayClass(d)}">${money(d.amount)} ₽</span>
            </div>
            <div class="dbk-card-client">${escapeHtml(d.client_name || "—")}</div>
            ${summary ? `<div class="dbk-card-content">${escapeHtml(summary)}</div>` : ""}
        </div>`;
}

function dbEmptyMsg(host, sourceLen, filtered, kind) {
    if (dbOrdersState.loading && !sourceLen) {
        host.innerHTML = `<div class="dbk-empty">Загрузка…</div>`; return true;
    }
    if (dbOrdersState.error) {
        host.innerHTML = `<div class="dbk-empty dbk-empty--error">${escapeHtml(dbOrdersState.error)}</div>`; return true;
    }
    return false;
}

function renderDbKanban() {
    const host = document.getElementById("dbOrdersBody");
    if (!host) return;
    if (dbEmptyMsg(host, dbOrdersState.kanbanDeals.length)) return;
    const deals = getDbKanbanFiltered();
    if (!deals.length) {
        const filtered = dbOrdersState.query || dbFiltersActive();
        host.innerHTML = `<div class="dbk-empty">${filtered ? "Ничего не найдено." : "Нет открытых заказов. Завершённые скрыты (кроме сегодняшних)."}</div>`;
        return;
    }
    const cols = buildDbColumns(deals, dbOrdersState.statuses);
    const zoom = dbOrdersState.kanbanZoom || 1;
    // Drop-зона — весь столбик (наводить можно куда угодно в колонке, не только на карточки).
    host.innerHTML = `<div class="dbk-board" style="zoom:${zoom}">${cols.map(c => `
        <div class="dbk-col" data-status-id="${c.id}" ondragover="dbDragOver(event)" ondragleave="dbDragLeave(event)" ondrop="dbDrop(event, ${c.id})">
            <div class="dbk-col-head" draggable="true" ondragstart="dbColDragStart(event, ${c.id})" ondragend="dbColDragEnd(event)"${dbColHeadStyle(c)} title="Перетащите, чтобы поменять колонки местами">
                <span class="dbk-col-name">${escapeHtml(c.name)}</span>
                <span class="dbk-col-count">${c.deals.length}</span>
            </div>
            <div class="dbk-col-body">${c.deals.map(dbDealCardHtml).join("")}</div>
        </div>`).join("")}</div>`;
    applyDbKanbanHeight();
    const boardEl = document.querySelector("#dbOrdersBody .dbk-board");
    dbSetupBoardPan(boardEl);
    dbSetupBoardTouchDrag(boardEl);
}

// Панорамирование доски мышью (замена горизонтальному скроллбару):
// зажать в пустой области/промежутке и тянуть в стороны. Карточки/заголовки — свой drag.
function dbSetupBoardPan(board) {
    if (!board || board.dataset.panBound === "1") return;
    board.dataset.panBound = "1";
    let panning = false, startX = 0, startScroll = 0;
    board.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest(".dbk-card, .dbk-col-head, button, a, input, select, textarea")) return;
        panning = true;
        startX = e.clientX;
        startScroll = board.scrollLeft;
        board.classList.add("dbk-board--panning");
        e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
        if (!panning) return;
        const dx = (e.clientX - startX) / (dbOrdersState.kanbanZoom || 1);
        board.scrollLeft = startScroll - dx;
    });
    const stop = () => { if (panning) { panning = false; board.classList.remove("dbk-board--panning"); } };
    window.addEventListener("mouseup", stop);
    window.addEventListener("mouseleave", stop);
}

// Перетаскивание карточек пальцем (touch) — нативный HTML5 DnD на тач не работает.
// Долгое нажатие (~200мс) «поднимает» карточку; быстрый свайп — обычная прокрутка вбок.
// Карточка-призрак следует за пальцем, у края доска автоскроллится, при отпускании —
// перенос в колонку под пальцем (без перерисовки, скролл сохраняется).
function dbSetupBoardTouchDrag(board) {
    if (!board || board.dataset.touchDndBound === "1") return;
    board.dataset.touchDndBound = "1";
    const HOLD_MS = 200, MOVE_CANCEL = 10, EDGE = 46, EDGE_SPEED = 14;
    let card = null, dealId = null, ghost = null, holdTimer = null;
    let dragging = false, offX = 0, offY = 0, curCol = null, autoRAF = 0, lastX = 0;

    const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };

    board.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "touch" || e.isPrimary === false) return;
        const c = e.target.closest(".dbk-card");
        if (!c || e.target.closest("button, a, input, select, textarea")) return;
        card = c; dealId = Number(c.dataset.dealId);
        const sx = e.clientX, sy = e.clientY;
        clearHold();
        holdTimer = setTimeout(() => { holdTimer = null; beginDrag(sx, sy); }, HOLD_MS);
        // до старта drag: если палец заметно двинулся — это скролл/свайп, отменяем захват
        const preMove = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVE_CANCEL) { clearHold(); board.removeEventListener("pointermove", preMove); } };
        board.addEventListener("pointermove", preMove, { passive: true });
        const preUp = () => { clearHold(); board.removeEventListener("pointermove", preMove); board.removeEventListener("pointerup", preUp); board.removeEventListener("pointercancel", preUp); };
        board.addEventListener("pointerup", preUp);
        board.addEventListener("pointercancel", preUp);
    });

    function beginDrag(sx, sy) {
        if (!card) return;
        dragging = true;
        try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
        const r = card.getBoundingClientRect();
        const zoom = dbOrdersState.kanbanZoom || 1;
        offX = sx - r.left; offY = sy - r.top; lastX = sx;
        ghost = card.cloneNode(true);
        ghost.classList.add("dbk-card--ghost");
        ghost.style.width = (r.width / zoom) + "px";   // после scale(zoom) → фактическая ширина карточки
        ghost.style.left = r.left + "px";
        ghost.style.top = r.top + "px";
        ghost.style.transformOrigin = "top left";
        ghost.style.transform = `scale(${zoom}) rotate(1.5deg)`;
        document.body.appendChild(ghost);
        card.classList.add("dbk-card--dragging");
        board.classList.add("dbk-board--carddrag");   // touch-action: none, чтобы не скроллилось
        document.addEventListener("pointermove", onMove, { passive: false });
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    }

    function onMove(e) {
        if (!dragging) return;
        e.preventDefault();
        lastX = e.clientX;
        ghost.style.left = (e.clientX - offX) + "px";
        ghost.style.top = (e.clientY - offY) + "px";
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const col = under && under.closest(".dbk-col");
        if (col !== curCol) {
            if (curCol) curCol.classList.remove("dbk-col--over");
            curCol = col;
            if (curCol) curCol.classList.add("dbk-col--over");
        }
        ensureAutoScroll();
    }

    function ensureAutoScroll() {
        if (autoRAF) return;
        const step = () => {
            if (!dragging) { autoRAF = 0; return; }
            const rect = board.getBoundingClientRect();
            let dx = 0;
            if (lastX < rect.left + EDGE) dx = -EDGE_SPEED;
            else if (lastX > rect.right - EDGE) dx = EDGE_SPEED;
            if (dx) board.scrollLeft += dx;
            autoRAF = dx ? requestAnimationFrame(step) : 0;
        };
        autoRAF = requestAnimationFrame(step);
    }

    function onUp() {
        if (!dragging) { cleanup(); return; }
        const col = curCol;
        const dropDealId = dealId;
        cleanup();
        // подавляем «клик» после перетаскивания, чтобы не открылась карточка
        document.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); }, { capture: true, once: true });
        if (col) {
            const sid = Number(col.dataset.statusId);
            const deal = dbFindDeal(dropDealId);
            if (deal && Number.isFinite(sid) && sid >= 0 && Number(deal.status_id) !== sid) {
                setDealStatusFromKanban(dropDealId, sid);
            }
        }
    }

    function cleanup() {
        clearHold();
        dragging = false;
        if (autoRAF) { cancelAnimationFrame(autoRAF); autoRAF = 0; }
        if (ghost) { ghost.remove(); ghost = null; }
        if (card) card.classList.remove("dbk-card--dragging");
        if (curCol) curCol.classList.remove("dbk-col--over");
        board.classList.remove("dbk-board--carddrag");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        card = null; curCol = null; dealId = null;
    }
}

// Высота канбана: тянем доску до низа экрана (учитываем zoom, т.к. он масштабирует высоту).
function applyDbKanbanHeight() {
    const board = document.querySelector("#dbOrdersBody .dbk-board");
    if (!board) return;
    const zoom = dbOrdersState.kanbanZoom || 1;
    const top = board.getBoundingClientRect().top;
    const avail = window.innerHeight - top - 14;      // экранные px до низа
    if (avail > 120) board.style.height = (avail / zoom) + "px";  // делим на zoom → после масштабирования заполнит
}

// ---- Drag-and-drop: смена статуса сделки перетаскиванием ----
let dbDragDealId = null;
function dbDragStart(e, dealId) {
    dbDragDealId = dealId;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dealId)); } catch (_) {} }
    if (e.currentTarget) e.currentTarget.classList.add("dbk-card--dragging");
}
function dbDragEnd(e) { if (e.currentTarget) e.currentTarget.classList.remove("dbk-card--dragging"); }
function dbClearColMarkers() {
    document.querySelectorAll(".dbk-col--insert-before, .dbk-col--insert-after")
        .forEach(c => c.classList.remove("dbk-col--insert-before", "dbk-col--insert-after"));
}
function dbDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    const col = e.currentTarget;
    if (!col) return;
    if (dbColDragStatusId != null) {
        // Перетаскивание КОЛОНКИ — показать анимированное место вставки (лево/право по курсору).
        if (Number(col.dataset.statusId) === dbColDragStatusId) { dbClearColMarkers(); return; }
        const rect = col.getBoundingClientRect();
        const after = (e.clientX - rect.left) > rect.width / 2;
        dbColDropAfter = after;
        dbClearColMarkers();
        col.classList.add(after ? "dbk-col--insert-after" : "dbk-col--insert-before");
    } else {
        col.classList.add("dbk-col--over");
    }
}
function dbDragLeave(e) {
    // не снимать при переходе на дочерний элемент (карточку) внутри столбика
    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove("dbk-col--over", "dbk-col--insert-before", "dbk-col--insert-after");
    }
}
function dbDrop(e, statusId) {
    e.preventDefault();
    if (e.currentTarget) e.currentTarget.classList.remove("dbk-col--over", "dbk-col--insert-before", "dbk-col--insert-after");
    // Перенос КОЛОНКИ (drag за заголовок) — меняем порядок колонок.
    if (dbColDragStatusId != null) {
        const dragId = dbColDragStatusId; const after = dbColDropAfter;
        dbColDragStatusId = null; dbClearColMarkers();
        dbReorderColumn(dragId, statusId, after);
        return;
    }
    // Перенос СДЕЛКИ — смена статуса.
    const id = dbDragDealId; dbDragDealId = null;
    if (!id || !Number.isFinite(Number(statusId)) || Number(statusId) < 0) return;
    const deal = dbFindDeal(id);
    if (!deal || Number(deal.status_id) === Number(statusId)) return;
    setDealStatusFromKanban(id, statusId);
}

// Оптимистичный перенос карточки в колонку БЕЗ полной перерисовки доски —
// сохраняет позицию горизонтального скролла (иначе доска прыгает в начало).
function dbKanbanMoveCardDom(dealId, statusId) {
    const board = document.querySelector("#dbOrdersBody .dbk-board");
    if (!board) return false;
    const card = board.querySelector(`.dbk-card[data-deal-id="${dealId}"]`);
    const body = board.querySelector(`.dbk-col[data-status-id="${statusId}"] .dbk-col-body`);
    if (!card || !body) return false;
    body.appendChild(card);
    board.querySelectorAll(".dbk-col").forEach(col => {
        const cnt = col.querySelector(".dbk-col-count");
        if (cnt) cnt.textContent = col.querySelectorAll(".dbk-col-body .dbk-card").length;
    });
    return true;
}
// Смена статуса из канбана: оптимистично двигаем карточку в DOM (без перерисовки,
// скролл на месте) + PUT в CRM в фоне. При ошибке — откат и полная перерисовка.
async function setDealStatusFromKanban(dealId, statusId) {
    const deal = dbFindDeal(dealId);
    const prev = deal ? { status_id: deal.status_id, status_name: deal.status_name } : null;
    const st = (dbOrdersState.statuses || []).find(s => Number(s.id) === Number(statusId));
    dbSetDealStatusLocal(dealId, Number(statusId), st ? st.name : (deal ? deal.status_name : ""));
    if (!dbKanbanMoveCardDom(dealId, statusId)) renderDbOrders();
    try {
        await clientsApi("setDealStatus", { crmId: Number(dealId), statusId: Number(statusId) });
        if (typeof showReadinessToast === "function") showReadinessToast(`№ ${deal?.num || dealId} → ${st?.name || ""}`);
    } catch (e) {
        console.error("setDealStatus", e);
        if (prev) dbSetDealStatusLocal(dealId, prev.status_id, prev.status_name);
        renderDbOrders();
        alert("Не удалось сменить статус сделки в CRM.");
    }
}

// ---- Перетаскивание КОЛОНОК (порядок сохраняется в localStorage) ----
let dbColDragStatusId = null;
let dbColDropAfter = false;
function dbColDragStart(e, statusId) {
    e.stopPropagation();
    dbColDragStatusId = Number(statusId);
    dbDragDealId = null;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "col:" + statusId); } catch (_) {} }
    const col = e.currentTarget.closest(".dbk-col");
    if (col) col.classList.add("dbk-col--col-dragging");
}
function dbColDragEnd() {
    dbColDragStatusId = null;
    dbClearColMarkers();
    document.querySelectorAll(".dbk-col--col-dragging").forEach(c => c.classList.remove("dbk-col--col-dragging"));
}
function dbReorderColumn(dragId, targetId, after) {
    dragId = Number(dragId); targetId = Number(targetId);
    if (!Number.isFinite(dragId) || !Number.isFinite(targetId) || dragId === targetId) return;
    let order = dbGetColOrder().filter(id => id !== dragId);
    const ti = order.indexOf(targetId);
    if (ti < 0) order.push(dragId);
    else order.splice(after ? ti + 1 : ti, 0, dragId);
    dbOrdersState.colOrder = order;
    try { localStorage.setItem("dbKanbanColOrder", JSON.stringify(order)); } catch (_) {}
    renderDbKanban();
}

// Найти сделку во всех загруженных коллекциях (список + канбан).
function dbFindDeal(dealId) {
    const id = Number(dealId);
    return (dbOrdersState.deals || []).find(d => Number(d.crm_deal_id) === id)
        || (dbOrdersState.kanbanDeals || []).find(d => Number(d.crm_deal_id) === id) || null;
}
function dbSetDealStatusLocal(dealId, statusId, statusName) {
    const id = Number(dealId);
    [dbOrdersState.deals, dbOrdersState.kanbanDeals].forEach(arr => (arr || []).forEach(d => {
        if (Number(d.crm_deal_id) === id) { d.status_id = statusId; d.status_name = statusName; }
    }));
    // синхронизируем статус в открытой карточке заказа
    if (dbCardData && Number(dbCardData.deal?.crm_deal_id) === id) {
        dbCardData.deal.status_id = statusId;
        dbCardData.deal.status_name = statusName;
        const ov = document.getElementById("dbDealCardOverlay");
        if (ov && ov.style.display !== "none") renderDbDealCard(dbCardData, dbCardDealId);
    }
}

// ---- Смена статуса сделки (оптимистично + PUT в CRM через бэкенд) ----
async function setDealStatus(dealId, statusId) {
    const deal = dbFindDeal(dealId);
    const prev = deal ? { status_id: deal.status_id, status_name: deal.status_name } : null;
    const st = (dbOrdersState.statuses || []).find(s => Number(s.id) === Number(statusId));
    dbSetDealStatusLocal(dealId, Number(statusId), st ? st.name : (deal ? deal.status_name : ""));
    renderDbOrders();
    try {
        await clientsApi("setDealStatus", { crmId: Number(dealId), statusId: Number(statusId) });
        if (typeof showReadinessToast === "function") {
            showReadinessToast(`№ ${deal?.num || dealId} → ${st?.name || ""}`);
        }
    } catch (e) {
        console.error("setDealStatus", e);
        if (prev) dbSetDealStatusLocal(dealId, prev.status_id, prev.status_name);
        renderDbOrders();
        alert("Не удалось сменить статус сделки в CRM.");
    }
}

function dbStatusPillColors(st) {
    const bg = (st && st.bk_color) ? st.bk_color : "#dfdfdf";
    const fg = st ? (st.text_color === "white" ? "#fff" : "#1c1b19") : "#555";
    return { bg, fg };
}
// Статус сделки — цветная пилюля-кнопка, по клику открывается цветное меню статусов.
function dbDealStatusSelectHtml(d) {
    const statuses = dbOrdersState.statuses || [];
    const cur = d.status_id != null ? Number(d.status_id) : null;
    const curSt = statuses.find(s => Number(s.id) === cur) || null;
    const { bg, fg } = dbStatusPillColors(curSt);
    const label = curSt ? curSt.name : (d.status_name || "Статус не установлен");
    if (!statuses.length) {
        return `<span class="dbk-status-pill" style="background:${bg};color:${fg}">${escapeHtml(label)}</span>`;
    }
    return `<button type="button" class="dbk-status-pill" style="background:${bg};color:${fg}" onclick="dbOpenDealStatusMenu(event, ${d.crm_deal_id})">${escapeHtml(label)}</button>`;
}

// Цветное меню смены статуса (общий элемент в body, позиционируется под пилюлей).
let dbStatusMenuDealId = null;
function dbOpenDealStatusMenu(e, dealId) {
    if (e) e.stopPropagation();
    dbCloseStatusMenu();
    dbStatusMenuDealId = dealId;
    const statuses = dbOrdersState.statuses || [];
    const deal = dbFindDeal(dealId);
    const cur = deal && deal.status_id != null ? Number(deal.status_id) : null;
    const menu = document.createElement("div");
    menu.className = "dbk-status-menu";
    menu.id = "dbStatusMenu";
    menu.innerHTML = statuses.map(s => {
        const { bg } = dbStatusPillColors(s);
        return `<button type="button" class="dbk-status-opt${Number(s.id) === cur ? " is-cur" : ""}" onclick="dbPickDealStatus(${s.id})"><span class="dbk-status-swatch" style="background:${bg}"></span><span class="dbk-status-optname">${escapeHtml(s.name)}</span></button>`;
    }).join("");
    document.body.appendChild(menu);
    const rect = e.currentTarget.getBoundingClientRect();
    const mw = Math.max(220, Math.min(280, rect.width + 60));
    let left = rect.left;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    menu.style.width = mw + "px";
    menu.style.left = Math.max(8, left) + "px";
    // если снизу не влезает — открыть вверх
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 260 && rect.top > 260) menu.style.top = (rect.top - menu.offsetHeight - 4) + "px";
    else menu.style.top = (rect.bottom + 4) + "px";
    setTimeout(() => document.addEventListener("click", dbStatusMenuOutside), 0);
}
function dbStatusMenuOutside(ev) {
    const menu = document.getElementById("dbStatusMenu");
    if (menu && !menu.contains(ev.target)) dbCloseStatusMenu();
}
function dbCloseStatusMenu() {
    const menu = document.getElementById("dbStatusMenu");
    if (menu) menu.remove();
    document.removeEventListener("click", dbStatusMenuOutside);
    dbStatusMenuDealId = null;
}
function dbPickDealStatus(statusId) {
    const id = dbStatusMenuDealId;
    dbCloseStatusMenu();
    if (id != null) setDealStatus(id, statusId);
}

// ---- Список заказов (стиль раздела «Заказы») ----
function dbListHead() {
    return `<div class="crm-list-thead" aria-hidden="true">
        <div class="dl-cell dl-num">№</div>
        <div class="dl-cell dl-client">Клиент</div>
        <div class="dl-cell dl-content">Содержимое</div>
        <div class="dl-cell dl-sum">Сумма / Долг</div>
        <div class="dl-cell dl-status">Статус</div>
        <div class="dl-cell dl-resp">Ответственный</div>
        <div class="dl-cell dl-date">Создано</div>
    </div>`;
}
// Содержимое сделки → каждая позиция с новой строки и номером «1)» (номер акцентным цветом).
// Делим по переводу строки (в именах элементов бывает «; », по нему делить нельзя).
function dbContentHtml(content) {
    const items = String(content || "").split("\n").map(s => s.trim()).filter(Boolean);
    if (!items.length) return "—";
    return `<div class="dbk-content-list">${items.map((it, i) =>
        `<div class="dbk-content-item"><span class="dbk-content-num">${i + 1})</span> ${escapeHtml(it)}</div>`).join("")}</div>`;
}
function dbListRowHtml(d) {
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = Math.max(0, amount - debt);
    const cls = debt <= 0.009 ? "is-ok" : (paid <= 0.009 ? "is-unpaid" : "is-partial");
    const note = debt > 0.009
        ? `<div class="dl-sum-note">Долг ${money(debt)} ₽</div>`
        : `<div class="dl-sum-note">Оплачено</div>`;
    return `
        <div class="crm-item crm-item--list dbk-list-row">
            <div class="dl-cell dl-num"><a class="dbk-num-link" onclick="openDbDealCard(${d.crm_deal_id})" title="Открыть заказ">№ ${escapeHtml(String(d.num ?? d.crm_deal_id ?? ""))}</a></div>
            <div class="dl-cell dl-client"><span class="dl-client-name">${escapeHtml(d.client_name || "—")}</span></div>
            <div class="dl-cell dl-content">${dbContentHtml(d.content)}</div>
            <div class="dl-cell dl-sum"><div class="dl-sum-total ${cls}">${money(amount)} ₽</div>${note}</div>
            <div class="dl-cell dl-status">${dbDealStatusSelectHtml(d)}</div>
            <div class="dl-cell dl-resp">${escapeHtml(d.employee_name || "—")}</div>
            <div class="dl-cell dl-date">${escapeHtml(d.created_at_crm || "")}</div>
        </div>`;
}
function renderDbList() {
    const host = document.getElementById("dbOrdersBody");
    if (!host) return;
    if (dbEmptyMsg(host, dbOrdersState.deals.length)) return;
    const deals = dbOrdersState.deals;
    if (!deals.length) {
        const filtered = dbOrdersState.query || dbFiltersActive();
        host.innerHTML = `<div class="dbk-empty">${filtered ? "Ничего не найдено." : "Нет заказов в базе. Нажмите «⟳ Сделки», затем «⟳ Элементы»."}</div>`;
        return;
    }
    host.innerHTML = `
        <div class="crm-list-table dbk-list-table">${dbListHead()}${deals.map(dbListRowHtml).join("")}</div>
        <div class="dbk-listfoot">
            <div class="dbk-count">Всего: <b>${dbOrdersState.total}</b> · стр. ${dbOrdersState.page} из ${dbOrdersState.pages}</div>
            ${renderDbPager()}
        </div>`;
}

// ---- Синхронизация ----
async function syncDbDeals(btn) {
    if (!ensureActiveSession()) return;
    const original = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "Синхронизация…"; }
    try {
        const data = await clientsApi("syncDealsFromCrm", {});
        if (typeof showReadinessToast === "function") {
            showReadinessToast(`Сделки: ${Number(data?.total ?? 0)}${data?.deleted ? `, удалено ${data.deleted}` : ""}`);
        }
        await loadDbDeals();
    } catch (e) {
        console.error("syncDbDeals", e);
        alert("Не удалось синхронизировать сделки.");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
}

// Бэкфилл элементов — фоновая задача. Прогресс/итог показываем баннером (переживает
// перезагрузку страницы: статус хранится на сервере, опрашиваем при открытии раздела).
let dbSyncStatusTimer = null;
let dbSyncWasRunning = false;
async function syncDbElements(btn) {
    if (!ensureActiveSession()) return;
    if (btn) { btn.disabled = true; }
    try {
        await clientsApi("syncDealElements", {});   // старт (возвращается сразу)
        if (typeof showReadinessToast === "function") showReadinessToast("Синхронизация элементов запущена…");
        dbSyncWasRunning = true;
        refreshDbSyncStatus();
    } catch (e) {
        console.error("syncDbElements", e);
        alert("Не удалось запустить синхронизацию элементов.");
    } finally {
        if (btn) btn.disabled = false;
    }
}
// Опрос статуса задачи + отрисовка баннера. Вызывается при открытии раздела и по таймеру.
async function refreshDbSyncStatus() {
    try {
        const data = await clientsApi("elementsSyncStatus", {});
        const job = data?.job || null;
        renderDbSyncBanner(job);
        if (job && job.running) {
            dbSyncWasRunning = true;
            clearTimeout(dbSyncStatusTimer);
            dbSyncStatusTimer = setTimeout(refreshDbSyncStatus, 3000);
        } else if (dbSyncWasRunning) {
            // только что завершилось — обновим данные раздела
            dbSyncWasRunning = false;
            loadDbDeals();
        }
    } catch (_) { /* нет сессии/сети — молча */ }
}
function dbDismissSyncBanner() {
    const el = document.getElementById("dbSyncBanner");
    if (el) el.remove();
}
function renderDbSyncBanner(job) {
    const container = document.getElementById("db-orders-container");
    const bodyEl = document.getElementById("dbOrdersBody");
    if (!container || !bodyEl) return;
    let el = document.getElementById("dbSyncBanner");
    const empty = !job || (!job.running && !job.finishedAt && !job.startedAt);
    if (empty) { if (el) el.remove(); if (dbOrdersState.view === "kanban") applyDbKanbanHeight(); return; }
    if (!el) {
        el = document.createElement("div");
        el.id = "dbSyncBanner";
        container.insertBefore(el, bodyEl);
    }
    if (job.running) {
        const total = job.total || 0, done = job.deals || 0;
        const pct = total ? Math.round(done / total * 100) : 0;
        el.className = "dbk-sync-banner is-running";
        el.innerHTML = `
            <div class="dbk-sync-row">
                <span class="dbk-sync-spin" aria-hidden="true"></span>
                <span>Синхронизация элементов: <b>${done} / ${total}</b> сделок (${pct}%)${job.elements ? ` · элементов: ${job.elements}` : ""}${job.failed ? ` · ошибок: ${job.failed}` : ""} — идёт, можно закрыть вкладку</span>
            </div>
            <div class="dbk-sync-bar"><i style="width:${pct}%"></i></div>`;
    } else {
        el.className = "dbk-sync-banner is-done";
        const t = job.finishedAt ? new Date(job.finishedAt).toLocaleString("ru-RU") : "";
        const errText = job.error ? ` · ошибка: ${escapeHtml(job.error)}` : (job.failed ? ` · с ошибками: ${job.failed}` : "");
        el.innerHTML = `
            <div class="dbk-sync-row">
                <span>✅ Элементы синхронизированы: <b>${job.elements || 0}</b> (по <b>${job.deals || 0}</b> сделкам)${t ? ` · завершено ${escapeHtml(t)}` : ""}${errText}</span>
                <button type="button" class="dbk-sync-close" onclick="dbDismissSyncBanner()" title="Скрыть" aria-label="Скрыть">×</button>
            </div>`;
    }
    if (dbOrdersState.view === "kanban") applyDbKanbanHeight();
}

// ---- Карточка заказа (сделка + элементы) ----
function dbDealCardEsc(e) {
    if (e.key !== "Escape") return;
    // Если открыт просмотр превью на весь экран — Esc закрывает его (обрабатывает dboOpenLightbox), не заказ.
    if (document.querySelector(".preview-lightbox")) return;
    // Если открыта форма позиции — Esc закрывает её (обрабатывает dbElEditEsc), не заказ.
    if (document.getElementById("dbElEditOverlay")) return;
    if (document.getElementById("dbPayOverlay")) return;
    if (document.getElementById("dbInvOverlay")) return;
    closeDbDealCard();
}
function closeDbDealCard() {
    const ov = document.getElementById("dbDealCardOverlay");
    if (ov) ov.style.display = "none";
    document.removeEventListener("keydown", dbDealCardEsc);
    dbCloseStatusMenu();
    if (typeof dbCloseElStatusMenu === "function") dbCloseElStatusMenu();
    if (typeof closeDbElEdit === "function") closeDbElEdit();
    if (typeof closeDbPayModal === "function") closeDbPayModal();
    if (typeof dbCloseInvoice === "function") dbCloseInvoice();
}

async function openDbDealCard(crmId) {
    if (!ensureActiveSession() || !crmId) return;
    let ov = document.getElementById("dbDealCardOverlay");
    if (!ov) {
        ov = document.createElement("div");
        ov.id = "dbDealCardOverlay";
        ov.className = "client-card-overlay";
        ov.setAttribute("onmousedown", "overlayDown(event)");
        ov.setAttribute("onclick", "if (overlayClickedSelf(event)) closeDbDealCard()");
    }
    document.body.appendChild(ov);   // всегда в конец body → поверх карточки клиента
    ov.style.display = "flex";
    ov.innerHTML = `<div class="client-card"><div class="client-card-loading">Загрузка заказа…</div></div>`;
    document.addEventListener("keydown", dbDealCardEsc);
    try {
        const data = await clientsApi("getDeal", { crmId: Number(crmId) });
        renderDbDealCard(data, crmId);
    } catch (e) {
        console.error("getDeal", e);
        ov.innerHTML = `
            <div class="client-card">
                <div class="client-card-header"><h3>Ошибка</h3>
                    <button class="client-card-close" onclick="closeDbDealCard()" aria-label="Закрыть">&times;</button></div>
                <div class="client-card-body"><div class="clients-empty clients-empty--error">Не удалось загрузить заказ.</div></div>
            </div>`;
    }
}

// Значение доппполя: ссылку — линком, остальное — текстом.
function dbAfValueHtml(v) {
    const s = String(v ?? "").trim();
    if (/^https?:\/\//i.test(s)) return `<a href="${escapeHtml(s)}" target="_blank" rel="noopener">ссылка ↗</a>`;
    return escapeHtml(s);
}
// Только поля с непустым значением.
function dbAfWithValue(fields) {
    return Array.isArray(fields) ? fields.filter(f => String(f?.value ?? "").trim() !== "") : [];
}

// Статусы элементов и id сделки текущей карточки (для смены статуса элемента).
let dbCardDealId = null;
let dbCardElementStatuses = [];

let dbCardData = null;   // текущие данные карточки (для оптимистичного апдейта статусов)
let dbCardCategories = []; // категории прайс-листа (для смены категории элемента)
let dbCardPayMethods = []; // методы оплаты CRM (для ручного ввода оплат)

// ---- Редактирование элемента (поля; имя/категорию — через пересоздание в CRM) ----
function dbElEditEsc(e) { if (e.key === "Escape") closeDbElEdit(); }
function closeDbElEdit() {
    const ov = document.getElementById("dbElEditOverlay");
    if (ov) ov.remove();
    document.removeEventListener("keydown", dbElEditEsc);
}
// Базовое имя без хвоста « / Категория» (категория выбирается отдельным дропдауном).
function dbElBaseName(e) {
    let n = String(e.name || e.category_and_name || "").trim();
    const catId = e.category_id != null ? Number(e.category_id) : null;
    const cat = (dbCardCategories || []).find(c => Number(c.id) === catId);
    if (cat && cat.name && n.endsWith(" / " + cat.name)) {
        n = n.slice(0, -(" / " + cat.name).length).trim();
    }
    return n;
}
function dbOpenElEdit(elId) {
    const e = (dbCardData?.elements || []).find(x => Number(x.crm_element_id) === Number(elId));
    if (!e) return;
    closeDbElEdit();
    const name = dbElBaseName(e);
    const catId = e.category_id != null ? Number(e.category_id) : null;
    const catOpts = (dbCardCategories || []).map(c =>
        `<option value="${c.id}"${Number(c.id) === catId ? " selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
    const costHq = dbAfById(e.additional_fields, 1057);
    const sheets = dbAfById(e.additional_fields, 1066);
    // себестоимость за единицу (для пропорционального пересчёта при смене кол-ва)
    const q0 = Number(e.quantity) || 0;
    dbEditCostPerUnit = q0 ? (Number(e.cost) || 0) / q0 : 0;
    const ov = document.createElement("div");
    ov.id = "dbElEditOverlay";
    ov.className = "client-card-overlay dbo-edit-overlay";
    ov.setAttribute("onmousedown", "overlayDown(event)");
    ov.setAttribute("onclick", "if (overlayClickedSelf(event)) closeDbElEdit()");
    ov.style.display = "flex";
    ov.innerHTML = `
        <div class="dbo-edit" role="dialog" aria-modal="true">
            <div class="dbo-edit-head">
                <h3>Редактирование позиции</h3>
                <button class="dbo-close" onclick="closeDbElEdit()" aria-label="Закрыть">×</button>
            </div>
            <div class="dbo-edit-body">
                <label class="dbo-edit-wide">Наименование
                    <textarea id="dbEditName" class="dbo-edit-name" rows="1" oninput="dbAutoGrow(this)">${escapeHtml(name)}</textarea>
                </label>
                <label class="dbo-edit-wide">Категория
                    <select id="dbEditCat">${catOpts || `<option value="">— нет категорий —</option>`}</select>
                </label>
                <div class="dbo-edit-row">
                    <label>Ед.изм
                        <div class="dbo-units" id="dbUnitsWrap">
                            <button type="button" class="dbo-units-btn" id="dbUnitsBtn" onclick="dbToggleUnits(event)"><span id="dbUnitsBtnText">${escapeHtml(e.units || "шт")}</span><span class="dbo-units-caret">▾</span></button>
                            <div class="dbo-units-menu" id="dbUnitsMenu" hidden>
                                <button type="button" class="dbo-units-opt" onclick="dbPickUnit('шт')">шт</button>
                                <button type="button" class="dbo-units-opt" onclick="dbPickUnit('услуга')">услуга</button>
                                <input type="text" class="dbo-units-custom" placeholder="Своё значение" maxlength="32" oninput="dbUnitsCustom(this.value)">
                            </div>
                            <input type="hidden" id="dbEditUnits" value="${escapeHtml(e.units || "шт")}">
                        </div>
                    </label>
                    <label>Кол-во<input type="text" inputmode="decimal" id="dbEditQty" value="${Number(e.quantity) || 0}" oninput="dbCleanNum(this); dbEditRecalc('qty')"></label>
                    <label>Цена<input type="text" inputmode="decimal" id="dbEditPrice" value="${Number(e.price) || 0}" oninput="dbCleanNum(this); dbEditRecalc('price')"></label>
                    <label>Себестоимость<input type="text" inputmode="decimal" id="dbEditCost" value="${Number(e.cost) || 0}" oninput="dbCleanNum(this)" onblur="dbCostBlur(this)"></label>
                    <label>Сумма<input type="text" inputmode="decimal" id="dbEditTotal" value="${Number(e.total) || 0}" oninput="dbCleanNum(this); dbEditRecalc('total')"></label>
                </div>
                <label class="dbo-edit-wide">Себестоимость HQ<input type="text" inputmode="decimal" id="dbEditCostHq" value="${escapeHtml(costHq)}" oninput="dbCleanNum(this)"></label>
                <label class="dbo-edit-wide">Количество листов<input type="text" inputmode="decimal" id="dbEditSheets" value="${escapeHtml(sheets)}" oninput="dbCleanNum(this)"></label>
                <div class="dbo-assets-title dbo-assets-heading">Превью и макеты</div>
                ${dboAssetsEditHtml(elId)}
            </div>
            <div class="dbo-edit-note">Имя и категорию в PrintOffice нельзя менять напрямую — при их изменении позиция пересоздаётся (удаляется и создаётся заново).</div>
            <div class="dbo-edit-actions">
                <button class="dbo-btn dbo-btn-primary" id="dbEditSaveBtn" onclick="dbSaveElEdit(${elId})">Сохранить</button>
                <button class="dbo-btn" onclick="closeDbElEdit()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
    document.addEventListener("keydown", dbElEditEsc);
    setTimeout(() => { const t = document.getElementById("dbEditName"); if (t) { dbAutoGrow(t); t.focus(); } }, 0);
    // Освежаем превью/макеты позиции (если карточка ещё не догрузила).
    const cached = dboAssets.get(dboAssetKey(elId));
    if (!cached || cached.status !== "ready") dboLoadElementAssets(elId).catch(() => {});
}
// Авто-высота textarea наименования (растёт вниз по мере ввода).
function dbAutoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 40) + "px";
}
// Дропдаун единиц измерения (как в разделе «Заказы» по API): пресеты + своё значение.
function dbToggleUnits(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("dbUnitsMenu");
    if (!menu) return;
    const open = menu.hidden;
    menu.hidden = !open;
    if (open) setTimeout(() => document.addEventListener("click", dbUnitsOutside), 0);
    else document.removeEventListener("click", dbUnitsOutside);
}
function dbUnitsOutside(e) {
    const wrap = document.getElementById("dbUnitsWrap");
    if (wrap && !wrap.contains(e.target)) { const m = document.getElementById("dbUnitsMenu"); if (m) m.hidden = true; document.removeEventListener("click", dbUnitsOutside); }
}
function dbSetUnitsValue(v) {
    const val = String(v || "").trim() || "шт";
    const hid = document.getElementById("dbEditUnits");
    const txt = document.getElementById("dbUnitsBtnText");
    if (hid) hid.value = val;
    if (txt) txt.textContent = val;
}
function dbPickUnit(v) {
    dbSetUnitsValue(v);
    const menu = document.getElementById("dbUnitsMenu");
    if (menu) menu.hidden = true;
    document.removeEventListener("click", dbUnitsOutside);
}
function dbUnitsCustom(v) { dbSetUnitsValue(v); }
let dbEditCostPerUnit = 0;
// Пересчёт цен на лету: кол-во/цена → сумма и себест.; сумма → цена.
function dbEditRecalc(source) {
    const g = id => { const el = document.getElementById(id); return el ? (Number(el.value) || 0) : 0; };
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = dbRound(v); };
    const qty = g("dbEditQty"), price = g("dbEditPrice"), total = g("dbEditTotal");
    if (source === "qty") {
        s("dbEditTotal", qty * price);
        s("dbEditCost", dbEditCostPerUnit * qty);   // себест. пропорционально кол-ву
    } else if (source === "price") {
        s("dbEditTotal", qty * price);
    } else if (source === "total") {
        s("dbEditPrice", qty ? total / qty : price);
    }
}
function dbRound(n) {
    const r = Math.round((Number(n) || 0) * 100) / 100;
    return Number.isInteger(r) ? String(r) : String(r);
}
// Чистим число: убираем пробелы (в т.ч. неразрывные), запятую → точку, только цифры/точка/минус.
// (в CRM нельзя записать «1 500» — пробел ломает число).
function dbCleanNum(el) {
    if (!el) return;
    const v = String(el.value)
        .replace(/[\s   ]/g, "")
        .replace(",", ".")
        .replace(/[^0-9.\-]/g, "");
    if (el.value !== v) el.value = v;
}
// Себестоимость не может быть пустой — пусто → 0 (0 или любое число).
function dbCostBlur(el) {
    dbCleanNum(el);
    if (!String(el.value).trim()) el.value = "0";
}
async function dbSaveElEdit(elId) {
    const e = (dbCardData?.elements || []).find(x => Number(x.crm_element_id) === Number(elId));
    if (!e) return;
    const val = id => document.getElementById(id)?.value;
    const name = String(val("dbEditName") || "").trim();
    const categoryId = val("dbEditCat") !== "" ? Number(val("dbEditCat")) : null;
    const units = String(val("dbEditUnits") || "шт").trim() || "шт";
    const quantity = Number(val("dbEditQty")) || 0;
    const price = Number(val("dbEditPrice")) || 0;
    const total = Number(val("dbEditTotal")) || 0;
    const cost = Number(val("dbEditCost")) || 0;
    const costHq = String(val("dbEditCostHq") || "").trim();
    const sheets = String(val("dbEditSheets") || "").trim();
    // имя/категория изменились → пересоздание
    const recreate = (name !== dbElBaseName(e)) || (categoryId !== (e.category_id != null ? Number(e.category_id) : null));

    const btn = document.getElementById("dbEditSaveBtn");
    if (btn) { btn.disabled = true; btn.textContent = recreate ? "Пересоздание…" : "Сохранение…"; }
    try {
        const data = await clientsApi("editElement", {
            dealId: Number(dbCardDealId), elementId: Number(elId),
            name, categoryId, units, quantity, price, total, cost, costHq, sheets, recreate
        });
        // обновляем карточку свежими данными
        if (data?.deal) dbCardData.deal = data.deal;
        if (Array.isArray(data?.elements)) dbCardData.elements = data.elements;
        renderDbDealCard(dbCardData, dbCardDealId);
        closeDbElEdit();
        if (typeof showReadinessToast === "function") showReadinessToast("Позиция сохранена");
        // освежим список/канбан позади (суммы/содержимое могли измениться)
        loadDbDeals();
    } catch (err) {
        console.error("editElement", err);
        if (btn) { btn.disabled = false; btn.textContent = "Сохранить"; }
        alert("Не удалось сохранить позицию в CRM.");
    }
}

function dbIcon(name) { return (typeof icon === "function") ? icon(name) : ""; }
// Цвет/иконка статуса элемента по имени (как getStatusIcon в CRM).
function dbElStatusColor(name, bkColor) {
    if (bkColor) return bkColor;
    const n = String(name || "").toLowerCase().trim();
    if (!n || n === "без статуса") return "#95a5a6";
    if (n === "печать") return "#2F6BD8";
    if (n === "постпечать") return "#b06a1f";
    if (n === "завершено") return "#1F9D55";
    return "#7a766c";
}
function dbElStatusIconName(name) {
    const n = String(name || "").toLowerCase().trim();
    if (!n || n === "без статуса") return "circle";
    if (n === "печать") return "printer";
    if (n === "постпечать") return "scissors";
    if (n === "завершено") return "check";
    return "box";
}
function dbElStatusMeta(e) {
    const cur = e.status_id != null ? Number(e.status_id) : null;
    const known = (dbCardElementStatuses || []).find(s => Number(s.id) === cur) || null;
    const name = known ? known.name : (e.status_name || "");
    return { name: name || "Без статуса", color: dbElStatusColor(name, known && known.bk_color), iconName: dbElStatusIconName(name) };
}
// Кружок-статус элемента (иконка, цвет по статусу) — по клику открывает меню.
function dbElStatusBtn(e) {
    const m = dbElStatusMeta(e);
    return `<button type="button" class="dbo-el-statusbtn" style="color:${m.color};border-color:${m.color}" title="${escapeHtml(m.name)}" onclick="dbOpenElStatusMenu(event, ${e.crm_element_id})">${dbIcon(m.iconName)}</button>`;
}

let dbElStatusMenuElId = null;
function dbOpenElStatusMenu(ev, elId) {
    if (ev) ev.stopPropagation();
    dbCloseStatusMenu();
    dbCloseElStatusMenu();
    dbElStatusMenuElId = elId;
    const statuses = dbCardElementStatuses || [];
    const el = (dbCardData?.elements || []).find(x => Number(x.crm_element_id) === Number(elId));
    const cur = el && el.status_id != null ? Number(el.status_id) : null;
    const menu = document.createElement("div");
    menu.className = "dbk-status-menu"; menu.id = "dbElStatusMenu";
    menu.innerHTML = statuses.map(s => {
        const c = dbElStatusColor(s.name, s.bk_color);
        return `<button type="button" class="dbk-status-opt${Number(s.id) === cur ? " is-cur" : ""}" onclick="dbPickElStatus(${s.id})"><span class="dbk-status-swatch" style="background:${c}"></span><span class="dbk-status-optname">${escapeHtml(s.name)}</span></button>`;
    }).join("");
    document.body.appendChild(menu);
    const rect = ev.currentTarget.getBoundingClientRect();
    const mw = 240;
    let left = rect.left; if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    menu.style.width = mw + "px";
    menu.style.left = Math.max(8, left) + "px";
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 260 && rect.top > 260) menu.style.top = (rect.top - menu.offsetHeight - 4) + "px";
    else menu.style.top = (rect.bottom + 4) + "px";
    setTimeout(() => document.addEventListener("click", dbElStatusMenuOutside), 0);
}
function dbElStatusMenuOutside(ev) {
    const menu = document.getElementById("dbElStatusMenu");
    if (menu && !menu.contains(ev.target)) dbCloseElStatusMenu();
}
function dbCloseElStatusMenu() {
    const menu = document.getElementById("dbElStatusMenu");
    if (menu) menu.remove();
    document.removeEventListener("click", dbElStatusMenuOutside);
    dbElStatusMenuElId = null;
}
function dbPickElStatus(statusId) {
    const elId = dbElStatusMenuElId;
    dbCloseElStatusMenu();
    if (elId == null || !statusId) return;
    const st = (dbCardElementStatuses || []).find(s => Number(s.id) === Number(statusId));
    const el = (dbCardData?.elements || []).find(x => Number(x.crm_element_id) === Number(elId));
    const prev = el ? { status_id: el.status_id, status_name: el.status_name } : null;
    if (el) { el.status_id = Number(statusId); el.status_name = st ? st.name : el.status_name; }
    renderDbDealCard(dbCardData, dbCardDealId);
    clientsApi("setElementStatus", { dealId: Number(dbCardDealId), elementId: Number(elId), statusId: Number(statusId) })
        .then(() => { if (typeof showReadinessToast === "function") showReadinessToast("Статус элемента обновлён"); })
        .catch(err => {
            console.error("setElementStatus", err);
            if (el && prev) { el.status_id = prev.status_id; el.status_name = prev.status_name; renderDbDealCard(dbCardData, dbCardDealId); }
            alert("Не удалось сменить статус элемента в CRM.");
        });
}

// Значение доп-поля по его id (из additional_fields сделки).
function dbAfById(fields, id) {
    if (!Array.isArray(fields)) return "";
    const f = fields.find(x => Number(x?.id) === Number(id));
    return f ? String(f.value ?? "").trim() : "";
}
function money2(n) {
    return (Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const DBO_USER_ICON = '<svg class="dbo-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/></svg>';
const DBO_COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/></svg>';

// Удаление позиции: подтверждение → бэкенд удаляет её в CRM (PrintOffice) + БД.
async function dbDeleteElement(elementId, btn) {
    const list = dbCardData?.elements || [];
    const idx = list.findIndex(x => Number(x.crm_element_id) === Number(elementId));
    if (idx < 0) return;
    const el = list[idx];
    const nm = el.category_and_name || el.name || "позицию";
    if (!confirm(`Удалить позицию «${nm}»?\n\nУдаление произойдёт и в PrintOffice. Действие необратимо.`)) return;
    if (btn) btn.disabled = true;
    const removed = list[idx];
    list.splice(idx, 1);                       // оптимистично убираем
    renderDbDealCard(dbCardData, dbCardDealId);
    try {
        await clientsApi("deleteElement", { dealId: Number(dbCardDealId), elementId: Number(elementId) });
        if (typeof loadDbDeals === "function") loadDbDeals();
        // Достоверные данные (суммы + доп-поля позиций) — перечитываем сделку.
        try { const fresh = await clientsApi("getDeal", { crmId: Number(dbCardDealId) }); renderDbDealCard(fresh, dbCardDealId); } catch (_) {}
        if (typeof showReadinessToast === "function") showReadinessToast("Позиция удалена");
    } catch (e) {
        console.error("deleteElement", e);
        (dbCardData.elements ||= []).splice(idx, 0, removed);   // откат
        renderDbDealCard(dbCardData, dbCardDealId);
        alert("Не удалось удалить позицию: " + String(e.message || e));
    }
}
// Удаление всей сделки: подтверждение → бэкенд удаляет её в CRM (PrintOffice) + БД.
async function dbDeleteDeal(crmId, btn) {
    const d = dbCardData?.deal || {};
    const num = String(d.num ?? crmId);
    if (!confirm(`Удалить заказ № ${num} полностью?\n\nЗаказ и все его позиции будут удалены, в том числе в PrintOffice. Действие необратимо.`)) return;
    if (btn) { btn.disabled = true; btn.textContent = "Удаляем…"; }
    try {
        await clientsApi("deleteDeal", { dealId: Number(crmId) });
        if (typeof showReadinessToast === "function") showReadinessToast(`Заказ № ${num} удалён`);
        closeDbDealCard();
        if (typeof loadDbDeals === "function") loadDbDeals();
    } catch (e) {
        console.error("deleteDeal", e);
        alert("Не удалось удалить заказ: " + String(e.message || e));
        if (btn) { btn.disabled = false; btn.textContent = "Удалить заказ"; }
    }
}
// Копия заказа: подтверждение → бэкенд создаёт новую сделку (без макетов) → открываем её.
async function dbCopyDeal(crmId, btn) {
    const d = dbCardData?.deal || {};
    const num = String(d.num ?? crmId);
    if (!confirm(`Создать копию заказа № ${num}?\n\nСкопируются все позиции с ценами и себестоимостью. Макеты и превью не копируются.`)) return;
    if (btn) { btn.disabled = true; btn.classList.add("is-busy"); }
    try {
        const data = await clientsApi("copyDeal", { dealId: Number(crmId) });
        const newId = Number(data?.newDealId);
        if (!Number.isFinite(newId)) throw new Error("бэкенд не вернул id новой сделки");
        if (typeof showReadinessToast === "function") showReadinessToast(`Создан заказ № ${data?.deal?.num || newId} (копия)`);
        if (typeof loadDbDeals === "function") loadDbDeals();
        openDbDealCard(newId);   // откроем карточку новой сделки
    } catch (e) {
        console.error("copyDeal", e);
        alert("Не удалось создать копию заказа: " + String(e.message || e));
        if (btn) { btn.disabled = false; btn.classList.remove("is-busy"); }
    }
}

// Доп-инфо под элементом: «Название поля: значение · …»
function dbElAfLine(e) {
    const af = dbAfWithValue(e.additional_fields);
    if (!af.length) return "";
    return `<div class="dbo-el-meta">${af.map(f => `${escapeHtml(f.name)}: <b>${dbAfValueHtml(f.value)}</b>`).join(" · ")}</div>`;
}
// История оплат сделки — второстепенный блок (мягкий, ненавязчивый).
// Приход — зелёным, отмена — красным. У проведённых платежей — кнопка «Отмена».
function dbPaymentsBlock(payments) {
    const list = Array.isArray(payments) ? payments : [];
    if (!list.length) {
        return `<details class="dbo-pay-section">
            <summary class="dbo-pay-caption">История оплат <span class="dbo-pay-count">0</span></summary>
            <div class="dbo-pay-empty">Оплат пока нет.</div>
        </details>`;
    }
    const rows = list.map(p => {
        const amt = Number(p.amount) || 0;
        const isCancel = p.is_billing === false || amt < 0;      // отмена/списание
        const cancelled = !isCancel && Number(p.rollback_pay_id) > 0; // платёж уже отменён
        const canCancel = !isCancel && !cancelled && amt > 0.009;
        const sign = amt > 0 ? "+" : "";
        const cls = isCancel ? "is-cancel" : (cancelled ? "is-cancelled" : "is-income");
        const payRef = p.crm_payment_id != null ? Number(p.crm_payment_id) : 0; // dph_id (id истории оплат)
        return `<div class="dbo-pay-line ${cls}">
            <span class="dbo-pay-date">${escapeHtml(p.date_crm || "")}</span>
            <span class="dbo-pay-amount">${sign}${money2(amt)} ₽</span>
            <span class="dbo-pay-method">${escapeHtml(p.method_name || "—")}</span>
            <span class="dbo-pay-user">${escapeHtml(p.user_name || "")}</span>
            <span class="dbo-pay-comment">${escapeHtml(p.comment || "")}${isCancel ? ' <span class="dbo-pay-tag">отмена</span>' : ""}${cancelled ? ' <span class="dbo-pay-tag dbo-pay-tag--muted">отменён</span>' : ""}</span>
            <span class="dbo-pay-act">${canCancel ? `<button type="button" class="dbo-pay-cancel" title="Отменить платёж" onclick="dbOpenPayCancel(${payRef}, ${amt}, '${encodeURIComponent(p.method_name || "")}', '${encodeURIComponent(p.date_crm || "")}')">Отмена</button>` : ""}</span>
        </div>`;
    }).join("");
    return `<details class="dbo-pay-section" open>
        <summary class="dbo-pay-caption">История оплат <span class="dbo-pay-count">${list.length}</span></summary>
        <div class="dbo-pay-list">${rows}</div>
    </details>`;
}

// Строка элемента: СТАТУС(кружок) · НАЗВАНИЕ(+доп-инфо) · КОЛ-ВО · ЦЕНА/ШТ · СЕБЕС. · СУММА.
// На мобиле цена/шт уходит в конец наименования, себестоимость — строкой под названием.
function dbElementRow(e) {
    const qty = Number(e.quantity) || 0;
    const cost = Number(e.cost) || 0;
    const total = Number(e.total) || 0;
    const price = (e.price != null && Number(e.price) > 0) ? Number(e.price) : (qty ? total / qty : 0);
    const units = escapeHtml(e.units || "шт");
    return `
        <div class="dbo-el-row">
            <div class="dbo-el-status">${dbElStatusBtn(e)}<span class="element-preview-thumb dbo-el-thumb" data-el="${e.crm_element_id}"></span></div>
            <div class="dbo-el-name">
                <div class="dbo-el-title dbo-el-title--edit" onclick="dbOpenElEdit(${e.crm_element_id})" title="Редактировать позицию">${escapeHtml(e.category_and_name || e.name || "—")}${price ? `<span class="dbo-el-price-inline"> (${money2(price)} руб./${units})</span>` : ""}</div>
                ${cost ? `<div class="dbo-el-costline">Себестоимость: <b>${money(cost)}</b></div>` : ""}
                ${dbElAfLine(e)}
            </div>
            <div class="dbo-el-qty">${qty} ${units}</div>
            <div class="dbo-el-price">${price ? money2(price) : "—"}</div>
            <div class="dbo-el-cost">${cost ? money(cost) : "—"}</div>
            <div class="dbo-el-sum">${money2(total)}</div>
            <button type="button" class="dbo-el-del" onclick="event.stopPropagation(); dbDeleteElement(${e.crm_element_id}, this)" title="Удалить позицию" aria-label="Удалить позицию">×</button>
        </div>`;
}

function renderDbDealCard(data, crmId) {
    const ov = document.getElementById("dbDealCardOverlay");
    if (!ov) return;
    const d = data?.deal || {};
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    dbCardDealId = crmId;
    dbCardData = data;
    dbCardElementStatuses = Array.isArray(data?.elementStatuses) ? data.elementStatuses : [];
    dbCardCategories = Array.isArray(data?.categories) ? data.categories : dbCardCategories;
    if (Array.isArray(data?.payMethods) && data.payMethods.length) dbCardPayMethods = data.payMethods;
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);
    const dbClientClickable = Number.isFinite(Number(d.client_crm_id)) && Number(d.client_crm_id) > 0;

    // Статус — цветная пилюля с меню (как в «Заказах»).
    const dealStatusControl = (dbOrdersState.statuses && dbOrdersState.statuses.length)
        ? dbDealStatusSelectHtml({ crm_deal_id: crmId, status_id: d.status_id, status_name: d.status_name })
        : `<span class="dbk-status-pill" style="background:#dfdfdf;color:#555">${escapeHtml(d.status_name || "Статус не установлен")}</span>`;

    const elHead = `<div class="dbo-el-head"><span>Статус</span><span>Название</span><span>Кол-во</span><span>Цена/шт</span><span>Себес.</span><span>Сумма</span><span></span></div>`;
    const elBody = elements.length
        ? elements.map(dbElementRow).join("")
        : `<div class="dbo-el-empty">Элементов в базе нет — нажмите «⟳ Элементы» в разделе.</div>`;

    // «Информация о связанных счетах» — поля счёта (допполя PrintOffice), редактируемые.
    const invoiceBlock = dbInvoiceBlock(d, crmId);
    // Прочие доп-поля (кроме себестоимости 476 и полей счёта) — как есть.
    const dealAf = dbAfWithValue(d.additional_fields).filter(f => Number(f?.id) !== 476 && !DBO_INVOICE_FIELDS.includes(Number(f?.id)));
    const dealAfBlock = dealAf.length ? `
        <div class="dbo-section">
            <div class="dbo-section-title">Дополнительная информация</div>
            <div class="dbo-af-list">${dealAf.map(f =>
                `<div class="dbo-af-row"><span class="dbo-af-name">${escapeHtml(f.name || "")}</span><span class="dbo-af-val">${dbAfValueHtml(f.value)}</span></div>`).join("")}</div>
        </div>` : "";

    // Информация по себестоимости (доп-поле 476) — большое редактируемое поле, сохраняется в CRM.
    const costInfo = dbAfById(d.additional_fields, 476);
    const costBlock = `
        <div class="dbo-section">
            <div class="dbo-section-title">Информация по себестоимости</div>
            <textarea class="dbo-costinfo-input" rows="3" placeholder="Заметки по себестоимости заказа…"
                onblur="dbSaveCostInfo(${crmId}, this.value)">${escapeHtml(costInfo)}</textarea>
        </div>`;

    ov.innerHTML = `
        <div class="dbo-card" role="dialog" aria-modal="true">
            <div class="dbo-head">
                <div class="dbo-head-left">
                    <div class="dbo-num">№ ${escapeHtml(String(d.num ?? crmId))}<button type="button" class="dbo-num-copy" onclick="dbCopyDeal(${crmId}, this)" title="Создать копию заказа (без макетов)" aria-label="Создать копию заказа">${DBO_COPY_ICON}</button></div>
                    ${(d.created_at_crm || d.employee_name) ? `<div class="dbo-head-meta">${[
                        d.created_at_crm ? `<b>${escapeHtml(d.created_at_crm)}</b>` : "",
                        d.employee_name ? `Менеджер: <b>${escapeHtml(d.employee_name)}</b>` : ""
                    ].filter(Boolean).join(" · ")}</div>` : ""}
                    <div class="dbo-client${dbClientClickable ? " dbo-client--link" : ""}"${dbClientClickable ? ` onclick="openClientCard(${Number(d.client_crm_id)})" title="Открыть карточку клиента"` : ""}>${DBO_USER_ICON} ${escapeHtml(d.client_name || "—")}</div>
                </div>
                <div class="dbo-head-right">
                    ${dealStatusControl}
                    <a class="dbo-crm" href="https://crm.heavendevelop.ru/editDeal/${crmId}" target="_blank" rel="noopener" title="Открыть в CRM">↗</a>
                </div>
                <button class="dbo-close" onclick="closeDbDealCard()" aria-label="Закрыть">×</button>
            </div>
            <div class="dbo-body">
                <div class="dbo-elements">
                    ${elHead}
                    ${elBody}
                </div>
                <div class="dbo-mid">
                    <div class="dbo-meta">
                        ${d.created_at_crm ? `<div>Дата заказа: <b>${escapeHtml(d.created_at_crm)}</b></div>` : ""}
                        ${d.employee_name ? `<div>Менеджер: <b>${escapeHtml(d.employee_name)}</b></div>` : ""}
                    </div>
                    <div class="payment-summary dbo-totals">
                        <div class="payment-summary-row"><span class="payment-summary-label">Всего</span><span class="payment-summary-value">${money2(amount)}</span><span></span></div>
                        <div class="payment-summary-row paid-row"><span class="payment-summary-label">Оплачено</span><span class="payment-summary-value">${money2(paid)}</span><span class="payment-actions">${debt > 0.009 ? `<button type="button" class="payment-action-btn payment-partial-btn" title="Добавить частичную сумму к оплате" aria-label="Добавить частичную сумму к оплате" onclick="dbOpenPayModal('partial')"><span class="payment-action-icon">+</span></button><button type="button" class="payment-action-btn payment-full-btn" title="Добавить всю сумму" aria-label="Добавить всю сумму" onclick="dbOpenPayModal('full')"><span class="payment-action-icon">+</span></button>` : ""}</span></div>
                        <div class="payment-summary-row"><span class="payment-summary-label">Долг</span><span class="payment-summary-value ${debt > 0.009 ? "payment-alert" : "payment-ok"}">${money2(debt)}</span><span></span></div>
                    </div>
                </div>
                ${dbPaymentsBlock(data?.payments)}
                ${invoiceBlock}
                ${dealAfBlock}
                ${costBlock}
                <div class="dbo-danger-zone">
                    <button type="button" class="dbo-btn dbo-btn-danger dbo-del-deal" onclick="dbDeleteDeal(${crmId}, this)">Удалить заказ</button>
                </div>
            </div>
        </div>`;
    // Подгружаем превью/макеты элементов (Я.Диск) — миниатюры рядом со статусом.
    dboLoadAllAssets(crmId, d.num, elements);
}

// Сохранение «Информации по себестоимости» (доп-поле 476) в CRM + локально.
async function dbSaveCostInfo(crmId, value) {
    const val = String(value ?? "");
    const cur = dbAfById(dbCardData?.deal?.additional_fields, 476);
    if (val === cur) return;   // без изменений — не дёргаем CRM
    try {
        await clientsApi("setDealField", { crmId: Number(crmId), fieldId: 476, value: val });
        // обновим локальные данные карточки
        if (dbCardData?.deal) {
            let af = Array.isArray(dbCardData.deal.additional_fields) ? dbCardData.deal.additional_fields : [];
            let found = false;
            af = af.map(f => (Number(f?.id) === 476 ? (found = true, { ...f, value: val }) : f));
            if (!found) af.push({ id: 476, name: "Информация по себестоимости", value: val });
            dbCardData.deal.additional_fields = af;
        }
        if (typeof showReadinessToast === "function") showReadinessToast("Себестоимость сохранена");
    } catch (e) {
        console.error("dbSaveCostInfo", e);
        alert("Не удалось сохранить информацию по себестоимости в CRM.");
    }
}

// ============ «Информация о связанных счетах» (допполя PrintOffice) ============
// Поля счёта: 477 номер, 1105 дата, 560 ИНН, 1104 ссылка на счёт, 1106 ссылка-привью.
const DBO_INVOICE_FIELDS = [477, 1105, 560, 1104, 1106];
function dbShortUrl(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    try { const x = new URL(s); const t = x.host + x.pathname; return t.length > 34 ? t.slice(0, 32) + "…" : t; }
    catch { return s.length > 34 ? s.slice(0, 32) + "…" : s; }
}
// Инлайн-редактируемое текстовое поле (клик → ввод → сохранение в PrintOffice).
function dbInvEditable(fieldId, value, placeholder) {
    const v = String(value || "").trim();
    const inner = v ? escapeHtml(v) : `<span class="dbo-inv-empty">${escapeHtml(placeholder || "—")}</span>`;
    return `<span class="dbo-inv-edit" data-af="${fieldId}" data-val="${escapeHtml(v)}" tabindex="0" role="button" title="Нажмите, чтобы изменить" onclick="dbInvEditStart(this)">${inner}</span>`;
}
function dbInvLinkRow(label, fieldId, url) {
    const u = String(url || "").trim();
    const linkHtml = u
        ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener" class="dbo-inv-link" title="${escapeHtml(u)}">${escapeHtml(dbShortUrl(u))} ↗</a>`
        : `<span class="dbo-inv-empty">нет ссылки</span>`;
    return `<div class="dbo-inv-row">
        <span class="dbo-inv-label">${escapeHtml(label)}</span>
        <span class="dbo-inv-linkwrap" data-af="${fieldId}" data-url="${escapeHtml(u)}">
            ${linkHtml}
            <button type="button" class="dbo-inv-editbtn" title="Редактировать ссылку" onclick="dbInvEditLink(this)">✎</button>
        </span></div>`;
}
function dbInvoiceBlock(d, crmId) {
    const af = d.additional_fields;
    const num = dbAfById(af, 477), date = dbAfById(af, 1105), inn = dbAfById(af, 560);
    const link = dbAfById(af, 1104), prev = dbAfById(af, 1106);
    return `
        <div class="dbo-section">
            <div class="dbo-section-title">Информация о связанных счетах</div>
            <div class="dbo-invoice-card">
                <div class="dbo-inv-row">
                    <span class="dbo-inv-label">Счёт</span>
                    <span class="dbo-inv-value">№&nbsp;${dbInvEditable(477, num, "—")} от ${dbInvEditable(1105, date, "—")}</span>
                </div>
                <div class="dbo-inv-row">
                    <span class="dbo-inv-label">ИНН контрагента</span>
                    <span class="dbo-inv-value">${dbInvEditable(560, inn, "—")}</span>
                </div>
                ${dbInvLinkRow("Ссылка на счёт", 1104, link)}
                ${dbInvLinkRow("Ссылка-привью", 1106, prev)}
                <div class="dbo-inv-actions">
                    <button type="button" class="dbo-btn dbo-btn-primary" onclick="dbOpenInvoiceCreate(${crmId})">Создать счёт</button>
                </div>
            </div>
        </div>`;
}
function dbInvResetVal(el, v) { el.innerHTML = v ? escapeHtml(v) : `<span class="dbo-inv-empty">—</span>`; el.dataset.val = v; }
function dbInvEditStart(el) {
    if (el.querySelector("input")) return;
    const cur = el.dataset.val || "";
    el.innerHTML = `<input class="dbo-inv-input" value="${escapeHtml(cur)}">`;
    const inp = el.querySelector("input");
    inp.focus(); inp.select();
    let done = false;
    const finish = async (save) => {
        if (done) return; done = true;
        const fieldId = Number(el.dataset.af);
        const v = inp.value.trim();
        if (!save || v === cur) { dbInvResetVal(el, cur); return; }
        el.textContent = "…";
        const ok = await dbSaveAf(fieldId, v);
        dbInvResetVal(el, ok ? v : cur);
    };
    inp.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    inp.addEventListener("blur", () => finish(true));
}
function dbInvEditLink(btn) {
    const wrap = btn.closest(".dbo-inv-linkwrap");
    if (!wrap || wrap.querySelector("input")) return;
    const fieldId = Number(wrap.dataset.af);
    const cur = wrap.dataset.url || "";
    wrap.innerHTML = `<input class="dbo-inv-input dbo-inv-input-wide" value="${escapeHtml(cur)}" placeholder="https://…">
        <button type="button" class="dbo-inv-editbtn" title="Сохранить" onclick="dbInvSaveLink(${fieldId}, this)">✓</button>`;
    const inp = wrap.querySelector("input");
    inp.focus();
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); dbInvSaveLink(fieldId, inp); } if (e.key === "Escape") renderDbDealCard(dbCardData, dbCardDealId); });
}
async function dbInvSaveLink(fieldId, el) {
    const wrap = el.closest(".dbo-inv-linkwrap");
    const v = wrap.querySelector("input").value.trim();
    const ok = await dbSaveAf(fieldId, v);
    if (ok) renderDbDealCard(dbCardData, dbCardDealId);
}
// Сохранение доп-поля сделки в PrintOffice + локально.
async function dbSaveAf(fieldId, value) {
    try {
        await clientsApi("setDealField", { crmId: Number(dbCardDealId), fieldId: Number(fieldId), value: String(value) });
        if (dbCardData?.deal) {
            let af = Array.isArray(dbCardData.deal.additional_fields) ? dbCardData.deal.additional_fields : [];
            let found = false;
            af = af.map(f => (Number(f?.id) === Number(fieldId) ? (found = true, { ...f, value: String(value) }) : f));
            if (!found) af.push({ id: Number(fieldId), value: String(value) });
            dbCardData.deal.additional_fields = af;
        }
        if (typeof showReadinessToast === "function") showReadinessToast("Сохранено в PrintOffice");
        return true;
    } catch (e) {
        console.error("dbSaveAf", fieldId, e);
        alert("Не удалось сохранить в PrintOffice.");
        return false;
    }
}
// «Создать счёт» → выбор реквизитов клиента → выставление в МоеДело.
let dbInvClientId = null;   // клиент открытой модалки «Создать счёт»
async function dbOpenInvoiceCreate(crmId) {
    if (!ensureActiveSession()) return;
    dbInvClientId = Number(dbCardData?.deal?.client_crm_id);
    const ov = document.createElement("div");
    ov.id = "dbInvOverlay";
    ov.className = "client-card-overlay dbo-edit-overlay";
    ov.setAttribute("onmousedown", "overlayDown(event)");
    ov.setAttribute("onclick", "if (overlayClickedSelf(event)) document.getElementById('dbInvOverlay')?.remove()");
    ov.style.display = "flex";
    ov.innerHTML = `
        <div class="dbo-edit dbo-pay-modal" role="dialog" aria-modal="true">
            <div class="dbo-edit-head"><h3>Создать счёт</h3>
                <button class="dbo-close" onclick="document.getElementById('dbInvOverlay')?.remove()">×</button></div>
            <div class="dbo-edit-body">
                <p class="dbo-ya-note">Выберите реквизиты плательщика — счёт будет создан в МоеДело и записан в сделку. Реквизиты хранятся в нашей базе.</p>
                <div class="dbo-inv-req-head">
                    <span>Реквизиты клиента</span>
                    <button type="button" class="dbo-inv-refresh" onclick="dbRefreshRequisites(this)" title="Подтянуть реквизиты из PrintOffice (на переходный период)">⟳ Обновить из PrintOffice</button>
                </div>
                <div id="dbInvReqList" class="dbo-inv-req-list"><div class="dbo-asset-empty">Загрузка реквизитов…</div></div>
                <details class="dbo-inv-addwrap">
                    <summary class="dbo-inv-addtoggle">+ Добавить реквизит из МоеДело</summary>
                    <div class="dbo-inv-addform">
                        <div class="dbo-inv-search-row">
                            <input type="text" id="dbInvSearch" placeholder="ИНН или название контрагента" onkeydown="if(event.key==='Enter'){event.preventDefault();dbSearchKontragents()}">
                            <button type="button" class="dbo-btn" onclick="dbSearchKontragents()">Найти</button>
                        </div>
                        <div id="dbInvSearchResults" class="dbo-inv-search-results"></div>
                        <div class="dbo-inv-create-hint">Нет нужного в МоеДело? Создайте новый контрагент:</div>
                        <div class="dbo-inv-create-row">
                            <input type="text" id="dbInvAddInn" inputmode="numeric" placeholder="ИНН (10 или 12 цифр)" maxlength="12" onblur="reqInnAutoFill(this, document.getElementById('dbInvAddName'), document.getElementById('dbInvAddForm'))">
                            <input type="text" id="dbInvAddName" placeholder="Наименование (подставится по ИНН)">
                            <select id="dbInvAddForm" class="dbo-inv-formsel" title="Организационная форма">
                                <option value="">форма: авто</option>
                                <option value="UL">Юр. лицо</option>
                                <option value="IP">ИП</option>
                                <option value="FL">Физлицо</option>
                            </select>
                            <button type="button" class="dbo-btn dbo-btn-primary" onclick="dbCreateKontragent()">Создать в МоеДело и привязать</button>
                        </div>
                    </div>
                </details>
            </div>
            <div class="dbo-edit-actions">
                <button class="dbo-btn dbo-btn-primary" id="dbInvCreateBtn" onclick="dbConfirmInvoice(${crmId})" disabled>Создать счёт</button>
                <button class="dbo-btn" onclick="document.getElementById('dbInvOverlay')?.remove()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
    document.addEventListener("keydown", dbInvEsc);
    dbLoadRequisites();
}
function dbRenderRequisites(list, selectInn) {
    const host = document.getElementById("dbInvReqList");
    if (!host) return;
    if (!list.length) { host.innerHTML = `<div class="dbo-asset-empty">Реквизитов пока нет — добавьте вручную ниже.</div>`; }
    else {
        host.innerHTML = list.map((r, i) => {
            const checked = selectInn ? (r.inn === selectInn) : (i === 0);
            return `<label class="dbo-inv-req"><input type="radio" name="dbInvReq" value="${escapeHtml(r.inn)}"${checked ? " checked" : ""} onchange="dbInvReqPicked()">
                <span class="dbo-inv-req-body"><b>${escapeHtml(r.name || r.title)}</b><span class="dbo-inv-req-inn">ИНН ${escapeHtml(r.inn)}</span></span>
                <button type="button" class="dbo-inv-reqdel" title="Удалить реквизит" onclick="event.preventDefault();event.stopPropagation();dbDeleteRequisite('${escapeHtml(r.inn)}',this)">×</button></label>`;
        }).join("");
    }
    dbInvReqPicked();
}
async function dbLoadRequisites(selectInn) {
    try {
        const data = await clientsApi("getClientRequisites", { clientId: dbInvClientId });
        dbRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : [], selectInn);
    } catch (e) {
        console.error("getClientRequisites", e);
        const host = document.getElementById("dbInvReqList");
        if (host) host.innerHTML = `<div class="dbo-asset-empty">Не удалось загрузить реквизиты.</div>`;
    }
}
// Автозаполнение названия по ИНН через DaData (ЕГРЮЛ/ЕГРИП). Общий помощник для обеих форм.
let _dadataHintShown = false;
async function reqInnAutoFill(innEl, nameEl, formEl) {
    if (!innEl || !nameEl) return;
    const inn = String(innEl.value || "").replace(/\D/g, "");
    if (!/^\d{10}$|^\d{12}$/.test(inn)) return;
    if (nameEl.value.trim()) return;   // не перезатираем введённое вручную
    const ph = nameEl.getAttribute("placeholder") || "";
    nameEl.setAttribute("placeholder", "Ищем по ИНН…");
    try {
        const data = await clientsApi("lookupInn", { inn });
        if (data?.found && data?.name) {
            nameEl.value = data.name;
            if (formEl && data.form && !formEl.value) formEl.value = data.form;
        } else if (data && data.found === false) {
            if (typeof showReadinessToast === "function") showReadinessToast("По этому ИНН в ЕГРЮЛ/ЕГРИП ничего не найдено");
        }
    } catch (e) {
        console.warn("lookupInn", String(e.message || e));
        if (!_dadataHintShown && /DaData/i.test(String(e.message || e))) {
            _dadataHintShown = true;
            if (typeof showReadinessToast === "function") showReadinessToast("Подключите DaData в Настройках — и название подставится по ИНН");
        }
    } finally {
        nameEl.setAttribute("placeholder", ph);
    }
}
// Удалить привязанный реквизит (только из нашей БД).
async function dbDeleteRequisite(inn, btn) {
    if (!confirm("Удалить этот реквизит у клиента? (в МоеДело и PrintOffice он останется)")) return;
    if (btn) btn.disabled = true;
    try {
        const cur = document.querySelector('input[name="dbInvReq"]:checked')?.value || "";
        const data = await clientsApi("deleteClientRequisite", { clientId: dbInvClientId, inn });
        dbRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : [], cur === inn ? "" : cur);
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизит удалён");
    } catch (e) {
        console.error("deleteClientRequisite", e);
        alert("Не удалось удалить реквизит: " + String(e.message || e));
        if (btn) btn.disabled = false;
    }
}
// Поиск контрагентов в МоеДело по ИНН или названию.
async function dbSearchKontragents() {
    const query = String(document.getElementById("dbInvSearch")?.value || "").trim();
    const host = document.getElementById("dbInvSearchResults");
    if (!host) return;
    if (query.length < 3) { host.innerHTML = `<div class="dbo-asset-empty">Введите ИНН или минимум 3 символа названия.</div>`; return; }
    // Предзаполним форму создания на случай, если контрагент не найдётся.
    const digitsOnly = !/[^\d\s]/.test(query);
    if (digitsOnly) {
        const i = document.getElementById("dbInvAddInn"); if (i && !i.value) i.value = query.replace(/\D/g, "");
    } else {
        const n = document.getElementById("dbInvAddName"); if (n && !n.value) n.value = query;
    }
    host.innerHTML = `<div class="dbo-asset-empty">Поиск в МоеДело…</div>`;
    try {
        const data = await clientsApi("searchMoedeloKontragents", { query });
        const results = Array.isArray(data?.results) ? data.results : [];
        if (!results.length) { host.innerHTML = `<div class="dbo-asset-empty">В МоеДело не найдено — создайте контрагента ниже.</div>`; return; }
        host.innerHTML = results.map(r => `<div class="dbo-inv-hit">
            <span class="dbo-inv-hit-body"><b>${escapeHtml(r.name || r.inn)}</b><span class="dbo-inv-req-inn">ИНН ${escapeHtml(r.inn)}</span></span>
            <button type="button" class="dbo-btn dbo-btn-sm" onclick="dbBindKontragent('${escapeHtml(r.inn)}', this)" data-name="${escapeHtml(r.name || '')}">Привязать</button>
        </div>`).join("");
    } catch (e) {
        console.error("searchMoedeloKontragents", e);
        host.innerHTML = `<div class="dbo-asset-empty">Не удалось выполнить поиск: ${escapeHtml(String(e.message || e))}</div>`;
    }
}
// Привязать найденного контрагента (в нашу БД).
async function dbBindKontragent(inn, btn) {
    const name = btn?.getAttribute("data-name") || "";
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    try {
        const data = await clientsApi("bindMoedeloKontragent", { clientId: dbInvClientId, inn, name });
        dbRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : [], inn);
        const w = document.querySelector(".dbo-inv-addwrap"); if (w) w.open = false;
        const s = document.getElementById("dbInvSearchResults"); if (s) s.innerHTML = "";
        const q = document.getElementById("dbInvSearch"); if (q) q.value = "";
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизит привязан");
    } catch (e) {
        console.error("bindMoedeloKontragent", e);
        alert("Не удалось привязать: " + String(e.message || e));
        if (btn) { btn.disabled = false; btn.textContent = "Привязать"; }
    }
}
// Создать нового контрагента в МоеДело и привязать к клиенту.
async function dbCreateKontragent() {
    const inn = String(document.getElementById("dbInvAddInn")?.value || "").replace(/\D/g, "");
    const name = String(document.getElementById("dbInvAddName")?.value || "").trim();
    const form = String(document.getElementById("dbInvAddForm")?.value || "");
    if (!/^\d{10}$|^\d{12}$/.test(inn)) { alert("ИНН должен содержать 10 или 12 цифр."); return; }
    if (!name) { alert("Укажите наименование контрагента."); return; }
    const btn = document.querySelector(".dbo-inv-create-row .dbo-btn-primary");
    if (btn) { btn.disabled = true; btn.textContent = "Создаём в МоеДело…"; }
    try {
        const data = await clientsApi("createMoedeloKontragent", { clientId: dbInvClientId, inn, name, form });
        dbRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : [], inn);
        const i = document.getElementById("dbInvAddInn"); if (i) i.value = "";
        const n = document.getElementById("dbInvAddName"); if (n) n.value = "";
        const s = document.getElementById("dbInvSearchResults"); if (s) s.innerHTML = "";
        const w = document.querySelector(".dbo-inv-addwrap"); if (w) w.open = false;
        if (typeof showReadinessToast === "function") showReadinessToast("Контрагент создан в МоеДело и привязан");
    } catch (e) {
        console.error("createMoedeloKontragent", e);
        alert("Не удалось создать контрагента: " + String(e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Создать в МоеДело и привязать"; }
    }
}
// Принудительно подтянуть реквизиты клиента из PrintOffice (переходный период).
// Дедуп на бэкенде — существующие не дублируются; выбор сохраняем.
async function dbRefreshRequisites(btn) {
    const cur = document.querySelector('input[name="dbInvReq"]:checked')?.value || "";
    const old = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Обновляем…"; }
    try {
        const data = await clientsApi("refreshClientRequisites", { clientId: dbInvClientId });
        dbRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : [], cur);
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизиты обновлены из PrintOffice");
    } catch (e) {
        console.error("refreshClientRequisites", e);
        alert("Не удалось обновить реквизиты: " + String(e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = old || "⟳ Обновить из PrintOffice"; }
    }
}
function dbInvEsc(e) { if (e.key === "Escape") dbCloseInvoice(); }
function dbCloseInvoice() { document.getElementById("dbInvOverlay")?.remove(); document.removeEventListener("keydown", dbInvEsc); }
function dbInvReqPicked() {
    const b = document.getElementById("dbInvCreateBtn");
    if (b) b.disabled = !document.querySelector('input[name="dbInvReq"]:checked');
}
async function dbConfirmInvoice(crmId) {
    const inn = document.querySelector('input[name="dbInvReq"]:checked')?.value;
    if (!inn) { alert("Выберите реквизиты."); return; }
    const btn = document.getElementById("dbInvCreateBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Создаём счёт…"; }
    try {
        const data = await clientsApi("createInvoice", { dealId: Number(crmId), inn });
        if (data?.deal && dbCardData) dbCardData.deal = data.deal;
        dbCloseInvoice();
        renderDbDealCard(dbCardData, dbCardDealId);
        loadDbDeals();
        if (typeof showReadinessToast === "function") showReadinessToast(`Счёт №${data?.invoice?.number || ""} создан`);
    } catch (e) {
        console.error("createInvoice", e);
        alert("Не удалось создать счёт: " + String(e.message || e));
        if (btn) { btn.disabled = false; btn.textContent = "Создать счёт"; }
    }
}

// ——— Ручной ввод оплаты (дублируется в нашу БД и CRM PrintOffice) ———
// mode: 'full' — сумма = остаток долга; 'part' — сумма пустая (вводит пользователь).
function dbOpenPayModal(mode) {
    const d = dbCardData?.deal;
    if (!d) return;
    closeDbPayModal();
    const amount = Number(d.amount) || 0;
    const debt = d.debt != null ? Number(d.debt) : Math.max(0, amount - (Number(d.paid) || 0));
    const isFull = mode === "full";
    dbPayDebt = debt;   // для проверки «не больше долга»
    const prefill = isFull ? Number(debt).toFixed(2) : "";
    // Метод оплаты по умолчанию — «Безнал (Р/С)», иначе первый доступный.
    const methods = dbCardPayMethods || [];
    const defId = (methods.find(m => /безнал/i.test(m.name)) || methods[0] || {}).id;
    const methodOpts = methods.length
        ? methods.map(m => `<option value="${m.id}"${Number(m.id) === Number(defId) ? " selected" : ""}>${escapeHtml(m.name)}</option>`).join("")
        : `<option value="">— методы не загружены —</option>`;
    const ov = document.createElement("div");
    ov.id = "dbPayOverlay";
    ov.className = "client-card-overlay dbo-edit-overlay";
    ov.setAttribute("onmousedown", "overlayDown(event)");
    ov.setAttribute("onclick", "if (overlayClickedSelf(event)) closeDbPayModal()");
    ov.style.display = "flex";
    ov.innerHTML = `
        <div class="dbo-edit dbo-pay-modal" role="dialog" aria-modal="true">
            <div class="dbo-edit-head">
                <h3>Добавить оплату</h3>
                <button class="dbo-close" onclick="closeDbPayModal()" aria-label="Закрыть">×</button>
            </div>
            <div class="dbo-edit-body">
                <label class="dbo-edit-wide">Сумма
                    <input type="text" inputmode="decimal" id="dbPayAmount" value="${prefill}" placeholder="0.00" oninput="dbCleanNum(this)"${isFull ? ' readonly style="background:var(--surface-2)"' : ''}>
                </label>
                <label class="dbo-edit-wide">Метод оплаты
                    <select id="dbPayMethod">${methodOpts}</select>
                </label>
                <label class="dbo-edit-wide">Основание
                    <textarea id="dbPayComment" rows="2" placeholder="Можно оставить пустым"></textarea>
                </label>
            </div>
            <div class="dbo-edit-actions">
                <button class="dbo-btn dbo-btn-primary" id="dbPaySaveBtn" onclick="dbAddPayment()">Добавить оплату</button>
                <button class="dbo-btn" onclick="closeDbPayModal()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
    document.addEventListener("keydown", dbPayEsc);
    setTimeout(() => { const t = document.getElementById("dbPayAmount"); if (t) { t.focus(); t.select(); } }, 0);
}
let dbPayDebt = 0;   // остаток долга на момент открытия модалки (для валидации)
function dbPayEsc(e) { if (e.key === "Escape") closeDbPayModal(); }
function closeDbPayModal() {
    const ov = document.getElementById("dbPayOverlay");
    if (ov) ov.remove();
    document.removeEventListener("keydown", dbPayEsc);
}
async function dbAddPayment() {
    const crmId = Number(dbCardDealId);
    const amount = Number((document.getElementById("dbPayAmount")?.value || "").replace(",", "."));
    const payMethodId = Number(document.getElementById("dbPayMethod")?.value);
    const comment = String(document.getElementById("dbPayComment")?.value || "").trim();
    if (!Number.isFinite(amount) || amount <= 0) { alert("Введите сумму оплаты (больше 0)."); return; }
    if (amount - dbPayDebt > 0.009) { alert("Сумма оплаты больше долга."); return; }
    if (!Number.isFinite(payMethodId)) { alert("Выберите метод оплаты."); return; }
    const btn = document.getElementById("dbPaySaveBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Сохраняем…"; }
    try {
        const data = await clientsApi("addDealPayment", { crmId, payMethodId, amount, comment });
        if (data?.deal && dbCardData) dbCardData.deal = data.deal;
        if (Array.isArray(data?.payments) && dbCardData) dbCardData.payments = data.payments;
        closeDbPayModal();
        renderDbDealCard(dbCardData, dbCardDealId);
        loadDbDeals();
        if (typeof showReadinessToast === "function") showReadinessToast("Оплата добавлена");
    } catch (e) {
        console.error("dbAddPayment", e);
        alert("Не удалось добавить оплату в CRM.");
        if (btn) { btn.disabled = false; btn.textContent = "Добавить оплату"; }
    }
}

// ——— Отмена (откат) платежа ———
let dbPayCancelRef = 0;   // dph_id (id записи истории оплат), которую отменяем
function dbOpenPayCancel(payRef, amount, methodEnc, dateEnc) {
    if (!dbCardData?.deal) return;
    closeDbPayModal();
    dbPayCancelRef = Number(payRef) || 0;
    const method = decodeURIComponent(methodEnc || "");
    const date = decodeURIComponent(dateEnc || "");
    const ov = document.createElement("div");
    ov.id = "dbPayOverlay";
    ov.className = "client-card-overlay dbo-edit-overlay";
    ov.setAttribute("onmousedown", "overlayDown(event)");
    ov.setAttribute("onclick", "if (overlayClickedSelf(event)) closeDbPayModal()");
    ov.style.display = "flex";
    ov.innerHTML = `
        <div class="dbo-edit dbo-pay-modal dbo-pay-cancel-modal" role="dialog" aria-modal="true">
            <div class="dbo-edit-head dbo-cancel-head">
                <h3>↺ Отмена платёжной операции</h3>
                <button class="dbo-close" onclick="closeDbPayModal()" aria-label="Закрыть">×</button>
            </div>
            <div class="dbo-edit-body">
                <div class="dbo-cancel-info">
                    ${date ? `<div><span>Дата платежа:</span><b>${escapeHtml(date)}</b></div>` : ""}
                    <div><span>Сумма платежа:</span><b>${money2(Math.abs(Number(amount) || 0))} ₽</b></div>
                    ${method ? `<div><span>Метод оплаты:</span><b>${escapeHtml(method)}</b></div>` : ""}
                </div>
                <label class="dbo-edit-wide">Основание <span class="dbo-req">(обязательное поле)</span>
                    <textarea id="dbPayCancelComment" rows="3" placeholder="Причина отмены платежа"></textarea>
                </label>
            </div>
            <div class="dbo-edit-actions">
                <button class="dbo-btn dbo-btn-danger" id="dbPayCancelBtn" onclick="dbConfirmPayCancel()">Создать отмену операции</button>
                <button class="dbo-btn" onclick="closeDbPayModal()">Отмена</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
    document.addEventListener("keydown", dbPayEsc);
    setTimeout(() => { const t = document.getElementById("dbPayCancelComment"); if (t) t.focus(); }, 0);
}
async function dbConfirmPayCancel() {
    const crmId = Number(dbCardDealId);
    const comment = String(document.getElementById("dbPayCancelComment")?.value || "").trim();
    if (!comment) { alert("Укажите основание отмены (обязательное поле)."); return; }
    if (!dbPayCancelRef) { alert("Не удалось определить платёж для отмены."); return; }
    const btn = document.getElementById("dbPayCancelBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Отменяем…"; }
    try {
        const data = await clientsApi("revokeDealPayment", { crmId, dphId: dbPayCancelRef, comment });
        if (data?.deal && dbCardData) dbCardData.deal = data.deal;
        if (Array.isArray(data?.payments) && dbCardData) dbCardData.payments = data.payments;
        closeDbPayModal();
        renderDbDealCard(dbCardData, dbCardDealId);
        loadDbDeals();
        if (typeof showReadinessToast === "function") showReadinessToast("Платёж отменён");
    } catch (e) {
        console.error("dbConfirmPayCancel", e);
        alert("Не удалось отменить платёж в CRM.");
        if (btn) { btn.disabled = false; btn.textContent = "Создать отмену операции"; }
    }
}

// ============ Превью и макеты элементов (Яндекс.Диск + PrintOffice) ============
// Файлы лежат в одном экземпляре на Я.Диске (/printoffice24/...), зеркалятся в CRM.
// Загрузка двухфазная: бэкенд даёт presigned-URL → браузер грузит байты прямо на Я.Диск.
const dboAssets = new Map();   // elementId -> { status:'loading'|'ready'|'error', preview, layouts }
let dboAssetsDeal = { id: null, num: null };

function dboAssetKey(elId) { return String(elId); }
function dboIsImageUrl(u) { return typeof u === "string" && /^https?:\/\//i.test(u); }

async function dboLoadAllAssets(dealId, dealNum, elements) {
    dboAssetsDeal = { id: Number(dealId), num: String(dealNum ?? "") };
    const ids = (elements || []).map(e => Number(e.crm_element_id)).filter(Number.isFinite);
    for (const id of ids) {
        if (!dboAssets.has(dboAssetKey(id))) dboAssets.set(dboAssetKey(id), { status: "loading", preview: null, layouts: [] });
        dboUpdateThumb(id);
    }
    // последовательно, чтобы не долбить Я.Диск/CRM разом
    for (const id of ids) {
        await dboLoadElementAssets(id).catch(() => {});
    }
}

async function dboLoadElementAssets(elementId) {
    const key = dboAssetKey(elementId);
    try {
        const data = await clientsApi("getElementAssets", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num || "")
        });
        dboAssets.set(key, { status: "ready", preview: data?.preview || null, layouts: Array.isArray(data?.layouts) ? data.layouts : [] });
    } catch (e) {
        const prev = dboAssets.get(key) || {};
        dboAssets.set(key, { status: "error", preview: prev.preview || null, layouts: prev.layouts || [] });
    }
    dboUpdateThumb(elementId);
    dboRenderEditAssets(elementId);
}

function dboUpdateThumb(elementId) {
    const cached = dboAssets.get(dboAssetKey(elementId));
    document.querySelectorAll(`.dbo-el-thumb[data-el="${elementId}"]`).forEach(thumb => {
        thumb.classList.remove("has-preview", "is-loading", "is-error", "element-preview-thumb-clickable");
        thumb.onclick = null;
        thumb.innerHTML = "";
        thumb.removeAttribute("title");
        if (!cached || cached.status === "loading") { thumb.classList.add("is-loading"); return; }
        const url = cached.preview?.thumbUrl || cached.preview?.url;
        if (dboIsImageUrl(url)) {
            thumb.classList.add("has-preview", "element-preview-thumb-clickable");
            thumb.title = "Открыть превью";
            const img = document.createElement("img");
            img.src = url; img.alt = ""; img.referrerPolicy = "no-referrer";
            thumb.appendChild(img);
            thumb.onclick = (ev) => { ev.stopPropagation(); dboOpenLightbox(cached.preview.url || url); };
        } else if (cached.status === "error") {
            thumb.classList.add("is-error");
        }
    });
}

function dboOpenLightbox(url) {
    if (!dboIsImageUrl(url)) return;
    document.querySelectorAll(".preview-lightbox").forEach(el => el.remove());
    const box = document.createElement("div");
    box.className = "preview-lightbox";
    box.innerHTML = `<button type="button" class="preview-lightbox-close" aria-label="Закрыть">&times;</button>
        <img src="${escapeHtml(url)}" alt="Превью" referrerpolicy="no-referrer">`;
    const close = () => { box.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    box.addEventListener("click", close);
    box.querySelector(".preview-lightbox-close").addEventListener("click", (e) => { e.stopPropagation(); close(); });
    box.querySelector("img").addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
}

// --- Блок «Превью и макеты» в форме редактирования позиции ---
function dboAssetsEditHtml(elementId) {
    return `<div class="dbo-assets" id="dboAssets_${elementId}">${dboAssetsInnerHtml(elementId)}</div>`;
}
function dboRenderEditAssets(elementId) {
    const box = document.getElementById(`dboAssets_${elementId}`);
    if (box) box.innerHTML = dboAssetsInnerHtml(elementId);
}
function dboAssetsInnerHtml(elementId) {
    const cached = dboAssets.get(dboAssetKey(elementId)) || { status: "loading", preview: null, layouts: [] };
    const busy = dboUploadBusy === elementId;
    const preview = cached.preview;
    const purl = preview?.thumbUrl || preview?.url;
    // Область превью — кликабельна и принимает перетаскивание (загрузка/замена превью).
    const hasPreview = dboIsImageUrl(purl);
    const previewInner = hasPreview
        ? `<img src="${escapeHtml(purl)}" alt="превью" referrerpolicy="no-referrer">
           <button type="button" class="dbo-asset-del" title="Удалить превью" onclick="event.stopPropagation(); dboDeletePreview(${elementId})">×</button>`
        : `<span class="dbo-asset-empty">${cached.status === "loading" ? "загрузка…" : "＋ превью"}</span>`;
    const layouts = (cached.layouts || []).map(l => {
        const icon = l.type === "link" ? "🔗" : "📄";
        const del = l.isCanDelete !== false
            ? `<button type="button" class="dbo-asset-del" title="Удалить макет" onclick="dboDeleteLayout(${elementId}, ${Number(l.id)})">×</button>` : "";
        return `<div class="dbo-layout-item"><a href="${escapeHtml(l.url || "#")}" target="_blank" rel="noopener">${icon} ${escapeHtml(l.name || l.file_name || "файл")}</a>${del}</div>`;
    }).join("") || `<div class="dbo-asset-empty">макетов нет</div>`;
    return `
        <div class="dbo-assets-row">
            <div class="dbo-preview-box dbo-drop" title="Нажмите или перетащите изображение"
                 onclick="document.getElementById('dboPreviewInput_${elementId}').click()"
                 ondragover="dboDragOver(event)" ondragleave="dboDragLeave(event)" ondrop="dboDropPreview(event, ${elementId})">
                ${previewInner}
                <input type="file" id="dboPreviewInput_${elementId}" hidden accept="image/jpeg,image/png,image/webp,image/gif" onchange="dboUploadPreview(${elementId}, this)">
            </div>
            <div class="dbo-layouts-col dbo-drop" ondragover="dboDragOver(event)" ondragleave="dboDragLeave(event)" ondrop="dboDropLayout(event, ${elementId})">
                <div class="dbo-assets-title">Макеты</div>
                <div class="dbo-layouts-list">${layouts}</div>
                <div class="dbo-layout-add">
                    <input type="url" id="dboLinkInput_${elementId}" placeholder="Ссылка на макет" class="dbo-edit-wide">
                    <button type="button" class="dbo-btn" onclick="dboAddLayoutLink(${elementId})">+ ссылка</button>
                    <label class="dbo-btn">📎 файл<input type="file" hidden multiple onchange="dboUploadLayout(${elementId}, this)"></label>
                </div>
                <div class="dbo-layout-drophint">Перетащите файлы макетов сюда</div>
                ${busy ? `<div class="dbo-asset-progress">${escapeHtml(dboUploadLabel || "Загрузка…")}</div>` : ""}
            </div>
        </div>`;
}
// Перетаскивание файлов в области превью/макетов.
function dboDragOver(e) { e.preventDefault(); e.currentTarget.classList.add("dbo-drop-active"); }
function dboDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove("dbo-drop-active"); }
function dboDropPreview(e, elementId) {
    e.preventDefault(); e.currentTarget.classList.remove("dbo-drop-active");
    const f = [...(e.dataTransfer?.files || [])].filter(x => x && /^image\//.test(x.type))[0];
    if (f) dboUploadPreviewFile(elementId, f);
    else alert("Для превью нужен файл-изображение (JPG, PNG, WebP, GIF).");
}
function dboDropLayout(e, elementId) {
    e.preventDefault(); e.currentTarget.classList.remove("dbo-drop-active");
    const files = [...(e.dataTransfer?.files || [])].filter(x => x && x.size > 0);
    if (files.length) dboUploadLayoutFiles(elementId, files);
}

let dboUploadBusy = null;    // elementId, пока идёт загрузка
let dboUploadLabel = "";
function dboSetBusy(elementId, label) { dboUploadBusy = elementId; dboUploadLabel = label || ""; dboRenderEditAssets(elementId); }
function dboClearBusy(elementId) { dboUploadBusy = null; dboUploadLabel = ""; dboRenderEditAssets(elementId); }

// Загрузка превью из <input> (клик) — делегирует на файловый core.
function dboUploadPreview(elementId, input) {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (file) dboUploadPreviewFile(elementId, file);
}
async function dboUploadPreviewFile(elementId, file) {
    if (!file) return;
    if (!dboAssetsDeal.num) { alert("У сделки нет номера — загрузка на Я.Диск недоступна."); return; }
    dboSetBusy(elementId, "Подготовка превью…");
    try {
        let up = file;
        if (typeof compressPreviewImage === "function") { try { up = await compressPreviewImage(file); } catch (_) {} }
        dboSetBusy(elementId, "Регистрация превью…");
        const prep = await clientsApi("uploadElementPreview", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num),
            fileName: up.name || "preview.jpg", mimeType: up.type || "image/jpeg"
        });
        if (!prep?.uploadUrl) throw new Error("нет uploadUrl");
        dboSetBusy(elementId, "Загрузка на Я.Диск…");
        await uploadFileToYandexUrl(prep.uploadUrl, up, up.type || "image/jpeg");
        dboSetBusy(elementId, "Сохранение…");
        const data = await clientsApi("uploadElementPreview", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num), uploadComplete: true
        });
        dboApplyAssets(elementId, data);
    } catch (e) {
        console.error("dboUploadPreviewFile", e);
        alert("Не удалось загрузить превью.");
    } finally { dboClearBusy(elementId); dboUpdateThumb(elementId); }
}

// Загрузка макетов из <input> (клик) — делегирует на файловый core.
function dboUploadLayout(elementId, input) {
    const files = [...(input?.files || [])];
    if (input) input.value = "";
    if (files.length) dboUploadLayoutFiles(elementId, files);
}
async function dboUploadLayoutFiles(elementId, files) {
    files = [...(files || [])].filter(f => f && f.size > 0);
    if (!files.length) return;
    if (!dboAssetsDeal.num) { alert("У сделки нет номера — загрузка на Я.Диск недоступна."); return; }
    // Было ли уже превью до загрузки (чтобы авто-превью из PDF ставить только при первом макете).
    const hadPreview = !!dboAssets.get(dboAssetKey(elementId))?.preview;
    dboSetBusy(elementId, "Загрузка макетов…");
    let firstPdf = null;
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pfx = files.length > 1 ? `(${i + 1}/${files.length}) ` : "";
            dboSetBusy(elementId, `${pfx}Регистрация…`);
            const prep = await clientsApi("addElementLayout", {
                dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num),
                type: "file", fileName: file.name || "layout", mimeType: file.type || "application/octet-stream"
            });
            if (!prep?.uploadUrl) throw new Error("нет uploadUrl");
            dboSetBusy(elementId, `${pfx}Загрузка на Я.Диск…`);
            await uploadFileToYandexUrl(prep.uploadUrl, file, file.type || "application/octet-stream");
            dboSetBusy(elementId, `${pfx}Сохранение…`);
            const data = await clientsApi("addElementLayout", {
                dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num),
                type: "file", uploadComplete: true
            });
            dboApplyAssets(elementId, data);
            if (!firstPdf && typeof isPdfFile === "function" && isPdfFile(file)) firstPdf = file;
        }
        // Авто-превью из первого PDF-макета — если превью ещё не было (как в разделе по API).
        if (firstPdf && !hadPreview && !dboAssets.get(dboAssetKey(elementId))?.preview
            && typeof renderPdfFirstPageToImageFile === "function") {
            try {
                dboSetBusy(elementId, "Генерация превью из PDF…");
                const img = await renderPdfFirstPageToImageFile(firstPdf, "preview");
                if (img) await dboUploadPreviewFile(elementId, img);
            } catch (e) { console.warn("auto preview from PDF failed", e); }
        }
    } catch (e) {
        console.error("dboUploadLayoutFiles", e);
        alert("Не удалось загрузить макет.");
    } finally { dboClearBusy(elementId); }
}

async function dboAddLayoutLink(elementId) {
    const inp = document.getElementById(`dboLinkInput_${elementId}`);
    const url = String(inp?.value || "").trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { alert("Ссылка должна начинаться с http:// или https://"); return; }
    dboSetBusy(elementId, "Добавление ссылки…");
    try {
        const data = await clientsApi("addElementLayout", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num || ""), type: "link", url
        });
        dboApplyAssets(elementId, data);
    } catch (e) {
        console.error("dboAddLayoutLink", e);
        alert("Не удалось добавить ссылку на макет.");
    } finally { dboClearBusy(elementId); }
}

async function dboDeletePreview(elementId) {
    if (!confirm("Удалить превью позиции?")) return;
    dboSetBusy(elementId, "Удаление превью…");
    try {
        const data = await clientsApi("deleteElementPreview", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), dealNum: String(dboAssetsDeal.num || "")
        });
        dboApplyAssets(elementId, data);
    } catch (e) {
        console.error("dboDeletePreview", e);
        alert("Не удалось удалить превью.");
    } finally { dboClearBusy(elementId); dboUpdateThumb(elementId); }
}

async function dboDeleteLayout(elementId, layoutId) {
    if (!confirm("Удалить макет?")) return;
    dboSetBusy(elementId, "Удаление макета…");
    try {
        const data = await clientsApi("deleteElementLayout", {
            dealId: Number(dboAssetsDeal.id), elementId: Number(elementId), layoutId: Number(layoutId), dealNum: String(dboAssetsDeal.num || "")
        });
        dboApplyAssets(elementId, data);
    } catch (e) {
        console.error("dboDeleteLayout", e);
        alert("Не удалось удалить макет.");
    } finally { dboClearBusy(elementId); }
}

function dboApplyAssets(elementId, data) {
    const key = dboAssetKey(elementId);
    const prev = dboAssets.get(key) || {};
    dboAssets.set(key, {
        status: "ready",
        preview: data?.preview !== undefined ? data.preview : prev.preview || null,
        layouts: Array.isArray(data?.layouts) ? data.layouts : (prev.layouts || [])
    });
    dboUpdateThumb(elementId);
    dboRenderEditAssets(elementId);
}

// --- Страница «Настройки» (в разделе аккаунта) + инлайн-форма Яндекс.Диска ---
function openSettingsPage() {
    if (!ensureActiveSession()) return;
    if (typeof toggleAuthModal === "function") toggleAuthModal(false);
    if (typeof switchTab === "function") switchTab("settings-tab");
    renderYandexSettingsInline();
    renderMoedeloSettingsInline();
    renderDadataSettingsInline();
}
async function renderDadataSettingsInline() {
    const host = document.getElementById("settingsDadataHost");
    if (!host) return;
    host.innerHTML = `<p class="dbo-ya-note">Загрузка статуса…</p>`;
    let status = { dadataConfigured: false };
    try { status = await clientsApi("getIntegrations", {}); } catch (_) {}
    host.innerHTML = `
        <p class="dbo-ya-note">Автозаполнение названия контрагента по ИНН (ЕГРЮЛ/ЕГРИП) при добавлении реквизита.
        Нужен бесплатный API-ключ DaData (тариф до 10 000 запросов/день).</p>
        <div class="dbo-ya-status">Статус: <b class="${status.dadataConfigured ? "payment-ok" : "payment-alert"}">${status.dadataConfigured ? "подключено" : "не настроено"}</b></div>
        <label class="dbo-edit-wide">API-ключ DaData (Token)
            <input type="password" id="dboDadataToken" placeholder="${status.dadataConfigured ? "•••••• (задан) — введите новый, чтобы заменить" : "вставьте ключ"}" autocomplete="off">
        </label>
        <p class="dbo-ya-hint">Ключ хранится на сервере и не показывается обратно. Регистрация и ключ — на dadata.ru → Личный кабинет → API-интеграция.</p>
        <div class="settings-actions">
            <button class="dbo-btn dbo-btn-primary" onclick="dboSaveDadataToken()">Сохранить</button>
            ${status.dadataConfigured ? `<button class="dbo-btn dbo-btn-danger" onclick="dboSaveDadataToken(true)">Отключить</button>` : ""}
        </div>`;
}
async function dboSaveDadataToken(clear = false) {
    const token = clear ? "" : String(document.getElementById("dboDadataToken")?.value || "").trim();
    if (!clear && !token) { alert("Введите ключ."); return; }
    try {
        await clientsApi("setDadataToken", { token });
        if (typeof showReadinessToast === "function") showReadinessToast(clear ? "Интеграция отключена" : "Ключ сохранён");
        renderDadataSettingsInline();
    } catch (e) {
        console.error("dboSaveDadataToken", e);
        alert("Не удалось сохранить ключ.");
    }
}
async function renderMoedeloSettingsInline() {
    const host = document.getElementById("settingsMoedeloHost");
    if (!host) return;
    host.innerHTML = `<p class="dbo-ya-note">Загрузка статуса…</p>`;
    let status = { moedeloConfigured: false };
    try { status = await clientsApi("getIntegrations", {}); } catch (_) {}
    host.innerHTML = `
        <p class="dbo-ya-note">Выставление счетов клиентам через МоеДело (кнопка «Создать счёт» в карточке заказа).
        Нужен API-ключ из личного кабинета МоеДело.</p>
        <div class="dbo-ya-status">Статус: <b class="${status.moedeloConfigured ? "payment-ok" : "payment-alert"}">${status.moedeloConfigured ? "подключено" : "не настроено"}</b></div>
        <label class="dbo-edit-wide">API-ключ МоеДело (md-api-key)
            <input type="password" id="dboMdToken" placeholder="${status.moedeloConfigured ? "•••••• (задан) — введите новый, чтобы заменить" : "вставьте ключ"}" autocomplete="off">
        </label>
        <p class="dbo-ya-hint">Ключ хранится на сервере и не показывается обратно. Настройки → Интеграция → API в кабинете МоеДело.</p>
        <div class="settings-actions">
            <button class="dbo-btn dbo-btn-primary" onclick="dboSaveMoedeloToken()">Сохранить</button>
            ${status.moedeloConfigured ? `<button class="dbo-btn dbo-btn-danger" onclick="dboSaveMoedeloToken(true)">Отключить</button>` : ""}
        </div>`;
}
async function dboSaveMoedeloToken(clear = false) {
    const token = clear ? "" : String(document.getElementById("dboMdToken")?.value || "").trim();
    if (!clear && !token) { alert("Введите ключ."); return; }
    try {
        await clientsApi("setMoedeloToken", { token });
        if (typeof showReadinessToast === "function") showReadinessToast(clear ? "Интеграция отключена" : "Ключ сохранён");
        renderMoedeloSettingsInline();
    } catch (e) {
        console.error("dboSaveMoedeloToken", e);
        alert("Не удалось сохранить ключ.");
    }
}
async function renderYandexSettingsInline() {
    const host = document.getElementById("settingsYandexHost");
    if (!host) return;
    host.innerHTML = `<p class="dbo-ya-note">Загрузка статуса…</p>`;
    let status = { yandexConfigured: false, previewDir: "", layoutsDir: "" };
    try { status = await clientsApi("getIntegrations", {}); } catch (_) {}
    host.innerHTML = `
        <p class="dbo-ya-note">Макеты и превью хранятся на Яндекс.Диске в одном экземпляре
        (<code>${escapeHtml(status.layoutsDir || "/printoffice24/layouts")}</code>,
        <code>${escapeHtml(status.previewDir || "/printoffice24/preview")}</code>) и зеркалятся в PrintOffice.
        Нужен OAuth-токен того же аккаунта Яндекс.Диска, к которому подключён PrintOffice.</p>
        <div class="dbo-ya-status">Статус: <b class="${status.yandexConfigured ? "payment-ok" : "payment-alert"}">${status.yandexConfigured ? "подключено" : "не настроено"}</b></div>
        <label class="dbo-edit-wide">OAuth-токен Яндекс.Диска
            <input type="password" id="dboYaToken" placeholder="${status.yandexConfigured ? "•••••• (задан) — введите новый, чтобы заменить" : "вставьте токен"}" autocomplete="off">
        </label>
        <p class="dbo-ya-hint">Токен хранится на сервере и не показывается обратно. Получить: <a href="https://yandex.ru/dev/disk/poligon/" target="_blank" rel="noopener">yandex.ru/dev/disk</a>.</p>
        <div class="settings-actions">
            <button class="dbo-btn dbo-btn-primary" onclick="dboSaveYandexToken()">Сохранить</button>
            ${status.yandexConfigured ? `<button class="dbo-btn dbo-btn-danger" onclick="dboSaveYandexToken(true)">Отключить</button>` : ""}
        </div>`;
}
async function dboSaveYandexToken(clear = false) {
    const token = clear ? "" : String(document.getElementById("dboYaToken")?.value || "").trim();
    if (!clear && !token) { alert("Введите токен."); return; }
    try {
        await clientsApi("setYandexToken", { token });
        if (typeof showReadinessToast === "function") showReadinessToast(clear ? "Интеграция отключена" : "Токен сохранён");
        renderYandexSettingsInline();
    } catch (e) {
        console.error("dboSaveYandexToken", e);
        alert("Не удалось сохранить токен.");
    }
}
