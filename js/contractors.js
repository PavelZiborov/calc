// ——— Раздел «Подрядчики» (перезаказ продукции) ———
// Наш учёт долга = сумма неоплаченных перезаказов (себестоимость элементов).
// Долг/оплачено из PrintOffice показываем справочно (API — только агрегаты, read-only).

let ctrListCache = [];
let ctrCurrentId = null;
let ctrDefaultContractorId = null;   // подрядчик по умолчанию для перезаказа

function ctrMoney(v) { return (typeof money2 === "function") ? money2(v) : (Math.round((Number(v) || 0) * 100) / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ctrEsc(v) { return (typeof escapeHtml === "function") ? escapeHtml(String(v == null ? "" : v)) : String(v == null ? "" : v); }

function openContractors(btn) {
    if (typeof ensureActiveSession === "function" && !ensureActiveSession()) return;
    if (typeof switchTab === "function") switchTab("contractors-tab", btn);
    ctrCurrentId = null;
    ctrShowList();
    ctrLoadList();
}

function ctrShowList() {
    const list = document.getElementById("contractorsListView");
    const det = document.getElementById("contractorDetailView");
    if (list) list.style.display = "";
    if (det) det.style.display = "none";
}

async function ctrLoadList() {
    const host = document.getElementById("contractorsListBody");
    if (host) host.innerHTML = `<p class="ctr-note">Загрузка…</p>`;
    try {
        const r = await clientsApi("listContractors", {});
        ctrListCache = Array.isArray(r.contractors) ? r.contractors : [];
        ctrDefaultContractorId = (r.defaultContractorId != null) ? Number(r.defaultContractorId) : null;
        if (typeof dbContractorsCache !== "undefined") { dbContractorsCache = ctrListCache; dbReorderDefaultId = ctrDefaultContractorId; }  // синхронизируем кэш выпадашки
        ctrRenderList();
    } catch (e) {
        console.error("listContractors", e);
        if (host) host.innerHTML = `<p class="ctr-note ctr-alert">Не удалось загрузить список подрядчиков.</p>`;
    }
}

function ctrRenderList() {
    const host = document.getElementById("contractorsListBody");
    if (!host) return;
    if (!ctrListCache.length) {
        host.innerHTML = `<p class="ctr-note">Подрядчиков пока нет. Добавьте вручную или синхронизируйте с PrintOffice.</p>`;
        return;
    }
    const rows = ctrListCache.map(c => {
        const debt = Number(c.our_debt) || 0;
        const poDebt = c.po_debt != null ? Number(c.po_debt) : null;
        return `<tr class="ctr-row${c.active ? "" : " ctr-row--off"}" onclick="ctrOpenDetail(${c.id})">
            <td class="ctr-td-name">${ctrEsc(c.name)}${c.active ? "" : ` <span class="ctr-tag">неактивен</span>`}${c.po_id ? ` <span class="ctr-tag ctr-tag--po">PO</span>` : ""}</td>
            <td class="ctr-td-num ${debt > 0 ? "ctr-debt" : ""}">${debt > 0 ? ctrMoney(debt) + " ₽" : "—"}</td>
            <td class="ctr-td-num">${Number(c.our_paid) > 0 ? ctrMoney(c.our_paid) + " ₽" : "—"}</td>
            <td class="ctr-td-num">${Number(c.our_orders) || 0}${Number(c.our_unpaid) > 0 ? ` <span class="ctr-unpaid">(${c.our_unpaid} неопл.)</span>` : ""}</td>
            <td class="ctr-td-num ctr-po-col">${poDebt != null ? ctrMoney(poDebt) + " ₽" : "—"}</td>
        </tr>`;
    }).join("");
    // Подрядчик по умолчанию для перезаказа (подставляется при включении галочки в позиции). Только админ.
    let defBlock = "";
    if (ctrIsAdmin()) {
        const opts = `<option value="">— без конкретного —</option>` +
            ctrListCache.map(c => `<option value="${c.id}"${Number(c.id) === Number(ctrDefaultContractorId) ? " selected" : ""}>${ctrEsc(c.name)}</option>`).join("");
        defBlock = `<div class="ctr-default-row">
            <label class="ctr-default-label">Подрядчик по умолчанию для перезаказа:</label>
            <select id="ctrDefaultSel" onchange="ctrSetDefaultContractor(this.value)">${opts}</select>
            <span id="ctrDefaultMsg" class="ctr-note"></span>
        </div>`;
    }
    host.innerHTML = defBlock + `<table class="ctr-table">
        <thead><tr>
            <th>Подрядчик</th><th>Наш долг</th><th>Оплачено нами</th><th>Заказов</th><th class="ctr-po-col" title="Долг по данным PrintOffice (справочно)">Долг PrintOffice</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}
async function ctrSetDefaultContractor(val) {
    const msg = document.getElementById("ctrDefaultMsg");
    try {
        const r = await clientsApi("setReorderDefaultContractor", { contractorId: val || "" });
        ctrDefaultContractorId = (r.defaultContractorId != null) ? Number(r.defaultContractorId) : null;
        if (typeof dbReorderDefaultId !== "undefined") dbReorderDefaultId = ctrDefaultContractorId;
        if (msg) { msg.textContent = "Сохранено"; msg.className = "ctr-note ctr-ok"; setTimeout(() => { if (msg) msg.textContent = ""; }, 1800); }
    } catch (e) { if (msg) { msg.textContent = "Ошибка: " + (e.message || ""); msg.className = "ctr-note ctr-alert"; } }
}

async function ctrSync(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "Синхронизация…"; }
    try {
        const r = await clientsApi("syncContractorsFromPrintoffice", {});
        await ctrLoadList();
        if (typeof showReadinessToast === "function") showReadinessToast(`Синхронизировано подрядчиков: ${r.synced}`);
    } catch (e) {
        console.error("syncContractors", e);
        alert("Не удалось синхронизировать: " + (e.message || ""));
    } finally { if (btn) { btn.disabled = false; btn.textContent = "Синхронизировать с PrintOffice"; } }
}

// ——— Карточка подрядчика ———
async function ctrOpenDetail(id) {
    ctrCurrentId = Number(id);
    ctrIntegrationLoaded = false;   // при открытии подрядчика интеграция грузится заново (лениво)
    const list = document.getElementById("contractorsListView");
    const det = document.getElementById("contractorDetailView");
    if (list) list.style.display = "none";
    if (det) { det.style.display = ""; det.innerHTML = `<p class="ctr-note">Загрузка…</p>`; }
    try {
        const r = await clientsApi("getContractor", { id: ctrCurrentId });
        ctrRenderDetail(r);
    } catch (e) {
        console.error("getContractor", e);
        if (det) det.innerHTML = `<p class="ctr-note ctr-alert">Не удалось загрузить подрядчика.</p>`;
    }
}

function ctrRenderDetail(r) {
    const det = document.getElementById("contractorDetailView");
    if (!det) return;
    const c = r.contractor || {};
    const orders = Array.isArray(r.orders) ? r.orders : [];
    const debt = Number(r.debt) || 0;
    const paid = Number(r.paid) || 0;
    const unpaid = orders.filter(o => !o.paid);
    const ordRows = orders.length ? orders.map(o => {
        const amount = Number(o.amount) || 0;   // эффективная сумма подрядчику (кастомная или = себестоимость)
        const date = o.created_at_crm || "";
        const dealId = o.deal_crm_id != null ? Number(o.deal_crm_id) : null;
        const numCell = o.deal_num
            ? (dealId ? `<a href="#" class="ctr-ord-link" onclick="ctrOpenDeal(${dealId}); return false;">№ ${ctrEsc(o.deal_num)}</a>` : `№ ${ctrEsc(o.deal_num)}`)
            : "—";
        return `<tr class="${o.paid ? "ctr-ord--paid" : ""}">
            <td>${numCell}</td>
            <td class="ctr-ord-name">${ctrEsc(o.category_and_name || o.element_name || "—")}</td>
            <td class="ctr-td-num">${Number(o.quantity) || 0} ${ctrEsc(o.units || "шт")}</td>
            <td>${ctrEsc(date)}</td>
            <td class="ctr-td-num">${ctrMoney(amount)} ₽</td>
            <td>${o.paid ? `<span class="ctr-paid">✓ оплачено</span>` : `<span class="ctr-owed">не оплачено</span>`}</td>
            <td class="ctr-td-act">${o.paid
                ? `<button type="button" class="ctr-btn ctr-btn-ghost" onclick="ctrSetPaid(${o.crm_element_id}, false)">Отменить</button>`
                : `<button type="button" class="ctr-btn ctr-btn-primary" onclick="ctrSetPaid(${o.crm_element_id}, true)">Оплатить</button>`}</td>
        </tr>`;
    }).join("") : `<tr><td colspan="7" class="ctr-note">Перезаказов у этого подрядчика пока нет.</td></tr>`;

    det.innerHTML = `
        <div class="ctr-detail-head">
            <button type="button" class="ctr-btn ctr-btn-ghost" onclick="ctrShowList()">← К списку</button>
            <h2 class="ctr-detail-title">${ctrEsc(c.name)}</h2>
            <div class="ctr-detail-actions">
                <button type="button" class="ctr-btn ctr-btn-ghost" onclick="ctrOpenEdit(${c.id})">Изменить</button>
            </div>
        </div>
        ${c.comment ? `<p class="ctr-detail-comment">${ctrEsc(c.comment)}</p>` : ""}
        <div class="ctr-summary">
            <div class="ctr-sum-box ctr-sum-debt"><span>Наш долг</span><b>${ctrMoney(debt)} ₽</b></div>
            <div class="ctr-sum-box"><span>Оплачено нами</span><b>${ctrMoney(paid)} ₽</b></div>
            <div class="ctr-sum-box"><span>Перезаказов</span><b>${orders.length} <small>(${unpaid.length} неопл.)</small></b></div>
            <div class="ctr-sum-box ctr-sum-po"><span>По PrintOffice</span><b title="справочно">долг ${c.po_debt != null ? ctrMoney(c.po_debt) : "—"} / опл. ${c.po_paid != null ? ctrMoney(c.po_paid) : "—"}</b></div>
        </div>
        ${debt > 0 ? `<div class="ctr-payall-row"><button type="button" class="ctr-btn ctr-btn-primary" onclick="ctrPayAll(${c.id}, ${unpaid.length})">Оплатить всё (${ctrMoney(debt)} ₽)</button></div>` : ""}
        <div class="ctr-tabs">
            <button type="button" class="ctr-tab is-active" data-tab="orders" onclick="ctrSwitchTab(${c.id}, 'orders', this)">Заказы</button>
            ${ctrIsAdmin() ? `<button type="button" class="ctr-tab" data-tab="integration" onclick="ctrSwitchTab(${c.id}, 'integration', this)">Интеграция</button>` : ""}
        </div>
        <div id="ctrTabOrders" class="ctr-tabpanel">
            <div class="ctr-orders-wrap">
                <table class="ctr-table ctr-orders">
                    <thead><tr><th>Заказ</th><th>Позиция</th><th>Кол-во</th><th>Дата</th><th>Сумма</th><th>Оплата</th><th></th></tr></thead>
                    <tbody>${ordRows}</tbody>
                </table>
            </div>
        </div>
        <div id="ctrTabIntegration" class="ctr-tabpanel" style="display:none"><div id="ctrIntegrationHost"></div></div>`;
}
// Переключение вкладок в карточке подрядчика. Интеграция грузится лениво при первом открытии.
let ctrIntegrationLoaded = false;
function ctrSwitchTab(contractorId, tab, btn) {
    document.querySelectorAll("#contractorDetailView .ctr-tab").forEach(b => b.classList.toggle("is-active", b === btn));
    const ord = document.getElementById("ctrTabOrders");
    const integ = document.getElementById("ctrTabIntegration");
    if (ord) ord.style.display = tab === "orders" ? "" : "none";
    if (integ) integ.style.display = tab === "integration" ? "" : "none";
    if (tab === "integration" && !ctrIntegrationLoaded) { ctrIntegrationLoaded = true; ctrLoadIntegration(contractorId); }
}
// Открыть сделку (карточку заказа) из списка перезаказов подрядчика.
function ctrOpenDeal(crmDealId) {
    if (typeof openDbDealCard === "function") openDbDealCard(Number(crmDealId));
    else if (typeof loadDbDealCard === "function") loadDbDealCard(Number(crmDealId));
    else console.warn("Не найдена функция открытия сделки");
}

// ——— Интеграция: коннектор в CRM подрядчика (только админ) ———
function ctrIsAdmin() { return (typeof isCurrentUserAdmin === "function") ? isCurrentUserAdmin() : !!(typeof currentUser !== "undefined" && currentUser && currentUser.isAdmin); }
let ctrConnData = null;
async function ctrLoadIntegration(contractorId) {
    const host = document.getElementById("ctrIntegrationHost");
    if (!host) return;
    host.innerHTML = `<div class="ctr-integ"><div class="ctr-integ-head">Интеграция с CRM подрядчика</div><p class="ctr-note">Загрузка…</p></div>`;
    try {
        ctrConnData = await clientsApi("getContractorConnector", { contractorId: Number(contractorId) });
        ctrRenderIntegration(contractorId);
    } catch (e) { console.error("getContractorConnector", e); host.innerHTML = ""; }
}
function ctrRenderIntegration(contractorId) {
    const host = document.getElementById("ctrIntegrationHost");
    if (!host || !ctrConnData) return;
    const c = ctrConnData.connector || {};
    const our = Array.isArray(ctrConnData.ourStatuses) ? ctrConnData.ourStatuses : [];
    const ourCats = Array.isArray(ctrConnData.ourCategories) ? ctrConnData.ourCategories : [];
    const extSt = Array.isArray(ctrConnData.extStatuses) ? ctrConnData.extStatuses : [];
    const extCat = Array.isArray(ctrConnData.extCategories) ? ctrConnData.extCategories : [];
    const smap = new Map((ctrConnData.statusMap || []).map(m => [Number(m.our_status_id), m.ext_status_id]));
    const cmap = new Map((ctrConnData.categoryMap || []).map(m => [Number(m.our_category_id), m.ext_category_id]));
    const trigOpts = our.map(s => `<option value="${s.id}"${Number(s.id) === Number(c.triggerStatusId) ? " selected" : ""}>${ctrEsc(s.name)}</option>`).join("");
    const encWarn = ctrConnData.encReady ? "" : `<p class="ctr-note ctr-alert">На сервере не задан ключ шифрования (CONNECTOR_ENC_KEY) — API-ключ подрядчика сохранить нельзя.</p>`;
    const check = c.lastCheckAt ? `<span class="ctr-integ-check ${c.lastCheckOk ? "ok" : "bad"}">${c.lastCheckOk ? "✓ связь ок" : "✗ связь не прошла"}</span>` : "";
    // Дефолт-категория у подрядчика.
    const defCatOpts = `<option value="">— авто (первая/Цифровая печать) —</option>` +
        extCat.map(x => `<option value="${x.id}"${Number(x.id) === Number(c.defaultCategoryId) ? " selected" : ""}>${ctrEsc(x.name)}</option>`).join("");
    // Поле «Техническое задание» наименования у подрядчика.
    const extFields = Array.isArray(ctrConnData.extElementFields) ? ctrConnData.extElementFields : [];
    const tzOpts = `<option value="">— не заполнять —</option>` +
        extFields.map(x => `<option value="${x.id}"${Number(x.id) === Number(c.tzFieldId) ? " selected" : ""}>${ctrEsc(x.name)}</option>`).join("");
    const tzField = extFields.length
        ? `<label class="ctr-field">Поле «Техническое задание» у подрядчика (туда дублируем наименование с категорией)<select id="ctrConnTz">${tzOpts}</select></label>`
        : `<p class="ctr-note">Поле «Техническое задание» подрядчика появится после сохранения ключа и «Проверить связь».</p>`;
    // Таблица сопоставления статусов: наш статус → их статус.
    const stRows = extSt.length ? our.map(s => {
        const sel = smap.has(Number(s.id)) ? Number(smap.get(Number(s.id))) : null;
        const opts = `<option value="">— не слать —</option>` + extSt.map(x => `<option value="${x.id}"${Number(x.id) === sel ? " selected" : ""}>${ctrEsc(x.name)}</option>`).join("");
        return `<div class="ctr-map-row"><span class="ctr-map-our">${ctrEsc(s.name)}</span><span class="ctr-map-arrow">→</span><select data-our="${s.id}" class="ctr-map-st">${opts}</select></div>`;
    }).join("") : `<p class="ctr-note">Списки статусов подрядчика появятся после сохранения ключа и «Проверить связь».</p>`;
    // Таблица сопоставления категорий: наша категория → их категория.
    const catRows = extCat.length ? ourCats.map(s => {
        const sel = cmap.has(Number(s.id)) ? Number(cmap.get(Number(s.id))) : null;
        const opts = `<option value="">— по умолчанию —</option>` + extCat.map(x => `<option value="${x.id}"${Number(x.id) === sel ? " selected" : ""}>${ctrEsc(x.name)}</option>`).join("");
        return `<div class="ctr-map-row"><span class="ctr-map-our">${ctrEsc(s.name)}</span><span class="ctr-map-arrow">→</span><select data-our="${s.id}" class="ctr-map-cat">${opts}</select></div>`;
    }).join("") : `<p class="ctr-note">Списки категорий подрядчика появятся после сохранения ключа и «Проверить связь».</p>`;
    host.innerHTML = `<div class="ctr-integ">
        <div class="ctr-integ-head">Интеграция с CRM подрядчика ${check}</div>
        <p class="ctr-note">Заказы будут передаваться в CRM подрядчика. Ключ храним зашифрованным; обращаемся только к связанным заказам.</p>
        ${encWarn}
        <label class="ctr-field">Тип CRM
            <select id="ctrConnType"><option value="printoffice"${(c.type || "printoffice") === "printoffice" ? " selected" : ""}>PrintOffice</option></select>
        </label>
        <label class="ctr-field">URL API подрядчика<input type="text" id="ctrConnBase" value="${ctrEsc(c.baseUrl || "")}" placeholder="https://crm.их-домен.ru/api/v1"></label>
        <label class="ctr-field">API-ключ подрядчика<input type="password" id="ctrConnKey" placeholder="${c.hasKey ? "•••••• (задан — оставьте пустым, чтобы не менять)" : "вставьте ключ"}" autocomplete="off"></label>
        <label class="ctr-field">ID клиента в CRM подрядчика<input type="text" inputmode="numeric" id="ctrConnClient" value="${c.extClientId != null ? ctrEsc(String(c.extClientId)) : ""}" placeholder="напр. 783407 (существующий клиент у них)"></label>
        <label class="ctr-field">Статус-триггер отправки<select id="ctrConnTrigger"><option value="">—</option>${trigOpts}</select></label>
        <label class="ctr-field">Категория позиции по умолчанию<select id="ctrConnDefCat">${defCatOpts}</select></label>
        ${tzField}
        <label class="ctr-check"><input type="checkbox" id="ctrConnActive" ${c.active === false ? "" : "checked"}> Интеграция активна</label>
        <div class="ctr-map-block">
            <div class="ctr-map-title">Сопоставление статусов (наш → подрядчика)</div>
            <div class="ctr-map-list">${stRows}</div>
        </div>
        <div class="ctr-map-block">
            <div class="ctr-map-title">Сопоставление категорий (наша → подрядчика)</div>
            <div class="ctr-map-list">${catRows}</div>
        </div>
        <div class="ctr-integ-actions">
            <button type="button" class="ctr-btn ctr-btn-primary" onclick="ctrSaveConnector(${contractorId})">Сохранить</button>
            <button type="button" class="ctr-btn ctr-btn-ghost" onclick="ctrTestConnector(${contractorId}, this)">Проверить связь</button>
        </div>
        <div id="ctrConnMsg" class="ctr-note"></div>
    </div>`;
}
async function ctrSaveConnector(contractorId) {
    const msg = document.getElementById("ctrConnMsg");
    const statusMap = Array.from(document.querySelectorAll("#ctrIntegrationHost .ctr-map-st")).map(s => ({ ourStatusId: s.dataset.our, extStatusId: s.value || "" }));
    const categoryMap = Array.from(document.querySelectorAll("#ctrIntegrationHost .ctr-map-cat")).map(s => ({ ourCategoryId: s.dataset.our, extCategoryId: s.value || "" }));
    const body = {
        contractorId: Number(contractorId),
        type: document.getElementById("ctrConnType")?.value || "printoffice",
        baseUrl: document.getElementById("ctrConnBase")?.value || "",
        triggerStatusId: document.getElementById("ctrConnTrigger")?.value || "",
        active: !!document.getElementById("ctrConnActive")?.checked,
        extClientId: document.getElementById("ctrConnClient")?.value ?? "",
        defaultCategoryId: document.getElementById("ctrConnDefCat")?.value ?? "",
        statusMap, categoryMap,
    };
    const tzEl = document.getElementById("ctrConnTz");
    if (tzEl) body.tzFieldId = tzEl.value ?? "";   // шлём только если список полей подгружен
    const key = document.getElementById("ctrConnKey")?.value || "";
    if (key.trim()) body.apiKey = key.trim();   // пусто → не меняем сохранённый
    try {
        await clientsApi("setContractorConnector", body);
        if (msg) { msg.textContent = "Сохранено."; msg.className = "ctr-note ctr-ok"; }
        await ctrLoadIntegration(contractorId);
    } catch (e) { if (msg) { msg.textContent = "Ошибка: " + (e.message || ""); msg.className = "ctr-note ctr-alert"; } }
}
async function ctrTestConnector(contractorId, btn) {
    const msg = document.getElementById("ctrConnMsg");
    if (btn) { btn.disabled = true; btn.textContent = "Проверка…"; }
    try {
        const r = await clientsApi("testContractorConnector", { contractorId: Number(contractorId) });
        const n = Array.isArray(r.theirStatuses) ? r.theirStatuses.length : 0;
        if (msg) { msg.textContent = `Связь ок. Получено статусов подрядчика: ${n} (статусы сопоставлены по именам автоматически).`; msg.className = "ctr-note ctr-ok"; }
        await ctrLoadIntegration(contractorId);
    } catch (e) { if (msg) { msg.textContent = "Не удалось: " + (e.message || ""); msg.className = "ctr-note ctr-alert"; } }
    finally { if (btn) { btn.disabled = false; btn.textContent = "Проверить связь"; } }
}

async function ctrSetPaid(crmElementId, paid) {
    try {
        await clientsApi("setElementReorderPaid", { crmElementId: Number(crmElementId), paid: !!paid });
        if (ctrCurrentId) await ctrOpenDetail(ctrCurrentId);
    } catch (e) { console.error("setElementReorderPaid", e); alert("Не удалось изменить статус оплаты."); }
}

async function ctrPayAll(id, count) {
    if (!confirm(`Отметить оплаченными все неоплаченные перезаказы (${count} шт.)?`)) return;
    try {
        const r = await clientsApi("payContractorAll", { id: Number(id) });
        await ctrOpenDetail(Number(id));
        if (typeof showReadinessToast === "function") showReadinessToast(`Оплачено позиций: ${r.paid}`);
    } catch (e) { console.error("payContractorAll", e); alert("Не удалось провести оплату."); }
}

// ——— Добавить / изменить подрядчика ———
function ctrOpenAdd() { ctrOpenEditModal(null); }
function ctrOpenEdit(id) { const c = (ctrListCache || []).find(x => Number(x.id) === Number(id)); ctrOpenEditModal(c || { id }); }
function ctrOpenEditModal(c) {
    const edit = !!(c && c.id);
    const ov = document.createElement("div");
    ov.id = "ctrEditOverlay";
    ov.className = "client-card-overlay";
    ov.style.cssText = "display:flex;align-items:center;justify-content:center;";
    ov.setAttribute("onclick", "if (event.target===this) this.remove()");
    ov.innerHTML = `<div class="ctr-modal">
        <div class="ctr-modal-head"><h3>${edit ? "Подрядчик" : "Новый подрядчик"}</h3><button class="client-card-close" onclick="document.getElementById('ctrEditOverlay').remove()">&times;</button></div>
        <label class="ctr-field">Название<input type="text" id="ctrEditName" value="${ctrEsc(c?.name || "")}" placeholder="Например, Djetta"></label>
        <label class="ctr-field">Комментарий<textarea id="ctrEditComment" rows="2">${ctrEsc(c?.comment || "")}</textarea></label>
        <label class="ctr-check"><input type="checkbox" id="ctrEditActive" ${(!c || c.active) ? "checked" : ""}> Активен</label>
        <div class="ctr-modal-foot">
            ${edit && ctrIsAdmin() ? `<button type="button" class="ctr-btn ctr-btn-danger" onclick="ctrDelete(${c.id})">Удалить</button>` : "<span></span>"}
            <div><button type="button" class="ctr-btn ctr-btn-ghost" onclick="document.getElementById('ctrEditOverlay').remove()">Отмена</button>
            <button type="button" class="ctr-btn ctr-btn-primary" onclick="ctrSave(${edit ? c.id : "null"})">Сохранить</button></div>
        </div>
    </div>`;
    document.body.appendChild(ov);
    setTimeout(() => document.getElementById("ctrEditName")?.focus(), 0);
}

async function ctrSave(id) {
    const name = String(document.getElementById("ctrEditName")?.value || "").trim();
    const comment = String(document.getElementById("ctrEditComment")?.value || "");
    const active = !!document.getElementById("ctrEditActive")?.checked;
    if (!name) { alert("Укажите название подрядчика."); return; }
    try {
        await clientsApi("saveContractor", { id: id || undefined, name, comment, active });
        document.getElementById("ctrEditOverlay")?.remove();
        await ctrLoadList();
        if (ctrCurrentId && Number(ctrCurrentId) === Number(id)) await ctrOpenDetail(ctrCurrentId);
    } catch (e) { console.error("saveContractor", e); alert("Не удалось сохранить: " + (e.message || "")); }
}

async function ctrDelete(id) {
    if (!confirm("Удалить подрядчика? Привязки перезаказов к нему будут сняты.")) return;
    try {
        await clientsApi("deleteContractor", { id: Number(id), force: true });
        document.getElementById("ctrEditOverlay")?.remove();
        ctrShowList();
        await ctrLoadList();
    } catch (e) { console.error("deleteContractor", e); alert("Не удалось удалить: " + (e.message || "")); }
}
