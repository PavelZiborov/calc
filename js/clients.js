// js/clients.js — раздел «Клиенты».
// Клиенты хранятся в СВОЕЙ БД (Postgres через n8n-вебхук CLIENTS_URL).
// При создании из приложения клиент дублируется в CRM PrintOffice24 (BD→CRM).
// Обратная синхронизация (CRM→БД) — по cron в n8n и по кнопке «Синхронизировать».

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
        throw new Error(`clients ${action} (${resp.status}) ${detail}`.trim());
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
        clientsState.error = "Не удалось загрузить клиентов. Проверьте, что вебхук «clients» в n8n настроен.";
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
    return `
        <tr>
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
