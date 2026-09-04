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
dbOrdersState.filters = { statuses: new Set(), debtOnly: false };
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

// Клиентская фильтрация канбана (открытые сделки уже ограничены сервером).
function getDbKanbanFiltered() {
    let list = dbOrdersState.kanbanDeals || [];
    const f = dbOrdersState.filters;
    const q = (dbOrdersState.query || "").trim().toLowerCase();
    if (q) list = list.filter(d => (`${d.num || ""} ${d.client_name || ""} ${d.content || ""}`).toLowerCase().includes(q));
    if (f.statuses && f.statuses.size) list = list.filter(d => f.statuses.has(Number(d.status_id)));
    if (f.debtOnly) list = list.filter(d => (Number(d.debt) || 0) > 0.009);
    return list;
}
function dbFiltersActive() {
    const f = dbOrdersState.filters;
    return (f.statuses && f.statuses.size > 0) || f.debtOnly;
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
// Кнопка фильтров — открыть/закрыть, наполнить статусы.
function toggleDbFilters(e) {
    if (e) e.stopPropagation();
    const wrap = document.getElementById("dbFiltersWrap");
    if (!wrap) return;
    const open = wrap.classList.toggle("open");   // CSS: .adv-filters-popover-wrap.open .adv-filters-popover
    const btn = document.getElementById("dbFiltersBtn");
    if (btn) btn.setAttribute("aria-expanded", String(open));
    if (open) {
        renderDbFilterStatuses();
        setTimeout(() => document.addEventListener("click", dbFiltersOutside), 0);
    } else {
        document.removeEventListener("click", dbFiltersOutside);
    }
}
function dbFiltersOutside(e) {
    const wrap = document.getElementById("dbFiltersWrap");
    if (wrap && !wrap.contains(e.target)) {
        wrap.classList.remove("open");
        document.removeEventListener("click", dbFiltersOutside);
    }
}
function renderDbFilterStatuses() {
    const host = document.getElementById("dbFilterStatusList");
    if (!host) return;
    const sel = dbOrdersState.filters.statuses;
    const items = (dbOrdersState.statuses || []).map(s =>
        `<label class="dbk-filter-status"><input type="checkbox" value="${s.id}"${sel.has(Number(s.id)) ? " checked" : ""} onchange="applyDbFilters()"><span class="dbk-filter-dot" style="background:${escapeHtml(s.bk_color || "#dfdfdf")}"></span>${escapeHtml(s.name)}</label>`).join("");
    host.innerHTML = items || `<div class="dbk-filter-empty">Нет статусов</div>`;
}
function applyDbFilters() {
    const sel = new Set();
    document.querySelectorAll("#dbFilterStatusList input[type=checkbox]:checked").forEach(c => sel.add(Number(c.value)));
    const debt = document.getElementById("dbFilterDebtOnly");
    dbOrdersState.filters.statuses = sel;
    dbOrdersState.filters.debtOnly = !!(debt && debt.checked);
    updateDbFiltersBtn();
    dbApplyQueryOrFilters();
}
function resetDbFilters() {
    dbOrdersState.filters.statuses = new Set();
    dbOrdersState.filters.debtOnly = false;
    const debt = document.getElementById("dbFilterDebtOnly");
    if (debt) debt.checked = false;
    const inp = document.getElementById("dbkSearchInput");
    if (inp) inp.value = "";
    dbOrdersState.query = "";
    updateDbSearchClearBtn();
    updateDbFiltersBtn();
    renderDbFilterStatuses();
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
    updateDbFiltersBtn();
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
function updateDbViewToggle() {
    const l = document.getElementById("dbViewListBtn");
    const k = document.getElementById("dbViewKanbanBtn");
    if (l) l.classList.toggle("is-active", dbOrdersState.view === "list");
    if (k) k.classList.toggle("is-active", dbOrdersState.view === "kanban");
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
            debtOnly: !!f.debtOnly
        });
        dbOrdersState.deals = Array.isArray(data?.deals) ? data.deals : [];
        if (Array.isArray(data?.statuses)) dbOrdersState.statuses = data.statuses;
        dbOrdersState.total = Number(data?.total) || 0;
        dbOrdersState.pages = Number(data?.pages) || 1;
        dbOrdersState.page = Number(data?.page) || dbOrdersState.page;
        dbOrdersState.loaded = true;
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
        dbOrdersState.loaded = true;
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
    let z = parseFloat(v);
    if (!(z >= 0.5 && z <= 1)) z = 1;
    dbOrdersState.kanbanZoom = z;
    try { localStorage.setItem("dbKanbanZoom", String(z)); } catch (_) {}
    const board = document.querySelector("#dbOrdersBody .dbk-board");
    if (board) board.style.zoom = z;
    applyDbKanbanHeight();
    updateDbZoomUI();
}
function updateDbZoomUI() {
    const sel = document.getElementById("dbZoomSelect");
    if (sel) sel.value = String(dbOrdersState.kanbanZoom || 1);
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

function dbDealCardHtml(d) {
    const num = escapeHtml(String(d.num ?? d.crm_deal_id ?? ""));
    const els = Number(d.elements_count) || 0;
    const debt = Number(d.debt) || 0;
    const debtBadge = debt > 0.009 ? `<span class="dbk-card-debt">долг ${money(debt)} ₽</span>` : "";
    return `
        <div class="dbk-card" draggable="true" ondragstart="dbDragStart(event, ${d.crm_deal_id})" ondragend="dbDragEnd(event)" onclick="openDbDealCard(${d.crm_deal_id})" title="Перетащите в колонку, чтобы сменить статус; клик — открыть">
            <div class="dbk-card-top">
                <span class="dbk-card-num">№ ${num}</span>
                <span class="dbk-card-amount">${money(d.amount)} ₽</span>
            </div>
            <div class="dbk-card-client">${escapeHtml(d.client_name || "—")}</div>
            ${d.content ? `<div class="dbk-card-content">${escapeHtml(d.content)}</div>` : ""}
            <div class="dbk-card-meta">${els ? `<span>${els} элем.</span>` : "<span></span>"}${debtBadge}</div>
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
    setDealStatus(id, statusId);
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
    // Если открыта форма позиции — Esc закрывает её (обрабатывает dbElEditEsc), не заказ.
    if (document.getElementById("dbElEditOverlay")) return;
    closeDbDealCard();
}
function closeDbDealCard() {
    const ov = document.getElementById("dbDealCardOverlay");
    if (ov) ov.style.display = "none";
    document.removeEventListener("keydown", dbDealCardEsc);
    dbCloseStatusMenu();
    if (typeof dbCloseElStatusMenu === "function") dbCloseElStatusMenu();
    if (typeof closeDbElEdit === "function") closeDbElEdit();
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
        document.body.appendChild(ov);
    }
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
                        <input type="text" id="dbEditUnits" list="dbUnitsList" value="${escapeHtml(e.units || "шт")}">
                        <datalist id="dbUnitsList"><option value="шт"></option><option value="услуга"></option></datalist>
                    </label>
                    <label>Кол-во<input type="text" inputmode="decimal" id="dbEditQty" value="${Number(e.quantity) || 0}" oninput="dbCleanNum(this); dbEditRecalc('qty')"></label>
                    <label>Цена<input type="text" inputmode="decimal" id="dbEditPrice" value="${Number(e.price) || 0}" oninput="dbCleanNum(this); dbEditRecalc('price')"></label>
                    <label>Себестоимость<input type="text" inputmode="decimal" id="dbEditCost" value="${Number(e.cost) || 0}" oninput="dbCleanNum(this)" onblur="dbCostBlur(this)"></label>
                    <label>Сумма<input type="text" inputmode="decimal" id="dbEditTotal" value="${Number(e.total) || 0}" oninput="dbCleanNum(this); dbEditRecalc('total')"></label>
                </div>
                <label class="dbo-edit-wide">Себестоимость HQ<input type="text" inputmode="decimal" id="dbEditCostHq" value="${escapeHtml(costHq)}" oninput="dbCleanNum(this)"></label>
                <label class="dbo-edit-wide">Количество листов<input type="text" inputmode="decimal" id="dbEditSheets" value="${escapeHtml(sheets)}" oninput="dbCleanNum(this)"></label>
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
}
// Авто-высота textarea наименования (растёт вниз по мере ввода).
function dbAutoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 40) + "px";
}
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

// Доп-инфо под элементом: «Название поля: значение · …»
function dbElAfLine(e) {
    const af = dbAfWithValue(e.additional_fields);
    if (!af.length) return "";
    return `<div class="dbo-el-meta">${af.map(f => `${escapeHtml(f.name)}: <b>${dbAfValueHtml(f.value)}</b>`).join(" · ")}</div>`;
}
// Строка элемента: СТАТУС(кружок) · НАЗВАНИЕ(+доп-инфо) · КОЛ-ВО · СЕБЕС. · СУММА.
function dbElementRow(e) {
    const qty = Number(e.quantity) || 0;
    const cost = Number(e.cost) || 0;
    const total = Number(e.total) || 0;
    return `
        <div class="dbo-el-row">
            <div class="dbo-el-status">${dbElStatusBtn(e)}</div>
            <div class="dbo-el-name">
                <div class="dbo-el-title dbo-el-title--edit" onclick="dbOpenElEdit(${e.crm_element_id})" title="Редактировать позицию">${escapeHtml(e.category_and_name || e.name || "—")}</div>
                ${dbElAfLine(e)}
            </div>
            <div class="dbo-el-qty">${qty} ${escapeHtml(e.units || "шт")}</div>
            <div class="dbo-el-cost">${cost ? money(cost) : "—"}</div>
            <div class="dbo-el-sum">${money2(total)}</div>
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
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);

    // Статус — цветная пилюля с меню (как в «Заказах»).
    const dealStatusControl = (dbOrdersState.statuses && dbOrdersState.statuses.length)
        ? dbDealStatusSelectHtml({ crm_deal_id: crmId, status_id: d.status_id, status_name: d.status_name })
        : `<span class="dbk-status-pill" style="background:#dfdfdf;color:#555">${escapeHtml(d.status_name || "Статус не установлен")}</span>`;

    const elHead = `<div class="dbo-el-head"><span>Статус</span><span>Название</span><span>Кол-во</span><span>Себес.</span><span>Сумма</span></div>`;
    const elBody = elements.length
        ? elements.map(dbElementRow).join("")
        : `<div class="dbo-el-empty">Элементов в базе нет — нажмите «⟳ Элементы» в разделе.</div>`;

    // Вся доп-информация по сделке (кроме «Информации по себестоимости» — она отдельным полем).
    const dealAf = dbAfWithValue(d.additional_fields).filter(f => Number(f?.id) !== 476);
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
                    <div class="dbo-num">№ ${escapeHtml(String(d.num ?? crmId))}</div>
                    <div class="dbo-client">${DBO_USER_ICON} ${escapeHtml(d.client_name || "—")}</div>
                </div>
                <div class="dbo-head-right">
                    ${dealStatusControl}
                    <a class="dbo-crm" href="https://crm.heavendevelop.ru/editDeal/${crmId}" target="_blank" rel="noopener" title="Открыть в CRM">↗</a>
                    <button class="dbo-close" onclick="closeDbDealCard()" aria-label="Закрыть">×</button>
                </div>
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
                        <div class="payment-summary-row paid-row"><span class="payment-summary-label">Оплачено</span><span class="payment-summary-value">${money2(paid)}</span><span></span></div>
                        <div class="payment-summary-row"><span class="payment-summary-label">Долг</span><span class="payment-summary-value ${debt > 0.009 ? "payment-alert" : "payment-ok"}">${money2(debt)}</span><span></span></div>
                    </div>
                </div>
                ${dealAfBlock}
                ${costBlock}
            </div>
        </div>`;
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
