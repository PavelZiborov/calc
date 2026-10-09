// ——— Раздел «Производство» ———
// Незавершённые элементы заказов (с превью) для печати и оперативной смены статуса.
// Без цен/себестоимости. Фильтры: статус, менеджер, категория, поиск + сброс.

const prodState = { statusId: "", manager: "", categoryId: "", search: "", page: 1 };
let prodData = { elements: [], statuses: [], managers: [], categories: [], total: 0, page: 1, pages: 1 };
const prodPreviews = new Map();   // elId -> url | null
let prodSearchTimer = null;

function prodEsc(v) { return (typeof escapeHtml === "function") ? escapeHtml(String(v == null ? "" : v)) : String(v == null ? "" : v); }
function prodCatName(id) {
    const c = (prodData.categories || []).find(x => Number(x.id) === Number(id));
    return c ? c.name : "";
}

function openProduction(btn) {
    if (typeof ensureActiveSession === "function" && !ensureActiveSession()) return;
    if (typeof switchTab === "function") switchTab("production-tab", btn);
    prodLoad(true);
}

async function prodLoad(initial) {
    const listHost = document.getElementById("prodListBody");
    if (listHost && initial) listHost.innerHTML = `<p class="prod-note">Загрузка…</p>`;
    try {
        const r = await clientsApi("listProduction", {
            statusId: prodState.statusId || undefined,
            manager: prodState.manager || undefined,
            categoryId: prodState.categoryId || undefined,
            search: prodState.search || undefined,
            page: prodState.page || 1,
        });
        prodData = {
            elements: Array.isArray(r.elements) ? r.elements : [],
            statuses: Array.isArray(r.statuses) ? r.statuses : [],
            managers: Array.isArray(r.managers) ? r.managers : [],
            categories: Array.isArray(r.categories) ? r.categories : [],
            total: Number(r.total) || 0, page: Number(r.page) || 1, pages: Number(r.pages) || 1,
        };
        prodState.page = prodData.page;
        if (initial) prodRenderFilters();
        prodRenderList();
        prodLoadPreviews();
    } catch (e) {
        console.error("listProduction", e);
        if (listHost) listHost.innerHTML = `<p class="prod-note prod-alert">Не удалось загрузить список производства.</p>`;
    }
}

function prodRenderFilters() {
    const host = document.getElementById("prodFilters");
    if (!host) return;
    // Все статусы (включая «Завершено» — чтобы смотреть завершённые позиции постранично).
    const statusOpts = prodData.statuses
        .map(s => `<option value="${s.id}"${String(s.id) === String(prodState.statusId) ? " selected" : ""}>${prodEsc(s.name)}</option>`).join("");
    const mgrOpts = prodData.managers
        .map(m => `<option value="${prodEsc(m)}"${m === prodState.manager ? " selected" : ""}>${prodEsc(m)}</option>`).join("");
    const catOpts = (prodData.categories || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"))
        .map(c => `<option value="${c.id}"${String(c.id) === String(prodState.categoryId) ? " selected" : ""}>${prodEsc(c.name)}</option>`).join("");
    host.innerHTML = `
        <div class="prod-filter-group"><label>Статус</label><select id="prodFilterStatus" onchange="prodOnFilter()"><option value="">Все</option>${statusOpts}</select></div>
        <div class="prod-filter-group"><label>Менеджер</label><select id="prodFilterManager" onchange="prodOnFilter()"><option value="">Все</option>${mgrOpts}</select></div>
        <div class="prod-filter-group"><label>Категория</label><select id="prodFilterCategory" onchange="prodOnFilter()"><option value="">Все</option>${catOpts}</select></div>
        <div class="prod-filter-group prod-filter-search"><label>Поиск</label><input type="text" id="prodFilterSearch" value="${prodEsc(prodState.search)}" placeholder="Заказ, клиент, позиция…" oninput="prodOnSearch(this.value)"></div>
        <button type="button" class="prod-btn prod-btn-ghost prod-reset" onclick="prodReset()">Сбросить фильтры</button>`;
}

function prodOnFilter() {
    prodState.statusId = document.getElementById("prodFilterStatus")?.value || "";
    prodState.manager = document.getElementById("prodFilterManager")?.value || "";
    prodState.categoryId = document.getElementById("prodFilterCategory")?.value || "";
    prodState.page = 1;
    prodLoad(false);
}
function prodOnSearch(v) {
    prodState.search = v;
    prodState.page = 1;
    clearTimeout(prodSearchTimer);
    prodSearchTimer = setTimeout(() => prodLoad(false), 350);
}
function prodReset() {
    prodState.statusId = ""; prodState.manager = ""; prodState.categoryId = ""; prodState.search = ""; prodState.page = 1;
    prodRenderFilters();
    prodLoad(false);
}
function prodGoPage(p) {
    const n = Math.min(prodData.pages, Math.max(1, Number(p) || 1));
    if (n === prodState.page) return;
    prodState.page = n;
    prodLoad(false);
    const host = document.getElementById("production-tab");
    if (host) host.scrollIntoView({ block: "start" });
}

function prodStatusColor(e) {
    return (typeof dbElStatusColor === "function") ? dbElStatusColor(e.status_name) : "#7a766c";
}
function prodStatusSelectHtml(e) {
    const cur = e.status_id != null ? Number(e.status_id) : null;
    const opts = prodData.statuses.map(s =>
        `<option value="${s.id}"${Number(s.id) === cur ? " selected" : ""}>${prodEsc(s.name)}</option>`).join("");
    const color = prodStatusColor(e);
    return `<select class="prod-status-select" style="border-color:${color};color:${color}"
        onchange="prodSetStatus(${e.crm_element_id}, ${e.deal_crm_id}, this.value)">${opts}</select>`;
}

function prodRenderList() {
    const host = document.getElementById("prodListBody");
    if (!host) return;
    const els = prodData.elements;
    const countEl = document.getElementById("prodCount");
    if (countEl) countEl.textContent = prodData.total ? `${prodData.total}` : "";
    if (!els.length) {
        host.innerHTML = `<p class="prod-note">Нет позиций по выбранным фильтрам.</p>`;
        return;
    }
    const rowsHtml = els.map(e => {
        const qty = (Number(e.quantity) || 0);
        const units = prodEsc(e.units || "шт");
        const sheets = (e.sheets != null && String(e.sheets).trim() !== "") ? `Листов: <b>${prodEsc(e.sheets)}</b> · ` : "";
        const reorder = e.reorder ? `<div class="prod-reorder">↗ Переразмещение: <b>${prodEsc(e.reorder.contractorName || "подрядчик")}</b></div>` : "";
        const cat = prodCatName(e.category_id);
        return `<div class="prod-row" data-el="${e.crm_element_id}">
            <div class="prod-thumb" data-el="${e.crm_element_id}" title="Превью"><span class="prod-thumb-ph">нет превью</span></div>
            <div class="prod-main">
                <div class="prod-dealline"><button type="button" class="prod-dealnum" onclick="openDbDealCard(${e.deal_crm_id})" title="Открыть заказ">№ ${prodEsc(e.deal_num || "—")}</button>${e.client_name ? ` · ${prodEsc(e.client_name)}` : ""}${cat ? ` · <span class="prod-cat">${prodEsc(cat)}</span>` : ""}</div>
                <div class="prod-title">${prodEsc(e.category_and_name || e.name || "—")}</div>
                <div class="prod-meta">${sheets}Кол-во: <b>${qty} ${units}</b></div>
                ${reorder}
                <div class="prod-mgr">Менеджер: ${prodEsc(e.manager || "—")}</div>
            </div>
            <div class="prod-actions">
                ${prodStatusSelectHtml(e)}
                <button type="button" class="prod-btn prod-btn-open" onclick="openDbDealCard(${e.deal_crm_id})">Открыть заказ ↗</button>
            </div>
        </div>`;
    }).join("");
    host.innerHTML = rowsHtml + prodPagerHtml();
    // восстановить уже загруженные превью
    for (const e of els) { if (prodPreviews.has(String(e.crm_element_id))) prodApplyThumb(e.crm_element_id); }
}

function prodPagerHtml() {
    if ((prodData.pages || 1) <= 1) return "";
    const p = prodData.page, m = prodData.pages;
    return `<div class="prod-pager">
        <button type="button" class="prod-btn prod-btn-ghost" ${p <= 1 ? "disabled" : ""} onclick="prodGoPage(${p - 1})">← Назад</button>
        <span class="prod-pager-info">Страница <b>${p}</b> из <b>${m}</b> · всего ${prodData.total}</span>
        <button type="button" class="prod-btn prod-btn-ghost" ${p >= m ? "disabled" : ""} onclick="prodGoPage(${p + 1})">Вперёд →</button>
    </div>`;
}

async function prodLoadPreviews() {
    for (const e of prodData.elements) {
        const key = String(e.crm_element_id);
        if (prodPreviews.has(key)) { prodApplyThumb(e.crm_element_id); continue; }
        try {
            const data = await clientsApi("getElementAssets", { dealId: Number(e.deal_crm_id), elementId: Number(e.crm_element_id), dealNum: String(e.deal_num || "") });
            const url = data?.preview?.thumbUrl || data?.preview?.url || null;
            prodPreviews.set(key, (typeof dboIsImageUrl === "function" && dboIsImageUrl(url)) ? url : null);
        } catch (_) { prodPreviews.set(key, null); }
        prodApplyThumb(e.crm_element_id);
    }
}
function prodApplyThumb(elId) {
    const url = prodPreviews.get(String(elId));
    document.querySelectorAll(`.prod-thumb[data-el="${elId}"]`).forEach(t => {
        if (url) {
            t.innerHTML = `<img src="${prodEsc(url)}" alt="" referrerpolicy="no-referrer">`;
            t.classList.add("has-preview");
            t.onclick = () => { if (typeof dboOpenLightbox === "function") dboOpenLightbox(url); };
        } else {
            t.innerHTML = `<span class="prod-thumb-ph">нет превью</span>`;
            t.classList.remove("has-preview");
            t.onclick = null;
        }
    });
}

async function prodSetStatus(elId, dealId, statusId) {
    const sid = Number(statusId);
    if (!Number.isFinite(sid)) return;
    try {
        await clientsApi("setElementStatus", { dealId: Number(dealId), elementId: Number(elId), statusId: sid });
        const st = prodData.statuses.find(s => Number(s.id) === sid);
        if (st && Number(st.type) === 1) {
            // завершено — убираем из очереди производства
            prodData.elements = prodData.elements.filter(e => Number(e.crm_element_id) !== Number(elId));
            prodRenderList();
        } else {
            const e = prodData.elements.find(x => Number(x.crm_element_id) === Number(elId));
            if (e) { e.status_id = sid; e.status_name = st ? st.name : e.status_name; }
            prodRenderList();
        }
        if (typeof showReadinessToast === "function") showReadinessToast("Статус обновлён");
    } catch (e) {
        console.error("prodSetStatus", e);
        alert("Не удалось сменить статус в CRM.");
        prodLoad(false);
    }
}
function prodMarkDone(elId, dealId) {
    const done = prodData.statuses.find(s => Number(s.type) === 1);
    if (!done) { alert("Не найден статус «Завершено»."); return; }
    prodSetStatus(elId, dealId, done.id);
}
