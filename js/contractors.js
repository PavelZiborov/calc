// ——— Раздел «Подрядчики» (перезаказ продукции) ———
// Наш учёт долга = сумма неоплаченных перезаказов (себестоимость элементов).
// Долг/оплачено из PrintOffice показываем справочно (API — только агрегаты, read-only).

let ctrListCache = [];
let ctrCurrentId = null;

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
        if (typeof dbContractorsCache !== "undefined") dbContractorsCache = ctrListCache;  // синхронизируем кэш выпадашки
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
    host.innerHTML = `<table class="ctr-table">
        <thead><tr>
            <th>Подрядчик</th><th>Наш долг</th><th>Оплачено нами</th><th>Заказов</th><th class="ctr-po-col" title="Долг по данным PrintOffice (справочно)">Долг PrintOffice</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
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
        return `<tr class="${o.paid ? "ctr-ord--paid" : ""}">
            <td>${o.deal_num ? `№ ${ctrEsc(o.deal_num)}` : "—"}</td>
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
        <div id="ctrIntegrationHost"></div>
        <div class="ctr-orders-wrap">
            <table class="ctr-table ctr-orders">
                <thead><tr><th>Заказ</th><th>Позиция</th><th>Кол-во</th><th>Дата</th><th>Сумма</th><th>Оплата</th><th></th></tr></thead>
                <tbody>${ordRows}</tbody>
            </table>
        </div>`;
    if (ctrIsAdmin()) ctrLoadIntegration(c.id);
}

// ——— Интеграция: коннектор в CRM подрядчика (только админ) ———
function ctrIsAdmin() { return typeof currentUser !== "undefined" && currentUser && (currentUser.role === "superadmin" || currentUser.is_admin); }
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
    const trigOpts = our.map(s => `<option value="${s.id}"${Number(s.id) === Number(c.triggerStatusId) ? " selected" : ""}>${ctrEsc(s.name)}</option>`).join("");
    const encWarn = ctrConnData.encReady ? "" : `<p class="ctr-note ctr-alert">На сервере не задан ключ шифрования (CONNECTOR_ENC_KEY) — API-ключ подрядчика сохранить нельзя.</p>`;
    const check = c.lastCheckAt ? `<span class="ctr-integ-check ${c.lastCheckOk ? "ok" : "bad"}">${c.lastCheckOk ? "✓ связь ок" : "✗ связь не прошла"}</span>` : "";
    host.innerHTML = `<div class="ctr-integ">
        <div class="ctr-integ-head">Интеграция с CRM подрядчика ${check}</div>
        <p class="ctr-note">Заказы будут передаваться в CRM подрядчика. Ключ храним зашифрованным; обращаемся только к связанным заказам.</p>
        ${encWarn}
        <label class="ctr-field">Тип CRM
            <select id="ctrConnType"><option value="printoffice"${(c.type || "printoffice") === "printoffice" ? " selected" : ""}>PrintOffice</option></select>
        </label>
        <label class="ctr-field">URL API подрядчика<input type="text" id="ctrConnBase" value="${ctrEsc(c.baseUrl || "")}" placeholder="https://crm.их-домен.ru/api/v1"></label>
        <label class="ctr-field">API-ключ подрядчика<input type="password" id="ctrConnKey" placeholder="${c.hasKey ? "•••••• (задан — оставьте пустым, чтобы не менять)" : "вставьте ключ"}" autocomplete="off"></label>
        <label class="ctr-field">Статус-триггер отправки<select id="ctrConnTrigger"><option value="">—</option>${trigOpts}</select></label>
        <label class="ctr-check"><input type="checkbox" id="ctrConnActive" ${c.active === false ? "" : "checked"}> Интеграция активна</label>
        <div class="ctr-integ-actions">
            <button type="button" class="ctr-btn ctr-btn-primary" onclick="ctrSaveConnector(${contractorId})">Сохранить</button>
            <button type="button" class="ctr-btn ctr-btn-ghost" onclick="ctrTestConnector(${contractorId}, this)">Проверить связь</button>
        </div>
        <div id="ctrConnMsg" class="ctr-note"></div>
    </div>`;
}
async function ctrSaveConnector(contractorId) {
    const msg = document.getElementById("ctrConnMsg");
    const body = {
        contractorId: Number(contractorId),
        type: document.getElementById("ctrConnType")?.value || "printoffice",
        baseUrl: document.getElementById("ctrConnBase")?.value || "",
        triggerStatusId: document.getElementById("ctrConnTrigger")?.value || "",
        active: !!document.getElementById("ctrConnActive")?.checked,
    };
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
            ${edit && (typeof currentUser !== "undefined" && currentUser && (currentUser.role === "superadmin" || currentUser.is_admin)) ? `<button type="button" class="ctr-btn ctr-btn-danger" onclick="ctrDelete(${c.id})">Удалить</button>` : "<span></span>"}
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
