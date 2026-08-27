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
    updateDbZoomUI();
}
function updateDbZoomUI() {
    const sel = document.getElementById("dbZoomSelect");
    if (sel) sel.value = String(dbOrdersState.kanbanZoom || 1);
}

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
    // Все статусы из справочника показываем колонками — даже пустые (для перетаскивания).
    order.forEach(id => { const c = byId.get(id); if (c) cols.push(c); });
    // Прочие статусы (которых нет в справочнике) — только если в них есть сделки.
    extra.forEach(id => { const c = byId.get(id); if (c && c.deals.length) cols.push(c); });
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
            <div class="dbk-col-head"${dbColHeadStyle(c)}>
                <span class="dbk-col-name">${escapeHtml(c.name)}</span>
                <span class="dbk-col-count">${c.deals.length}</span>
            </div>
            <div class="dbk-col-body">${c.deals.map(dbDealCardHtml).join("")}</div>
        </div>`).join("")}</div>`;
}

// ---- Drag-and-drop: смена статуса сделки перетаскиванием ----
let dbDragDealId = null;
function dbDragStart(e, dealId) {
    dbDragDealId = dealId;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(dealId)); } catch (_) {} }
    if (e.currentTarget) e.currentTarget.classList.add("dbk-card--dragging");
}
function dbDragEnd(e) { if (e.currentTarget) e.currentTarget.classList.remove("dbk-card--dragging"); }
function dbDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (e.currentTarget) e.currentTarget.classList.add("dbk-col--over");
}
function dbDragLeave(e) {
    // не снимать подсветку при переходе на дочерний элемент (карточку) внутри столбика
    if (e.currentTarget && !e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove("dbk-col--over");
    }
}
function dbDrop(e, statusId) {
    e.preventDefault();
    if (e.currentTarget) e.currentTarget.classList.remove("dbk-col--over");
    const id = dbDragDealId; dbDragDealId = null;
    if (!id || !Number.isFinite(Number(statusId)) || Number(statusId) < 0) return;
    const deal = dbFindDeal(id);
    if (!deal || Number(deal.status_id) === Number(statusId)) return;
    setDealStatus(id, statusId);
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
            <div class="dl-cell dl-content">${escapeHtml(d.content || "—")}</div>
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
        <div class="crm-list-table">${dbListHead()}${deals.map(dbListRowHtml).join("")}</div>
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

// Бэкфилл элементов — фоновая задача на сервере, опрашиваем прогресс.
let dbElementsPollTimer = null;
async function syncDbElements(btn) {
    if (!ensureActiveSession()) return;
    const original = (btn && btn.dataset.orig) || (btn ? btn.innerHTML : "");
    if (btn) { btn.dataset.orig = original; btn.disabled = true; btn.innerHTML = "Элементы…"; }
    try {
        await clientsApi("syncDealElements", {});   // старт (возвращается сразу)
        if (typeof showReadinessToast === "function") {
            showReadinessToast("Синхронизация элементов запущена в фоне…");
        }
        pollDbElements(btn);
    } catch (e) {
        console.error("syncDbElements", e);
        alert("Не удалось запустить синхронизацию элементов.");
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
}

async function pollDbElements(btn) {
    try {
        const data = await clientsApi("elementsSyncStatus", {});
        const job = data?.job || {};
        if (job.running) {
            if (btn) btn.innerHTML = `Элементы ${job.deals || 0}/${job.total || 0}`;
            clearTimeout(dbElementsPollTimer);
            dbElementsPollTimer = setTimeout(() => pollDbElements(btn), 3000);
            return;
        }
        // завершено
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.orig || "⟳ Элементы"; }
        const samples = Array.isArray(job.errors) ? job.errors : [];
        if (job.failed && samples.length) {
            console.warn("Ошибки синхронизации элементов (образцы):", samples);
        }
        if (typeof showReadinessToast === "function") {
            showReadinessToast(job.error
                ? `Элементы: ошибка — ${job.error}`
                : `Элементы готовы: ${job.elements || 0} по ${job.deals || 0} сделкам${job.failed ? `, ошибок ${job.failed}` : ""}`);
        }
        // при ошибках — показать первую причину (остальные в консоли/логах)
        if (job.failed && samples.length) {
            alert(`Часть элементов не загрузилась (${job.failed}).\nПример ошибки:\n${samples[0]}\n\nОстальные образцы — в консоли (F12) и в логах бэкенда.`);
        }
        await loadDbDeals();
    } catch (e) {
        console.error("pollDbElements", e);
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.orig || "⟳ Элементы"; }
    }
}

// ---- Карточка заказа (сделка + элементы) ----
function dbDealCardEsc(e) { if (e.key === "Escape") closeDbDealCard(); }
function closeDbDealCard() {
    const ov = document.getElementById("dbDealCardOverlay");
    if (ov) ov.style.display = "none";
    document.removeEventListener("keydown", dbDealCardEsc);
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

function dbElementStatusSelectHtml(e) {
    const statuses = dbCardElementStatuses || [];
    const cur = e.status_id != null ? Number(e.status_id) : null;
    if (!statuses.length) return escapeHtml(e.status_name || "Не выбран");
    const curSt = statuses.find(s => Number(s.id) === cur) || null;
    // Нет статуса в CRM → плейсхолдер «Не выбран» (selected + disabled), а не первый попавшийся.
    const placeholder = `<option value="" disabled${cur == null ? " selected" : ""}>Не выбран</option>`;
    const extra = (cur != null && !curSt) ? `<option value="${cur}" selected>${escapeHtml(e.status_name || "—")}</option>` : "";
    const opts = statuses.map(s => `<option value="${s.id}"${Number(s.id) === cur ? " selected" : ""}>${escapeHtml(s.name)}</option>`).join("");
    return `<select class="dbk-status-select" data-prev="${cur ?? ""}" onchange="onDbElementStatusChange(this, ${e.crm_element_id})">${placeholder}${extra}${opts}</select>`;
}
function onDbElementStatusChange(sel, elId) { if (sel.value) setElementStatus(dbCardDealId, elId, Number(sel.value), sel); }
async function setElementStatus(dealId, elId, statusId, sel) {
    const prev = sel ? sel.getAttribute("data-prev") : null;
    try {
        await clientsApi("setElementStatus", { dealId: Number(dealId), elementId: Number(elId), statusId: Number(statusId) });
        if (sel) sel.setAttribute("data-prev", String(statusId));
        if (typeof showReadinessToast === "function") showReadinessToast("Статус элемента обновлён");
    } catch (e) {
        console.error("setElementStatus", e);
        if (sel && prev != null) sel.value = prev;
        alert("Не удалось сменить статус элемента в CRM.");
    }
}

function dbElementRow(e) {
    const total = money(e.total);
    const qty = Number(e.quantity) || 0;
    const af = dbAfWithValue(e.additional_fields);
    const afHtml = af.length
        ? `<div class="dbk-el-af">${af.map(f => `<span class="dbk-el-af-chip">${escapeHtml(f.name || "")}: ${dbAfValueHtml(f.value)}</span>`).join("")}</div>`
        : "";
    return `
        <tr>
            <td class="clients-td-num">${escapeHtml(String(e.num ?? ""))}</td>
            <td>${escapeHtml(e.category_and_name || e.name || "—")}${afHtml}</td>
            <td class="clients-td-num">${qty}${e.units ? " " + escapeHtml(e.units) : ""}</td>
            <td class="clients-td-num">${total} ₽</td>
            <td class="cc-deal-status">${dbElementStatusSelectHtml(e)}</td>
        </tr>`;
}

function renderDbDealCard(data, crmId) {
    const ov = document.getElementById("dbDealCardOverlay");
    if (!ov) return;
    const d = data?.deal || {};
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    dbCardDealId = crmId;
    dbCardElementStatuses = Array.isArray(data?.elementStatuses) ? data.elementStatuses : [];
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);
    const crmLink = `<a class="client-card-crm" href="https://crm.heavendevelop.ru/editDeal/${crmId}" target="_blank" rel="noopener">В CRM ↗</a>`;

    // Статус сделки — редактируемый (если справочник статусов загружен).
    const dealStatusControl = (dbOrdersState.statuses && dbOrdersState.statuses.length)
        ? dbDealStatusSelectHtml({ crm_deal_id: crmId, status_id: d.status_id, status_name: d.status_name })
        : `<span class="cc-stat-value" style="font-size:15px">${escapeHtml(d.status_name || "—")}</span>`;

    const stats = `
        <div class="client-card-stats">
            <div class="cc-stat"><span class="cc-stat-label">Статус</span>${dealStatusControl}</div>
            <div class="cc-stat"><span class="cc-stat-label">Сумма</span><span class="cc-stat-value">${money(amount)} ₽</span></div>
            <div class="cc-stat"><span class="cc-stat-label">Оплачено</span><span class="cc-stat-value">${money(paid)} ₽</span></div>
            <div class="cc-stat"><span class="cc-stat-label">Долг</span><span class="cc-stat-value ${debt > 0.009 ? "is-negative" : ""}">${money(debt)} ₽</span></div>
        </div>`;

    const dealAf = dbAfWithValue(d.additional_fields);
    const dealAfBlock = dealAf.length ? `
        <div class="dbk-af">
            <div class="dbk-af-head">Доп. поля сделки</div>
            <div class="dbk-af-grid">${dealAf.map(f => `
                <div class="dbk-af-row"><span class="dbk-af-name">${escapeHtml(f.name || "")}</span><span class="dbk-af-val">${dbAfValueHtml(f.value)}</span></div>`).join("")}</div>
        </div>` : "";

    const elementsBlock = elements.length ? `
        <div class="client-card-deals-head"><span>Элементы <b>(${elements.length})</b></span></div>
        <div class="clients-table-wrap">
            <table class="clients-table cc-deals-table">
                <thead><tr><th class="clients-td-num">№</th><th>Наименование</th><th class="clients-td-num">Кол-во</th><th class="clients-td-num">Сумма</th><th>Статус</th></tr></thead>
                <tbody>${elements.map(dbElementRow).join("")}</tbody>
            </table>
        </div>` : `
        <div class="client-card-deals-empty">
            <p>Элементов в базе нет.</p>
            <p class="cc-hint">Нажмите «⟳ Элементы» в разделе, чтобы подтянуть их из CRM.</p>
        </div>`;

    ov.innerHTML = `
        <div class="client-card" role="dialog" aria-modal="true">
            <div class="client-card-header">
                <div class="client-card-title">
                    <h3>Заказ № ${escapeHtml(String(d.num ?? crmId))}</h3>
                    <div class="client-card-sub">${escapeHtml(d.client_name || "—")}${d.employee_name ? " · " + escapeHtml(d.employee_name) : ""}${d.created_at_crm ? " · " + escapeHtml(d.created_at_crm) : ""}</div>
                </div>
                <div class="client-card-header-actions">
                    ${crmLink}
                    <button class="client-card-close" onclick="closeDbDealCard()" aria-label="Закрыть">&times;</button>
                </div>
            </div>
            <div class="client-card-body">
                ${stats}
                ${dealAfBlock}
                ${elementsBlock}
            </div>
        </div>`;
}
