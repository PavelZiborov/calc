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
    loaded: false
};

let dbDealsSearchTimer = null;

function openDbOrders(trigger) {
    if (!ensureActiveSession()) return;
    switchTab("db-orders-tab", trigger || document.querySelector('.tab-btn[data-tab-target="db-orders-tab"]'));
    if (!dbOrdersState.loaded) loadDbDeals();
}

async function loadDbDeals() {
    if (!ensureActiveSession()) return;
    dbOrdersState.loading = true;
    dbOrdersState.error = "";
    renderDbKanban();
    try {
        const data = await clientsApi("listDeals", { q: dbOrdersState.query || "" });
        dbOrdersState.deals = Array.isArray(data?.deals) ? data.deals : [];
        dbOrdersState.statuses = Array.isArray(data?.statuses) ? data.statuses : [];
        dbOrdersState.loaded = true;
    } catch (e) {
        console.error("loadDbDeals", e);
        dbOrdersState.deals = [];
        dbOrdersState.error = "Не удалось загрузить заказы. Проверьте бэкенд (/api/clients).";
    } finally {
        dbOrdersState.loading = false;
        renderDbKanban();
    }
}

function onDbDealsSearchInput(value) {
    dbOrdersState.query = String(value || "");
    clearTimeout(dbDealsSearchTimer);
    dbDealsSearchTimer = setTimeout(() => loadDbDeals(), 350);
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
    order.forEach(id => { const c = byId.get(id); if (c && c.deals.length) cols.push(c); });
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
        <div class="dbk-card" onclick="openDbDealCard(${d.crm_deal_id})" title="Открыть заказ">
            <div class="dbk-card-top">
                <span class="dbk-card-num">№ ${num}</span>
                <span class="dbk-card-amount">${money(d.amount)} ₽</span>
            </div>
            <div class="dbk-card-client">${escapeHtml(d.client_name || "—")}</div>
            ${d.content ? `<div class="dbk-card-content">${escapeHtml(d.content)}</div>` : ""}
            <div class="dbk-card-meta">${els ? `<span>${els} элем.</span>` : "<span></span>"}${debtBadge}</div>
        </div>`;
}

function renderDbKanban() {
    const host = document.getElementById("dbKanbanBoard");
    if (!host) return;
    if (dbOrdersState.loading && !dbOrdersState.deals.length) {
        host.innerHTML = `<div class="dbk-empty">Загрузка заказов…</div>`;
        return;
    }
    if (dbOrdersState.error) {
        host.innerHTML = `<div class="dbk-empty dbk-empty--error">${escapeHtml(dbOrdersState.error)}</div>`;
        return;
    }
    if (!dbOrdersState.deals.length) {
        host.innerHTML = `<div class="dbk-empty">${dbOrdersState.query ? "Ничего не найдено." : "Нет заказов в базе. Нажмите «⟳ Сделки», затем «⟳ Элементы»."}</div>`;
        return;
    }
    const cols = buildDbColumns(dbOrdersState.deals, dbOrdersState.statuses);
    host.innerHTML = cols.map(c => `
        <div class="dbk-col">
            <div class="dbk-col-head"${dbColHeadStyle(c)}>
                <span class="dbk-col-name">${escapeHtml(c.name)}</span>
                <span class="dbk-col-count">${c.deals.length}</span>
            </div>
            <div class="dbk-col-body">${c.deals.map(dbDealCardHtml).join("")}</div>
        </div>`).join("");
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

function dbElementRow(e) {
    const total = money(e.total);
    const qty = Number(e.quantity) || 0;
    const status = String(e.status_name || "").trim();
    return `
        <tr>
            <td class="clients-td-num">${escapeHtml(String(e.num ?? ""))}</td>
            <td>${escapeHtml(e.category_and_name || e.name || "—")}</td>
            <td class="clients-td-num">${qty}${e.units ? " " + escapeHtml(e.units) : ""}</td>
            <td class="clients-td-num">${total} ₽</td>
            <td class="cc-deal-status">${status ? escapeHtml(status) : "—"}</td>
        </tr>`;
}

function renderDbDealCard(data, crmId) {
    const ov = document.getElementById("dbDealCardOverlay");
    if (!ov) return;
    const d = data?.deal || {};
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);
    const crmLink = `<a class="client-card-crm" href="https://crm.heavendevelop.ru/editDeal/${crmId}" target="_blank" rel="noopener">В CRM ↗</a>`;

    const stats = `
        <div class="client-card-stats">
            <div class="cc-stat"><span class="cc-stat-label">Статус</span><span class="cc-stat-value" style="font-size:15px">${escapeHtml(d.status_name || "—")}</span></div>
            <div class="cc-stat"><span class="cc-stat-label">Сумма</span><span class="cc-stat-value">${money(amount)} ₽</span></div>
            <div class="cc-stat"><span class="cc-stat-label">Оплачено</span><span class="cc-stat-value">${money(paid)} ₽</span></div>
            <div class="cc-stat"><span class="cc-stat-label">Долг</span><span class="cc-stat-value ${debt > 0.009 ? "is-negative" : ""}">${money(debt)} ₽</span></div>
        </div>`;

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
                ${elementsBlock}
            </div>
        </div>`;
}
