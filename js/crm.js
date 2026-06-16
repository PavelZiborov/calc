// --- CRM ЛОГИКА ---
async function searchCRM(mode) {
    if (!ensureActiveSession()) return;

    const resId = mode === 'main' ? 'crmResults' : 'advCrmResults';
    const loadId = mode === 'main' ? 'crmLoader' : 'advCrmLoader';
    const resDiv = document.getElementById(resId);
    const load = document.getElementById(loadId);
    
    // Находим кнопку, которая вызвала поиск
    const btn = event?.target?.tagName === 'BUTTON' ? event.target : document.querySelector(`button[onclick="searchCRM('${mode}')"]`);
    if (btn && btn.disabled) return;
    const originalBtnText = btn ? btn.innerText : "";

    let q = "";
    if (currentUser.role === 'staff' || mode === 'adv') {
        const input = document.getElementById(mode === 'main' ? 'crmSearchInput' : 'advSearchInput');
        q = input ? input.value : "";
    }

    const selectedStatusInputs = mode === 'adv'
        ? Array.from(document.querySelectorAll('#advStatusList input[type="checkbox"]:checked'))
        : [];
    const selectedStatuses = selectedStatusInputs
        .map(input => Number(input.value))
        .filter(Number.isInteger);
    const selectedStatusNames = selectedStatusInputs.map(input => input.dataset.name || "");

    const selectedManagerInputs = mode === 'adv'
        ? Array.from(document.querySelectorAll('#advManagerList input[type="checkbox"]:checked'))
        : [];
    const selectedManagers = selectedManagerInputs
        .map(input => Number(input.value))
        .filter(Number.isFinite);
    const selectedManagerNames = selectedManagerInputs.map(input => input.dataset.name || "");

    const advFilters = mode === 'adv' ? {
        status: selectedStatuses,
        statusNames: selectedStatusNames,
        managers: selectedManagers,
        managerNames: selectedManagerNames,
        dateFrom: formatDateForWebhook(document.getElementById('advDateFrom')?.value || ""),
        dateTo: formatDateForWebhook(document.getElementById('advDateTo')?.value || "")
    } : {};

    resDiv.innerHTML = ""; 
    load.style.display = "block";
    
    if (btn) {
        btn.disabled = true;
        btn.innerText = "⌛...";
    }

    try {
        const searchPayload = { 
            action: 'search', 
            hp: document.getElementById("honey_field").value,
            query: q,
            clientId: currentUser.role === 'client' ? (currentUser.crmId || null) : null
        };

        if (mode === 'adv') {
            searchPayload.filters = advFilters;
        }

        const res = await fetch(N8N_URL, {
            method: 'POST', 
            headers: authHeaders(),
            body: JSON.stringify(searchPayload)
        });

        if (res.status === 401) {
            handleUnauthorized();
            return;
        }

        const data = await res.json();
        load.style.display = "none";

        let deals = Array.isArray(data) ? (data[0]?.json ? data.map(i => i.json) : data) : (data.items || [data]);
        deals = deals.filter(isValidDeal);

        if (!deals || deals.length === 0 || !deals[0]) {
            crmSearchCache[mode] = [];
            resDiv.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Список заказов пуст</p>";
        } else {
            crmSearchCache[mode] = deals;
            renderDealsResults(deals, resDiv);
        }

    } catch (e) {
        resDiv.innerHTML = `<p style="color:red; text-align:center;">Ошибка соединения</p>`;
    } finally {
        load.style.display = "none";
        // Разблокировка кнопки поиска через 2 секунды
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalBtnText || "Найти";
            }, 2000);
        }
    }
}

function isValidDeal(deal, allowIdOnly = false) {
    if (!deal || !deal.id) return false;
    if (allowIdOnly) return true;
    return !!(
        deal.num
        || deal.client
        || deal.client_name
        || deal.elements
        || deal.amount != null
        || deal.total != null
        || deal.paid != null
        || deal.paid_amount != null
        || deal.debt != null
        || deal.debt_amount != null
    );
}

function unwrapDealPayload(data) {
    if (data == null) return null;

    let payload = data;
    if (Array.isArray(payload)) payload = payload[0]?.json ?? payload[0];
    if (Array.isArray(payload)) payload = payload[0]?.json ?? payload[0];
    if (payload?.json && typeof payload.json === "object") payload = payload.json;
    if (payload?.body && typeof payload.body === "object") payload = payload.body;
    if (payload?.data && typeof payload.data === "object" && payload.id == null) payload = payload.data;
    if (payload?.deal && typeof payload.deal === "object") payload = payload.deal;
    if (payload?.item && typeof payload.item === "object" && payload.id == null) payload = payload.item;

    return payload;
}

function normalizeDealResponse(data, allowIdOnly = false) {
    const deal = unwrapDealPayload(data);
    return isValidDeal(deal, allowIdOnly) ? deal : null;
}

function dealHasFinancialFields(deal) {
    if (!deal) return false;
    return (
        deal.paid != null
        || deal.paid_amount != null
        || deal.paidAmount != null
        || deal.payment_sum != null
        || deal.debt != null
        || deal.debt_amount != null
        || deal.debtAmount != null
        || deal.amount != null
        || deal.total != null
    );
}

function applyLocalPayment(deal, amount) {
    const base = { ...deal };
    const f = getDealFinancials(base);
    base.paid = f.paid + amount;
    base.debt = Math.max(0, f.debt - amount);
    return normalizeDealForView(base);
}

function mergeDealAfterPayment(baseDeal, apiData, addedAmount) {
    const unwrapped = unwrapDealPayload(apiData);

    if (unwrapped && typeof unwrapped === "object") {
        if (dealHasFinancialFields(unwrapped)) {
            return normalizeDealForView({ ...baseDeal, ...unwrapped, id: baseDeal.id });
        }

        const apiDeal = normalizeDealResponse(unwrapped);
        if (apiDeal) {
            if (dealHasFinancialFields(apiDeal)) {
                return normalizeDealForView({ ...baseDeal, ...apiDeal });
            }
            return applyLocalPayment({ ...baseDeal, ...apiDeal }, addedAmount);
        }
    }

    return applyLocalPayment(baseDeal, addedAmount);
}

async function fetchDealDetails(dealId, options = {}) {
    if (!dealId) return null;

    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                action: 'getDeal',
                dealId: Number(dealId)
            })
        });

        if (response.status === 401) {
            handleUnauthorized({ silent: options.silent401 === true });
            return null;
        }
        if (!response.ok) throw new Error("Ошибка загрузки заказа");

        const data = await response.json();
        const deal = normalizeDealForView(normalizeDealResponse(data));
        if (deal) {
            dealsCache.set(String(deal.id), deal);
            return deal;
        }
        return null;
    } catch (e) {
        console.error("fetchDealDetails failed", e);
        return null;
    }
}

function findCrmStatus(status) {
    if (status && typeof status === 'object') {
        const statusById = findCrmStatus(status.id);
        if (statusById) return statusById;
        return findCrmStatus(status.name);
    }

    const statusId = Number(status);
    if (Number.isInteger(statusId)) {
        return getCrmStatuses().find(s => s.id === statusId) || null;
    }

    const statusName = String(status || "");
    const normalized = (statusName || "").toLowerCase().trim();
    return getCrmStatuses().find(s => s.name.toLowerCase() === normalized) || null;
}

function getStatusMeta(statusName, statusObj = {}) {
    const knownStatus = findCrmStatus(statusObj) || findCrmStatus(statusObj.id || statusObj.status_id) || findCrmStatus(statusName);
    const name = knownStatus?.name || statusObj.name || statusName || "Статус не установлен";
    return {
        id: knownStatus?.id || Number(statusObj.id ?? statusObj.status_id) || null,
        name: name,
        bk_color: knownStatus?.bk_color || statusObj.bk_color || "#dfdfdf",
        text_color: knownStatus?.text_color || statusObj.text_color || "black"
    };
}

function getElementId(element) {
    return element?.id ?? element?.element_id ?? element?.elementId ?? element?.item_id ?? element?.itemId ?? "";
}

function renderDealStatusControl(dealId, statusMeta, isLocked = false) {
    if (currentUser.role !== 'staff' || isLocked) {
        return `<div class="status-badge" style="background:${statusMeta.bk_color}; color:${statusMeta.text_color};">${escapeHtml(statusMeta.name)}</div>`;
    }

    return `<button type="button" class="editable-status" data-status-scope="deal" data-deal-id="${dealId}" onclick="showStatusMenu(event, this)" style="background:${statusMeta.bk_color}; color:${statusMeta.text_color};">${escapeHtml(statusMeta.name)}</button>`;
}

function renderElementStatusControl(dealId, element, elementIndex, statusMeta, isLocked = false) {
    const icon = statusMeta.icon || getStatusIcon(statusMeta.name).icon;
    const elementId = getElementId(element);

    if (currentUser.role !== 'staff' || isLocked) {
        return `<span title="${escapeHtml(statusMeta.name)}" style="cursor: help; margin-right: 12px; font-size: 18px; min-width: 24px; text-align: center;">${icon}</span>`;
    }

    return `<button type="button" class="item-status-control" data-status-scope="element" data-deal-id="${dealId}" data-element-id="${escapeHtml(elementId)}" data-element-index="${elementIndex}" onclick="showStatusMenu(event, this)" title="${escapeHtml(statusMeta.name)}">${icon}</button>`;
}

function showStatusMenu(event, trigger) {
    event.stopPropagation();
    if (!trigger || currentUser.role !== 'staff') return;

    document.querySelectorAll('.status-menu').forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'status-menu';
    const statuses = trigger.dataset.statusScope === "element" ? getElementStatuses({ manualOnly: true }) : getCrmStatuses();

    statuses.forEach(status => {
        const option = document.createElement('button');
        option.type = "button";
        option.className = "status-menu-option";
        option.innerHTML = `
            <span class="status-menu-color" style="background:${status.bk_color};"></span>
            <span>${escapeHtml(status.name)}</span>`;
        option.onclick = () => updateCrmStatus(trigger, status, menu);
        menu.appendChild(option);
    });

    document.body.appendChild(menu);

    const rect = trigger.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - 12);
    menu.style.left = `${Math.max(12, left)}px`;
    menu.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - menu.offsetHeight - 12)}px`;
}

function applyDealStatusToCache(dealId, status) {
    const deal = dealsCache.get(String(dealId));
    if (!deal) return;

    const nextStatus = {
        id: status.id,
        name: status.name,
        bk_color: status.bk_color,
        text_color: status.text_color
    };

    deal.status = nextStatus;
    deal.status_id = status.id;
    deal.status_name = status.name;
    deal.status_text = status.name;
    dealsCache.set(String(dealId), deal);

    if (Array.isArray(crmSearchCache.adv)) {
        const idx = crmSearchCache.adv.findIndex(item => String(item.id) === String(dealId));
        if (idx >= 0) {
            crmSearchCache.adv[idx] = { ...crmSearchCache.adv[idx], ...deal };
        }
    }

    if (document.getElementById("deal-tab")?.classList.contains("active")) {
        const openDealId = document.querySelector("#deal-detail .crm-item")?.id?.replace("deal-", "");
        if (openDealId && String(openDealId) === String(dealId)) {
            saveOpenDealState(deal);
        }
    }
}

function refreshDealStatusControls(dealId, status) {
    document.querySelectorAll(`.editable-status[data-status-scope="deal"][data-deal-id="${dealId}"]`).forEach(control => {
        control.innerText = status.name;
        control.style.background = status.bk_color;
        control.style.color = status.text_color;
    });
    document.querySelectorAll(`.status-badge`).forEach(badge => {
        const card = badge.closest(`.crm-item#deal-${dealId}`);
        if (!card) return;
        badge.innerText = status.name;
        badge.style.background = status.bk_color;
        badge.style.color = status.text_color;
    });
}

async function updateDealStatusById(dealId, status) {
    if (!ensureActiveSession() || !dealId || status?.id == null) return false;

    try {
        const response = await fetch(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "updateStatus",
                entity: "deal",
                dealId: Number(dealId),
                statusId: status.id,
                statusName: status.name
            })
        });

        if (response.status === 401) {
            handleUnauthorized();
            return false;
        }
        if (!response.ok) throw new Error("Ошибка обновления статуса");

        applyDealStatusToCache(dealId, status);
        refreshDealStatusControls(dealId, status);
        return true;
    } catch (e) {
        console.error(e);
        alert("Не удалось обновить статус");
        return false;
    }
}

function updateCachedStatus(trigger, status) {
    const scope = trigger.dataset.statusScope;
    const dealId = String(trigger.dataset.dealId || "");
    const deal = dealsCache.get(dealId);
    if (!deal) return;

    const nextStatus = {
        id: status.id,
        name: status.name,
        bk_color: status.bk_color,
        text_color: status.text_color
    };

    if (scope === "deal") {
        applyDealStatusToCache(dealId, status);
        return;
    }

    if (scope === "element" && Array.isArray(deal.elements)) {
        const elementId = trigger.dataset.elementId || "";
        const elementIndex = Number(trigger.dataset.elementIndex);
        const element = (elementId ? deal.elements.find(e => String(getElementId(e)) === String(elementId)) : null)
            || deal.elements[elementIndex];

        if (element) {
            element.status = nextStatus;
            element.status_id = status.id;
            element.status_name = status.name;
        }
    }

    dealsCache.set(dealId, deal);
}

function refreshStatusControls(trigger, status) {
    const scope = trigger.dataset.statusScope;
    const dealId = trigger.dataset.dealId;
    const selector = scope === "deal"
        ? `.editable-status[data-status-scope="deal"][data-deal-id="${dealId}"]`
        : `.item-status-control[data-status-scope="element"][data-deal-id="${dealId}"][data-element-index="${trigger.dataset.elementIndex}"]`;

    document.querySelectorAll(selector).forEach(control => {
        if (scope === "deal") {
            control.innerText = status.name;
            control.style.background = status.bk_color;
            control.style.color = status.text_color;
        } else {
            const icon = status.icon || getStatusIcon(status.name).icon;
            control.innerText = icon;
            control.title = status.name;
        }
    });
}

async function updateCrmStatus(trigger, status, menu) {
    if (!ensureActiveSession()) return;

    const scope = trigger.dataset.statusScope;
    const dealId = Number(trigger.dataset.dealId);
    const elementId = trigger.dataset.elementId || null;
    const elementIndex = Number(trigger.dataset.elementIndex);

    if (!dealId || status?.id == null) return;

    trigger.disabled = true;
    if (menu) menu.remove();

    try {
        const payload = {
            action: 'updateStatus',
            entity: scope,
            dealId: dealId,
            statusId: status.id,
            statusName: status.name
        };

        if (scope === "element") {
            payload.elementId = elementId;
            payload.elementIndex = Number.isFinite(elementIndex) ? elementIndex : null;
        }

        const response = await fetch(N8N_URL, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        if (!response.ok) throw new Error("Ошибка обновления статуса");

        updateCachedStatus(trigger, status);
        refreshStatusControls(trigger, status);
    } catch (e) {
        alert("Не удалось обновить статус");
        console.error(e);
    } finally {
        trigger.disabled = false;
    }
}

function fillStatusFilter() {
    const list = document.getElementById('advStatusList');
    if (!list) return;

    list.innerHTML = getCrmStatuses().map(s => `
        <label class="status-option">
            <input type="checkbox" value="${s.id}" data-name="${s.name}" onchange="updateAdvFilterUi()">
            <span class="status-color-marker" style="background:${s.bk_color};"></span>
            <span class="status-option-name">${escapeHtml(s.name)}</span>
            <span class="status-checkmark">✓</span>
        </label>
    `).join('');

    updateAdvFilterUi();
}

function hasActiveAdvFilters() {
    const statusChecked = document.querySelectorAll("#advStatusList input[type=\"checkbox\"]:checked").length;
    const managerChecked = document.querySelectorAll("#advManagerList input[type=\"checkbox\"]:checked").length;
    const dateFrom = document.getElementById("advDateFrom")?.value || "";
    const dateTo = document.getElementById("advDateTo")?.value || "";
    return statusChecked > 0 || managerChecked > 0 || !!dateFrom || !!dateTo;
}

function syncAdvFiltersButtonState() {
    const btn = document.getElementById("advFiltersBtn");
    if (!btn) return;
    btn.classList.toggle("has-filters", hasActiveAdvFilters());
}

function updateAdvFilterUi() {
    updateStatusDropdownLabel();
    updateManagerDropdownLabel();
    updateDateDropdownLabel();
    syncAdvFiltersButtonState();
}

function toggleAdvFiltersPopover(event) {
    event?.stopPropagation();
    const wrap = document.getElementById("advFiltersPopoverWrap");
    const popover = document.getElementById("advFiltersPopover");
    const btn = document.getElementById("advFiltersBtn");
    if (!wrap || !popover || !btn) return;

    const willOpen = !wrap.classList.contains("open");
    wrap.classList.toggle("open", willOpen);
    btn.setAttribute("aria-expanded", willOpen ? "true" : "false");

    if (!willOpen) {
        document.getElementById("advStatusDropdown")?.classList.remove("open");
        document.getElementById("advManagerDropdown")?.classList.remove("open");
        document.getElementById("advDateDropdown")?.classList.remove("open");
    }
}

function closeAdvFiltersPopover() {
    document.getElementById("advFiltersPopoverWrap")?.classList.remove("open");
    document.getElementById("advFiltersBtn")?.setAttribute("aria-expanded", "false");
    document.getElementById("advStatusDropdown")?.classList.remove("open");
    document.getElementById("advManagerDropdown")?.classList.remove("open");
    document.getElementById("advDateDropdown")?.classList.remove("open");
}

function fillManagerFilter() {
    const list = document.getElementById('advManagerList');
    if (!list) return;

    const managers = getManagers();
    list.innerHTML = managers.length
        ? managers.map(manager => `
            <label class="status-option manager-option">
                <input type="checkbox" value="${manager.id}" data-name="${manager.name}" onchange="updateAdvFilterUi()">
                <span class="status-option-name">${escapeHtml(manager.name)}</span>
                <span class="status-checkmark">✓</span>
            </label>
        `).join('')
        : `<div style="padding:10px; color:#888; font-size:13px;">Список менеджеров не загружен</div>`;

    updateAdvFilterUi();
}

function formatDateForWebhook(dateValue) {
    if (!dateValue) return "";
    const [year, month, day] = dateValue.split("-");
    return year && month && day ? `${day}-${month}-${year}` : dateValue;
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthSelect = document.getElementById('calendarMonthSelect');
    const yearSelect = document.getElementById('calendarYearSelect');
    if (!grid || !monthSelect || !yearSelect) return;

    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const startOffset = (monthStart.getDay() + 6) % 7;
    const firstCellDate = new Date(monthStart);
    firstCellDate.setDate(monthStart.getDate() - startOffset);
    const todayValue = formatDateInput(new Date());

    renderCalendarMonthOptions(monthSelect);
    renderCalendarYearOptions(yearSelect);
    grid.innerHTML = "";

    for (let i = 0; i < 42; i++) {
        const day = new Date(firstCellDate);
        day.setDate(firstCellDate.getDate() + i);

        const value = formatDateInput(day);
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "calendar-day";
        btn.innerText = String(day.getDate());
        btn.onclick = () => selectCalendarDate(value);

        if (day.getMonth() !== calendarMonth.getMonth()) btn.classList.add("muted");
        if (value > todayValue) btn.classList.add("future");
        if (calendarRangeStart && calendarRangeEnd && value > calendarRangeStart && value < calendarRangeEnd) btn.classList.add("in-range");
        if (value === calendarRangeStart || value === calendarRangeEnd) btn.classList.add("selected");

        grid.appendChild(btn);
    }
}

function renderCalendarMonthOptions(select) {
    const selectedMonth = calendarMonth.getMonth();

    if (select.dataset.rendered === "true" && Number(select.value) === selectedMonth) return;

    select.innerHTML = "";
    for (let month = 0; month < 12; month++) {
        const option = document.createElement('option');
        option.value = String(month);
        option.innerText = new Date(calendarMonth.getFullYear(), month, 1)
            .toLocaleDateString('ru-RU', { month: 'long' });
        option.selected = month === selectedMonth;
        select.appendChild(option);
    }
    select.dataset.rendered = "true";
}

function renderCalendarYearOptions(select) {
    const selectedYear = calendarMonth.getFullYear();
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 5;
    const endYear = currentYear + 1;

    if (select.dataset.renderedFor === `${startYear}-${endYear}` && Number(select.value) === selectedYear) return;

    select.innerHTML = "";
    for (let year = startYear; year <= endYear; year++) {
        const option = document.createElement('option');
        option.value = String(year);
        option.innerText = String(year);
        option.selected = year === selectedYear;
        select.appendChild(option);
    }
    select.dataset.renderedFor = `${startYear}-${endYear}`;
}

function selectCalendarDate(value) {
    if (!calendarRangeStart || (calendarRangeStart && calendarRangeEnd) || value < calendarRangeStart) {
        calendarRangeStart = value;
        calendarRangeEnd = "";
    } else {
        calendarRangeEnd = value;
    }

    document.getElementById('advDateFrom').value = calendarRangeStart;
    document.getElementById('advDateTo').value = calendarRangeEnd;
    updateAdvFilterUi();
    renderCalendar();
}

function changeCalendarMonth(delta) {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1);
    renderCalendar();
}

function changeCalendarMonthSelect(month) {
    calendarMonth = new Date(calendarMonth.getFullYear(), Number(month), 1);
    renderCalendar();
}

function changeCalendarYear(year) {
    calendarMonth = new Date(Number(year), calendarMonth.getMonth(), 1);
    renderCalendar();
}

function toggleStatusDropdown() {
    document.getElementById('advManagerDropdown')?.classList.remove('open');
    document.getElementById('advDateDropdown')?.classList.remove('open');
    document.getElementById('advStatusDropdown')?.classList.toggle('open');
}

function toggleManagerDropdown() {
    document.getElementById('advStatusDropdown')?.classList.remove('open');
    document.getElementById('advDateDropdown')?.classList.remove('open');
    document.getElementById('advManagerDropdown')?.classList.toggle('open');
}

function toggleDateDropdown() {
    document.getElementById('advStatusDropdown')?.classList.remove('open');
    document.getElementById('advManagerDropdown')?.classList.remove('open');
    document.getElementById('advDateDropdown')?.classList.toggle('open');
    renderCalendar();
}

document.addEventListener('click', (event) => {
    const statusDropdown = document.getElementById('advStatusDropdown');
    const managerDropdown = document.getElementById('advManagerDropdown');
    const dateDropdown = document.getElementById('advDateDropdown');
    const filtersWrap = document.getElementById('advFiltersPopoverWrap');
    const confirmPopover = document.querySelector('.deal-confirm-popover');
    const statusMenu = document.querySelector('.status-menu');
    if (statusDropdown && !statusDropdown.contains(event.target)) statusDropdown.classList.remove('open');
    if (managerDropdown && !managerDropdown.contains(event.target)) managerDropdown.classList.remove('open');
    if (dateDropdown && !dateDropdown.contains(event.target)) dateDropdown.classList.remove('open');
    if (filtersWrap && !filtersWrap.contains(event.target)) closeAdvFiltersPopover();
    if (confirmPopover && !confirmPopover.contains(event.target) && !event.target.closest('.deal-create-btn')) {
        confirmPopover.remove();
    }
    if (statusMenu && !statusMenu.contains(event.target) && !event.target.closest('.editable-status, .item-status-control')) {
        statusMenu.remove();
    }
});

function updateStatusDropdownLabel() {
    const btn = document.querySelector('#advStatusDropdown .status-dropdown-btn');
    const selected = Array.from(document.querySelectorAll('#advStatusList input[type="checkbox"]:checked'));
    if (!btn) return;

    if (selected.length === 0) {
        btn.innerText = "Все статусы";
    } else if (selected.length === 1) {
        btn.innerText = selected[0].dataset.name || "1 статус";
    } else {
        btn.innerText = `Выбрано ${selected.length}`;
    }
}

function updateManagerDropdownLabel() {
    const btn = document.querySelector('#advManagerDropdown .status-dropdown-btn');
    const selected = Array.from(document.querySelectorAll('#advManagerList input[type="checkbox"]:checked'));
    if (!btn) return;

    if (selected.length === 0) {
        btn.innerText = "Все менеджеры";
    } else if (selected.length === 1) {
        btn.innerText = selected[0].dataset.name || "1 менеджер";
    } else {
        btn.innerText = `Выбрано ${selected.length}`;
    }
}

function updateDateDropdownLabel() {
    const btn = document.querySelector('#advDateDropdown .date-range-btn');
    const dateFrom = document.getElementById('advDateFrom')?.value || "";
    const dateTo = document.getElementById('advDateTo')?.value || "";
    if (!btn) return;

    if (dateFrom && dateTo) {
        btn.innerText = `${formatDateForWebhook(dateFrom)} - ${formatDateForWebhook(dateTo)}`;
    } else if (dateFrom) {
        btn.innerText = `с ${formatDateForWebhook(dateFrom)}`;
    } else if (dateTo) {
        btn.innerText = `до ${formatDateForWebhook(dateTo)}`;
    } else {
        btn.innerText = "Любой период";
    }
}

function clearAdvFilters() {
    const searchInput = document.getElementById('advSearchInput');
    const dateFrom = document.getElementById('advDateFrom');
    const dateTo = document.getElementById('advDateTo');

    document.querySelectorAll('#advStatusList input[type="checkbox"]').forEach(input => input.checked = false);
    document.querySelectorAll('#advManagerList input[type="checkbox"]').forEach(input => input.checked = false);
    if (searchInput) searchInput.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    calendarRangeStart = "";
    calendarRangeEnd = "";
    calendarMonth = new Date();
    updateAdvFilterUi();
    renderCalendar();
}

function clearMainSearch() {
    const input = document.getElementById('crmSearchInput');
    if (input) input.value = "";
}

// Функция для определения иконок и цветов статуса
function getStatusIcon(statusName) {
    const name = (statusName || "").toLowerCase().trim();
    if (!name || name === "без статуса") return { icon: "⚪", color: "#95a5a6", label: "Без статуса" };
    if (name === "печать") return { icon: "🖨️", color: "#3498db", label: "Печать" };
    if (name === "постпечать") return { icon: "✂️", color: "#e67e22", label: "Постпечать" };
    if (name === "завершено") return { icon: "✅", color: "#27ae60", label: "Завершено" };
    return { icon: "📦", color: "#9b59b6", label: statusName || "Статус" };
}

function getElementStatuses(options = {}) {
    const statuses = normalizeElementStatuses(currentUser.elementStatuses);
    return options.manualOnly ? statuses.filter(status => status.is_manual !== false) : statuses;
}

function getElementStatusMeta(statusName, statusObj = {}) {
    const statuses = getElementStatuses();
    const statusId = statusObj.status_id ?? statusObj.statusId ?? statusObj.id;
    const knownStatus = (statusId != null && statusId !== "")
        ? statuses.find(status => status.id === Number(statusId))
        : statuses.find(status => status.name.toLowerCase() === String(statusName || "").trim().toLowerCase());
    const s = getStatusIcon(knownStatus?.name || statusName);

    return {
        id: knownStatus?.id ?? (Number.isFinite(Number(statusId)) ? Number(statusId) : null),
        name: knownStatus?.name || s.label,
        bk_color: knownStatus?.bk_color || s.color,
        text_color: knownStatus?.text_color || "white",
        icon: knownStatus?.icon || s.icon
    };
}

// Функция для создания HTML строки товара (элемента сделки)
function createRowHtml(name, qty, price, statusName, isNew = false, options = {}) {
    const q = Number(qty) || 0;
    const p = Number(price) || 0;
    const rowTotal = options.lineTotal != null ? Number(options.lineTotal) : q * p;
    const statusMeta = options.dealId
        ? getElementStatusMeta(statusName, options.statusObj || {})
        : getStatusMeta(statusName, options.statusObj || {});
    const statusControl = options.dealId
        ? renderElementStatusControl(options.dealId, options.element || {}, options.elementIndex || 0, statusMeta, Boolean(options.lockStatus))
        : `<span title="${escapeHtml(statusMeta.name)}" style="cursor: help; margin-right: 12px; font-size: 18px; min-width: 24px; text-align: center;">${getStatusIcon(statusMeta.name).icon}</span>`;

    const elementId = getElementId(options.element || {});
    const isDetailMode = Boolean(options.detailMode);
    const canOpenEditor = isDetailMode && elementId && !isNew;
    const rowAttrs = canOpenEditor
        ? ` data-deal-id="${options.dealId}" data-element-id="${escapeHtml(elementId)}" data-element-index="${options.elementIndex || 0}"`
        : "";
    const thumbHtml = canOpenEditor
        ? `<span class="element-preview-thumb" data-deal-id="${options.dealId}" data-element-id="${escapeHtml(elementId)}"></span>`
        : "";
    const textClass = canOpenEditor ? "element-row-text element-row-text-clickable" : "element-row-text";
    const textClick = canOpenEditor
        ? ` onclick="openElementEditor(event, this)" data-deal-id="${options.dealId}" data-element-id="${escapeHtml(elementId)}" data-element-index="${options.elementIndex || 0}" data-lock-status="${options.lockStatus ? "1" : "0"}"`
        : "";

    return `
        <div class="element-row ${isNew ? 'new-row' : ''}" data-price="${rowTotal}"${rowAttrs}>
            ${statusControl}
            ${thumbHtml}
            <span class="${textClass}"${textClick}>${escapeHtml(name)}, ${q} ${escapeHtml(getElementUnits(options.element || {}))}, ${p} руб.</span>
            <span class="element-row-total" style="margin-right: ${isNew ? '30px' : '0'};">${rowTotal.toLocaleString('ru-RU', {minimumFractionDigits: 2})} руб.</span>
            ${isNew ? `<button onclick="this.parentElement.remove(); updateDealTotal(this.closest('.elements-list'));" style="position: absolute; right: 0; background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 1; padding: 0;">&times;</button>` : ''}
        </div>`;
}

function getDealUrl(dealId) {
    return `https://crm.heavendevelop.ru/editDeal/${dealId}`;
}

function openCrmDealUrl(dealId) {
    window.open(getDealUrl(dealId), '_blank', 'noopener');
}

function getDealClientName(deal) {
    return deal?.client?.name || deal?.client_name || "клиента";
}

function getDealNum(dealOrId) {
    const deal = typeof dealOrId === "object" && dealOrId != null
        ? dealOrId
        : dealsCache.get(String(dealOrId));
    if (!deal) return "";

    const num = deal.num ?? deal.deal_num ?? deal.number ?? deal.dealNum;
    return num != null && String(num).trim() !== "" ? String(num).trim() : "";
}

function saveOpenDealState(deal) {
    const snapshot = typeof deal === "object" && deal != null ? deal : dealsCache.get(String(deal));
    const dealId = snapshot?.id ?? deal;
    if (!dealId) return;

    try {
        localStorage.setItem("calc_open_deal", JSON.stringify({
            dealId,
            dealNum: snapshot?.num ?? snapshot?.deal_num ?? null,
            deal: snapshot?.id ? snapshot : null,
            savedAt: Date.now()
        }));
    } catch (e) {
        try {
            localStorage.setItem("calc_open_deal", JSON.stringify({
                dealId,
                dealNum: snapshot?.num ?? null,
                savedAt: Date.now()
            }));
        } catch (e2) {
            console.warn("Не удалось сохранить открытую сделку", e2);
        }
    }
}

function readOpenDealState() {
    try {
        return JSON.parse(localStorage.getItem("calc_open_deal") || "null");
    } catch (e) {
        return null;
    }
}

function getSavedOpenDeal(dealId) {
    const saved = readOpenDealState();
    if (!saved?.deal?.id) return null;
    if (String(saved.deal.id) !== String(dealId)) return null;
    return normalizeDealForView(saved.deal);
}

function clearOpenDealState() {
    localStorage.removeItem('calc_open_deal');
}

function restoreOpenDealTab() {
    try {
        const saved = readOpenDealState();
        const dealId = saved?.dealId ?? saved?.deal?.id;
        if (!dealId) return;

        const cached = getSavedOpenDeal(dealId);
        if (cached) {
            dealsCache.set(String(dealId), cached);
        }

        openDealInTab(dealId, { preserveScroll: true });
    } catch (e) {
        clearOpenDealState();
    }
}

function getElementName(element) {
    return element?.category_and_name || element?.name || element?.title || "";
}

function getElementQuantity(element) {
    return Number(element?.quantity ?? element?.qty) || 0;
}

function getElementUnits(element) {
    const units = String(element?.units || "").trim();
    return units || "шт";
}

function getElementPrice(element) {
    return toMoneyNumber(element?.price, 0);
}

function getElementLineTotal(element) {
    const explicitTotal = toMoneyNumber(element?.total, null);
    if (explicitTotal != null) return explicitTotal;
    return getElementQuantity(element) * getElementPrice(element);
}

function getElementStatusInfo(element) {
    const statusObj = (element?.status && typeof element.status === "object") ? element.status : {};
    const name = statusObj.name
        || (typeof element?.status === "string" ? element.status : "")
        || element?.status_name
        || "";

    return {
        name,
        statusObj: {
            ...statusObj,
            id: statusObj.id ?? statusObj.status_id ?? element?.status_id ?? element?.statusId
        }
    };
}

function getDealResponsibleName(deal) {
    return deal?.responsible?.name || deal?.employee_name || "—";
}

const CRM_VIEW_STORAGE_KEY = "calc_crm_view_mode";
const crmSearchCache = { main: null, adv: null };
const kanbanDragState = {
    type: null,
    columnKey: null,
    card: null,
    dealId: null,
    sourceColumnKey: null,
    insertBefore: null
};

function resetKanbanDragState() {
    kanbanDragState.type = null;
    kanbanDragState.columnKey = null;
    kanbanDragState.card = null;
    kanbanDragState.dealId = null;
    kanbanDragState.sourceColumnKey = null;
    kanbanDragState.insertBefore = null;
}

function isKanbanAvailable() {
    return currentUser?.role === "staff";
}

function getCrmViewMode() {
    if (!isKanbanAvailable()) return "list";
    return localStorage.getItem(CRM_VIEW_STORAGE_KEY) === "kanban" ? "kanban" : "list";
}

function isKanbanFullscreenActive() {
    return isKanbanAvailable()
        && getCrmViewMode() === "kanban"
        && document.getElementById("search-tab")?.classList.contains("active");
}

function getKanbanColumnOrderStorageKey() {
    const userId = currentUser?.crmId || currentUser?.login || currentUser?.id || "guest";
    return `calc_kanban_col_order_${userId}`;
}

function loadKanbanColumnOrder() {
    try {
        const raw = localStorage.getItem(getKanbanColumnOrderStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function saveKanbanColumnOrder(keys) {
    localStorage.setItem(getKanbanColumnOrderStorageKey(), JSON.stringify(keys.map(String)));
}

function sortKanbanColumnsBySavedOrder(columns) {
    const saved = loadKanbanColumnOrder();
    if (!saved.length) return columns;

    const orderMap = new Map(saved.map((key, index) => [key, index]));
    return [...columns].sort((a, b) => {
        const ai = orderMap.has(a.key) ? orderMap.get(a.key) : 10000 + columns.indexOf(a);
        const bi = orderMap.has(b.key) ? orderMap.get(b.key) : 10000 + columns.indexOf(b);
        return ai - bi;
    });
}

function saveKanbanColumnOrderFromBoard(board) {
    const keys = [...board.querySelectorAll(".crm-kanban-column")].map(col => col.dataset.statusKey);
    saveKanbanColumnOrder(keys);
}

function reorderKanbanColumns(board, sourceKey, targetKey) {
    const columns = [...board.querySelectorAll(".crm-kanban-column")];
    const source = columns.find(col => col.dataset.statusKey === sourceKey);
    const target = columns.find(col => col.dataset.statusKey === targetKey);
    if (!source || !target || source === target) return;

    const sourceIdx = columns.indexOf(source);
    const targetIdx = columns.indexOf(target);
    if (sourceIdx < targetIdx) {
        target.after(source);
    } else {
        target.before(source);
    }
}

function bindKanbanColumnDrag(board) {
    if (!board || !isKanbanAvailable()) return;

    board.querySelectorAll(".crm-kanban-column").forEach(col => {
        const header = col.querySelector(".crm-kanban-column-header");
        if (!header) return;

        header.draggable = true;
        header.title = "Перетащите для изменения порядка колонок";

        header.addEventListener("dragstart", (event) => {
            resetKanbanDragState();
            kanbanDragState.type = "column";
            kanbanDragState.columnKey = col.dataset.statusKey;
            col.classList.add("is-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", kanbanDragState.columnKey || "");
        });

        header.addEventListener("dragend", () => {
            col.classList.remove("is-dragging");
            board.querySelectorAll(".crm-kanban-column").forEach(item => {
                item.classList.remove("drop-target");
                item.classList.remove("card-drop-target");
            });
            resetKanbanDragState();
        });

        col.addEventListener("dragover", (event) => {
            if (kanbanDragState.type !== "column" || !kanbanDragState.columnKey) return;
            if (col.dataset.statusKey === kanbanDragState.columnKey) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            col.classList.add("drop-target");
        });

        col.addEventListener("dragleave", (event) => {
            if (!col.contains(event.relatedTarget)) {
                col.classList.remove("drop-target");
            }
        });

        col.addEventListener("drop", (event) => {
            if (kanbanDragState.type !== "column") return;
            event.preventDefault();
            event.stopPropagation();
            col.classList.remove("drop-target");
            const targetKey = col.dataset.statusKey;
            const dragKey = kanbanDragState.columnKey;
            if (!dragKey || !targetKey || dragKey === targetKey) return;
            reorderKanbanColumns(board, dragKey, targetKey);
            saveKanbanColumnOrderFromBoard(board);
        });
    });
}

function resolveKanbanColumnStatus(columnEl) {
    if (!columnEl) return null;

    const statusId = Number(columnEl.dataset.statusId);
    if (Number.isFinite(statusId) && statusId > 0) {
        return getCrmStatuses().find(status => status.id === statusId) || null;
    }

    const statusKey = String(columnEl.dataset.statusKey || "");
    if (statusKey.startsWith("_name:")) {
        const name = statusKey.slice(6);
        return getCrmStatuses().find(status => status.name.toLowerCase() === name) || null;
    }

    return getCrmStatuses().find(status => String(status.id) === statusKey) || null;
}

function syncKanbanColumnEmptyState(columnEl) {
    const body = columnEl?.querySelector(".crm-kanban-column-body");
    if (!body) return;

    const count = body.querySelectorAll(".kanban-card").length;
    const countEl = columnEl.querySelector(".crm-kanban-column-count");
    if (countEl) countEl.textContent = String(count);

    const emptyEl = body.querySelector(".crm-kanban-empty");
    if (count === 0 && !emptyEl) {
        body.insertAdjacentHTML("beforeend", `<div class="crm-kanban-empty">Нет заказов</div>`);
    } else if (count > 0 && emptyEl) {
        emptyEl.remove();
    }
}

function clearKanbanDropIndicators(board) {
    board?.querySelectorAll(".kanban-drop-indicator").forEach(el => el.remove());
}

function getKanbanInsertPosition(body, clientY, draggingCard = null) {
    const cards = [...body.querySelectorAll(".kanban-card")].filter(card => card !== draggingCard);
    if (!cards.length) {
        return { insertBefore: null };
    }

    for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (clientY < mid) {
            return { insertBefore: card };
        }
    }

    return { insertBefore: null };
}

function showKanbanDropIndicator(body, insertBefore, draggingCard = null) {
    clearKanbanDropIndicators(body.closest(".crm-kanban-board"));
    const indicator = document.createElement("div");
    indicator.className = "kanban-drop-indicator";
    if (insertBefore && insertBefore !== draggingCard) {
        body.insertBefore(indicator, insertBefore);
    } else {
        body.appendChild(indicator);
    }
}

function moveKanbanCardToPosition(card, targetBody, insertBefore = null) {
    if (!targetBody || !card) return;

    targetBody.querySelector(".crm-kanban-empty")?.remove();
    clearKanbanDropIndicators(targetBody.closest(".crm-kanban-board"));

    if (insertBefore && insertBefore.parentElement === targetBody) {
        targetBody.insertBefore(card, insertBefore);
    } else {
        targetBody.appendChild(card);
    }
}

function moveKanbanCardToColumn(card, targetColumn, insertBefore = null) {
    const sourceColumn = card.closest(".crm-kanban-column");
    const targetBody = targetColumn.querySelector(".crm-kanban-column-body");
    if (!targetBody) return;

    moveKanbanCardToPosition(card, targetBody, insertBefore);

    if (sourceColumn && sourceColumn !== targetColumn) {
        syncKanbanColumnEmptyState(sourceColumn);
    }
    syncKanbanColumnEmptyState(targetColumn);
}

function bindKanbanCardDrag(board) {
    if (!board || !isKanbanAvailable()) return;

    board.querySelectorAll(".kanban-card").forEach(card => {
        let dragMoved = false;

        card.draggable = true;
        card.addEventListener("dragstart", (event) => {
            resetKanbanDragState();
            kanbanDragState.type = "card";
            kanbanDragState.card = card;
            kanbanDragState.dealId = card.dataset.dealId;
            kanbanDragState.sourceColumnKey = card.closest(".crm-kanban-column")?.dataset.statusKey || null;
            dragMoved = false;

            card.classList.add("is-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("application/x-kanban-card", kanbanDragState.dealId || "");
        });

        card.addEventListener("drag", () => {
            dragMoved = true;
        });

        card.addEventListener("dragend", () => {
            card.classList.remove("is-dragging");
            board.querySelectorAll(".crm-kanban-column").forEach(col => col.classList.remove("card-drop-target"));
            clearKanbanDropIndicators(board);
            resetKanbanDragState();
        });

        card.addEventListener("click", (event) => {
            if (dragMoved) {
                event.preventDefault();
                event.stopPropagation();
                dragMoved = false;
                return;
            }

            const dealId = Number(card.dataset.dealId);
            if (Number.isFinite(dealId)) openDealInTab(dealId);
        });

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const dealId = Number(card.dataset.dealId);
                if (Number.isFinite(dealId)) openDealInTab(dealId);
            }
        });
    });

    board.querySelectorAll(".crm-kanban-column-body").forEach(body => {
        body.addEventListener("dragover", (event) => {
            if (kanbanDragState.type !== "card" || !kanbanDragState.card) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";

            const { insertBefore } = getKanbanInsertPosition(body, event.clientY, kanbanDragState.card);
            kanbanDragState.insertBefore = insertBefore;
            showKanbanDropIndicator(body, insertBefore, kanbanDragState.card);
            body.closest(".crm-kanban-column")?.classList.add("card-drop-target");
        });

        body.addEventListener("dragleave", (event) => {
            const column = body.closest(".crm-kanban-column");
            if (column && !column.contains(event.relatedTarget)) {
                column.classList.remove("card-drop-target");
            }
            if (!body.contains(event.relatedTarget)) {
                clearKanbanDropIndicators(board);
            }
        });

        body.addEventListener("drop", async (event) => {
            if (kanbanDragState.type !== "card") return;
            event.preventDefault();
            event.stopPropagation();

            const targetColumn = body.closest(".crm-kanban-column");
            targetColumn?.classList.remove("card-drop-target");
            clearKanbanDropIndicators(board);

            const card = kanbanDragState.card;
            const dealId = kanbanDragState.dealId;
            const sourceColumnKey = kanbanDragState.sourceColumnKey;
            const insertBefore = kanbanDragState.insertBefore;
            if (!card || !dealId || !targetColumn) return;

            const targetColumnKey = targetColumn.dataset.statusKey;
            if (!targetColumnKey) return;

            const sourceColumn = card.closest(".crm-kanban-column");
            const sameColumn = targetColumnKey === sourceColumnKey;

            if (sameColumn) {
                const nextCard = card.nextElementSibling;
                const alreadyLast = !nextCard || nextCard.classList.contains("kanban-drop-indicator");
                if ((insertBefore === card)
                    || (insertBefore === nextCard && !nextCard?.classList?.contains("kanban-drop-indicator"))
                    || (!insertBefore && alreadyLast)) {
                    clearKanbanDropIndicators(board);
                    resetKanbanDragState();
                    return;
                }
                moveKanbanCardToPosition(card, body, insertBefore);
                syncKanbanColumnEmptyState(targetColumn);
                resetKanbanDragState();
                return;
            }

            const status = resolveKanbanColumnStatus(targetColumn);
            if (!status?.id) {
                alert("Не удалось определить статус для этой колонки");
                return;
            }

            moveKanbanCardToColumn(card, targetColumn, insertBefore);
            card.classList.add("is-updating");

            const ok = await updateDealStatusById(dealId, status);
            card.classList.remove("is-updating");

            if (!ok && sourceColumn) {
                moveKanbanCardToColumn(card, sourceColumn, null);
            }

            resetKanbanDragState();
        });
    });
}

function syncCrmViewToggleButtons() {
    const mode = getCrmViewMode();
    document.querySelectorAll("#adv-search-container .crm-view-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === mode);
    });
}

function applyCrmViewLayoutClass() {
    const isKanban = isKanbanAvailable() && getCrmViewMode() === "kanban";
    document.getElementById("adv-search-container")?.classList.toggle("crm-kanban-layout", isKanban);
    document.body.classList.toggle("crm-kanban-active", isKanbanFullscreenActive());
    if (isKanbanFullscreenActive()) {
        window.scrollTo(0, 0);
    }
    if (!isKanban) {
        closeAdvFiltersPopover();
    }
}

function rerenderCrmResultsFromCache(mode) {
    if (mode !== "adv") return;
    const deals = crmSearchCache.adv;
    const resDiv = document.getElementById("advCrmResults");
    if (!resDiv || !deals) return;

    if (!deals.length) {
        resDiv.classList.remove("crm-kanban-results-host");
        resDiv.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Список заказов пуст</p>";
        return;
    }

    renderDealsResults(deals, resDiv);
}

function toggleCrmView(mode) {
    if (!isKanbanAvailable()) return;

    const nextMode = mode === "kanban" ? "kanban" : "list";
    if (getCrmViewMode() === nextMode) return;

    localStorage.setItem(CRM_VIEW_STORAGE_KEY, nextMode);
    syncCrmViewToggleButtons();
    applyCrmViewLayoutClass();
    rerenderCrmResultsFromCache("adv");
}

function initCrmViewToggle() {
    syncCrmViewToggleButtons();
    applyCrmViewLayoutClass();
    updateAdvFilterUi();
}

function resolveDealStatusColumnMeta(deal) {
    const statusObj = (deal.status && typeof deal.status === "object") ? deal.status : {};
    const statusName = statusObj.name
        || (typeof deal.status === "string" ? deal.status : "")
        || deal.status_name
        || deal.status_text
        || "";
    return getStatusMeta(statusName, {
        ...statusObj,
        id: statusObj.id ?? statusObj.status_id ?? deal.status_id ?? deal.statusId
    });
}

function buildKanbanColumns(deals) {
    const columns = [];
    const columnMap = new Map();

    const ensureColumn = (col) => {
        if (!columnMap.has(col.key)) {
            columns.push(col);
            columnMap.set(col.key, col);
        }
        return columnMap.get(col.key);
    };

    getCrmStatuses().forEach(status => {
        ensureColumn({
            key: String(status.id),
            id: status.id,
            name: status.name,
            bk_color: status.bk_color || "#dfdfdf",
            text_color: status.text_color || "#333",
            deals: []
        });
    });

    deals.forEach(deal => {
        if (!isValidDeal(deal)) return;
        const meta = resolveDealStatusColumnMeta(deal);
        let col = meta.id != null ? columnMap.get(String(meta.id)) : null;

        if (!col) {
            col = columns.find(item => item.name.toLowerCase() === meta.name.toLowerCase());
        }

        if (!col) {
            col = ensureColumn({
                key: meta.id != null ? String(meta.id) : `_name:${meta.name.toLowerCase()}`,
                id: meta.id,
                name: meta.name,
                bk_color: meta.bk_color,
                text_color: meta.text_color,
                deals: []
            });
        }

        col.deals.push(deal);
    });

    return columns;
}

function renderKanbanCard(deal, index) {
    const f = getDealFinancials(deal);
    const amountClass = f.isPaid ? "payment-ok" : "payment-alert";
    const client = deal.client?.name || deal.client_name || "Клиент не указан";
    const manager = getDealResponsibleName(deal);
    const num = deal.num || deal.id;

    return `
        <article class="kanban-card" data-deal-id="${deal.id}" style="--card-index:${index}" tabindex="0" role="button" aria-label="Открыть заказ № ${escapeHtml(num)}">
            <div class="kanban-card-num">№ ${escapeHtml(num)}</div>
            <div class="kanban-card-client">${escapeHtml(client)}</div>
            <div class="kanban-card-manager">${escapeHtml(manager)}</div>
            <div class="kanban-card-amount ${amountClass}">${formatMoney(f.total)} ₽</div>
        </article>`;
}

function bindKanbanBoardEvents(board) {
    bindKanbanCardDrag(board);
}

function renderDealsKanban(deals, targetDiv) {
    const validDeals = deals.filter(isValidDeal).map(deal => normalizeDealForView(deal));
    validDeals.forEach(deal => dealsCache.set(String(deal.id), deal));

    const columns = sortKanbanColumnsBySavedOrder(buildKanbanColumns(validDeals));
    const board = document.createElement("div");
    board.className = "crm-kanban-board";

    columns.forEach(col => {
        const columnEl = document.createElement("section");
        columnEl.className = "crm-kanban-column";
        columnEl.dataset.statusKey = col.key;
        if (col.id != null) columnEl.dataset.statusId = String(col.id);

        const cardsHtml = col.deals.map((deal, idx) => renderKanbanCard(deal, idx)).join("");
        const emptyHtml = col.deals.length
            ? ""
            : `<div class="crm-kanban-empty">Нет заказов</div>`;

        columnEl.innerHTML = `
            <header class="crm-kanban-column-header" style="--col-bg:${col.bk_color}; --col-text:${col.text_color}">
                <span class="crm-kanban-column-grip" aria-hidden="true">⠿</span>
                <span class="crm-kanban-column-title">${escapeHtml(col.name)}</span>
                <span class="crm-kanban-column-count">${col.deals.length}</span>
            </header>
            <div class="crm-kanban-column-body">
                ${cardsHtml}${emptyHtml}
            </div>`;

        board.appendChild(columnEl);
    });

    targetDiv.innerHTML = "";
    targetDiv.classList.add("crm-kanban-results-host");
    targetDiv.appendChild(board);
    bindKanbanBoardEvents(board);
    bindKanbanColumnDrag(board);
    requestAnimationFrame(() => board.classList.add("is-ready"));
}

function renderDealsResults(deals, targetDiv, options = {}) {
    if (options.detailMode) {
        renderDealsList(deals, targetDiv, options);
        return;
    }

    const isAdvResults = targetDiv?.id === "advCrmResults";
    const useKanban = isAdvResults && getCrmViewMode() === "kanban";
    targetDiv?.classList.toggle("crm-kanban-results-host", useKanban);
    if (useKanban) {
        renderDealsKanban(deals, targetDiv);
    } else {
        renderDealsList(deals, targetDiv, options);
    }
}

function getDealCreatedAt(deal) {
    return deal?.created_at || deal?.createdAt || "";
}

function formatDealCreatedDate(raw) {
    if (!raw) return "";
    const value = String(raw).trim();
    const match = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
    if (match) {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
        return `${day}.${month}.${match[3]} г.`;
    }
    return value;
}

function renderDealFooterMeta(deal) {
    const date = formatDealCreatedDate(getDealCreatedAt(deal));
    const manager = getDealResponsibleName(deal);

    return `
        <div class="deal-footer-meta">
            ${date ? `<div>Дата заказа: <b>${escapeHtml(date)}</b></div>` : ""}
            <div>Менеджер: <b>${escapeHtml(manager)}</b></div>
        </div>`;
}

function sumDealElementsTotal(deal) {
    if (!Array.isArray(deal?.elements)) return 0;
    return deal.elements.reduce((sum, element) => sum + getElementLineTotal(element), 0);
}

function normalizeDealForView(deal) {
    if (!deal) return null;

    const financials = getDealFinancials(deal);
    if (deal.amount == null && deal.total == null && deal.sum == null) {
        deal.amount = financials.total;
    }
    if (deal.paid == null) deal.paid = financials.paid;
    if (deal.debt == null) deal.debt = financials.debt;

    return deal;
}

function toMoneyNumber(value, fallback = 0) {
    if (value == null || value === "") return fallback;
    if (typeof value === "string") {
        const normalized = value.replace(/\s+/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : fallback;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getDealFinancials(deal) {
    const paid = toMoneyNumber(
        deal?.paid ?? deal?.paid_amount ?? deal?.paidAmount ?? deal?.payment_sum ?? deal?.paymentSum ?? deal?.payed ?? deal?.payed_amount,
        0
    );
    const explicitDebt = deal?.debt ?? deal?.debt_amount ?? deal?.debtAmount;
    const debtFromApi = explicitDebt != null ? toMoneyNumber(explicitDebt, 0) : null;

    let total = toMoneyNumber(deal?.amount ?? deal?.total ?? deal?.sum, null);
    if (total == null && debtFromApi != null) {
        total = paid + debtFromApi;
    }
    if (total == null) {
        const elementsSum = sumDealElementsTotal(deal);
        if (elementsSum > 0) total = elementsSum;
    }
    if (total == null) total = paid + (debtFromApi ?? 0);

    const debt = debtFromApi != null ? debtFromApi : Math.max(0, total - paid);

    return {
        total,
        paid,
        debt,
        isPaid: total > 0 && debt <= 0.009
    };
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function renderPaymentSummary(deal, isClosed = false) {
    const f = getDealFinancials(deal);
    const debtClass = f.debt > 0.009 ? "payment-alert" : "payment-ok";
    const canAddPayment = currentUser.role === 'staff' && !isClosed;
    const actions = canAddPayment ? `
        <div class="payment-actions">
            <button type="button" class="payment-action-btn payment-partial-btn" onclick="openPaymentModal(${deal.id}, 'partial')" title="Добавить частичную сумму к оплате" aria-label="Добавить частичную сумму к оплате"><span class="payment-action-icon">+</span></button>
            <button type="button" class="payment-action-btn payment-full-btn" onclick="openPaymentModal(${deal.id}, 'full')" title="Добавить всю сумму" aria-label="Добавить всю сумму"><span class="payment-action-icon">+</span></button>
        </div>` : "";

    return `
        <div class="deal-payment-block" data-deal-id="${deal.id}" style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
            <div class="payment-summary">
                <div class="payment-summary-row">
                    <span class="payment-summary-label">Всего</span>
                    <span class="payment-summary-value" id="payment-total-${deal.id}">${formatMoney(f.total)}</span>
                    <span></span>
                </div>
                <div class="payment-summary-row paid-row">
                    <span class="payment-summary-label">Оплачено</span>
                    <span class="payment-summary-value" id="payment-paid-${deal.id}">${formatMoney(f.paid)}</span>
                    ${actions || "<span></span>"}
                </div>
                <div class="payment-summary-row">
                    <span class="payment-summary-label">Долг</span>
                    <span class="payment-summary-value ${debtClass}" id="payment-debt-${deal.id}">${formatMoney(f.debt)}</span>
                    <span></span>
                </div>
            </div>
        </div>`;
}

function renderDealTotalOnly(deal) {
    const f = getDealFinancials(deal);
    const totalClass = f.isPaid ? "payment-ok" : "payment-alert";
    return `<div class="deal-total-only ${totalClass}" data-deal-id="${deal.id}">Итого: ${formatMoney(f.total)} ₽</div>`;
}

function getDealCard(dealId, trigger = null) {
    if (trigger) {
        const card = trigger.closest('.crm-item');
        if (card) return card;
    }

    const dealTab = document.getElementById('deal-tab');
    if (dealTab?.classList.contains('active')) {
        const activeCard = dealTab.querySelector(`.crm-item#deal-${dealId}`);
        if (activeCard) return activeCard;
    }

    return document.getElementById(`deal-${dealId}`);
}

function getDealUiParts(dealId, trigger = null) {
    const card = getDealCard(dealId, trigger);
    return {
        card,
        list: card?.querySelector('.deal-elements-list') || null,
        saveArea: card?.querySelector('.deal-save-area') || null,
        paymentBlock: card?.querySelector('.deal-payment-block') || null,
        totalOnly: card?.querySelector('.deal-total-only') || null
    };
}

function refreshPaymentBlock(dealId, card = null) {
    const deal = dealsCache.get(String(dealId));
    const root = card || getDealCard(dealId);
    const block = root?.querySelector('.deal-payment-block');
    if (!deal || !block) return;

    const statusObj = (deal.status && typeof deal.status === "object") ? deal.status : {};
    const statusName = statusObj.name || (typeof deal.status === "string" ? deal.status : "") || deal.status_name || deal.status_text || "";
    const isClosed = statusName.toLowerCase().includes("завершено");
    block.outerHTML = renderPaymentSummary(deal, isClosed);
}

function openPaymentModal(dealId, mode = "partial") {
    if (!ensureActiveSession()) return;

    const deal = dealsCache.get(String(dealId));
    if (!deal) return;

    const paymentMethods = getPaymentMethods();
    if (!paymentMethods.length) {
        alert("Справочник методов оплаты не загружен. Войдите в систему заново.");
        return;
    }

    const f = getDealFinancials(deal);
    const defaultAmount = mode === "full" ? f.debt : "";
    const isFullPayment = mode === "full";
    document.querySelectorAll('.payment-modal-backdrop').forEach(el => el.remove());

    const modal = document.createElement('div');
    modal.className = 'payment-modal-backdrop';
    modal.innerHTML = `
        <div class="payment-modal" onclick="event.stopPropagation()">
            <h3>Добавить оплату</h3>
            <label>Сумма</label>
            <input id="paymentAmountInput" type="number" min="0" step="0.01" inputmode="decimal" value="${isFullPayment ? Number(defaultAmount).toFixed(2) : ""}" ${isFullPayment ? 'readonly style="background:#f1f3f5;"' : ''}>
            <label>Метод оплаты</label>
            <select id="paymentMethodSelect">
                ${paymentMethods.map(method => `<option value="${method.id}">${escapeHtml(method.name)}</option>`).join('')}
            </select>
            <label>Основание</label>
            <textarea id="paymentReasonInput" rows="3" placeholder="Можно оставить пустым"></textarea>
            <div class="payment-modal-actions">
                <button type="button" onclick="closePaymentModal()" style="background:#eef1f5; color:#555;">Отмена</button>
                <button type="button" onclick="submitPayment(${dealId}, this)" style="background:#27ae60;">Добавить оплату</button>
            </div>
        </div>`;

    modal.onclick = closePaymentModal;
    document.body.appendChild(modal);
    document.getElementById('paymentAmountInput')?.focus();
}

function closePaymentModal() {
    document.querySelectorAll('.payment-modal-backdrop').forEach(el => el.remove());
}

async function submitPayment(dealId, btn) {
    if (!ensureActiveSession()) return;

    const deal = dealsCache.get(String(dealId));
    const amountInput = document.getElementById('paymentAmountInput');
    const methodSelect = document.getElementById('paymentMethodSelect');
    const reasonInput = document.getElementById('paymentReasonInput');
    const amount = toMoneyNumber(amountInput?.value, 0);
    const f = getDealFinancials(deal);
    const selectedMethod = getPaymentMethods().find(method => String(method.id) === String(methodSelect?.value));

    if (!deal || amount <= 0) {
        alert("Введите сумму оплаты");
        return;
    }
    if (amount - f.debt > 0.009) {
        alert("Сумма оплаты больше долга");
        return;
    }

    const originalText = btn?.innerText || "";
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Сохраняем...";
    }

    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                action: 'addPayment',
                hp: document.getElementById("honey_field")?.value || "",
                dealId: dealId,
                amount: amount,
                paymentMethodId: selectedMethod?.id ?? null,
                method: selectedMethod?.name || methodSelect?.selectedOptions?.[0]?.text || "",
                reason: reasonInput?.value?.trim() || "",
                staffId: currentUser.crmId || null
            })
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        if (!response.ok) throw new Error("Ошибка добавления оплаты");

        let data = null;
        try { data = await response.json(); } catch (e) {}

        const updatedDeal = mergeDealAfterPayment(deal, data, amount);
        dealsCache.set(String(dealId), updatedDeal);
        saveOpenDealState(updatedDeal);

        closePaymentModal();
        refreshPaymentBlock(dealId);

        fetchDealDetails(dealId, { silent401: true }).then((freshDeal) => {
            if (!freshDeal) return;
            dealsCache.set(String(dealId), freshDeal);
            saveOpenDealState(freshDeal);
            refreshPaymentBlock(dealId);
        });
    } catch (e) {
        alert("Не удалось добавить оплату");
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
}

function renderDealTabTitle(tabBtn, dealId, dealNum) {
    const shortTitle = `№${dealNum || dealId}`;
    if (tabBtn) {
        tabBtn.innerHTML = `${escapeHtml(shortTitle)} <span class="tab-close-btn" onclick="event.stopPropagation(); closeDealTab()" title="Закрыть вкладку">&times;</span>`;
    }
    return shortTitle;
}

function renderDealCrmButton(deal, extraClass = "") {
    if (currentUser.role !== 'staff') return "";
    return `<button type="button" class="deal-action-btn deal-crm-btn ${extraClass}" onclick="openCrmDealUrl(${deal.id})" title="Открыть заказ в CRM" aria-label="Открыть заказ в CRM">↗</button>`;
}

function renderDealActionButtonsLeft(deal) {
    if (currentUser.role !== 'staff') return "";

    const contact = deal.client_contact_person || {};
    const hasContact = contact.telephone || contact.email || contact.name;
    const contactBtn = hasContact
        ? `<button type="button" class="deal-action-btn" onclick="event.stopPropagation(); showDealContactInfo(${deal.id}, this)" title="Контакты клиента" aria-label="Контакты клиента">👤</button>`
        : "";
    const createBtn = `<button type="button" class="deal-action-btn deal-create-btn" onclick="event.stopPropagation(); showCreateDealConfirm(${deal.id}, this)" title="Добавить новую сделку" aria-label="Добавить новую сделку">＋</button>`;

    return `<span class="deal-action-group">${contactBtn}${createBtn}${renderDealCrmButton(deal)}</span>`;
}

function renderDealActionButtons(deal, isDetailMode = false) {
    if (currentUser.role !== 'staff') return "";
    if (isDetailMode) return "";

    return `${renderDealCrmButton(deal)}<button type="button" class="deal-action-btn deal-create-btn" onclick="event.stopPropagation(); showCreateDealConfirm(${deal.id}, this)" title="Добавить новую сделку" aria-label="Добавить новую сделку">＋</button>`;
}

function renderDealDetailView(deal, detailContainer, tabBtn = null) {
    if (!detailContainer || !deal) return false;

    renderDealTabTitle(tabBtn, deal.id, deal.num);
    saveOpenDealState(deal);
    detailContainer.innerHTML = "";
    renderDealsList([deal], detailContainer, { detailMode: true });
    return true;
}

async function reloadDealTabContent(dealId) {
    const detailContainer = document.getElementById('deal-detail');
    if (!detailContainer || !document.getElementById('deal-tab')) return false;

    detailContainer.innerHTML = `<p class="loader" style="display:block; margin:30px 0;">Обновление заказа...</p>`;

    const fetchToken = ++dealTabFetchToken;
    const freshDeal = await fetchDealDetails(dealId, { silent401: true });
    if (fetchToken !== dealTabFetchToken) return false;

    if (freshDeal) {
        const tabBtn = document.querySelector('.tab-btn[data-tab-target="deal-tab"]');
        return renderDealDetailView(freshDeal, detailContainer, tabBtn);
    }

    detailContainer.innerHTML = `<p style="color:#e67e22; text-align:center; padding:20px;">Не удалось обновить заказ. Проверьте соединение.</p>`;
    return false;
}

function showDealContactInfo(dealId, btn) {
    document.querySelectorAll('.deal-contact-popover').forEach(el => el.remove());

    const deal = dealsCache.get(String(dealId));
    if (!deal) return;

    const contact = deal.client_contact_person || {};
    const phone = contact.telephone || "";
    const email = contact.email || "";
    const name = contact.name || deal.client?.name || deal.client_name || "";
    const position = contact.position || "";

    if (!phone && !email && !name) return;

    const rect = btn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.className = 'deal-contact-popover';
    popover.innerHTML = `
        ${name ? `<div><b>${escapeHtml(name)}</b></div>` : ""}
        ${position ? `<div style="color:#888; font-size:12px; margin-top:2px;">${escapeHtml(position)}</div>` : ""}
        ${phone ? `<div style="margin-top:8px;">📞 <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ""}
        ${email ? `<div style="margin-top:4px;">✉️ <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : ""}`;

    document.body.appendChild(popover);

    const left = Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12);
    popover.style.left = `${Math.max(12, left)}px`;
    popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - popover.offsetHeight - 12)}px`;

    const closePopover = (event) => {
        if (!popover.contains(event.target) && event.target !== btn && !btn.contains(event.target)) {
            popover.remove();
            document.removeEventListener('click', closePopover, true);
        }
    };
    setTimeout(() => document.addEventListener('click', closePopover, true), 0);
}

async function openDealInTab(dealId, options = {}) {
    if (!ensureActiveSession()) return;

    const id = String(dealId);
    const cachedDeal = dealsCache.get(id);
    const fetchToken = ++dealTabFetchToken;
    const tabId = "deal-tab";
    let tabBtn = document.querySelector(`.tab-btn[data-tab-target="${tabId}"]`);
    let tabContent = document.getElementById(tabId);

    if (!tabBtn) {
        tabBtn = document.createElement('button');
        tabBtn.className = 'tab-btn';
        tabBtn.dataset.tabTarget = tabId;
        tabBtn.onclick = () => switchTab(tabId, tabBtn);
        document.querySelector('.tabs-nav')?.appendChild(tabBtn);
    }
    renderDealTabTitle(tabBtn, dealId, cachedDeal?.num);

    if (!tabContent) {
        tabContent = document.createElement('div');
        tabContent.id = tabId;
        tabContent.className = 'tab-content';
        document.body.appendChild(tabContent);
    }

    tabContent.innerHTML = `
        <div class="container">
            <div id="deal-detail">
                <p id="deal-detail-loader" class="loader" style="display:block; margin:30px 0;">Загрузка актуальных данных...</p>
            </div>
        </div>`;

    switchTab(tabId, tabBtn);
    if (options.preserveScroll) {
        requestAnimationFrame(() => window.scrollTo(0, tabScrollPositions[tabId] || 0));
    }

    const freshDeal = await fetchDealDetails(dealId, { silent401: options.preserveScroll === true });
    if (fetchToken !== dealTabFetchToken) return;

    const detailContainer = document.getElementById('deal-detail');
    const activeDealTab = document.getElementById(tabId);
    if (!detailContainer || !activeDealTab) return;

    if (freshDeal) {
        renderDealDetailView(freshDeal, detailContainer, tabBtn);
        return;
    }

    const savedDeal = getSavedOpenDeal(id);
    if (savedDeal) {
        renderDealTabTitle(tabBtn, savedDeal.id, savedDeal.num);
        renderDealDetailView(savedDeal, detailContainer, tabBtn);
        return;
    }

    if (cachedDeal) {
        renderDealTabTitle(tabBtn, cachedDeal.id, cachedDeal.num);
        saveOpenDealState(cachedDeal);
        detailContainer.innerHTML = `
            <p style="color:#e67e22; text-align:center; padding:12px 0 4px;">Не удалось загрузить актуальные данные. Показана версия из поиска.</p>
            <div id="deal-detail-fallback"></div>`;
        renderDealsList([cachedDeal], detailContainer.querySelector('#deal-detail-fallback'), { detailMode: true });
        return;
    }

    detailContainer.innerHTML = `<p style="color:red; text-align:center; padding:30px 20px;">Не удалось загрузить заказ. Проверьте соединение и попробуйте снова.</p>`;
}

function closeDealTab() {
    const tabBtn = document.querySelector('.tab-btn[data-tab-target="deal-tab"]');
    const tabContent = document.getElementById('deal-tab');
    const wasActive = tabContent?.classList.contains('active');

    if (tabContent) tabScrollPositions["deal-tab"] = window.scrollY || window.pageYOffset || 0;
    clearOpenDealState();
    if (tabBtn) tabBtn.remove();
    if (tabContent) tabContent.remove();
    if (wasActive) {
        const fallbackTabId = document.getElementById(lastNonDealTabId) ? lastNonDealTabId : "main-tab";
        const fallbackBtn = document.querySelector(`.tab-btn[data-tab-target="${fallbackTabId}"]`) 
            || document.querySelector(`.tab-btn[onclick*="${fallbackTabId}"]`);
        switchTab(fallbackTabId, fallbackBtn);
    }
}

function showCreateDealConfirm(sourceDealId, btn) {
    if (!sourceDealId || !btn) return;

    document.querySelectorAll('.deal-confirm-popover').forEach(el => el.remove());

    const deal = dealsCache.get(String(sourceDealId));
    const clientName = getDealClientName(deal);
    const rect = btn.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.className = 'deal-confirm-popover';
    popover.innerHTML = `
        <div style="margin-bottom:10px;">Добавить новую сделку для клиента "${escapeHtml(clientName)}"?</div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="confirm-no" style="background:#eef1f5; color:#555;">нет</button>
            <button type="button" class="confirm-yes" style="background:#27ae60; color:white;">да</button>
        </div>`;

    document.body.appendChild(popover);

    const left = Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12);
    popover.style.left = `${Math.max(12, left)}px`;
    popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - popover.offsetHeight - 12)}px`;

    popover.querySelector('.confirm-no').onclick = () => popover.remove();
    popover.querySelector('.confirm-yes').onclick = () => {
        popover.remove();
        createDealFromDeal(sourceDealId, btn);
    };
}

function renderDealsList(deals, targetDiv, options = {}) {
    if (!targetDiv) return;
    targetDiv.innerHTML = ""; 
    const isDetailMode = Boolean(options.detailMode);

    deals.forEach(deal => {
        if (!isValidDeal(deal)) return;
        deal = normalizeDealForView(deal);
        dealsCache.set(String(deal.id), deal);

        const card = document.createElement('div');
        card.className = 'crm-item';
        card.id = `deal-${deal.id}`;

        // 1. Получаем статус основной сделки
        const statusObj = (deal.status && typeof deal.status === "object") ? deal.status : {};
        // Если статуса нет совсем, пишем "Статус не установлен"
        const statusName = statusObj.name || (typeof deal.status === "string" ? deal.status : "") || deal.status_name || deal.status_text || 'Статус не установлен';
        const statusMeta = getStatusMeta(statusName, {
            ...statusObj,
            id: statusObj.id ?? statusObj.status_id ?? deal.status_id ?? deal.statusId
        });
        const isClosed = statusMeta.name.toLowerCase().includes("завершено");
        const statusControl = renderDealStatusControl(deal.id, statusMeta, isClosed);

        // 2. Формируем список товаров
        let elementsHtml = "";
        if (deal.elements && Array.isArray(deal.elements)) {
            elementsHtml = deal.elements.map((e, idx) => {
                const elementStatus = getElementStatusInfo(e);

                return createRowHtml(
                    getElementName(e),
                    getElementQuantity(e),
                    getElementPrice(e),
                    elementStatus.name,
                    false,
                    {
                        dealId: deal.id,
                        element: e,
                        elementIndex: idx,
                        statusObj: elementStatus.statusObj,
                        lineTotal: getElementLineTotal(e),
                        lockStatus: isClosed,
                        detailMode: isDetailMode
                    }
                );
            }).join('');
        }

        const dealLink = isDetailMode
            ? `<span style="font-weight:bold; font-size:16px; color:#2f7df6;">№ ${escapeHtml(deal.num || deal.id)}</span>`
            : `<button type="button" class="deal-num-btn" onclick="openDealInTab(${deal.id})">№ ${escapeHtml(deal.num || deal.id)}</button>`;
        const dealActionButtons = renderDealActionButtons(deal, isDetailMode);
        const dealHeaderHtml = isDetailMode ? `
            <div class="crm-header deal-header-detail">
                <div class="deal-num-line">
                    ${dealLink}
                    ${renderDealActionButtonsLeft(deal)}
                </div>
                <div class="deal-header-side">
                    ${statusControl}
                </div>
            </div>` : `
            <div class="crm-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div class="deal-num" style="font-weight: bold; font-size: 16px;">
                    ${dealLink}
                    ${dealActionButtons}
                </div>
                ${statusControl}
            </div>`;

        card.innerHTML = `
            ${dealHeaderHtml}
            <div class="client-name">👤 ${escapeHtml(deal.client?.name || deal.client_name || 'Клиент не указан')}</div>
            <div class="elements-list">
                <div class="deal-elements-list" data-deal-id="${deal.id}">${elementsHtml}</div>
                ${(currentUser.role === 'staff' && !isClosed) ? `
                <div class="add-btn-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; text-align: left;">
                    <button class="add-btn" onclick="addToDeal(${deal.id}, this)">+ Добавить расчет</button>
                </div>` : ''}
            </div>
            <div class="crm-footer">
                <div class="deal-footer-left">
                    <div class="deal-save-area" data-deal-id="${deal.id}" style="display: none;">
                        <button onclick="saveDeal(${deal.id}, this)" style="margin:0; background:#2f7df6; color:white; padding:6px 12px; border-radius:4px; font-size:13px;">💾 Сохранить</button>
                    </div>
                    ${renderDealFooterMeta(deal)}
                </div>
                ${isDetailMode ? renderPaymentSummary(deal, isClosed) : renderDealTotalOnly(deal)}
            </div>`;
            
        targetDiv.appendChild(card);

        if (isDetailMode && typeof scheduleElementAssetsLoading === "function") {
            scheduleElementAssetsLoading(deal);
        }
    });
}

function createDealCardById(id) {
    if (!id) return null;

    const deal = { id: id, amount: 0, paid: 0, debt: 0 };
    dealsCache.set(String(id), deal);

    const card = document.createElement('div');
    card.className = 'crm-item';
    card.id = `deal-${id}`;
    card.style.borderColor = "#b8d7ff";
    card.style.background = "#f8fbff";

    card.innerHTML = `
        <div class="crm-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div class="deal-num" style="font-weight: bold; font-size: 16px;">
                <a href="https://crm.heavendevelop.ru/editDeal/${id}" target="_blank" style="color: #2f7df6; text-decoration: none;">№ ${id} 🔗</a>
                <small style="font-weight:normal; color:#888; margin-left:8px;">новая сделка</small>
            </div>
            <div class="status-badge" style="background:#eaf3ff; color:#2f7df6;">Новая</div>
        </div>
        <div class="client-name">👤 Новая сделка создана</div>
        <div class="elements-list">
            <div class="deal-elements-list" data-deal-id="${id}"></div>
            <div class="add-btn-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; text-align: left;">
                <button class="add-btn" onclick="addToDeal(${id}, this)">+ Добавить расчет</button>
            </div>
        </div>
        <div class="crm-footer">
            <div class="deal-footer-left">
                <div class="deal-save-area" data-deal-id="${id}" style="display: none;">
                    <button onclick="saveDeal(${id}, this)" style="margin:0; background:#2f7df6; color:white; padding:6px 12px; border-radius:4px; font-size:13px;">💾 Сохранить</button>
                </div>
                ${renderDealFooterMeta(deal)}
            </div>
            ${renderDealTotalOnly(deal)}
        </div>`;

    return card;
}

async function createDealFromDeal(sourceDealId, btn) {
    if (!ensureActiveSession()) return;
    if (!sourceDealId) return;

    const originalHtml = btn ? btn.innerHTML : "";
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "…";
        btn.style.opacity = "0.7";
    }

    try {
        const response = await fetch(N8N_URL, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                action: 'createDeal',
                sourceDealId: sourceDealId,
                staffId: currentUser.crmId || null
            })
        });

        if (!response.ok) throw new Error("Ошибка создания сделки");

        const data = await response.json();
        const newDeal = normalizeDealResponse(data, true);
        if (!newDeal) throw new Error("Сервер не вернул новую сделку");

        const wrapper = document.createElement("div");
        let newCard = null;

        if (isValidDeal(newDeal)) {
            const crmMode = btn?.closest("#search-tab") ? "adv" : "main";
            const targetDiv = btn?.closest(".tab-content")?.querySelector("#crmResults, #advCrmResults") || document.getElementById("crmResults");

            if (getCrmViewMode() === "kanban" && Array.isArray(crmSearchCache[crmMode])) {
                crmSearchCache[crmMode].unshift(newDeal);
                renderDealsResults(crmSearchCache[crmMode], targetDiv);
                targetDiv.querySelector(".kanban-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            } else {
                renderDealsList([newDeal], wrapper);
                newCard = wrapper.firstElementChild;
                if (newCard && targetDiv) {
                    newCard.style.borderColor = "#b8d7ff";
                    newCard.style.background = "#f8fbff";
                    targetDiv.prepend(newCard);
                    newCard.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }
        } else if (newDeal.id) {
            newCard = createDealCardById(newDeal.id);
            const targetDiv = btn?.closest(".tab-content")?.querySelector("#crmResults, #advCrmResults") || document.getElementById("crmResults");
            if (newCard && targetDiv) {
                newCard.style.borderColor = "#b8d7ff";
                newCard.style.background = "#f8fbff";
                targetDiv.prepend(newCard);
                newCard.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    } catch (e) {
        alert("Не удалось создать новую сделку");
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            btn.style.opacity = "1";
        }
    }
}

function addToDeal(id, trigger = null) {
    if (!ensureActiveSession()) return;
    if (!lastCalcData) { alert("Сделайте расчет!"); return; }

    const { list, saveArea } = getDealUiParts(id, trigger);
    if (!list) return;

    const s = window.currentCalcState; // Состояние из n8n
    const row = document.createElement('div'); 
    row.className = 'element-row new-row';
    
    // ВАЖНО: берем значения, которые ПРИШЛИ ОТ СЕРВЕРА (уже округленные)
    const finalTotal = lastCalcData.total;
    const finalPriceOne = lastCalcData.priceOne; // То самое 18.94

    const fullName = lastCalcData.fullName || lastCalcData.name;

    row.setAttribute('data-full-name', fullName); 
    row.setAttribute('data-qty', lastCalcData.qty);
    row.setAttribute('data-cost-total', Math.round(Number(lastCalcData.costTotal ?? s?.totalCost ?? 0)));
    row.setAttribute('data-cost-hq', Math.round(Number(lastCalcData.costHQ ?? lastCalcData.costTotal ?? s?.totalCost ?? 0)));
    row.setAttribute('data-sra3-sheets', Number(lastCalcData.sra3Sheets ?? 0));
    row.setAttribute('data-total-sum', finalTotal); 
    row.setAttribute('data-price-one', finalPriceOne); // Сохраняем готовую строку/число

    row.style.cssText = "padding:6px 8px; border-left:3px solid #8ab8ff; background:#f6f9ff; border-bottom:1px solid #e3ebf7; border-radius:4px; margin:4px 0;";
    row.innerHTML = `
        <span class="element-row-text" style="padding-right:8px;">${escapeHtml(fullName)}, ${lastCalcData.qty} шт</span>
        <span class="element-row-total">${finalTotal.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₽</span>
        <button onclick="this.parentElement.remove(); updateDealTotal(this.closest('.deal-elements-list'));" 
                style="margin:0; width:18px; height:18px; min-width:18px; padding:0; background:#f3d5d5; color:#9b2c2c; border:1px solid #e2b5b5; border-radius:50%; cursor:pointer; font-size:13px; line-height:16px;">×</button>
    `;
    
    list.appendChild(row);
    if (saveArea) saveArea.style.display = "block";
    updateDealTotal(list);
}

async function saveDeal(id, trigger = null) {
    if (!ensureActiveSession()) return;

    const { list, saveArea } = getDealUiParts(id, trigger);
    if (!list) return;

    const rows = list.querySelectorAll('.new-row');
    const btn = saveArea?.querySelector('button');
    
    if (rows.length === 0) return;
    
    btn.innerText = "⏳ Сохранение...";
    btn.disabled = true;

    try {
        for (let r of rows) {
            // Берем значения напрямую из атрибутов (строго как они пришли из n8n)
            const sendPrice = parseFloat(r.getAttribute('data-price-one'));
            const sendTotal = parseFloat(r.getAttribute('data-total-sum'));
            const sendQty = Number(r.getAttribute('data-qty'));
            const sendSra3Sheets = Number(r.getAttribute('data-sra3-sheets'));
            const sendCostTotal = Math.round(Number(r.getAttribute('data-cost-total')));
            const sendCostHQ = Math.round(Number(r.getAttribute('data-cost-hq')));

            const item = { 
                name: r.getAttribute('data-full-name'), 
                quantity: sendQty, 
                total: sendTotal, // Итоговая сумма
                price: sendPrice, // Цена за единицу (теперь точно 18.94)
                cost: sendCostTotal,
                // Доп.поля для n8n: далее на сервере можно сделать PUT в CRM
                sra3_sheets: Number.isFinite(sendSra3Sheets) ? sendSra3Sheets : null,
                cost_total: Number.isFinite(sendCostTotal) ? sendCostTotal : null,
                cost_hq: Number.isFinite(sendCostHQ) ? sendCostHQ : null,
                category_id: 2896, 
                units: "шт" 
            };

            const response = await fetch(N8N_URL, { 
                method: 'POST', 
                headers: authHeaders(), 
                body: JSON.stringify({ 
                    action: 'save', 
                    dealId: id, 
                    item: item
                }) 
            });

            if (!response.ok) throw new Error("Ошибка сервера");
        }

        const savedOnDealTab = Boolean(trigger?.closest('#deal-tab'));
        if (saveArea) saveArea.style.display = "none";

        if (savedOnDealTab) {
            await reloadDealTabContent(id);
        } else {
            rows.forEach(r => {
                r.classList.remove('new-row');
                const delBtn = r.querySelector('button');
                if (delBtn) delBtn.remove();
            });
            alert("Успешно сохранено!");
            updateDealTotal(list);
        }
    } catch (e) { 
        alert("Ошибка при сохранении в CRM"); 
        console.error(e);
    } finally { 
        if (btn) {
            btn.innerText = "💾 Сохранить"; 
            btn.disabled = false;
        }
    }
}

function updateDealTotal(el) {
    let sum = 0;
    el.querySelectorAll('.element-row').forEach(r => {
        const bEl = r.querySelector('b');
        if (bEl && bEl.innerText) {
            const b = bEl.innerText.replace(/\D/g, '');
            if (b) sum += parseInt(b, 10);
            return;
        }

        // Для строк, пришедших из CRM, где нет <b>, берём последнее значение "руб."
        const txt = (r.innerText || "").replace(/\s+/g, ' ');
        const m = txt.match(/(\d[\d\s]*)(?:[.,](\d{1,2}))?\s*руб\./i);
        if (m) {
            const intPart = Number((m[1] || "").replace(/\s+/g, ''));
            const decPart = m[2] ? Number(m[2]) / 100 : 0;
            if (Number.isFinite(intPart)) sum += Math.round(intPart + decPart);
        }
    });
    const id = el.dataset.dealId || el.id?.replace('list-', '');
    const card = el.closest('.crm-item');
    const deal = dealsCache.get(String(id));
    if (deal) {
        const financials = getDealFinancials(deal);
        deal.amount = sum;
        deal.debt = Math.max(0, sum - financials.paid);
        dealsCache.set(String(id), deal);
        if (document.getElementById('deal-tab')) saveOpenDealState(deal);

        const paymentBlock = card?.querySelector('.deal-payment-block');
        if (paymentBlock) {
            refreshPaymentBlock(id, card);
        } else {
            const totalOnlyEl = card?.querySelector('.deal-total-only');
            if (totalOnlyEl) totalOnlyEl.outerHTML = renderDealTotalOnly(deal);
        }
        return;
    }

    const oldTotalEl = card?.querySelector(`#total-${id}`) || document.getElementById(`total-${id}`);
    if (oldTotalEl) oldTotalEl.innerText = sum.toLocaleString();
}

