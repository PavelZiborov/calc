// js/clients.js — раздел «Клиенты».
// Клиенты/сделки хранятся в СВОЕЙ БД (Postgres) через серверный бэкенд CLIENTS_URL
// (/api/clients). При создании из приложения клиент дублируется в CRM PrintOffice24.
// Обратная синхронизация (CRM→БД) — по cron и по кнопкам «Синхронизировать».
// Клик по строке клиента → карточка с балансом и сделками (getClient).

const clientsState = {
    items: [],
    loading: false,
    error: "",
    query: "",
    loaded: false
};

let clientsSearchTimer = null;

// Универсальный вызов вебхука клиентов: POST { action, ... } с сессионными заголовками.
async function clientsApi(action, body = {}) {
    if (typeof CLIENTS_URL !== "string" || !CLIENTS_URL) {
        throw new Error("CLIENTS_URL не настроен");
    }
    const resp = await fetchWithTimeout(CLIENTS_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ action, ...body })
    }, 45000);

    if (resp.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
    }
    if (!resp.ok) {
        let detail = "";
        try { detail = await resp.text(); } catch (_) {}
        // Если сервер вернул {error:"..."} — показываем чистое сообщение.
        let clean = "";
        try { clean = JSON.parse(detail)?.error || ""; } catch (_) {}
        const err = new Error(clean || `clients ${action} (${resp.status}) ${detail}`.trim());
        err.status = resp.status;
        throw err;
    }
    return (typeof parseApiResponse === "function") ? parseApiResponse(resp) : resp.json();
}

// Нормализуем ответ БД/CRM к единому виду карточки клиента.
function normalizeClient(raw) {
    if (!raw || typeof raw !== "object") return null;
    const cp = raw.contact_person && typeof raw.contact_person === "object" ? raw.contact_person : {};
    return {
        id: raw.id ?? raw.client_id ?? null,
        crmId: raw.crm_client_id ?? raw.crmId ?? raw.crm_id ?? (raw.contact_person ? raw.id : null),
        num: raw.num ?? raw.crm_num ?? null,
        company: String(raw.company_name ?? raw.company ?? raw.name ?? "").trim(),
        contactName: String(raw.contact_name ?? cp.name ?? "").trim(),
        mobile: String(raw.mobile_phone ?? cp.mobile_phone ?? raw.phone ?? "").trim(),
        landline: String(raw.landline_phone ?? cp.landline_phone ?? "").trim(),
        email: String(raw.email ?? cp.email ?? "").trim(),
        notes: String(raw.notes ?? "").trim(),
        income: Number(raw.income ?? 0) || 0,
        debt: Number(raw.debt ?? 0) || 0,
        balance: Number(raw.balance ?? 0) || 0,
        dealsCount: Number(raw.deals_count ?? raw.dealsCount ?? 0) || 0,
        responsibleId: raw.responsible_id ?? raw.responsibleId ?? null
    };
}

function getClientsFromResponse(data) {
    const arr = Array.isArray(data?.clients) ? data.clients
        : Array.isArray(data?.items) ? data.items
        : Array.isArray(data) ? data
        : [];
    return arr.map(normalizeClient).filter(Boolean);
}

// Открытие раздела из навигации.
function openClientsView(trigger) {
    if (!ensureActiveSession()) return;
    switchTab("clients-tab", trigger || document.querySelector('.tab-btn[data-tab-target="clients-tab"]'));
    if (!clientsState.loaded) loadClients();
}

async function loadClients() {
    if (!ensureActiveSession()) return;
    clientsState.loading = true;
    clientsState.error = "";
    renderClientsTable();
    try {
        const data = await clientsApi("listClients", { q: clientsState.query || "" });
        clientsState.items = getClientsFromResponse(data);
        clientsState.loaded = true;
    } catch (e) {
        console.error("loadClients", e);
        clientsState.items = [];
        clientsState.error = "Не удалось загрузить клиентов. Бэкенд клиентов (/api/clients) недоступен — раздел заработает после переноса на сервер.";
    } finally {
        clientsState.loading = false;
        renderClientsTable();
    }
}

function onClientsSearchInput(value) {
    clientsState.query = String(value || "");
    clearTimeout(clientsSearchTimer);
    clientsSearchTimer = setTimeout(() => loadClients(), 350);
}

function money(n) {
    return (Number(n) || 0).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function clientRowHtml(c) {
    const crmLink = c.crmId
        ? `<a class="clients-crm-link" href="https://crm.heavendevelop.ru/editClient/${c.crmId}" target="_blank" rel="noopener" title="Открыть клиента в CRM">↗</a>`
        : "";
    const phone = c.mobile || c.landline || "";
    const debtHtml = c.debt > 0.009
        ? `<span class="clients-debt">${money(c.debt)} ₽</span>`
        : `<span class="clients-debt-zero">—</span>`;
    const clickable = c.crmId
        ? ` class="clients-row-clickable" onclick="onClientRowClick(event, ${c.crmId})" title="Открыть карточку клиента"`
        : "";
    return `
        <tr${clickable}>
            <td class="clients-td-company"><span class="clients-company">${escapeHtml(c.company || "—")}</span>${crmLink}</td>
            <td>${escapeHtml(c.contactName || "—")}</td>
            <td class="clients-td-nowrap">${phone ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>` : "—"}</td>
            <td class="clients-td-nowrap">${c.email ? `<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>` : "—"}</td>
            <td class="clients-td-num">${c.dealsCount || 0}</td>
            <td class="clients-td-num">${money(c.income)} ₽</td>
            <td class="clients-td-num">${debtHtml}</td>
            <td class="clients-td-notes">${escapeHtml(c.notes || "")}</td>
        </tr>`;
}

function renderClientsTable() {
    const host = document.getElementById("clientsResults");
    if (!host) return;

    if (clientsState.loading && !clientsState.items.length) {
        host.innerHTML = `<div class="clients-empty">Загрузка клиентов…</div>`;
        return;
    }
    if (clientsState.error) {
        host.innerHTML = `<div class="clients-empty clients-empty--error">${escapeHtml(clientsState.error)}</div>`;
        return;
    }
    if (!clientsState.items.length) {
        host.innerHTML = `<div class="clients-empty">${clientsState.query ? "Ничего не найдено." : "Пока нет клиентов. Добавьте нового или синхронизируйте из CRM."}</div>`;
        return;
    }

    host.innerHTML = `
        <div class="clients-table-wrap">
            <table class="clients-table">
                <thead>
                    <tr>
                        <th>Компания</th>
                        <th>Контакт</th>
                        <th>Телефон</th>
                        <th>Email</th>
                        <th class="clients-td-num">Сделок</th>
                        <th class="clients-td-num">Доход</th>
                        <th class="clients-td-num">Долг</th>
                        <th>Заметки</th>
                    </tr>
                </thead>
                <tbody>${clientsState.items.map(clientRowHtml).join("")}</tbody>
            </table>
        </div>
        <div class="clients-count">Всего клиентов: <b>${clientsState.items.length}</b></div>`;
}

// ---- Добавление клиента (пишет в БД + дублирует в CRM на стороне n8n) ----
function toggleClientForm(show) {
    const form = document.getElementById("clientAddForm");
    if (!form) return;
    const visible = show != null ? show : form.style.display === "none";
    form.style.display = visible ? "" : "none";
    if (visible) form.querySelector("#clientCompany")?.focus();
}

async function submitNewClient(btn) {
    if (!ensureActiveSession()) return;
    const company = document.getElementById("clientCompany")?.value.trim() || "";
    if (!company) { alert("Укажите название компании / имя клиента"); return; }

    const payload = {
        company_name: company,
        contact_name: document.getElementById("clientContact")?.value.trim() || "",
        mobile_phone: document.getElementById("clientPhone")?.value.trim() || "",
        email: document.getElementById("clientEmail")?.value.trim() || "",
        notes: document.getElementById("clientNotes")?.value.trim() || "",
        responsible_id: (typeof currentUser !== "undefined" && currentUser.crmId) ? Number(currentUser.crmId) : null
    };

    const original = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Сохранение…"; }
    try {
        await clientsApi("createClient", { client: payload });
        // очистить форму
        ["clientCompany", "clientContact", "clientPhone", "clientEmail", "clientNotes"].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = "";
        });
        toggleClientForm(false);
        await loadClients();
    } catch (e) {
        console.error("createClient", e);
        alert("Не удалось создать клиента. Проверьте вебхук «clients» и права.");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
    }
}

// ---- Синхронизация из CRM (тянет клиентов CRM → upsert в БД) ----
async function syncClientsFromCrm(btn) {
    if (!ensureActiveSession()) return;
    const original = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "Синхронизация…"; }
    try {
        const data = await clientsApi("syncFromCrm", {});
        const added = Number(data?.added ?? data?.upserted ?? 0);
        const total = Number(data?.total ?? 0);
        await loadClients();
        if (typeof showReadinessToast === "function") {
            showReadinessToast(`Синхронизация завершена${total ? `: ${total} клиентов` : ""}${added ? `, новых/обновлено: ${added}` : ""}`);
        } else {
            alert(`Синхронизация завершена. Всего: ${total || clientsState.items.length}`);
        }
    } catch (e) {
        console.error("syncFromCrm", e);
        alert("Не удалось синхронизировать из CRM. Проверьте вебхук и права.");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
}

// ============================================================================
//  Карточка клиента (баланс + сделки). Клик по строке → провалиться в карточку.
// ============================================================================

// Клик по строке открывает карточку, но не мешает ссылкам (CRM/тел/почта).
function onClientRowClick(event, crmId) {
    if (event && event.target && event.target.closest("a")) return;
    openClientCard(crmId);
}

function clientCardEscHandler(e) {
    if (e.key === "Escape") closeClientCard();
}

function closeClientCard() {
    const overlay = document.getElementById("clientCardOverlay");
    if (overlay) overlay.style.display = "none";
    document.removeEventListener("keydown", clientCardEscHandler);
}

async function openClientCard(crmId) {
    if (!ensureActiveSession()) return;
    if (!crmId) return;

    let overlay = document.getElementById("clientCardOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "clientCardOverlay";
        overlay.className = "client-card-overlay";
        overlay.setAttribute("onmousedown", "overlayDown(event)");
        overlay.setAttribute("onclick", "if (overlayClickedSelf(event)) closeClientCard()");
    }
    document.body.appendChild(overlay);   // всегда в конец body → поверх карточки заказа
    overlay.style.display = "flex";
    overlay.innerHTML = `<div class="client-card"><div class="client-card-loading">Загрузка карточки…</div></div>`;
    document.addEventListener("keydown", clientCardEscHandler);

    try {
        const data = await clientsApi("getClient", { crmId: Number(crmId) });
        renderClientCard(data, crmId);
    } catch (e) {
        console.error("getClient", e);
        overlay.innerHTML = `
            <div class="client-card">
                <div class="client-card-header">
                    <h3>Ошибка</h3>
                    <button class="client-card-close" onclick="closeClientCard()" aria-label="Закрыть">&times;</button>
                </div>
                <div class="client-card-body">
                    <div class="clients-empty clients-empty--error">Не удалось загрузить карточку клиента.</div>
                </div>
            </div>`;
    }
}

// Класс оплаты сделки по долгу/оплате (как в списке просчётов).
function dealPayClass(amount, paid, debt) {
    if (debt <= 0.009) return "is-ok";
    if (paid <= 0.009) return "is-unpaid";
    return "is-partial";
}

function clientCardDealRow(d) {
    const amount = Number(d.amount) || 0;
    const debt = Number(d.debt) || 0;
    const paid = d.paid != null ? Number(d.paid) : Math.max(0, amount - debt);
    const cls = dealPayClass(amount, paid, debt);
    const num = String(d.num ?? d.crm_deal_id ?? "").trim();
    const crmId = d.crm_deal_id;
    const numHtml = crmId
        ? `<a href="#" onclick="event.preventDefault(); openDbDealCard(${crmId});" title="Открыть карточку заказа">№ ${escapeHtml(num)}</a>`
        : `№ ${escapeHtml(num)}`;
    const status = String(d.status_name ?? "").trim();
    const date = String(d.created_at_crm ?? "").trim();
    const debtCell = debt > 0.009
        ? `<span class="cc-debt">${money(debt)} ₽</span>`
        : `<span class="cc-debt-zero">оплачено</span>`;
    return `
        <tr>
            <td class="cc-deal-num">${numHtml}</td>
            <td class="cc-deal-content">${escapeHtml(String(d.content ?? "") || "—")}</td>
            <td class="clients-td-num cc-deal-amount ${cls}">${money(amount)} ₽</td>
            <td class="clients-td-num">${money(paid)} ₽</td>
            <td class="clients-td-num">${debtCell}</td>
            <td class="cc-deal-status">${status ? escapeHtml(status) : "—"}</td>
            <td class="clients-td-nowrap cc-deal-date">${escapeHtml(date || "—")}</td>
        </tr>`;
}

function renderClientCard(data, crmId) {
    const overlay = document.getElementById("clientCardOverlay");
    if (!overlay) return;
    const c = normalizeClient(data?.client) || {};
    const deals = Array.isArray(data?.deals) ? data.deals : [];

    const contactBits = [c.contactName, c.mobile || c.landline, c.email].filter(Boolean);
    const sub = contactBits.map(escapeHtml).join(" · ");
    const crmLink = crmId
        ? `<a class="client-card-crm" href="https://crm.heavendevelop.ru/editClient/${crmId}" target="_blank" rel="noopener">В CRM ↗</a>`
        : "";

    const balanceCls = c.balance < -0.009 ? "is-negative" : (c.balance > 0.009 ? "is-positive" : "");
    const stats = `
        <div class="client-card-stats">
            <div class="cc-stat">
                <span class="cc-stat-label">Баланс</span>
                <span class="cc-stat-value ${balanceCls}">${money(c.balance)} ₽</span>
            </div>
            <div class="cc-stat">
                <span class="cc-stat-label">Оплатил</span>
                <span class="cc-stat-value">${money(c.income)} ₽</span>
            </div>
            <div class="cc-stat">
                <span class="cc-stat-label">Долг</span>
                <span class="cc-stat-value ${c.debt > 0.009 ? "is-negative" : ""}">${money(c.debt)} ₽</span>
            </div>
            <div class="cc-stat">
                <span class="cc-stat-label">Сделок</span>
                <span class="cc-stat-value">${c.dealsCount || deals.length || 0}</span>
            </div>
        </div>`;

    let dealsBlock;
    if (deals.length) {
        dealsBlock = `
            <div class="client-card-deals-head">
                <span>Сделки <b>(${deals.length})</b></span>
                <button class="clients-btn clients-btn-sync cc-sync-deals" onclick="syncDeals(this, ${crmId})">Обновить сделки</button>
            </div>
            <div class="clients-table-wrap">
                <table class="clients-table cc-deals-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Наименование</th>
                            <th class="clients-td-num">Сумма</th>
                            <th class="clients-td-num">Оплачено</th>
                            <th class="clients-td-num">Долг</th>
                            <th>Статус</th>
                            <th>Дата</th>
                        </tr>
                    </thead>
                    <tbody>${deals.map(clientCardDealRow).join("")}</tbody>
                </table>
            </div>`;
    } else {
        dealsBlock = `
            <div class="client-card-deals-empty">
                <p>Сделок в базе нет.</p>
                <p class="cc-hint">Если у клиента есть сделки в CRM — синхронизируйте их в базу.</p>
                <button class="clients-btn clients-btn-add cc-sync-deals" onclick="syncDeals(this, ${crmId})">Синхронизировать сделки из CRM</button>
            </div>`;
    }

    overlay.innerHTML = `
        <div class="client-card" role="dialog" aria-modal="true">
            <div class="client-card-header">
                <div class="client-card-title">
                    <h3>${escapeHtml(c.company || "Клиент")}</h3>
                    ${sub ? `<div class="client-card-sub">${sub}</div>` : ""}
                </div>
                <div class="client-card-header-actions">
                    ${crmLink}
                    <button class="client-card-close" onclick="closeClientCard()" aria-label="Закрыть">&times;</button>
                </div>
            </div>
            <div class="client-card-body">
                ${stats}
                ${data?.crmError ? `<div class="client-card-warn">Свежие данные из CRM недоступны — показаны сохранённые.</div>` : ""}
                <div class="hp-tabs">
                    <button type="button" class="hp-tab is-active" data-cctab="deals" onclick="ccSwitchTab('deals')">Заказы</button>
                    <button type="button" class="hp-tab" data-cctab="req" onclick="ccSwitchTab('req')">Реквизиты</button>
                    <button type="button" class="hp-tab" data-cctab="docs" onclick="ccSwitchTab('docs')">Шаблоны документов</button>
                </div>
                <div class="hp-tabpanel" id="ccPanel-deals">${dealsBlock}</div>
                <div class="hp-tabpanel" id="ccPanel-req" hidden>${clientCardRequisitesBlock()}</div>
                <div class="hp-tabpanel" id="ccPanel-docs" hidden>${ccDocsBlock()}</div>
            </div>
        </div>`;
    ccLoadRequisites(crmId);
    ccLoadDocs(crmId);
}
// Переключение вкладок карточки клиента: Заказы / Реквизиты / Шаблоны документов.
function ccSwitchTab(tab) {
    document.querySelectorAll("#clientCardOverlay .hp-tab").forEach(b => b.classList.toggle("is-active", b.dataset.cctab === tab));
    ["deals", "req", "docs"].forEach(t => {
        const p = document.getElementById("ccPanel-" + t);
        if (p) p.hidden = (t !== tab);
    });
}

// ==================== Документы клиента (договоры и приложения) ====================
let ccDocsClientId = null;
function ccDocsBlock() {
    return `
        <div class="cc-req-section cc-docs-section">
            <div class="dbo-inv-req-head"><span>Документы (договоры и приложения)</span></div>
            <div id="ccDocsHost"><div class="dbo-asset-empty">Загрузка…</div></div>
        </div>`;
}
async function ccLoadDocs(crmId) {
    ccDocsClientId = Number(crmId);
    const host = document.getElementById("ccDocsHost");
    if (!host) return;
    let data;
    try { data = await clientsApi("getDocData", { clientId: Number(crmId) }); }
    catch (e) { console.error("getDocData", e); host.innerHTML = `<div class="dbo-asset-empty">Не удалось загрузить документы.</div>`; return; }
    ccRenderDocs(data);
}
function ccDocReqOptions(requisites) {
    if (!requisites || !requisites.length) return "";
    return requisites.map(r => `<option value="${escapeHtml(r.inn)}">${escapeHtml(r.name || r.inn)} (ИНН ${escapeHtml(r.inn)})</option>`).join("");
}
function ccRenderDocs(data) {
    const host = document.getElementById("ccDocsHost");
    if (!host) return;
    const isAdmin = typeof isCurrentUserAdmin === "function" && isCurrentUserAdmin();
    const t = data.templates || { contract: {}, appendix: {} };
    const reqs = Array.isArray(data.requisites) ? data.requisites : [];
    const docs = Array.isArray(data.documents) ? data.documents : [];
    const today = new Date().toLocaleDateString("ru-RU");
    const tplStatus = (k) => {
        const s = t[k] || {};
        const parts = [];
        if (s.client) parts.push("свой шаблон");
        else if (s.global) parts.push("общий шаблон");
        else parts.push('<span class="payment-alert">шаблон не загружен</span>');
        return parts.join("");
    };
    const adminTpl = (k, label) => `
        <div class="cc-doc-tplrow">
            <span class="cc-doc-tpllabel">${label}:</span> <span class="cc-doc-tplstate">${tplStatus(k)}</span>
            <label class="dbo-btn dbo-btn-sm cc-doc-upl">Общий шаблон<input type="file" accept=".docx" hidden onchange="ccDocUpload('${k}', null, this)"></label>
            <label class="dbo-btn dbo-btn-sm cc-doc-upl">Для клиента<input type="file" accept=".docx" hidden onchange="ccDocUpload('${k}', ${ccDocsClientId}, this)"></label>
            ${(t[k]||{}).client ? `<button type="button" class="dbo-btn dbo-btn-sm dbo-btn-danger" onclick="ccDocDeleteTpl('${k}', ${ccDocsClientId})">Убрать свой</button>` : ""}
        </div>`;
    const reqSel = reqs.length
        ? `<label class="cc-doc-field">Реквизит (контрагент)
             <select id="ccDocInn">${ccDocReqOptions(reqs)}</select></label>`
        : `<div class="payment-alert" style="font-size:13px">Нет реквизитов — добавьте контрагента в блоке «Реквизиты клиента» выше.</div>`;
    const canGen = reqs.length > 0;
    const savedRows = docs.length
        ? docs.map(d => `
            <div class="cc-doc-row">
                <div class="cc-doc-rowmain">
                    <span class="cc-doc-kind cc-doc-kind--${d.kind}">${d.kind === "contract" ? "Договор" : "Приложение"}</span>
                    <span class="cc-doc-title">${escapeHtml(d.title || "")}</span>
                    <span class="cc-doc-date">${escapeHtml(new Date(d.created_at).toLocaleString("ru-RU"))}</span>
                </div>
                <div class="cc-doc-rowact">
                    <button type="button" class="dbo-btn dbo-btn-sm" onclick="ccDocDownload(${d.id}, 'docx')">Word</button>
                    <button type="button" class="dbo-btn dbo-btn-sm" onclick="ccDocDownload(${d.id}, 'pdf')">PDF</button>
                    <button type="button" class="dbo-btn dbo-btn-sm dbo-btn-danger" onclick="ccDocDelete(${d.id})">×</button>
                </div>
            </div>`).join("")
        : `<div class="dbo-asset-empty">Пока нет сформированных документов.</div>`;

    host.innerHTML = `
        ${isAdmin ? `<div class="cc-doc-templates">${adminTpl("contract", "Договор")}${adminTpl("appendix", "Приложение")}</div>` : ""}
        ${canGen ? `
        <div class="cc-doc-gen">
            ${reqSel}
            <div class="cc-doc-genblock">
                <div class="cc-doc-gentitle">Договор</div>
                <div class="cc-doc-fields">
                    <label class="cc-doc-field">№<input type="text" id="ccDocContractNum" value="${escapeHtml(data.nextContract || "")}"></label>
                    <label class="cc-doc-field">Дата<input type="text" id="ccDocContractDate" value="${escapeHtml(today)}"></label>
                </div>
                ${ccDocClauseFieldsHtml("cc")}
                <div class="cc-doc-btns">
                    <button type="button" class="dbo-btn dbo-btn-primary dbo-btn-sm" onclick="ccDocGenerate('contract','docx')">Word</button>
                    <button type="button" class="dbo-btn dbo-btn-sm" onclick="ccDocGenerate('contract','pdf')">PDF</button>
                </div>
            </div>
            <div class="cc-doc-hint">Приложения к договору формируются в конкретной сделке (раздел «Заказы БД» → карточка заказа) — там подставляются позиции заказа.</div>
        </div>` : ""}
        ${ccDocVarsReferenceHtml()}
        <div class="cc-doc-saved"><div class="cc-doc-savedhead">Сохранённые документы</div>${savedRows}</div>`;
}
async function ccDocUpload(kind, clientId, input) {
    const file = input?.files?.[0];
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { alert("Нужен файл .docx"); input.value = ""; return; }
    try {
        const b64 = await ccFileToBase64(file);
        await clientsApi("uploadDocTemplate", { kind, clientId: clientId ?? null, template_base64: b64, template_name: file.name });
        if (typeof showReadinessToast === "function") showReadinessToast("Шаблон загружен");
        ccLoadDocs(ccDocsClientId);
    } catch (e) { console.error("uploadDocTemplate", e); alert("Не удалось загрузить шаблон: " + (e.message || "")); }
    finally { input.value = ""; }
}
async function ccDocDeleteTpl(kind, clientId) {
    if (!confirm("Убрать индивидуальный шаблон клиента? Будет использоваться общий.")) return;
    try { await clientsApi("deleteDocTemplate", { kind, clientId }); ccLoadDocs(ccDocsClientId); }
    catch (e) { console.error("deleteDocTemplate", e); alert("Не удалось удалить шаблон."); }
}
function ccFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).replace(/^data:.*;base64,/, ""));
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}
// Доп. поля клаузулы (подписант/основание/город) — общий рендер, id с префиксом.
function ccDocClauseFieldsHtml(prefix) {
    return `<details class="cc-doc-adv">
        <summary>Доп. поля (подписант, основание, город)</summary>
        <div class="cc-doc-fields">
            <label class="cc-doc-field">Подписант (ФИО)<input type="text" id="${prefix}DocSigner" placeholder="пусто = из МоеДело"></label>
            <label class="cc-doc-field">Должность<input type="text" id="${prefix}DocPosition" placeholder="пусто = из МоеДело"></label>
            <label class="cc-doc-field">Основание<input type="text" id="${prefix}DocBasis" value="Устава"></label>
            <label class="cc-doc-field">Город<input type="text" id="${prefix}DocCity" value="Москва"></label>
        </div></details>`;
}
// Справочник переменных шаблонов (пользователь просил показать в программе).
function ccDocVarsReferenceHtml() {
    const groups = [
        ["Контрагент (из МоеДело)", [
            ["{client_name}", "Полное наименование"], ["{client_short_name}", "Краткое наименование"],
            ["{client_inn}", "ИНН"], ["{client_kpp}", "КПП"], ["{client_ogrn}", "ОГРН"], ["{client_okpo}", "ОКПО"],
            ["{client_legal_address}", "Юридический адрес"], ["{client_actual_address}", "Фактический адрес"],
            ["{client_signer}", "Подписант (ФИО)"], ["{client_signer_position}", "Должность подписанта"], ["{client_basis}", "Основание (Устав/свидетельство)"]
        ]],
        ["Банк контрагента (в МоеДело нет — пока пусто, заполняется вручную)", [
            ["{client_rs}", "Расчётный счёт"], ["{client_bank}", "Банк"], ["{client_bik}", "БИК"], ["{client_ks}", "Корр. счёт"]
        ]],
        ["Документ", [
            ["{doc_number}", "Номер документа"], ["{doc_date}", "Дата документа"], ["{city}", "Город"], ["{today}", "Сегодняшняя дата"],
            ["{appendix_number}", "Номер приложения"], ["{contract_number}", "Номер договора"], ["{contract_date}", "Дата договора"]
        ]],
        ["Позиции заказа (приложение из сделки)", [
            ["{#items} … {/items}", "Цикл по позициям (обернуть строку таблицы)"],
            ["{n}", "№ позиции"], ["{name}", "Наименование"], ["{units}", "Ед. изм."], ["{qty}", "Кол-во"], ["{price}", "Цена за шт."], ["{sum}", "Сумма"],
            ["{total_amount}", "Итого сумма"], ["{total_amount_words}", "Сумма прописью"], ["{items_count}", "Кол-во позиций"], ["{total_qty}", "Общее кол-во"]
        ]]
    ];
    return `<details class="cc-doc-vars">
        <summary>📋 Переменные для шаблонов .docx</summary>
        <div class="cc-doc-vars-body">
            <p>Вставляйте метки в фигурных скобках в .docx. Свои (исполнителя) реквизиты пишите в шаблон текстом.</p>
            ${groups.map(([g, rows]) => `<div class="cc-doc-vargroup"><div class="cc-doc-vargroup-title">${escapeHtml(g)}</div>${rows.map(([k, d]) => `<div class="cc-doc-varrow"><code>${escapeHtml(k)}</code><span>${escapeHtml(d)}</span></div>`).join("")}</div>`).join("")}
            <p class="cc-doc-vars-note">Таблицу позиций в приложении: строку с {n} {name} … оберните в {#items} … {/items} (как в шаблоне КП).</p>
        </div></details>`;
}
async function ccDocGenerate(kind, format) {
    const v = id => document.getElementById(id)?.value?.trim() || "";
    const inn = v("ccDocInn");
    if (!inn) { alert("Выберите реквизит (контрагента)"); return; }
    const body = {
        clientId: Number(ccDocsClientId), kind, inn, format,
        signer: v("ccDocSigner"), signerPosition: v("ccDocPosition"), basis: v("ccDocBasis"), city: v("ccDocCity")
    };
    if (kind === "contract") { body.number = v("ccDocContractNum"); body.date = v("ccDocContractDate"); }
    else { body.appendixNumber = v("ccDocAppNum"); body.date = v("ccDocAppDate"); body.contractNumber = v("ccDocAppContractNum"); body.contractDate = v("ccDocAppContractDate"); }
    if (typeof showReadinessToast === "function") showReadinessToast("Формируем документ…");
    try {
        await ccDownloadDocBlob({ action: "generateDocument", ...body }, kind, format);
        ccLoadDocs(ccDocsClientId);   // обновить список сохранённых
    } catch (e) { console.error("generateDocument", e); alert("Не удалось сформировать документ: " + (e.message || "")); }
}
async function ccDocDownload(id, format) {
    try { await ccDownloadDocBlob({ action: "downloadClientDocument", id: Number(id), format }, "document", format); }
    catch (e) { console.error("downloadClientDocument", e); alert("Не удалось скачать: " + (e.message || "")); }
}
async function ccDocDelete(id) {
    if (!confirm("Удалить сохранённый документ?")) return;
    try { await clientsApi("deleteClientDocument", { id: Number(id) }); ccLoadDocs(ccDocsClientId); }
    catch (e) { console.error("deleteClientDocument", e); alert("Не удалось удалить документ."); }
}
// Скачивание бинарного ответа (docx/pdf) с сервера.
async function ccDownloadDocBlob(payload, base, format) {
    const resp = await fetchWithTimeout(CLIENTS_URL, { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) }, UPLOAD_TIMEOUT_MS);
    if (resp.status === 401) { handleUnauthorized(); throw new Error("Unauthorized"); }
    if (!resp.ok) {
        let msg = "";
        try { msg = (await resp.json())?.error || ""; } catch (_) {}
        throw new Error(msg || `HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    let filename = `${base}.${format}`;
    const cd = resp.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (m) { try { filename = decodeURIComponent(m[1]); } catch (_) {} }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (typeof showReadinessToast === "function") showReadinessToast("Документ скачан");
}

// ==================== Реквизиты клиента в карточке ====================
let ccReqClientId = null;
function clientCardRequisitesBlock() {
    return `
        <div class="cc-req-section cc-req-widget">
            <div class="dbo-inv-req-head">
                <span>Реквизиты клиента</span>
                <button type="button" class="dbo-inv-refresh" onclick="ccReqRefresh(this)" title="Подтянуть реквизиты из PrintOffice (на переходный период)">⟳ Обновить из PrintOffice</button>
            </div>
            <div id="ccReqList" class="dbo-inv-req-list"><div class="dbo-asset-empty">Загрузка реквизитов…</div></div>
            <details class="dbo-inv-addwrap">
                <summary class="dbo-inv-addtoggle">+ Добавить реквизит из МоеДело</summary>
                <div class="dbo-inv-addform">
                    <div class="dbo-inv-search-row">
                        <input type="text" id="ccReqSearchInput" placeholder="ИНН или название контрагента" onkeydown="if(event.key==='Enter'){event.preventDefault();ccReqSearch()}">
                        <button type="button" class="dbo-btn" onclick="ccReqSearch()">Найти</button>
                    </div>
                    <div id="ccReqSearchResults" class="dbo-inv-search-results"></div>
                    <div class="dbo-inv-create-hint">Нет нужного в МоеДело? Создайте новый контрагент:</div>
                    <div class="dbo-inv-create-row">
                        <input type="text" id="ccReqAddInn" inputmode="numeric" placeholder="ИНН (10 или 12 цифр)" maxlength="12" onblur="reqInnAutoFill(this, document.getElementById('ccReqAddName'), document.getElementById('ccReqAddForm'))">
                        <input type="text" id="ccReqAddName" placeholder="Наименование (подставится по ИНН)">
                        <select id="ccReqAddForm" class="dbo-inv-formsel" title="Организационная форма">
                            <option value="">форма: авто</option>
                            <option value="UL">Юр. лицо</option>
                            <option value="IP">ИП</option>
                            <option value="FL">Физлицо</option>
                        </select>
                        <button type="button" class="dbo-btn dbo-btn-primary" onclick="ccReqCreate()">Создать в МоеДело и привязать</button>
                    </div>
                </div>
            </details>
        </div>`;
}
const CC_REQ_SRC = { printoffice: "PrintOffice", moedelo: "МоеДело", manual: "вручную" };
function ccRenderRequisites(list) {
    const host = document.getElementById("ccReqList");
    if (!host) return;
    if (!Array.isArray(list) || !list.length) {
        host.innerHTML = `<div class="dbo-asset-empty">Реквизитов пока нет — найдите в МоеДело или обновите из PrintOffice.</div>`;
        return;
    }
    host.innerHTML = list.map(r => {
        const src = CC_REQ_SRC[r.source] || r.source || "";
        return `<div class="dbo-inv-req">
            <span class="dbo-inv-req-body"><b>${escapeHtml(r.name || r.inn)}</b><span class="dbo-inv-req-inn">ИНН ${escapeHtml(r.inn)}${src ? " · " + escapeHtml(src) : ""}</span></span>
            <button type="button" class="dbo-inv-reqdel" title="Удалить реквизит" onclick="ccReqDelete('${escapeHtml(r.inn)}',this)">×</button>
        </div>`;
    }).join("");
}
async function ccLoadRequisites(crmId) {
    ccReqClientId = Number(crmId);
    try {
        const data = await clientsApi("getClientRequisites", { clientId: ccReqClientId });
        ccRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : []);
    } catch (e) {
        console.error("getClientRequisites", e);
        const host = document.getElementById("ccReqList");
        if (host) host.innerHTML = `<div class="dbo-asset-empty">Не удалось загрузить реквизиты.</div>`;
    }
}
async function ccReqRefresh(btn) {
    const old = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "Обновляем…"; }
    try {
        const data = await clientsApi("refreshClientRequisites", { clientId: ccReqClientId });
        ccRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : []);
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизиты обновлены из PrintOffice");
    } catch (e) {
        console.error("refreshClientRequisites", e);
        alert("Не удалось обновить реквизиты: " + String(e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = old || "⟳ Обновить из PrintOffice"; }
    }
}
async function ccReqSearch() {
    const query = String(document.getElementById("ccReqSearchInput")?.value || "").trim();
    const host = document.getElementById("ccReqSearchResults");
    if (!host) return;
    if (query.length < 3) { host.innerHTML = `<div class="dbo-asset-empty">Введите ИНН или минимум 3 символа названия.</div>`; return; }
    const digitsOnly = !/[^\d\s]/.test(query);
    if (digitsOnly) { const i = document.getElementById("ccReqAddInn"); if (i && !i.value) i.value = query.replace(/\D/g, ""); }
    else { const n = document.getElementById("ccReqAddName"); if (n && !n.value) n.value = query; }
    host.innerHTML = `<div class="dbo-asset-empty">Поиск в МоеДело…</div>`;
    try {
        const data = await clientsApi("searchMoedeloKontragents", { query });
        const results = Array.isArray(data?.results) ? data.results : [];
        if (!results.length) { host.innerHTML = `<div class="dbo-asset-empty">В МоеДело не найдено — создайте контрагента ниже.</div>`; return; }
        host.innerHTML = results.map(r => `<div class="dbo-inv-hit">
            <span class="dbo-inv-hit-body"><b>${escapeHtml(r.name || r.inn)}</b><span class="dbo-inv-req-inn">ИНН ${escapeHtml(r.inn)}</span></span>
            <button type="button" class="dbo-btn dbo-btn-sm" onclick="ccReqBind('${escapeHtml(r.inn)}', this)" data-name="${escapeHtml(r.name || '')}">Привязать</button>
        </div>`).join("");
    } catch (e) {
        console.error("searchMoedeloKontragents", e);
        host.innerHTML = `<div class="dbo-asset-empty">Не удалось выполнить поиск: ${escapeHtml(String(e.message || e))}</div>`;
    }
}
async function ccReqBind(inn, btn) {
    const name = btn?.getAttribute("data-name") || "";
    if (btn) { btn.disabled = true; btn.textContent = "…"; }
    try {
        const data = await clientsApi("bindMoedeloKontragent", { clientId: ccReqClientId, inn, name });
        ccRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : []);
        const w = document.querySelector(".cc-req-section .dbo-inv-addwrap"); if (w) w.open = false;
        const s = document.getElementById("ccReqSearchResults"); if (s) s.innerHTML = "";
        const q = document.getElementById("ccReqSearchInput"); if (q) q.value = "";
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизит привязан");
    } catch (e) {
        console.error("bindMoedeloKontragent", e);
        alert("Не удалось привязать: " + String(e.message || e));
        if (btn) { btn.disabled = false; btn.textContent = "Привязать"; }
    }
}
async function ccReqCreate() {
    const inn = String(document.getElementById("ccReqAddInn")?.value || "").replace(/\D/g, "");
    const name = String(document.getElementById("ccReqAddName")?.value || "").trim();
    const form = String(document.getElementById("ccReqAddForm")?.value || "");
    if (!/^\d{10}$|^\d{12}$/.test(inn)) { alert("ИНН должен содержать 10 или 12 цифр."); return; }
    // Название необязательно — МоеДело подтянет его по ИНН из ЕГРЮЛ/ЕГРИП.
    const btn = document.querySelector(".cc-req-section .dbo-inv-create-row .dbo-btn-primary");
    if (btn) { btn.disabled = true; btn.textContent = "Создаём в МоеДело…"; }
    try {
        const data = await clientsApi("createMoedeloKontragent", { clientId: ccReqClientId, inn, name, form });
        ccRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : []);
        const i = document.getElementById("ccReqAddInn"); if (i) i.value = "";
        const n = document.getElementById("ccReqAddName"); if (n) n.value = "";
        const s = document.getElementById("ccReqSearchResults"); if (s) s.innerHTML = "";
        const w = document.querySelector(".cc-req-section .dbo-inv-addwrap"); if (w) w.open = false;
        if (typeof showReadinessToast === "function") showReadinessToast("Контрагент создан в МоеДело и привязан");
    } catch (e) {
        console.error("createMoedeloKontragent", e);
        alert("Не удалось создать контрагента: " + String(e.message || e));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Создать в МоеДело и привязать"; }
    }
}
async function ccReqDelete(inn, btn) {
    if (!confirm("Удалить этот реквизит у клиента? (в МоеДело и PrintOffice он останется)")) return;
    if (btn) btn.disabled = true;
    try {
        const data = await clientsApi("deleteClientRequisite", { clientId: ccReqClientId, inn });
        ccRenderRequisites(Array.isArray(data?.requisites) ? data.requisites : []);
        if (typeof showReadinessToast === "function") showReadinessToast("Реквизит удалён");
    } catch (e) {
        console.error("deleteClientRequisite", e);
        alert("Не удалось удалить реквизит: " + String(e.message || e));
        if (btn) btn.disabled = false;
    }
}

// Синхронизация всех сделок CRM → БД. reopenCrmId — переоткрыть карточку после.
async function syncDeals(btn, reopenCrmId) {
    if (!ensureActiveSession()) return;
    const original = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = "Синхронизация…"; }
    try {
        const data = await clientsApi("syncDealsFromCrm", {});
        const total = Number(data?.total ?? 0);
        const deleted = Number(data?.deleted ?? 0);
        if (typeof showReadinessToast === "function") {
            showReadinessToast(`Сделки синхронизированы${total ? `: ${total}` : ""}${deleted ? `, удалено: ${deleted}` : ""}`);
        }
        if (reopenCrmId) openClientCard(reopenCrmId);
    } catch (e) {
        console.error("syncDealsFromCrm", e);
        alert("Не удалось синхронизировать сделки из CRM.");
        if (btn) { btn.disabled = false; btn.innerHTML = original; }
    }
}
