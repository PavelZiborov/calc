// --- CRM ЛОГИКА ---

// Единый набор иконок (Tabler Icons, outline 2px). Inline-SVG через currentColor —
// иконки наследуют цвет и размер текста, единый стиль вместо разнородных эмодзи.
const ICONS = {
  search: '<path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" />',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />',
  x: '<path d="M18 6l-12 12" /><path d="M6 6l12 12" />',
  user: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />',
  copy: '<path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666" /><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />',
  edit: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />',
  eye: '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />',
  trash: '<path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />',
  link: '<path d="M9 15l6 -6" /><path d="M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464" /><path d="M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463" />',
  clip: '<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5" />',
  mail: '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" />',
  telegram: '<path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />',
  bellOff: '<path d="M9.346 5.353c.21 -.129 .428 -.246 .654 -.353a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3m-1 3h-13a4 4 0 0 0 2 -3v-3a6.996 6.996 0 0 1 1.273 -3.707" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /><path d="M3 3l18 18" />',
  alert: '<path d="M12 9v4" /><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /><path d="M12 16h.01" />',
  check: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /><path d="M9 12l2 2l4 -4" />',
  box: '<path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5" /><path d="M12 12l8 -4.5" /><path d="M12 12l0 9" /><path d="M12 12l-8 -4.5" /><path d="M16 5.25l-8 4.5" />',
  photo: '<path d="M15 8h.01" /><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" /><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" /><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />',
  loader: '<path d="M12 3a9 9 0 1 0 9 9" />',
  send: '<path d="M10 14l11 -11" /><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />',
  filter: '<path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227" />',
  list: '<path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" />',
  kanban: '<path d="M4 4l6 0" /><path d="M14 4l6 0" /><path d="M4 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -8" /><path d="M14 10a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2l0 -2" />',
  printer: '<path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" /><path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" /><path d="M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4" />',
  scissors: '<path d="M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M8.6 8.6l10.4 10.4" /><path d="M8.6 15.4l10.4 -10.4" />',
  circle: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />',
  eyeOff: '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" />',
  file: '<path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" />',
  phone: '<path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2" />',
  save: '<path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" />',
  camera: '<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" /><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />'
};

// Возвращает inline-SVG иконки. opts: { cls, spin, size } (size в px переопределяет 1.1em).
function icon(name, opts = {}) {
  const paths = ICONS[name];
  if (!paths) return '';
  const cls = 'icn' + (opts.spin ? ' icn-spin' : '') + (opts.cls ? ' ' + opts.cls : '');
  const sizeStyle = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${sizeStyle}>${paths}</svg>`;
}

// Закрытие модалок по клику на фон — но НЕ когда выделяешь текст в поле и
// случайно отпускаешь мышь за пределами окна (drag-out). Закрываем только если
// И нажатие (mousedown), И клик пришлись на сам оверлей (фон), а не на содержимое.
// Использование: на оверлее onmousedown="overlayDown(event)"
//                          onclick="if(overlayClickedSelf(event)) closeX()"
let _overlayDownTarget = null;
function overlayDown(event) { _overlayDownTarget = event.target; }
function overlayClickedSelf(event) {
    const onSelf = event.target === event.currentTarget && _overlayDownTarget === event.currentTarget;
    _overlayDownTarget = null;
    return onSelf;
}

function collectAdvSearchParams() {
    const input = document.getElementById("advSearchInput");
    const q = input ? input.value : "";

    const selectedStatusInputs = Array.from(document.querySelectorAll('#advStatusList input[type="checkbox"]:checked:not([data-preset])'));
    const openDealsFilterActive = isAdvOpenDealsFilterActive();
    let selectedStatuses;
    let selectedStatusNames;
    if (openDealsFilterActive) {
        const openStatuses = getOpenCrmDealStatuses();
        selectedStatuses = openStatuses.map(status => status.id);
        selectedStatusNames = openStatuses.map(status => status.name);
    } else {
        selectedStatuses = selectedStatusInputs
            .map(input => Number(input.value))
            .filter(Number.isInteger);
        selectedStatusNames = selectedStatusInputs.map(input => input.dataset.name || "");
    }

    const selectedManagerInputs = Array.from(document.querySelectorAll('#advManagerList input[type="checkbox"]:checked'));
    const selectedManagers = selectedManagerInputs
        .map(input => Number(input.value))
        .filter(Number.isFinite);
    const selectedManagerNames = selectedManagerInputs.map(input => input.dataset.name || "");

    const filters = {
        status: selectedStatuses,
        statusNames: selectedStatusNames,
        managers: selectedManagers,
        managerNames: selectedManagerNames,
        dateFrom: formatDateForWebhook(document.getElementById("advDateFrom")?.value || ""),
        dateTo: formatDateForWebhook(document.getElementById("advDateTo")?.value || ""),
        openDealsOnly: openDealsFilterActive,
        unpaidOnly: isAdvUnpaidFilterActive()
    };

    return {
        q,
        filters,
        fingerprint: JSON.stringify({ q, filters })
    };
}

function saveAdvSearchUiState() {
    if (currentUser.role !== "staff") return;
    try {
        const { q, filters } = collectAdvSearchParams();
        localStorage.setItem(ADV_SEARCH_UI_STATE_KEY, JSON.stringify({
            q,
            filters,
            dateFrom: document.getElementById("advDateFrom")?.value || "",
            dateTo: document.getElementById("advDateTo")?.value || "",
            viewMode: getCrmViewMode(),
            listPage: advSearchListPage
        }));
    } catch (_) {}
}

function restoreAdvSearchUiState() {
    if (currentUser.role !== "staff") return false;

    let state;
    try {
        state = JSON.parse(localStorage.getItem(ADV_SEARCH_UI_STATE_KEY) || "null");
    } catch (_) {
        return false;
    }
    if (!state || typeof state !== "object") return false;

    const searchInput = document.getElementById("advSearchInput");
    if (searchInput && state.q != null) searchInput.value = state.q;
    updateAdvSearchClearBtn();

    document.querySelectorAll('#advStatusList input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });
    document.querySelectorAll('#advManagerList input[type="checkbox"]').forEach(input => {
        input.checked = false;
    });

    const filters = state.filters || {};
    if (filters.openDealsOnly) {
        const openFilter = document.querySelector('#advStatusList input[data-preset="open-deals"]');
        if (openFilter) openFilter.checked = true;
    } else if (Array.isArray(filters.status)) {
        filters.status.forEach(id => {
            const input = document.querySelector(`#advStatusList input[type="checkbox"][value="${CSS.escape(String(id))}"]`);
            if (input) input.checked = true;
        });
    }

    if (Array.isArray(filters.managers)) {
        filters.managers.forEach(id => {
            const input = document.querySelector(`#advManagerList input[type="checkbox"][value="${CSS.escape(String(id))}"]`);
            if (input) input.checked = true;
        });
    }

    const unpaidBox = document.getElementById("advUnpaidOnly");
    if (unpaidBox) unpaidBox.checked = Boolean(filters.unpaidOnly);

    const dateFromEl = document.getElementById("advDateFrom");
    const dateToEl = document.getElementById("advDateTo");
    calendarRangeStart = state.dateFrom || "";
    calendarRangeEnd = state.dateTo || "";
    if (dateFromEl) dateFromEl.value = calendarRangeStart;
    if (dateToEl) dateToEl.value = calendarRangeEnd;
    if (calendarRangeStart) {
        const parsed = new Date(calendarRangeStart);
        if (!Number.isNaN(parsed.getTime())) calendarMonth = parsed;
    }

    if (state.viewMode === "kanban" || state.viewMode === "list") {
        localStorage.setItem(CRM_VIEW_STORAGE_KEY, state.viewMode);
    }
    if (Number.isFinite(Number(state.listPage)) && Number(state.listPage) > 0) {
        advSearchListPage = Number(state.listPage);
    }

    if (typeof renderCalendar === "function") renderCalendar();
    updateAdvFilterUi();
    return true;
}

function saveAdvKanbanScrollState() {
    const board = document.querySelector("#advCrmResults .crm-kanban-board");
    if (board) advKanbanBoardScrollLeft = board.scrollLeft;
}

function restoreAdvKanbanScrollState() {
    const board = document.querySelector("#advCrmResults .crm-kanban-board");
    if (!board) return;
    board.scrollLeft = advKanbanBoardScrollLeft;
    requestAnimationFrame(() => {
        board.scrollLeft = advKanbanBoardScrollLeft;
    });
}

function syncAdvSearchCacheFromDealsCache() {
    if (!Array.isArray(crmSearchCache.adv)) return;
    const refreshed = crmSearchCache.adv.map(deal => {
        const fresh = dealsCache.get(String(deal.id));
        return fresh ? { ...deal, ...fresh } : deal;
    });
    crmSearchCache.adv = refreshed;
    const viewMode = getCrmViewMode();
    if (viewMode === "kanban") {
        advSearchKanbanCache = refreshed;
    } else {
        advSearchListCache = refreshed;
    }
}

function restoreAdvSearchFromCache() {
    const viewMode = getCrmViewMode();
    const cached = getAdvSearchViewCache(viewMode);
    if (cached !== null) {
        crmSearchCache.adv = cached;
    }
    syncAdvSearchCacheFromDealsCache();
    rerenderCrmResultsFromCache("adv", { restoreKanbanScroll: true });
    applyCrmViewLayoutClass();
}

function runAdvSearchOnTabOpen() {
    if (currentUser?.role !== "staff") return;
    if (!document.getElementById("search-tab")?.classList.contains("active")) return;

    const { fingerprint } = collectAdvSearchParams();
    const viewMode = getCrmViewMode();
    const cachedDeals = getAdvSearchViewCache(viewMode);
    const cacheFingerprint = viewMode === "kanban" ? advKanbanCacheFingerprint : advListCacheFingerprint;
    const hasCachedResults = cachedDeals !== null;
    const filtersUnchanged = advSearchFiltersFingerprint === fingerprint && cacheFingerprint === fingerprint;

    if (hasCachedResults && filtersUnchanged) {
        restoreAdvSearchFromCache();
        return;
    }

    searchCRM("adv", null, {
        kanbanMode: viewMode === "kanban",
        page: viewMode === "kanban" ? 1 : advSearchListPage,
        silentBtn: true
    });
}

function parseSearchResponse(data) {
    let payload = data;

    if (Array.isArray(payload)) {
        if (payload[0]?.json && payload[0].json.items) {
            payload = payload[0].json;
        } else if (payload.length === 1 && payload[0]?.items) {
            payload = payload[0];
        } else if (payload[0]?.json) {
            const deals = payload.map(item => item.json).filter(Boolean);
            return { deals, page: 1, pagesCount: 1 };
        }
    }

    if (payload && Array.isArray(payload.items)) {
        return {
            deals: payload.items,
            page: Number(payload.page) || 1,
            pagesCount: Math.max(1, Number(payload.pages_count ?? payload.pagesCount) || 1)
        };
    }

    let deals = Array.isArray(payload) ? payload : (payload?.items || (payload ? [payload] : []));
    if (deals[0]?.json) deals = deals.map(item => item.json);
    return { deals, page: 1, pagesCount: 1 };
}

function getCompletedCrmDealStatusIds() {
    return getCrmStatuses().filter(isCompletedCrmDealStatus).map(status => status.id);
}

function getAdvSearchViewCache(mode) {
    return mode === "kanban" ? advSearchKanbanCache : advSearchListCache;
}

function setAdvSearchViewCache(mode, deals, fingerprint) {
    if (mode === "kanban") {
        advSearchKanbanCache = deals;
        advKanbanCacheFingerprint = fingerprint;
    } else {
        advSearchListCache = deals;
        advListCacheFingerprint = fingerprint;
    }
    crmSearchCache.adv = deals;
}

async function searchCRM(mode, triggerEvent, options = {}) {
    if (!ensureActiveSession()) return;

    const resId = mode === 'main' ? 'crmResults' : 'advCrmResults';
    const loadId = mode === 'main' ? 'crmLoader' : 'advCrmLoader';
    const resDiv = document.getElementById(resId);
    const load = document.getElementById(loadId);
    
    const evt = triggerEvent ?? (typeof event !== "undefined" ? event : null);
    // silentBtn: программный вызов (переключение вкладок/вида) — не трогаем кнопку
    // поиска и НЕ блокируемся её кулдауном (после поиска она disabled ~1 сек;
    // ранний return здесь оставлял на экране старый вид — список вместо канбана).
    const btn = options.silentBtn
        ? null
        : (evt?.target?.tagName === 'BUTTON' ? evt.target : document.querySelector(`button[onclick="searchCRM('${mode}')"]`));
    if (btn && btn.disabled) return;
    const originalBtnText = btn ? btn.innerHTML : "";

    let q = "";
    let advFilters = {};
    let advFingerprint = "";
    if (mode === "adv") {
        const advParams = collectAdvSearchParams();
        q = advParams.q;
        advFilters = advParams.filters;
        advFingerprint = advParams.fingerprint;
    } else if (currentUser.role === "staff") {
        const input = document.getElementById("crmSearchInput");
        q = input ? input.value : "";
    }

    const advKanbanMode = mode === "adv" && (options.kanbanMode === true || (options.kanbanMode == null && getCrmViewMode() === "kanban"));
    const isExplicitPage = options.page != null;
    if (mode === "adv" && !advKanbanMode && !isExplicitPage) {
        advSearchListPage = 1;
    }
    const requestedPage = Math.max(1, Number(options.page) || advSearchListPage || 1);
    if (mode === "adv" && !advKanbanMode) {
        advSearchListPage = requestedPage;
    }

    resDiv.innerHTML = "";
    load.style.display = "block";
    
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = icon("loader", { spin: true });
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
            if (advKanbanMode) {
                searchPayload.kanbanMode = true;
                searchPayload.completedStatusIds = getCompletedCrmDealStatusIds();
                searchPayload.openStatusIds = getOpenCrmDealStatuses().map(status => status.id);
            } else {
                searchPayload.page = requestedPage;
            }
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

        const parsed = parseSearchResponse(data);
        let deals = parsed.deals.filter(isValidDeal);

        if (mode === "adv" && !advKanbanMode) {
            advSearchPagesCount = parsed.pagesCount;
            advSearchListPage = parsed.page || requestedPage;
        }

        if (!deals || deals.length === 0) {
            if (mode === "adv") {
                setAdvSearchViewCache(advKanbanMode ? "kanban" : "list", [], advFingerprint);
            } else {
                crmSearchCache[mode] = [];
            }
            resDiv.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Список заказов пуст</p>";
            if (mode === "adv" && !advKanbanMode) {
                renderAdvSearchPagination(resDiv);
            }
        } else {
            if (mode === "adv") {
                setAdvSearchViewCache(advKanbanMode ? "kanban" : "list", deals, advFingerprint);
            } else {
                crmSearchCache[mode] = deals;
            }
            renderDealsResults(deals, resDiv);
        }

        if (mode === "adv") {
            advSearchFiltersFingerprint = advFingerprint;
            saveAdvSearchUiState();
            if (!options.keepKanbanScroll) {
                advKanbanBoardScrollLeft = 0;
            }
        }

    } catch (e) {
        resDiv.innerHTML = `<p style="color:red; text-align:center;">Ошибка соединения</p>`;
    } finally {
        load.style.display = "none";
        // Разблокировка кнопки поиска через 1 секунду
        if (btn) {
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = originalBtnText || icon("search");
            }, 1000);
        }
    }
}

function goToAdvSearchPage(page) {
    const nextPage = Math.max(1, Number(page) || 1);
    if (nextPage === advSearchListPage && advSearchListCache) {
        crmSearchCache.adv = advSearchListCache;
        rerenderCrmResultsFromCache("adv");
        return;
    }
    searchCRM("adv", null, { page: nextPage, kanbanMode: false });
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
        id: knownStatus?.id ?? (Number.isFinite(Number(statusObj.id ?? statusObj.status_id)) ? Number(statusObj.id ?? statusObj.status_id) : null),
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
    const fallback = getStatusIcon(statusMeta.name);
    const statusIcon = statusMeta.icon || fallback.icon;
    const statusColor = statusMeta.color || fallback.color || "#3a3833";
    const elementId = getElementId(element);

    if (currentUser.role !== 'staff' || isLocked) {
        return `<span class="element-status-cell" title="${escapeHtml(statusMeta.name)}" style="cursor: help; margin-right: 12px; font-size: 18px; min-width: 24px; text-align: center; color:${statusColor};">${statusIcon}</span>`;
    }

    return `<button type="button" class="item-status-control element-status-cell" data-status-scope="element" data-deal-id="${dealId}" data-element-id="${escapeHtml(elementId)}" data-element-index="${elementIndex}" onclick="showStatusMenu(event, this)" title="${escapeHtml(statusMeta.name)}" style="color:${statusColor};">${statusIcon}</button>`;
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

    // Завершение сделки (в т.ч. перетаскиванием в канбане) — подтверждаем.
    // false → канбан вернёт карточку в исходную колонку.
    if (isCompletedCrmDealStatus(status)) {
        const confirmed = await confirmDealCompletion(dealId);
        if (!confirmed) return false;
    }

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

        if (Number(status.id) === DEAL_STATUS_READY) {
            markAllElementsCompleted(dealId);
        }
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
            const meta = getStatusIcon(status.name);
            // иконка статуса — SVG-разметка → innerHTML (НЕ innerText, иначе виден «<svg…»).
            control.innerHTML = status.icon || meta.icon;
            control.style.color = status.color || meta.color || "#3a3833";
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

    if (menu) menu.remove();

    // Завершение сделки — спрашиваем подтверждение, чтобы не закрыть заказ случайно
    if (scope === "deal" && isCompletedCrmDealStatus(status)) {
        const confirmed = await confirmDealCompletion(dealId, trigger);
        if (!confirmed) return;
    }

    trigger.disabled = true;

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

        // Авто-уведомление о готовности при переводе СДЕЛКИ в «Заказ готов».
        if (scope === "deal" && Number(status.id) === DEAL_STATUS_READY) {
            markAllElementsCompleted(dealId);
        }
    } catch (e) {
        alert("Не удалось обновить статус");
        console.error(e);
    } finally {
        trigger.disabled = false;
    }
}

function isCompletedCrmDealStatus(status) {
    return String(status?.name || "").trim().toLowerCase() === "завершено";
}

function getOpenCrmDealStatuses() {
    return getCrmStatuses().filter(status => !isCompletedCrmDealStatus(status));
}

function isAdvOpenDealsFilterActive() {
    return Boolean(document.querySelector('#advStatusList input[data-preset="open-deals"]:checked'));
}

// Фильтр «только неоплаченные» (без единой оплаты)
function isAdvUnpaidFilterActive() {
    return Boolean(document.getElementById("advUnpaidOnly")?.checked);
}
function isDealUnpaid(deal) {
    const f = getDealFinancials(deal);
    return Number(f.paid) <= 0.009;
}
function onAdvUnpaidToggle() {
    updateAdvFilterUi();
}

// Саммари по набору сделок: всего / оплачено / не оплачено (долг)
function summarizeDeals(deals) {
    let total = 0, paid = 0, debt = 0;
    (Array.isArray(deals) ? deals : []).forEach(d => {
        const f = getDealFinancials(d);
        total += Number(f.total) || 0;
        paid += Number(f.paid) || 0;
        debt += Number(f.debt) || 0;
    });
    return { total, paid, debt };
}
// Саммари под списком заказов
function renderDealsListSummary(deals) {
    const s = summarizeDeals(deals);
    return `<div class="crm-list-summary">
        <span class="crm-sum-item"><span class="crm-sum-label">Всего</span><b>${formatMoney(s.total)} ₽</b></span>
        <span class="crm-sum-item"><span class="crm-sum-label">Оплачено</span><b class="crm-sum-paid">${formatMoney(s.paid)} ₽</b></span>
        <span class="crm-sum-item"><span class="crm-sum-label">Не оплачено</span><b class="crm-sum-debt">${formatMoney(s.debt)} ₽</b></span>
    </div>`;
}
// Компактное саммари под колонкой канбана
function renderKanbanColumnSummary(deals) {
    const s = summarizeDeals(deals);
    return `<div class="crm-kanban-column-summary">
        <div class="csum-row"><span>Всего</span><b>${formatMoney(s.total)} ₽</b></div>
        <div class="csum-row"><span>Оплачено</span><b class="crm-sum-paid">${formatMoney(s.paid)} ₽</b></div>
        <div class="csum-row"><span>Не оплачено</span><b class="crm-sum-debt">${formatMoney(s.debt)} ₽</b></div>
    </div>`;
}

function onAdvStatusFilterChange(event) {
    const target = event?.target;
    if (target?.type === "checkbox") {
        if (target.dataset.preset === "open-deals") {
            if (target.checked) {
                document.querySelectorAll('#advStatusList input[type="checkbox"]:not([data-preset])').forEach(input => {
                    input.checked = false;
                });
            }
        } else if (target.checked) {
            const openFilter = document.querySelector('#advStatusList input[data-preset="open-deals"]');
            if (openFilter) openFilter.checked = false;
        }
    }
    updateAdvFilterUi();
}

function fillStatusFilter() {
    const list = document.getElementById('advStatusList');
    if (!list) return;

    const presetOption = `
        <label class="status-option status-option-preset">
            <input type="checkbox" data-preset="open-deals" data-name="Все открытые сделки" onchange="onAdvStatusFilterChange(event)">
            <span class="status-color-marker" style="background:#2f7df6;"></span>
            <span class="status-option-name">Все открытые сделки</span>
            <span class="status-checkmark">✓</span>
        </label>
        <div class="status-filter-divider" aria-hidden="true"></div>
    `;

    list.innerHTML = presetOption + getCrmStatuses().map(s => `
        <label class="status-option">
            <input type="checkbox" value="${s.id}" data-name="${s.name}" onchange="onAdvStatusFilterChange(event)">
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
    return statusChecked > 0 || managerChecked > 0 || !!dateFrom || !!dateTo || isAdvUnpaidFilterActive();
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

function closeAdvFilterDropdowns() {
    document.getElementById("advStatusDropdown")?.classList.remove("open");
    document.getElementById("advManagerDropdown")?.classList.remove("open");
    document.getElementById("advDateDropdown")?.classList.remove("open");
}

function onAdvFiltersPopoverClick(event) {
    event.stopPropagation();
    if (event.target.closest(".adv-filters-reset-btn, .adv-filters-apply-btn, .status-dropdown-btn, .date-range-btn")) return;

    document.querySelectorAll("#advFiltersPopover .status-dropdown.open, #advFiltersPopover .date-range-dropdown.open").forEach(dropdown => {
        const panel = dropdown.querySelector(".status-dropdown-list, .date-range-panel");
        if (panel && !panel.contains(event.target)) {
            dropdown.classList.remove("open");
        }
    });
}

function resetAdvFiltersPopoverPosition() {
    const popover = document.getElementById("advFiltersPopover");
    if (!popover) return;
    popover.style.position = "";
    popover.style.left = "";
    popover.style.right = "";
    popover.style.top = "";
    popover.style.bottom = "";
    popover.style.width = "";
    popover.style.maxHeight = "";
    popover.style.overflowY = "";
}

function positionAdvFiltersPopover() {
    const popover = document.getElementById("advFiltersPopover");
    const header = document.querySelector(".adv-search-header");
    const wrap = document.getElementById("advFiltersPopoverWrap");
    if (!popover || !header || !wrap?.classList.contains("open")) return;

    if (!window.matchMedia("(max-width: 600px)").matches) {
        resetAdvFiltersPopoverPosition();
        return;
    }

    const pad = 12;
    const gap = 6;
    const headerRect = header.getBoundingClientRect();
    const isBottomBar = document.body.classList.contains("crm-kanban-active")
        && window.matchMedia("(max-width: 875px)").matches;

    popover.style.position = "fixed";
    popover.style.left = `${pad}px`;
    popover.style.right = `${pad}px`;
    popover.style.width = "auto";
    popover.style.overflowY = "auto";

    if (isBottomBar) {
        const bottom = Math.round(window.innerHeight - headerRect.top + gap);
        popover.style.top = "auto";
        popover.style.bottom = `${bottom}px`;
        popover.style.maxHeight = `calc(${headerRect.top - pad}px)`;
    } else {
        const top = Math.round(headerRect.bottom + gap);
        popover.style.top = `${top}px`;
        popover.style.bottom = "auto";
        popover.style.maxHeight = `calc(100dvh - ${top + pad}px)`;
    }
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

    if (willOpen) {
        requestAnimationFrame(() => positionAdvFiltersPopover());
    } else {
        closeAdvFilterDropdowns();
        resetAdvFiltersPopoverPosition();
    }
}

function closeAdvFiltersPopover() {
    document.getElementById("advFiltersPopoverWrap")?.classList.remove("open");
    document.getElementById("advFiltersBtn")?.setAttribute("aria-expanded", "false");
    closeAdvFilterDropdowns();
    resetAdvFiltersPopoverPosition();
}

function applyAdvFilters(e) {
    e?.stopPropagation();
    closeAdvFilterDropdowns();
    closeAdvFiltersPopover();
    advSearchListPage = 1;
    searchCRM("adv", e, { page: 1, kanbanMode: getCrmViewMode() === "kanban" });
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
    if (confirmPopover && !confirmPopover.classList.contains('deal-confirm-popover--await')
        && !confirmPopover.contains(event.target) && !event.target.closest('.deal-create-btn')) {
        confirmPopover.remove();
    }
    if (statusMenu && !statusMenu.contains(event.target) && !event.target.closest('.editable-status, .item-status-control')) {
        statusMenu.remove();
    }
});

function updateStatusDropdownLabel() {
    const btn = document.querySelector('#advStatusDropdown .status-dropdown-btn');
    const selected = Array.from(document.querySelectorAll('#advStatusList input[type="checkbox"]:checked:not([data-preset])'));
    if (!btn) return;

    if (isAdvOpenDealsFilterActive()) {
        btn.innerText = "Все открытые сделки";
    } else if (selected.length === 0) {
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
    const unpaidBox = document.getElementById("advUnpaidOnly");
    if (unpaidBox) unpaidBox.checked = false;
    if (searchInput) searchInput.value = "";
    if (dateFrom) dateFrom.value = "";
    if (dateTo) dateTo.value = "";
    calendarRangeStart = "";
    calendarRangeEnd = "";
    calendarMonth = new Date();
    updateAdvFilterUi();
    renderCalendar();
    updateAdvSearchClearBtn();
    saveAdvSearchUiState();
}

// Крестик в строке поиска: стирает только текст запроса, фильтры не трогает.
function clearAdvSearchText() {
    const input = document.getElementById('advSearchInput');
    if (!input) return;
    input.value = "";
    updateAdvSearchClearBtn();
    saveAdvSearchUiState();
}

// Показываем крестик, только когда в поле есть текст.
function updateAdvSearchClearBtn() {
    const input = document.getElementById('advSearchInput');
    const btn = document.getElementById('advSearchClearBtn');
    if (!input || !btn) return;
    btn.hidden = input.value.length === 0;
}

function clearMainSearch() {
    const input = document.getElementById('crmSearchInput');
    if (input) input.value = "";
}

// Функция для определения иконок и цветов статуса
function getStatusIcon(statusName) {
    const name = (statusName || "").toLowerCase().trim();
    if (!name || name === "без статуса") return { icon: icon("circle"), color: "#95a5a6", label: "Без статуса" };
    if (name === "печать") return { icon: icon("printer"), color: "#2F6BD8", label: "Печать" };
    if (name === "постпечать") return { icon: icon("scissors"), color: "#b06a1f", label: "Постпечать" };
    if (name === "завершено") return { icon: icon("check"), color: "#1F9D55", label: "Завершено" };
    return { icon: icon("box"), color: "#7a766c", label: statusName || "Статус" };
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

    const canDeleteElement = isDetailMode
        && currentUser.role === "staff"
        && !options.lockStatus
        && elementId
        && !isNew;
    const deleteBtnHtml = canDeleteElement
        ? `<button type="button" class="element-row-delete-btn" onclick="requestDeleteDealElement(event, ${options.dealId}, ${elementId}, ${options.elementIndex || 0})" title="Удалить позицию" aria-label="Удалить позицию">×</button>`
        : (isNew
            ? `<button type="button" class="element-row-delete-btn" onclick="this.parentElement.remove(); updateDealTotal(this.closest('.deal-elements-list'));" title="Удалить" aria-label="Удалить">×</button>`
            : "");

    const units = escapeHtml(getElementUnits(options.element || {}));
    // Компактная строка для мобильных (как было): «название, кол-во ед., цена руб.».
    const compactText = `${escapeHtml(name)}, ${q} ${units}, ${p} руб.`;

    // Десктопные столбцы (только детальная карточка заказа): название | количество | себестоимость.
    let desktopColsHtml = "";
    if (isDetailMode) {
        const nameColClass = canOpenEditor
            ? "element-row-name element-row-col element-row-text-clickable"
            : "element-row-name element-row-col";
        let costColHtml = "";
        if (currentUser.role === "staff") {
            const cost = typeof getElementCost === "function" ? getElementCost(options.element || {}) : null;
            costColHtml = renderElementCostCell(cost);
        }
        desktopColsHtml = `
            <span class="${nameColClass}"${textClick}>${escapeHtml(name)}</span>
            <span class="element-row-qty element-row-col">${q} ${units}</span>
            ${costColHtml}`;
    }

    // Второстепенные данные под строкой позиции (только карточка заказа, staff):
    // «Себ. HQ» и «Листов SRA3» — показываем только те, что реально заполнены.
    const metaHtml = renderElementRowMeta(options.element || {}, isDetailMode, isNew);

    return `
        <div class="element-row ${isNew ? 'new-row' : ''}" data-price="${rowTotal}"${rowAttrs}>
            ${statusControl}
            ${thumbHtml}
            <span class="${textClass}"${textClick}>${compactText}</span>
            ${desktopColsHtml}
            <span class="element-row-total">${rowTotal.toLocaleString('ru-RU', {minimumFractionDigits: 2})}<span class="rub-suffix"> руб.</span></span>
            ${deleteBtnHtml}
        </div>${metaHtml}`;
}

// Доп.поля позиций (Себ. HQ / SRA3) приезжают батчем ПОСЛЕ рендера карточки
// (prefetchElementFieldsBatch → applyElementFieldsToDeal). Этот хелпер дорисовывает
// мета-строки в уже отрисованной карточке, когда данные появились в dealsCache.
function refreshElementRowMetas(dealId) {
    const deal = dealsCache.get(String(dealId));
    if (!deal || !Array.isArray(deal.elements)) return;

    // На странице может быть несколько .deal-elements-list с этим data-deal-id
    // (карточка в результатах поиска И открытая деталь). Мета-строки живут только
    // в detail-режиме (там у строк есть data-element-id), поэтому обходим ВСЕ списки.
    document.querySelectorAll(`.deal-elements-list[data-deal-id="${CSS.escape(String(dealId))}"]`).forEach(list => {
        list.querySelectorAll('.element-row[data-element-id]').forEach(row => {
            const element = deal.elements.find(el => String(getElementId(el)) === String(row.dataset.elementId));
            if (!element) return;

            const html = renderElementRowMeta(element, true, false);
            const next = row.nextElementSibling;
            const existing = (next && next.classList.contains("element-row-meta")) ? next : null;
            if (html) {
                if (existing) existing.outerHTML = html;
                else row.insertAdjacentHTML("afterend", html);
            } else if (existing) {
                existing.remove();
            }
        });
    });
}

// Мелкая строка под позицией: Листов SRA3 · Себ. HQ. Пусто, если данных нет.
// «Себ. HQ» — денежное значение, скрыто под маской (тот же глазик, что и у
// себестоимости): раскрывается классом .costs-hidden на .elements-list.
// «Листов SRA3» — не чувствительно, видно всегда.
function renderElementRowMeta(element, isDetailMode, isNew) {
    if (!isDetailMode || isNew || currentUser.role !== "staff") return "";

    const costHq = typeof getElementCostHq === "function" ? getElementCostHq(element) : null;
    const sheets = typeof getElementSra3Sheets === "function" ? getElementSra3Sheets(element) : null;

    const parts = [];
    if (sheets != null) {
        parts.push(`Листов SRA3: <b>${sheets}</b>`);
    }
    if (costHq != null) {
        const num = Math.round(costHq).toLocaleString('ru-RU');
        parts.push(`Себ. HQ: <b class="meta-hq"><span class="cost-val">${num} ₽</span><span class="cost-mask">•••••</span></b>`);
    }
    if (!parts.length) return "";

    return `<div class="element-row-meta">${parts.join(" · ")}</div>`;
}

// Ячейка себестоимости (десктоп): значение под маской (скрыто по умолчанию) либо явный
// индикатор «не указана», если себестоимость не заполнена.
function renderElementCostCell(cost) {
    if (cost == null) {
        return `<span class="element-row-cost element-row-col is-empty" title="Себестоимость не заполнена">не указана</span>`;
    }
    const num = Math.round(cost).toLocaleString('ru-RU');
    return `<span class="element-row-cost element-row-col"><span class="cost-val">${num}</span><span class="cost-mask">•••••</span></span>`;
}

// Видимость себестоимости (глобально, по умолчанию скрыто). Хранится в localStorage.
let dealCostsVisible = (function () {
    try { return localStorage.getItem("calc_costs_visible") === "1"; } catch (_) { return false; }
})();

function applyDealCostsVisibility() {
    document.querySelectorAll(".elements-list").forEach(el => {
        el.classList.toggle("costs-hidden", !dealCostsVisible);
    });
    document.querySelectorAll(".cost-eye-btn").forEach(btn => {
        btn.innerHTML = dealCostsVisible ? icon("eyeOff") : icon("eye");
        btn.setAttribute("aria-pressed", dealCostsVisible ? "true" : "false");
        btn.title = dealCostsVisible ? "Скрыть себестоимость" : "Показать себестоимость";
    });
}

function toggleDealCosts(event) {
    event?.stopPropagation?.();
    dealCostsVisible = !dealCostsVisible;
    try { localStorage.setItem("calc_costs_visible", dealCostsVisible ? "1" : "0"); } catch (_) {}
    applyDealCostsVisibility();
}

// Шапка столбцов над списком позиций (только десктоп, детальная карточка — скрывается через CSS).
// Себестоимость и хвостовая ячейка-распорка (под кнопку удаления) — только для staff в открытой сделке.
function renderElementColsHeader(options = {}) {
    const isStaff = currentUser.role === "staff";
    const hasDeleteCol = isStaff && !options.isClosed;
    const eyeIcon = dealCostsVisible ? icon("eyeOff") : icon("eye");
    const eyeTitle = dealCostsVisible ? "Скрыть себестоимость" : "Показать себестоимость";
    const costHead = isStaff
        ? `<span class="ecol ecol-cost">Себес.<button type="button" class="cost-eye-btn" onclick="toggleDealCosts(event)" title="${eyeTitle}" aria-pressed="${dealCostsVisible ? "true" : "false"}" aria-label="${eyeTitle}">${eyeIcon}</button></span>`
        : "";
    const actionsSpacer = hasDeleteCol ? `<span class="ecol ecol-actions"></span>` : "";

    return `
        <div class="element-cols-head">
            <span class="ecol ecol-status" title="Статус">Статус</span>
            <span class="ecol ecol-thumb" title="Превью">${icon("photo")}</span>
            <span class="ecol ecol-name">Название</span>
            <span class="ecol ecol-qty">Кол-во</span>
            ${costHead}
            <span class="ecol ecol-total">Сумма</span>
            ${actionsSpacer}
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
const ADV_SEARCH_UI_STATE_KEY = "calc_adv_search_ui";
const crmSearchCache = { main: null, adv: null };
let advSearchFiltersFingerprint = null;
let advSearchListPage = 1;
let advSearchPagesCount = 1;
let advSearchListCache = null;
let advSearchKanbanCache = null;
let advListCacheFingerprint = null;
let advKanbanCacheFingerprint = null;
let advKanbanBoardScrollLeft = 0;
let kanbanColumnOrderCache = null;
let kanbanColumnOrderSaveTimer = null;
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

function getStaffPrefsUserKey() {
    if (currentUser?.role !== "staff") return null;
    const id = currentUser?.crmId ?? currentUser?.login ?? currentUser?.id;
    return id ? String(id) : null;
}

function unwrapUserPrefsPayload(data) {
    let payload = data;
    if (Array.isArray(payload)) payload = payload[0]?.json ?? payload[0];
    if (payload?.json && typeof payload.json === "object") payload = payload.json;
    if (payload?.body && typeof payload.body === "object") payload = payload.body;
    if (payload?.userPrefs && typeof payload.userPrefs === "object") payload = payload.userPrefs;
    if (payload?.prefs && typeof payload.prefs === "object") payload = payload.prefs;
    return payload && typeof payload === "object" ? payload : {};
}

function normalizeKanbanColumnOrderKeys(keys) {
    if (!Array.isArray(keys)) return [];
    return keys.map(String).filter(Boolean);
}

function getKanbanColumnOrderStorageKey() {
    const userKey = getStaffPrefsUserKey() || "guest";
    return `calc_kanban_col_order_${userKey}`;
}

function applyKanbanColumnOrderCache(keys) {
    kanbanColumnOrderCache = normalizeKanbanColumnOrderKeys(keys);
    if (!kanbanColumnOrderCache.length) return;
    localStorage.setItem(getKanbanColumnOrderStorageKey(), JSON.stringify(kanbanColumnOrderCache));
}

function loadKanbanColumnOrder() {
    if (kanbanColumnOrderCache?.length) return kanbanColumnOrderCache;
    try {
        const raw = localStorage.getItem(getKanbanColumnOrderStorageKey());
        const parsed = raw ? JSON.parse(raw) : [];
        kanbanColumnOrderCache = normalizeKanbanColumnOrderKeys(parsed);
    } catch {
        kanbanColumnOrderCache = [];
    }
    return kanbanColumnOrderCache;
}

function saveKanbanColumnOrder(keys) {
    applyKanbanColumnOrderCache(keys);
    scheduleKanbanColumnOrderServerSave(kanbanColumnOrderCache);
}

function scheduleKanbanColumnOrderServerSave(keys) {
    if (!isKanbanAvailable()) return;
    clearTimeout(kanbanColumnOrderSaveTimer);
    kanbanColumnOrderSaveTimer = setTimeout(() => {
        syncKanbanColumnOrderToServer(keys);
    }, 450);
}

async function syncKanbanColumnOrderToServer(keys) {
    if (!isKanbanAvailable() || !ensureActiveSession({ silent: true })) return;
    const order = normalizeKanbanColumnOrderKeys(keys);
    if (!order.length) return;

    try {
        const response = await fetch(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "saveUserPrefs",
                kanbanColumnOrder: order
            })
        });
        if (response.status === 401) return;
    } catch (e) {
        console.warn("saveUserPrefs failed", e);
    }
}

async function fetchKanbanColumnOrderFromServer() {
    if (!isKanbanAvailable() || !ensureActiveSession({ silent: true })) return loadKanbanColumnOrder();

    try {
        const response = await fetch(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ action: "getUserPrefs" })
        });
        if (response.status === 401) return loadKanbanColumnOrder();
        if (!response.ok) return loadKanbanColumnOrder();

        const prefs = unwrapUserPrefsPayload(await response.json());
        const order = normalizeKanbanColumnOrderKeys(prefs.kanbanColumnOrder);
        if (order.length) {
            applyKanbanColumnOrderCache(order);
            return order;
        }
    } catch (e) {
        console.warn("getUserPrefs failed", e);
    }

    return loadKanbanColumnOrder();
}

async function initStaffUserPrefs() {
    if (!isKanbanAvailable()) return;
    migrateLegacyKanbanColumnOrderStorage();
    await fetchKanbanColumnOrderFromServer();
}

function migrateLegacyKanbanColumnOrderStorage() {
    if (loadKanbanColumnOrder().length) return;
    const legacyKeys = [
        currentUser?.crmId != null ? `calc_kanban_col_order_${currentUser.crmId}` : "",
        currentUser?.login ? `calc_kanban_col_order_${currentUser.login}` : "",
        currentUser?.id != null ? `calc_kanban_col_order_${currentUser.id}` : ""
    ].filter(Boolean);

    for (const key of legacyKeys) {
        if (key === getKanbanColumnOrderStorageKey()) continue;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const order = normalizeKanbanColumnOrderKeys(parsed);
            if (order.length) {
                applyKanbanColumnOrderCache(order);
                scheduleKanbanColumnOrderServerSave(order);
                return;
            }
        } catch {
            // ignore broken legacy cache
        }
    }
}

function applyUserPrefsFromAuth(session) {
    const prefs = unwrapUserPrefsPayload(session?.userPrefs ? { userPrefs: session.userPrefs } : session);
    const order = normalizeKanbanColumnOrderKeys(prefs.kanbanColumnOrder);
    if (order.length) applyKanbanColumnOrderCache(order);
}

function isKanbanPanTarget(target) {
    return !target?.closest(
        ".kanban-card, .crm-kanban-column-header, button, a, input, select, textarea, label.status-option, .kanban-drop-indicator"
    );
}

function bindKanbanBoardPan(board) {
    if (!board || board.dataset.panBound === "1") return;
    board.dataset.panBound = "1";

    const panState = {
        active: false,
        moved: false,
        startX: 0,
        scrollLeft: 0
    };

    const finishPan = () => {
        if (!panState.active) return;
        panState.active = false;
        board.classList.remove("is-panning");
    };

    board.addEventListener("mousedown", (event) => {
        if (event.button !== 0 || !isKanbanPanTarget(event.target)) return;
        panState.active = true;
        panState.moved = false;
        panState.startX = event.pageX;
        panState.scrollLeft = board.scrollLeft;
        board.classList.add("is-panning");
    });

    window.addEventListener("mousemove", (event) => {
        if (!panState.active) return;
        const delta = event.pageX - panState.startX;
        if (Math.abs(delta) > 2) panState.moved = true;
        board.scrollLeft = panState.scrollLeft - delta;
    });

    window.addEventListener("mouseup", finishPan);

    board.addEventListener("click", (event) => {
        if (!panState.moved) return;
        event.preventDefault();
        event.stopPropagation();
        panState.moved = false;
    }, true);

    // Touch scrolling is handled natively by the browser via overflow-x + CSS scroll-snap.
    // Custom touch handlers caused jitter competing with iOS momentum scroll.
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
    const zoomed = localStorage.getItem("kanban_zoom_out") === "1";
    const zoomBtn = document.getElementById("kanbanZoomBtn");
    if (zoomBtn) zoomBtn.classList.toggle("is-active", isKanban && zoomed);
}

function toggleKanbanZoom() {
    const board = document.querySelector(".crm-kanban-board");
    const zoomed = board ? board.classList.toggle("kanban-board--zoomed") : false;
    const zoomBtn = document.getElementById("kanbanZoomBtn");
    if (zoomBtn) zoomBtn.classList.toggle("is-active", zoomed);
    try { localStorage.setItem("kanban_zoom_out", zoomed ? "1" : "0"); } catch (_) {}
}

function rerenderCrmResultsFromCache(mode, options = {}) {
    if (mode !== "adv") return;
    const deals = crmSearchCache.adv;
    const resDiv = document.getElementById("advCrmResults");
    if (!resDiv || deals === null) return;

    if (!deals.length) {
        resDiv.classList.remove("crm-kanban-results-host");
        resDiv.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>Список заказов пуст</p>";
        return;
    }

    renderDealsResults(deals, resDiv);
    if (options.restoreKanbanScroll) {
        restoreAdvKanbanScrollState();
    }
}

// Навигация в шапке: «Заказы» всегда открывает список, «Канбан» — доску.
// Режим задаётся до switchTab, поэтому вкладка сразу рендерится в нужном виде.
function openOrdersView(mode, triggerBtn) {
    if (!isKanbanAvailable()) return;
    const nextMode = mode === "kanban" ? "kanban" : "list";
    localStorage.setItem(CRM_VIEW_STORAGE_KEY, nextMode);
    if (typeof saveAdvSearchUiState === "function") saveAdvSearchUiState();
    syncCrmViewToggleButtons();
    switchTab("search-tab", triggerBtn);
}

function toggleCrmView(mode) {
    if (!isKanbanAvailable()) return;

    const nextMode = mode === "kanban" ? "kanban" : "list";
    if (getCrmViewMode() === nextMode) return;

    localStorage.setItem(CRM_VIEW_STORAGE_KEY, nextMode);
    saveAdvSearchUiState();
    syncCrmViewToggleButtons();
    applyCrmViewLayoutClass();

    const { fingerprint } = collectAdvSearchParams();
    const cached = getAdvSearchViewCache(nextMode);
    const cacheFingerprint = nextMode === "kanban" ? advKanbanCacheFingerprint : advListCacheFingerprint;

    if (cached !== null && cacheFingerprint === fingerprint) {
        crmSearchCache.adv = cached;
        rerenderCrmResultsFromCache("adv", { restoreKanbanScroll: nextMode === "kanban" });
        return;
    }

    searchCRM("adv", null, {
        kanbanMode: nextMode === "kanban",
        page: nextMode === "kanban" ? 1 : advSearchListPage,
        keepKanbanScroll: nextMode === "kanban",
        silentBtn: true
    });
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

    ensureColumn({ key: '_null', id: null, name: 'Статус не установлен', bk_color: '#dfdfdf', text_color: '#555', deals: [] });

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

    const elements = Array.isArray(deal.elements) ? deal.elements
        : (Array.isArray(deal.items) ? deal.items : (Array.isArray(deal.positions) ? deal.positions : []));
    const descWords = elements
        .map(el => (el?.name || el?.title || "").trim().split(/\s+/)[0])
        .filter(Boolean);
    const descHtml = descWords.length
        ? `<div class="kanban-card-desc">${escapeHtml(descWords.join(", "))}</div>`
        : "";

    return `
        <article class="kanban-card" data-deal-id="${deal.id}" style="--card-index:${index}" tabindex="0" role="button" aria-label="Открыть заказ № ${escapeHtml(num)}">
            <div class="kanban-card-top-row">
                <span class="kanban-card-num">№ ${escapeHtml(num)}</span>
                <span class="kanban-card-manager">${escapeHtml(manager)}</span>
            </div>
            <div class="kanban-card-client">${escapeHtml(client)}</div>
            ${descHtml}
            <div class="kanban-card-amount ${amountClass}">${formatMoney(f.total)} ₽</div>
        </article>`;
}

function bindKanbanBoardEvents(board) {
    bindKanbanCardDrag(board);
    bindKanbanBoardPan(board);
}

function renderDealsKanban(deals, targetDiv) {
    const validDeals = deals.filter(isValidDeal).map(deal => normalizeDealForView(deal));
    validDeals.forEach(deal => dealsCache.set(String(deal.id), deal));

    const columns = sortKanbanColumnsBySavedOrder(buildKanbanColumns(validDeals));
    const board = document.createElement("div");
    board.className = "crm-kanban-board";
    if (localStorage.getItem("kanban_zoom_out") === "1") board.classList.add("kanban-board--zoomed");

    columns.forEach(col => {
        const columnEl = document.createElement("section");
        columnEl.className = "crm-kanban-column";
        columnEl.dataset.statusKey = col.key;
        if (col.id != null) columnEl.dataset.statusId = String(col.id);
        // прокидываем цвет статуса на столбец, чтобы карточки унаследовали --col-bg
        columnEl.style.setProperty("--col-bg", col.bk_color);
        columnEl.style.setProperty("--col-text", col.text_color);

        const cardsHtml = col.deals.map((deal, idx) => renderKanbanCard(deal, idx)).join("");
        const emptyHtml = col.deals.length
            ? ""
            : `<div class="crm-kanban-empty">Нет заказов</div>`;
        const summaryHtml = col.deals.length ? renderKanbanColumnSummary(col.deals) : "";

        columnEl.innerHTML = `
            <header class="crm-kanban-column-header" style="--col-bg:${col.bk_color}; --col-text:${col.text_color}">
                <span class="crm-kanban-column-grip" aria-hidden="true">⠿</span>
                <span class="crm-kanban-column-title">${escapeHtml(col.name)}</span>
                <span class="crm-kanban-column-count">${col.deals.length}</span>
            </header>
            <div class="crm-kanban-column-body">
                ${cardsHtml}${emptyHtml}
            </div>
            ${summaryHtml}`;

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
    // Клиентский фильтр «только неоплаченные». Для канбана он полный (загружаются
    // все сделки); для списка — по текущей странице (корректную постраничную
    // фильтрацию делает n8n-search-crm.js по filters.unpaidOnly).
    let list = deals;
    if (isAdvResults && isAdvUnpaidFilterActive()) {
        list = (Array.isArray(deals) ? deals : []).filter(isDealUnpaid);
    }
    const useKanban = isAdvResults && getCrmViewMode() === "kanban";
    targetDiv?.classList.toggle("crm-kanban-results-host", useKanban);
    if (useKanban) {
        renderDealsKanban(list, targetDiv);
    } else {
        renderDealsList(list, targetDiv, options);
        if (isAdvResults && Array.isArray(list) && list.length) {
            const sumWrap = document.createElement("div");
            sumWrap.innerHTML = renderDealsListSummary(list);
            const sumEl = sumWrap.firstElementChild;
            if (sumEl) {
                // саммари — под списком, но над пагинацией
                const pager = targetDiv.querySelector(".crm-search-pagination");
                if (pager) targetDiv.insertBefore(sumEl, pager);
                else targetDiv.appendChild(sumEl);
            }
        }
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

const DEAL_COST_INFO_PREFIX = "calc_deal_cost_info_";
const DEAL_REQUISITE_SEL_PREFIX = "calc_deal_requisite_sel_"; // выбранный реквизит клиента для счёта
let pendingElementDelete = null;

// CRM additional-field ids (карточка сделки, вкладка заказа)
const DEAL_FIELD_COST_INFO = 476;       // Информация по себестоимости
const DEAL_FIELD_INVOICE_NUMBER = 477;  // Номер счёта
const DEAL_FIELD_INVOICE_DATE = 1105;   // Дата счёта
const DEAL_FIELD_INVOICE_LINK = 1104;   // Ссылка на счёт (редактирование / старый формат)
const DEAL_FIELD_INVOICE_PREVIEW = 1106; // Ссылка-превью счёта (для встраивания в iframe)

// dealId -> { [fieldId]: value } последняя загрузка доп.полей из CRM
const dealAdditionalFieldsCache = new Map();
// dealId -> таймер дебаунса PUT себестоимости в CRM
const dealCostInfoPushTimers = new Map();
// clientId -> [{ id, title, inn, name }] реквизиты клиента из CRM
const clientRequisitesCache = new Map();
// dealId -> { number, date, onlineLink, editLink } данные выставленного счёта.
// onlineLink — статическая ссылка-превью счёта (МоёДело), встраиваемая в iframe.
const dealInvoiceCache = new Map();
// dealId -> { selectedContactId, contacts:[{key,source,crmRef,contactId,name,email,phone,position}] }
// контакт-получатель уведомлений о готовности заказа.
const dealContactsCache = new Map();

function readDealCostInfoDraft(dealId) {
    try {
        return localStorage.getItem(`${DEAL_COST_INFO_PREFIX}${dealId}`) || "";
    } catch (_) {
        return "";
    }
}

function saveDealCostInfoDraft(dealId, value) {
    const text = String(value ?? "");
    try {
        localStorage.setItem(`${DEAL_COST_INFO_PREFIX}${dealId}`, text);
    } catch (_) {}
    // CRM — источник правды; localStorage остаётся запасным кэшем.
    scheduleDealCostInfoPush(dealId, text);
}

function scheduleDealCostInfoPush(dealId, value) {
    const key = String(dealId);
    const cached = dealAdditionalFieldsCache.get(key);
    // Не дёргаем CRM, если значение не менялось относительно последней загрузки.
    if (cached && String(cached[DEAL_FIELD_COST_INFO] ?? "") === value) return;

    const prevTimer = dealCostInfoPushTimers.get(key);
    if (prevTimer) clearTimeout(prevTimer);

    const timer = setTimeout(() => {
        dealCostInfoPushTimers.delete(key);
        pushDealAdditionalField(dealId, DEAL_FIELD_COST_INFO, value).then(ok => {
            if (ok) {
                const map = dealAdditionalFieldsCache.get(key) || {};
                map[DEAL_FIELD_COST_INFO] = value;
                dealAdditionalFieldsCache.set(key, map);
            }
        });
    }, 600);
    dealCostInfoPushTimers.set(key, timer);
}

async function pushDealAdditionalField(dealId, fieldId, value) {
    if (!ensureActiveSession({ silent: true })) return false;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "saveDealAdditionalField",
                dealId: Number(dealId),
                fieldId: Number(fieldId),
                value: String(value ?? "")
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return false;
        }
        return response.ok;
    } catch (e) {
        console.warn("saveDealAdditionalField failed", e);
        return false;
    }
}

async function fetchDealAdditionalFields(dealId) {
    if (!ensureActiveSession({ silent: true })) return null;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "getDealAdditionalFields",
                dealId: Number(dealId)
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return null;
        }
        if (!response.ok) return null;

        const payload = await response.json();
        const list = Array.isArray(payload?.fields)
            ? payload.fields
            : (Array.isArray(payload) ? payload : []);

        const map = {};
        list.forEach(field => {
            if (field?.id == null) return;
            // value отсутствует, когда поле не заполнено.
            map[field.id] = field.value != null ? String(field.value) : "";
        });
        return map;
    } catch (e) {
        console.warn("getDealAdditionalFields failed", e);
        return null;
    }
}

function scheduleDealExtraFieldsLoading(deal) {
    const dealId = deal?.id;
    if (!dealId || currentUser.role !== "staff") return;

    fetchDealAdditionalFields(dealId).then(map => {
        if (!map) return;
        dealAdditionalFieldsCache.set(String(dealId), map);
        applyDealCostInfoFromCrm(dealId, map[DEAL_FIELD_COST_INFO] || "");
        applyDealInvoiceInfo(dealId, map);
    });

    scheduleDealRequisitesLoading(deal);
    scheduleDealContactsLoading(deal);
}

function applyDealCostInfoFromCrm(dealId, value) {
    const panel = document.querySelector(`.deal-extra-panel[data-deal-id="${CSS.escape(String(dealId))}"]`);
    const textarea = panel?.querySelector(".deal-cost-info-input");
    if (!textarea) return;
    // Не перетираем то, что менеджер сейчас редактирует.
    if (document.activeElement === textarea) return;

    textarea.value = value;
    try {
        localStorage.setItem(`${DEAL_COST_INFO_PREFIX}${dealId}`, value);
    } catch (_) {}
}

function formatInvoiceDate(raw) {
    const text = String(raw || "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}.${match[2]}.${match[1]}`;
    return text;
}

function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
}

// Ссылка на редактирование счёта в кабинете МоёДело (НЕ для встраивания в iframe).
function isInvoiceEditLink(value) {
    const url = String(value || "");
    return isHttpUrl(url) && (/\/bill\/edit\b/i.test(url) || /AccDocuments\/Sales/i.test(url));
}

// Собираем данные счёта из доп.полей CRM (после перезагрузки страницы).
//   1106 — ссылка-превью счёта (встраиваемая в iframe);
//   1104 — ссылка на счёт (редактирование / старый формат).
// Превью берём из 1106; для старых счетов, где 1106 пусто, — из 1104,
// если она в формате превью. Иначе 1104 показываем как «Редактировать».
function buildInvoiceFromFields(fields) {
    const map = fields || {};
    const number = String(map[DEAL_FIELD_INVOICE_NUMBER] || "").trim();
    const date = String(map[DEAL_FIELD_INVOICE_DATE] || "").trim();
    const previewField = String(map[DEAL_FIELD_INVOICE_PREVIEW] || "").trim();
    const linkField = String(map[DEAL_FIELD_INVOICE_LINK] || "").trim();

    // Превью: приоритет у выделенного поля 1106; иначе — ссылка из 1104, если это
    // не ссылка на редактирование. Так превью показывается всегда, когда оно есть.
    let onlineLink = "";
    if (isHttpUrl(previewField)) onlineLink = previewField;
    else if (isHttpUrl(linkField) && !isInvoiceEditLink(linkField)) onlineLink = linkField;

    // «Редактировать»: 1104, если это ссылка на редактирование (и не равна превью).
    const editLink = (isHttpUrl(linkField) && linkField !== onlineLink && isInvoiceEditLink(linkField))
        ? linkField
        : "";

    if (!number && !date && !onlineLink && !editLink) return null;
    return { number, date, onlineLink, editLink };
}

// Мобильное отображение: встроенное превью счёта не показываем (тяжело и тесно).
function isMobileInvoiceView() {
    return window.matchMedia("(max-width: 600px)").matches;
}

function renderInvoiceCardMarkup(dealId, invoice) {
    if (!invoice || (!invoice.number && !invoice.onlineLink && !invoice.editLink && !invoice.date)) {
        return `<div class="deal-invoice-empty">Счёт ещё не создан</div>`;
    }

    const title = invoice.number ? `Счёт № ${escapeHtml(invoice.number)}` : "Счёт";
    const date = formatInvoiceDate(invoice.date);
    const dateHtml = date ? `<span class="deal-invoice-date">от ${escapeHtml(date)}</span>` : "";
    const hasOnline = isHttpUrl(invoice.onlineLink);
    const hasEdit = isHttpUrl(invoice.editLink);
    const mobile = isMobileInvoiceView();
    // Раскрывающееся превью — только на десктопе.
    const canEmbed = hasOnline && !mobile;

    const headAttrs = canEmbed ? ` onclick="toggleInvoicePreview(${dealId})" title="Показать/скрыть счёт"` : "";
    const caret = canEmbed ? `<span class="deal-invoice-caret" aria-hidden="true">▸</span>` : "";

    // На десктопе у старого счёта без превью-ссылки поясняем, что превью нет.
    const noPreviewHtml = (!hasOnline && !mobile)
        ? `<span class="deal-invoice-nopreview" title="Для этого счёта недоступно встроенное превью">превью недоступно</span>`
        : "";

    const actionsHtml = `
            <div class="deal-invoice-actions">
                ${hasOnline ? `<button type="button" class="deal-invoice-link deal-invoice-copy" onclick="copyInvoiceLink(event, ${dealId})">${icon("copy")} Скопировать ссылку на счёт</button>` : ""}
                ${hasEdit ? `<a class="deal-invoice-link" href="${escapeHtml(invoice.editLink)}" target="_blank" rel="noopener">${icon("edit")} Редактировать</a>` : ""}
                <button type="button" class="deal-invoice-link deal-invoice-pdf" onclick="downloadInvoicePdf(event, ${dealId})">${icon("file")} Скачать PDF с печатью</button>
                <button type="button" class="deal-invoice-link deal-invoice-unlink" onclick="deleteInvoiceBinding(event, ${dealId})">${icon("trash")} Удалить привязку счёта</button>
            </div>`;

    return `
        <div class="deal-invoice-card${canEmbed ? " is-expandable" : ""} is-fresh">
            <div class="deal-invoice-head"${headAttrs}>
                ${caret}<span class="deal-invoice-title">${title}</span>${dateHtml}${noPreviewHtml}
            </div>
            ${actionsHtml}
        </div>`;
}

// Копирование ссылки на счёт в буфер обмена с короткой обратной связью на кнопке.
function copyInvoiceLink(event, dealId) {
    event?.stopPropagation();
    const invoice = dealInvoiceCache.get(String(dealId));
    const url = invoice?.onlineLink;
    if (!isHttpUrl(url)) return;

    const btn = event?.currentTarget;
    const showOk = () => {
        if (!btn) return;
        if (!btn.dataset.label) btn.dataset.label = btn.innerHTML;
        btn.innerHTML = icon("check") + " Скопировано";
        btn.classList.add("is-copied");
        clearTimeout(btn._copyTimer);
        btn._copyTimer = setTimeout(() => {
            btn.innerHTML = btn.dataset.label || (icon("copy") + " Скопировать ссылку на счёт");
            btn.classList.remove("is-copied");
        }, 1600);
    };

    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(showOk).catch(() => fallbackCopyText(url, showOk));
    } else {
        fallbackCopyText(url, showOk);
    }
}

// Скачать PDF счёта с печатью и подписью. PDF рендерит CRM на стороне сервера,
// поэтому идём через n8n-экшен getInvoicePdf, который дёргает соответствующий
// эндпоинт CRM и возвращает ссылку на готовый PDF (или сам файл base64).
async function downloadInvoicePdf(event, dealId) {
    event?.stopPropagation();
    if (!ensureActiveSession()) return;
    const btn = event?.currentTarget;
    const orig = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = icon("loader", { spin: true }) + " Готовлю PDF…"; }
    try {
        const resp = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ action: "getInvoicePdf", dealId: Number(dealId) })
        }, 60000);
        if (resp.status === 401) { handleUnauthorized(); return; }
        const payload = await resp.json().catch(() => null);
        const d = Array.isArray(payload) ? payload[0] : (payload?.data || payload);
        const url = d?.url || d?.pdfUrl || d?.link;
        if (isHttpUrl(url)) {
            window.open(url, "_blank", "noopener");
        } else if (typeof d?.base64 === "string" && d.base64) {
            const a = document.createElement("a");
            a.href = (d.base64.startsWith("data:") ? d.base64 : `data:application/pdf;base64,${d.base64}`);
            a.download = d.filename || `Счёт.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
        } else {
            alert("PDF с печатью пока недоступен: не настроен n8n-экшен getInvoicePdf (нужен эндпоинт CRM).");
        }
    } catch (e) {
        alert("Не удалось скачать PDF: " + (e.message || "ошибка"));
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig || (icon("file") + " Скачать PDF с печатью"); }
    }
}

// Удалить привязку счёта: очищаем доп.поля CRM (номер, дата, ссылка, превью).
// Сам счёт-документ в CRM не удаляется — только отвязка от сделки в нашем UI.
async function deleteInvoiceBinding(event, dealId) {
    event?.stopPropagation();
    if (!confirm("Удалить привязку счёта? В CRM очистятся номер, дата и ссылки счёта (сам счёт-документ не удаляется).")) return;
    if (!ensureActiveSession()) return;
    const btn = event?.currentTarget;
    const orig = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = icon("loader", { spin: true }) + " Удаляю…"; }
    const fields = [DEAL_FIELD_INVOICE_NUMBER, DEAL_FIELD_INVOICE_DATE, DEAL_FIELD_INVOICE_LINK, DEAL_FIELD_INVOICE_PREVIEW];
    try {
        const results = await Promise.all(fields.map(f => pushDealAdditionalField(dealId, f, "")));
        if (results.some(r => !r)) { alert("Не удалось очистить часть полей счёта — обновите страницу и повторите."); }
        const map = dealAdditionalFieldsCache.get(String(dealId)) || {};
        fields.forEach(f => { map[f] = ""; });
        dealAdditionalFieldsCache.set(String(dealId), map);
        dealInvoiceCache.delete(String(dealId));
        renderInvoiceDisplay(dealId);
    } finally {
        if (btn) { btn.disabled = false; if (orig) btn.innerHTML = orig; }
    }
}

// Фолбэк-копирование для небезопасного контекста / старых браузеров.
function fallbackCopyText(text, onDone) {
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0;";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        onDone?.();
    } catch (_) {
        alert("Не удалось скопировать. Ссылка: " + text);
    }
}

// Состояние «счёт выставляется»: анимированный индикатор в строке счёта.
function renderInvoiceLoading(dealId) {
    const row = document.querySelector(`.deal-invoice-row[data-deal-id="${CSS.escape(String(dealId))}"]`);
    if (!row) return;
    const display = row.querySelector(".deal-invoice-display");
    const slot = row.querySelector(".deal-invoice-preview-slot");
    if (slot) slot.innerHTML = "";
    if (display) {
        display.innerHTML = `
            <div class="deal-invoice-loading">
                <span class="deal-invoice-spinner" aria-hidden="true"></span>
                <span class="deal-invoice-loading-text">Выставляется счёт…</span>
            </div>`;
    }
}

// Естественная ширина документа счёта МоёДело (под неё считаем масштаб).
// Естественная ширина страницы счёта МоёДело (документ + правый блок печати/QR).
// Подобрано так, чтобы целиком вмещался QR-код и ссылки на скачивание справа.
const INVOICE_DOC_WIDTH = 1100;

// Полноширинное превью счёта (рендерится в отдельный слот под строкой).
// На мобильных не рендерим вовсе. Ссылку зашиваем в data-src, чтобы открытие
// превью не зависело от состояния кеша (иначе iframe мог остаться пустым).
function renderInvoicePreviewMarkup(invoice) {
    if (!invoice || !isHttpUrl(invoice.onlineLink) || isMobileInvoiceView()) return "";
    return `
        <div class="deal-invoice-preview" data-src="${escapeHtml(invoice.onlineLink)}" hidden>
            <div class="deal-invoice-stage">
                <iframe class="deal-invoice-iframe" loading="lazy" referrerpolicy="no-referrer" title="Превью счёта"></iframe>
            </div>
            <div class="deal-invoice-preview-hint">Если счёт не отобразился — <a href="${escapeHtml(invoice.onlineLink)}" target="_blank" rel="noopener">откройте в новой вкладке</a>.</div>
        </div>`;
}

function renderInvoiceDisplay(dealId) {
    const row = document.querySelector(`.deal-invoice-row[data-deal-id="${CSS.escape(String(dealId))}"]`);
    if (!row) return;
    const invoice = dealInvoiceCache.get(String(dealId));
    const display = row.querySelector(".deal-invoice-display");
    const slot = row.querySelector(".deal-invoice-preview-slot");
    if (display) display.innerHTML = renderInvoiceCardMarkup(dealId, invoice);
    if (slot) slot.innerHTML = renderInvoicePreviewMarkup(invoice);
}

// Масштабируем iframe так, чтобы документ счёта целиком влезал по ширине,
// а высота вписывалась в экран (с прокруткой внутри для длинных счетов).
function fitInvoicePreview(dealId) {
    const row = document.querySelector(`.deal-invoice-row[data-deal-id="${CSS.escape(String(dealId))}"]`);
    const stage = row?.querySelector(".deal-invoice-stage");
    const iframe = stage?.querySelector(".deal-invoice-iframe");
    if (!stage || !iframe) return;

    const containerW = stage.clientWidth;
    if (!containerW) return;

    const scale = Math.min(1, containerW / INVOICE_DOC_WIDTH);
    const stageH = Math.max(360, Math.round(window.innerHeight * 0.82));

    iframe.style.width = INVOICE_DOC_WIDTH + "px";
    iframe.style.height = Math.round(stageH / scale) + "px";
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = "top left";
    stage.style.height = stageH + "px";
}

// Раскрытие/скрытие inline-превью счёта. iframe грузим лениво при первом открытии.
function toggleInvoicePreview(dealId) {
    const row = document.querySelector(`.deal-invoice-row[data-deal-id="${CSS.escape(String(dealId))}"]`);
    const card = row?.querySelector(".deal-invoice-card");
    const preview = row?.querySelector(".deal-invoice-preview");
    const iframe = preview?.querySelector(".deal-invoice-iframe");
    if (!preview || !iframe) return;

    const willShow = preview.hidden;
    if (willShow && !iframe.getAttribute("src")) {
        // Ссылка зашита в data-src при рендере; кеш — лишь запасной источник.
        const src = preview.dataset.src || dealInvoiceCache.get(String(dealId))?.onlineLink;
        if (isHttpUrl(src)) iframe.setAttribute("src", src);
    }
    preview.hidden = !willShow;
    card?.classList.toggle("is-expanded", willShow);
    if (willShow) fitInvoicePreview(dealId);
}

// Пере-масштабируем открытые превью при изменении размера окна (дебаунс).
let invoiceFitResizeTimer = null;
window.addEventListener("resize", () => {
    clearTimeout(invoiceFitResizeTimer);
    invoiceFitResizeTimer = setTimeout(() => {
        document.querySelectorAll(".deal-invoice-card.is-expanded").forEach(card => {
            const row = card.closest(".deal-invoice-row");
            if (row?.dataset.dealId) fitInvoicePreview(row.dataset.dealId);
        });
    }, 150);
});

function applyDealInvoiceInfo(dealId, fields) {
    const fromFields = buildInvoiceFromFields(fields);
    if (fromFields) {
        // Сохраняем editLink, если он уже был получен при создании счёта в этой сессии.
        const existing = dealInvoiceCache.get(String(dealId));
        if (existing?.editLink && !fromFields.editLink) fromFields.editLink = existing.editLink;
        dealInvoiceCache.set(String(dealId), fromFields);
    }
    renderInvoiceDisplay(dealId);
}

function getDealClientId(deal) {
    const id = deal?.client?.id ?? deal?.client_id ?? deal?.clientId;
    const num = Number(id);
    return Number.isFinite(num) && num > 0 ? num : null;
}

function readSelectedRequisiteId(dealId) {
    try {
        return localStorage.getItem(`${DEAL_REQUISITE_SEL_PREFIX}${dealId}`) || "";
    } catch (_) {
        return "";
    }
}

function saveSelectedRequisiteId(dealId, requisiteId) {
    try {
        if (requisiteId) {
            localStorage.setItem(`${DEAL_REQUISITE_SEL_PREFIX}${dealId}`, String(requisiteId));
        } else {
            localStorage.removeItem(`${DEAL_REQUISITE_SEL_PREFIX}${dealId}`);
        }
    } catch (_) {}
}

// "ИНН Название" -> { inn, name }. ИНН — ведущие 10–12 цифр, остальное — название.
function parseRequisiteTitle(title) {
    const text = String(title || "").trim();
    const match = text.match(/^(\d{8,12})\s+(.*)$/);
    if (match) return { inn: match[1], name: match[2].trim() };
    return { inn: "", name: text };
}

function normalizeRequisitesList(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter(item => item && item.id != null)
        .map(item => {
            const parsed = parseRequisiteTitle(item.title);
            return {
                id: String(item.id),
                title: String(item.title || ""),
                inn: parsed.inn,
                name: parsed.name
            };
        });
}

function openClientRequisitesEditor(clientId) {
    if (!clientId) return;
    window.open(`https://crm.heavendevelop.ru/editClient/${clientId}`, "_blank", "noopener");
}

async function fetchClientRequisites(clientId) {
    if (!ensureActiveSession({ silent: true })) return null;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "getClientRequisites",
                clientId: Number(clientId)
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return null;
        }
        if (!response.ok) return null;

        const payload = await response.json();
        const list = Array.isArray(payload?.requisites)
            ? payload.requisites
            : (Array.isArray(payload) ? payload : []);
        return normalizeRequisitesList(list);
    } catch (e) {
        console.warn("getClientRequisites failed", e);
        return null;
    }
}

// Реквизиты не показываются в карточке — только предзагружаем в кеш,
// чтобы модалка по кнопке «Создать счёт» открывалась мгновенно.
function scheduleDealRequisitesLoading(deal) {
    if (currentUser.role !== "staff") return;

    const clientId = getDealClientId(deal);
    if (!clientId) return;
    if (clientRequisitesCache.has(String(clientId))) return;

    fetchClientRequisites(clientId).then(list => {
        if (list != null) clientRequisitesCache.set(String(clientId), list);
    });
}

function renderDealExtraPanel(deal) {
    if (currentUser.role !== "staff") return "";

    const dealId = deal.id;
    const costInfo = escapeHtml(readDealCostInfoDraft(dealId));
    const clientId = getDealClientId(deal);

    return `
        <div class="deal-extra-panel" data-deal-id="${dealId}">
            <div class="deal-extra-section">
                <label class="deal-extra-label">Информация по себестоимости</label>
                <textarea class="deal-cost-info-input" rows="3" placeholder="Заметки по себестоимости заказа…" onblur="saveDealCostInfoDraft(${dealId}, this.value)">${costInfo}</textarea>
            </div>
            <div class="deal-invoice-row" data-deal-id="${dealId}"${clientId ? ` data-client-id="${clientId}"` : ""}>
                <div class="deal-invoice-row-main">
                    <button type="button" class="deal-create-invoice-btn" onclick="showInvoiceRequisitesModal(${dealId})">Создать счёт</button>
                    <div class="deal-invoice-display"><div class="deal-invoice-empty">Загрузка…</div></div>
                </div>
                <div class="deal-invoice-preview-slot"></div>
            </div>
            <div class="deal-notify-section" data-deal-id="${dealId}"${clientId ? ` data-client-id="${clientId}"` : ""} data-deal-num="${escapeHtml(deal.num != null ? String(deal.num) : "")}" data-manager-id="${escapeHtml(deal.responsible?.id != null ? String(deal.responsible.id) : "")}" data-manager-name="${escapeHtml(getDealResponsibleName(deal))}">
                <span class="deal-extra-label">Контакт для уведомлений о готовности</span>
                <div class="deal-notify-body"><div class="deal-notify-loading">Загрузка контактов…</div></div>
            </div>
        </div>`;
}

// ─── Контакт для уведомлений о готовности (дропдаун + плашка-акцент) ───

function getDealNotifySection(dealId) {
    return document.querySelector(`.deal-notify-section[data-deal-id="${CSS.escape(String(dealId))}"]`);
}

function scheduleDealContactsLoading(deal) {
    const dealId = deal?.id;
    if (!dealId || currentUser.role !== "staff") return;

    const clientId = getDealClientId(deal);
    const section = getDealNotifySection(dealId);
    if (section && clientId) section.dataset.clientId = String(clientId);

    if (!clientId) {
        renderDealNotifyBody(dealId, "no-client");
        return;
    }

    renderDealNotifyBody(dealId, "loading");
    fetchDealContacts(dealId, clientId).then(data => {
        if (data == null) {
            renderDealNotifyBody(dealId, "error");
            return;
        }
        dealContactsCache.set(String(dealId), data);
        renderDealNotifyBody(dealId, "ready");
    });
}

async function fetchDealContacts(dealId, clientId) {
    if (!ensureActiveSession({ silent: true })) return null;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "getDealContacts",
                dealId: Number(dealId),
                clientId: Number(clientId)
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return null;
        }
        if (!response.ok) return null;

        const payload = await response.json();
        const data = Array.isArray(payload) ? payload[0] : payload;
        const contacts = Array.isArray(data?.contacts) ? data.contacts : [];
        return {
            selectedContactId: data?.selectedContactId != null ? Number(data.selectedContactId) : null,
            notifyDisabled: data?.notifyDisabled === true,
            lastSentAt: data?.lastSentAt || null,
            lastSentTo: data?.lastSentTo || null,
            contacts
        };
    } catch (e) {
        console.warn("getDealContacts failed", e);
        return null;
    }
}

// Telegram-ник контакта: из явного поля telegram, иначе парсим email/имя
// (ник мог быть вписан в поле email по конвенции «mail@ya.ru @nick»).
function contactTelegramNick(contact) {
    if (!contact) return "";
    if (contact.telegram) return String(contact.telegram).replace(/^@/, "");
    return parseContactReach(contact.email).telegram || parseContactReach(contact.name).telegram || "";
}
// Чистый email контакта (поле email может содержать «email @nick»).
function contactEmailAddr(contact) {
    if (!contact) return "";
    return parseContactReach(contact.email).email || "";
}

function buildContactLabel(contact) {
    const email = contactEmailAddr(contact);
    const tgNick = contactTelegramNick(contact);
    // Имя — главное; показываем И email, И @ник (видно сразу, без редактирования).
    // Телефон — только если ни email, ни ника нет.
    const bits = [];
    if (email) bits.push(email);
    if (tgNick) bits.push("@" + tgNick);
    if (!bits.length && contact.phone) bits.push(contact.phone);
    const reach = bits.join(" · ");
    const rawName = contact.name != null ? String(contact.name).trim() : "";
    const invalid = !rawName || rawName === "NaN" || rawName === "null" || rawName === "undefined"
        || rawName === reach || rawName === email || rawName === (tgNick ? "@" + tgNick : "\0") || rawName === contact.phone;
    const name = invalid ? "" : rawName;
    const parts = [];
    if (name) parts.push(name);
    if (reach) parts.push(reach);
    return parts.join(" · ") || "(без имени)";
}

// ISO/Postgres timestamp -> "ДД.ММ.ГГГГ ЧЧ:ММ" в локальном времени.
function formatNotifySentAt(raw) {
    if (!raw) return "";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "";
    const p = n => String(n).padStart(2, "0");
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderDealNotifyBody(dealId, state) {
    const section = getDealNotifySection(dealId);
    const body = section?.querySelector(".deal-notify-body");
    if (!section || !body) return;

    if (state === "loading" || state === "error" || state === "no-client") {
        section.classList.remove("is-unset");
        const cls = state === "error" ? "deal-notify-error" : (state === "no-client" ? "deal-notify-empty" : "deal-notify-loading");
        const text = state === "error" ? "Не удалось загрузить контакты"
            : (state === "no-client" ? "Клиент не привязан к сделке" : "Загрузка контактов…");
        body.innerHTML = `<div class="${cls}">${text}</div>`;
        return;
    }

    const data = dealContactsCache.get(String(dealId)) || { selectedContactId: null, notifyDisabled: false, contacts: [], lastSentAt: null, lastSentTo: null };
    const selectedId = data.selectedContactId;
    const notifyDisabled = data.notifyDisabled === true;
    const hasSelection = selectedId != null;
    const isDecided = hasSelection || notifyDisabled; // выбор сделан: контакт или «не уведомлять»
    const clientId = section.dataset.clientId;

    const sentAt = formatNotifySentAt(data.lastSentAt);
    const sentBadge = sentAt
        ? `<div class="deal-notify-sent" title="Уведомление о готовности уже отправлено">${icon("check")} Уведомление отправлено: <b>${escapeHtml(sentAt)}</b>${data.lastSentTo ? ` · ${escapeHtml(data.lastSentTo)}` : ""}</div>`
        : "";
    const sendLabel = sentAt ? (icon("mail") + " Отправить ещё раз") : (icon("mail") + " Отправить уведомление о готовности");

    const selectedContact = hasSelection
        ? data.contacts.find(c => c.contactId != null && Number(c.contactId) === Number(selectedId))
        : null;
    // Пункты кастомного дропдауна. Кнопка удаления — прямо в списке (только у ручных контактов).
    const ddOptionsHtml = data.contacts.map(contact => {
        const isSel = contact.contactId != null && Number(contact.contactId) === Number(selectedId);
        const canDel = contact.source === "manual" && contact.contactId != null;
        return `<div class="deal-notify-dd-opt-row">
            <button type="button" class="deal-notify-dd-opt${isSel ? " is-sel" : ""}" onclick="onNotifyPick(${dealId}, '${escapeHtml(contact.key)}')">${isSel ? "✓ " : ""}${escapeHtml(buildContactLabel(contact))}</button>
            ${canDel ? `<button type="button" class="deal-notify-dd-edit" onclick="event.stopPropagation(); openEditContactForm(${dealId}, ${contact.contactId})" title="Редактировать контакт">${icon("edit")}</button>` : ""}
            ${canDel ? `<button type="button" class="deal-notify-dd-del" onclick="event.stopPropagation(); deleteDealContactConfirm(${dealId}, ${contact.contactId})" title="Удалить этот контакт из книги">${icon("trash")}</button>` : ""}
        </div>`;
    }).join("");

    const currentLabel = notifyDisabled
        ? (icon("bellOff") + " Не уведомлять")
        : (hasSelection ? escapeHtml(buildContactLabel(selectedContact)) : "— выберите контакт —");

    section.classList.toggle("is-unset", !isDecided);

    body.innerHTML = `
        ${!isDecided ? `<div class="deal-notify-alert">${icon("alert")} Контакт для уведомлений не указан — выберите, кому сообщить о готовности</div>` : ""}
        <div class="deal-notify-row">
            <div class="deal-notify-dd">
                <button type="button" class="deal-notify-dd-toggle${!isDecided ? " is-unset" : ""}" onclick="toggleNotifyDropdown(${dealId}, event)">
                    <span class="deal-notify-dd-current">${currentLabel}</span>
                    <span class="deal-notify-dd-caret">▾</span>
                </button>
                <div class="deal-notify-dd-menu" hidden>
                    <button type="button" class="deal-notify-dd-opt${notifyDisabled ? " is-sel" : ""}" onclick="onNotifyPick(${dealId}, '__none__')">${notifyDisabled ? "✓ " : ""}${icon("bellOff")} Не уведомлять</button>
                    ${ddOptionsHtml}
                    <div class="deal-notify-dd-foot">
                        <button type="button" class="deal-notify-dd-add" onclick="openDealContactForm(${dealId})">+ Добавить</button>
                        ${clientId ? `<a class="deal-notify-dd-crm" href="https://crm.heavendevelop.ru/editClient/${clientId}" target="_blank" rel="noopener" onclick="closeAllNotifyDropdowns()" title="Добавить контакт в карточке клиента в CRM">Добавить в CRM ↗</a>` : ""}
                    </div>
                    <button type="button" class="deal-notify-dd-tg" onclick="copyTelegramSubscribeLink(${dealId})" title="Скопировать ссылку: клиент перейдёт, нажмёт «Старт» и подпишется на Telegram-уведомления">${icon("telegram")} Ссылка для подписки клиента в Telegram</button>
                </div>
            </div>
        </div>
        ${sentBadge}
        ${hasSelection ? renderDealNotifyChannels(selectedContact, dealId) : ""}
        ${hasSelection ? `<button type="button" class="deal-notify-send-btn" onclick="sendReadinessNotification(${dealId})">${sendLabel}</button>` : ""}
        <div class="deal-notify-modal" hidden onmousedown="overlayDown(event)" onclick="if(overlayClickedSelf(event))closeDealContactForm(${dealId})">
            <div class="deal-notify-modal-card">
                <div class="deal-notify-modal-title">Новый контакт</div>
                <input type="text" class="deal-notify-input deal-notify-name" placeholder="Имя">
                <input type="text" class="deal-notify-input deal-notify-email" placeholder="Email">
                <input type="text" class="deal-notify-input deal-notify-telegram" placeholder="@ник в Telegram (необязательно)">
                <input type="tel" inputmode="tel" class="deal-notify-input deal-notify-phone" placeholder="+7 (___) ___ __ __" oninput="maskRuPhone(this)">
                <div class="deal-notify-form-actions">
                    <button type="button" class="deal-notify-form-cancel" onclick="closeDealContactForm(${dealId})">Отмена</button>
                    <button type="button" class="deal-notify-form-save" onclick="submitDealContactForm(${dealId})">Сохранить и выбрать</button>
                </div>
            </div>
        </div>`;
}

// ── Кастомный дропдаун выбора контакта ────────────────────────────────
function closeAllNotifyDropdowns() {
    document.querySelectorAll(".deal-notify-dd-menu").forEach(m => { m.hidden = true; });
    document.querySelectorAll(".deal-notify-dd.is-open").forEach(d => d.classList.remove("is-open", "is-up"));
    document.removeEventListener("click", notifyDropdownOutside);
}

function notifyDropdownOutside(ev) {
    if (ev.target.closest(".deal-notify-dd")) return;
    closeAllNotifyDropdowns();
}

function toggleNotifyDropdown(dealId, ev) {
    if (ev) ev.stopPropagation();
    const section = getDealNotifySection(dealId);
    const dd = section?.querySelector(".deal-notify-dd");
    const menu = dd?.querySelector(".deal-notify-dd-menu");
    if (!menu) return;
    const willOpen = menu.hidden;
    closeAllNotifyDropdowns();
    if (willOpen) {
        menu.hidden = false;
        dd.classList.add("is-open");
        // Если снизу не хватает места (мобила/конец страницы) — открываем вверх,
        // и подскролливаем, чтобы список был виден целиком.
        requestAnimationFrame(() => {
            const menuH = menu.getBoundingClientRect().height;
            const spaceBelow = window.innerHeight - dd.getBoundingClientRect().bottom;
            if (menuH > spaceBelow - 8) dd.classList.add("is-up");
            menu.scrollIntoView({ block: "nearest" });
        });
        setTimeout(() => document.addEventListener("click", notifyDropdownOutside), 0);
    }
}

function onNotifyPick(dealId, key) {
    closeAllNotifyDropdowns();
    onDealContactSelect(dealId, key);
}

// ── Модалка добавления контакта (поверх списка) ───────────────────────
function openDealContactForm(dealId) {
    closeAllNotifyDropdowns();
    const section = getDealNotifySection(dealId);
    const modal = section?.querySelector(".deal-notify-modal");
    if (!modal) return;
    // Режим «новый контакт»: чистим поля и метку редактирования.
    delete modal.dataset.editId;
    modal.querySelectorAll(".deal-notify-input").forEach(i => { i.value = ""; });
    const title = modal.querySelector(".deal-notify-modal-title");
    if (title) title.textContent = "Новый контакт";
    const save = modal.querySelector(".deal-notify-form-save");
    if (save) save.textContent = "Сохранить и выбрать";
    modal.hidden = false;
    modal.querySelector(".deal-notify-name")?.focus();
}

// Редактирование ручного контакта: открываем ту же модалку, пред-заполнив поля.
function openEditContactForm(dealId, contactId) {
    closeAllNotifyDropdowns();
    const data = dealContactsCache.get(String(dealId));
    const contact = data?.contacts.find(c => c.contactId != null && Number(c.contactId) === Number(contactId));
    if (!contact) return;
    const section = getDealNotifySection(dealId);
    const modal = section?.querySelector(".deal-notify-modal");
    if (!modal) return;

    const email = contactEmailAddr(contact);
    const tgNick = contactTelegramNick(contact);
    // Не подставляем авто-фолбэк (email/@ник/телефон) в поле «Имя» — пусть будет пустым.
    const rawName = contact.name != null ? String(contact.name).trim() : "";
    const nameIsAuto = !rawName || rawName === "NaN" || rawName === "null" || rawName === "undefined"
        || rawName === email || rawName === (tgNick ? "@" + tgNick : "\0")
        || rawName === (contact.phone || "\0") || rawName === "Контакт";
    const nameInp = modal.querySelector(".deal-notify-name");
    const emailInp = modal.querySelector(".deal-notify-email");
    const tgInp = modal.querySelector(".deal-notify-telegram");
    const phoneInp = modal.querySelector(".deal-notify-phone");
    if (nameInp) nameInp.value = nameIsAuto ? "" : rawName;
    if (emailInp) emailInp.value = email;
    if (tgInp) tgInp.value = tgNick ? "@" + tgNick : "";
    if (phoneInp) phoneInp.value = contact.phone || "";

    modal.dataset.editId = String(contactId);
    const title = modal.querySelector(".deal-notify-modal-title");
    if (title) title.textContent = "Редактировать контакт";
    const save = modal.querySelector(".deal-notify-form-save");
    if (save) save.textContent = "Сохранить";
    modal.hidden = false;
    nameInp?.focus();
}

function closeDealContactForm(dealId) {
    const section = getDealNotifySection(dealId);
    const modal = section?.querySelector(".deal-notify-modal");
    if (modal) modal.hidden = true;
}

// Маска российского номера: +7 (XXX) XXX XX XX
function maskRuPhone(input) {
    let v = String(input.value || "").replace(/\D/g, "");
    if (!v) { input.value = ""; return; }
    if (v[0] === "8") v = "7" + v.slice(1);
    if (v[0] !== "7") v = "7" + v;
    v = v.slice(0, 11);
    const r = v.slice(1); // до 10 цифр после «7»
    let out = "+7";
    if (r.length) out += " (" + r.slice(0, 3);
    if (r.length >= 3) out += ") " + r.slice(3, 6);
    if (r.length >= 6) out += " " + r.slice(6, 8);
    if (r.length >= 8) out += " " + r.slice(8, 10);
    input.value = out;
}

// Бот для уведомлений о готовности.
const TELEGRAM_BOT_USERNAME = "HeavenPrint_bot";

// Ссылка-приглашение: клиент переходит, жмёт «Старт» (deep-link ?start=…) и бот
// ловит его username→chat_id (ветка /start в боте). Дальше менеджер выбирает контакт
// по нику и шлёт уведомление. Кнопка просто копирует ссылку для ручной отправки.
function copyTelegramSubscribeLink(dealId) {
    // Без payload: клиенту нужен только «Старт» для подписки; id сделки боту не нужен.
    const link = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
    const ok = () => {
        if (typeof showReadinessToast === "function") showReadinessToast("Ссылка для подписки скопирована — отправьте её клиенту");
        else alert("Ссылка скопирована:\n" + link);
    };
    if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(link).then(ok, () => prompt("Скопируйте ссылку для клиента:", link));
    } else {
        prompt("Скопируйте ссылку для клиента:", link);
    }
}

// Сохранение выбора каналов отправки по сделке (переживает перезагрузку страницы).
function getStoredNotifyChannels(dealId) {
    try {
        const raw = localStorage.getItem(`calc_notify_ch_${dealId}`);
        return raw ? JSON.parse(raw) : null; // массив ["email","telegram"] или null (нет настройки)
    } catch { return null; }
}
function saveNotifyChannels(dealId, channels) {
    try { localStorage.setItem(`calc_notify_ch_${dealId}`, JSON.stringify(channels)); } catch (_) {}
}
function onNotifyChannelToggle(dealId) {
    const section = getDealNotifySection(dealId);
    if (!section) return;
    const channels = getCheckedChannels(section);
    saveNotifyChannels(dealId, channels);          // localStorage — мгновенно для UI/ручной отправки
    saveNotifyChannelsToServer(dealId, channels);  // в БД — чтобы КРОН слал в выбранные каналы
}

// Сохраняем выбор каналов в БД (deal_contacts.notify_channels), чтобы серверный
// крон авто-отправки шёл ровно в отмеченные каналы.
async function saveNotifyChannelsToServer(dealId, channels) {
    if (!ensureActiveSession({ silent: true })) return;
    try {
        await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ action: "saveNotifyChannels", dealId: Number(dealId), channels: channels.join(",") })
        });
    } catch (e) { console.warn("saveNotifyChannels failed", e); }
}

// Set сделок, каналы которых уже синхронизированы с БД в этой сессии.
const _notifyChannelSynced = new Set();

// Галочки каналов: активны только при наличии адреса (почта/ник); состояние
// восстанавливается из сохранённого выбора (по умолчанию — все доступные отмечены).
// При первом показе блока пушим localStorage → БД, чтобы крон видел актуальный выбор.
function renderDealNotifyChannels(contact, dealId) {
    const email = contactEmailAddr(contact);
    const tg = contactTelegramNick(contact);
    const hasEmail = !!email;
    const hasTg = !!tg;
    const emailLabel = hasEmail ? escapeHtml(email) : "нет почты";
    const tgLabel = hasTg ? `@${escapeHtml(tg)}` : "нет ника";
    const stored = getStoredNotifyChannels(dealId);
    const emailChecked = hasEmail && (stored ? stored.includes("email") : true);
    const tgChecked = hasTg && (stored ? stored.includes("telegram") : true);

    // Один раз за сессию синхронизируем состояние чекбоксов с БД.
    // Без этого крон читает дефолт «email,telegram» даже если пользователь убрал галочку.
    if (!_notifyChannelSynced.has(dealId)) {
        _notifyChannelSynced.add(dealId);
        const activeChannels = [];
        if (emailChecked) activeChannels.push("email");
        if (tgChecked) activeChannels.push("telegram");
        setTimeout(() => saveNotifyChannelsToServer(dealId, activeChannels), 300);
    }

    return `
        <div class="deal-notify-channels">
            <span class="deal-notify-channels-label">Куда слать:</span>
            <label class="deal-notify-ch-label${hasEmail ? "" : " is-disabled"}" title="${emailLabel}">
                <input type="checkbox" class="deal-notify-ch" value="email" ${hasEmail ? "" : "disabled"} ${emailChecked ? "checked" : ""} onchange="onNotifyChannelToggle(${dealId})"> ${icon("mail")} Email
            </label>
            <label class="deal-notify-ch-label${hasTg ? "" : " is-disabled"}" title="${tgLabel}">
                <input type="checkbox" class="deal-notify-ch" value="telegram" ${hasTg ? "" : "disabled"} ${tgChecked ? "checked" : ""} onchange="onNotifyChannelToggle(${dealId})"> ${icon("telegram")} Telegram
            </label>
        </div>`;
}

async function onDealContactSelect(dealId, key) {
    if (!key) return; // плейсхолдер «— выберите контакт —»
    if (key === "__none__") {
        await saveDealContactAndRefresh(dealId, { disable: true });
        return;
    }
    const data = dealContactsCache.get(String(dealId));
    const contact = data?.contacts.find(c => c.key === key);
    if (!contact) return;

    let payload;
    if (contact.contactId != null) {
        payload = { contactId: Number(contact.contactId) };
    } else if (contact.source === "crm") {
        payload = { source: "crm", crmRef: contact.crmRef, name: contact.name, email: contact.email, phone: contact.phone, telegram: contact.telegram || "" };
    } else {
        payload = { source: "manual", name: contact.name, email: contact.email, phone: contact.phone, telegram: contact.telegram || "" };
    }
    await saveDealContactAndRefresh(dealId, payload);
}

// «zzipp@inbox.ru @paulgt» → { email, telegram }. Любое одно тоже ок.
function parseContactReach(raw) {
    const str = String(raw || "").trim();
    let email = "";
    let telegram = "";
    const em = str.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (em) email = em[0];
    const rest = email ? str.replace(email, " ") : str;
    const tg = rest.match(/@([A-Za-z][A-Za-z0-9_]{3,31})/);
    if (tg) telegram = tg[1];
    else if (!email) {
        const bare = rest.trim().replace(/^@/, "");
        if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(bare)) telegram = bare;
    }
    return { email, telegram };
}

function getSelectedDealContact(dealId) {
    const data = dealContactsCache.get(String(dealId));
    if (!data || data.selectedContactId == null) return null;
    return data.contacts.find(c => c.contactId != null && Number(c.contactId) === Number(data.selectedContactId)) || null;
}

function getCheckedChannels(section) {
    return Array.from(section.querySelectorAll(".deal-notify-ch:checked")).map(c => c.value);
}

// Тело запроса отправки (общее для ручной и авто). Один запрос = один канал.
function buildReadinessSendBody(dealId, channel, opts = {}) {
    const deal = dealsCache.get(String(dealId));
    const selected = getSelectedDealContact(dealId);
    const body = {
        action: "sendReadinessNotification",
        channel,
        dealId: Number(dealId),
        dealNum: deal?.num != null ? String(deal.num) : "",
        managerId: deal?.responsible?.id != null ? String(deal.responsible.id) : "",
        managerName: getDealResponsibleName(deal || {}),
        // ник передаём с фронта (свежий из CRM) — для Telegram-отправки, чтобы не зависеть от книги
        telegram: contactTelegramNick(selected),
        elements: collectDealElementsForEmail(dealId)
    };
    if (opts.force) body.force = true;
    if (opts.auto) body.auto = true;
    return body;
}

async function sendReadinessChannel(dealId, channel, opts = {}) {
    if (!ensureActiveSession({ silent: true })) return { ok: false };
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify(buildReadinessSendBody(dealId, channel, opts))
        });
        if (response.status === 401) { handleUnauthorized(); return { ok: false, auth: true }; }
        const payload = response.ok ? await response.json() : null;
        const result = Array.isArray(payload) ? payload[0] : payload;
        return result || { ok: false };
    } catch (e) {
        console.warn("sendReadinessChannel failed", channel, e);
        return { ok: false, message: e.message };
    }
}

// Ручная отправка — по отмеченным галочкам каналам (force).
async function sendReadinessNotification(dealId) {
    const section = getDealNotifySection(dealId);
    if (!section || !ensureActiveSession()) return;

    const channels = getCheckedChannels(section);
    if (!channels.length) { alert("Отметьте хотя бы один канал (Email / Telegram)"); return; }

    const btn = section.querySelector(".deal-notify-send-btn");
    const orig = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.textContent = "Отправка…"; }

    try {
        const lines = [];
        for (const ch of channels) {
            const r = await sendReadinessChannel(dealId, ch, { force: true });
            const label = ch === "email" ? "Email" : "Telegram";
            lines.push(r?.ok
                ? `✅ ${label}: отправлено${r.to ? ` (${r.to})` : ""}`
                : `⚠️ ${label}: ${r?.message || "не отправлено"}`);
        }
        alert(lines.join("\n"));

        const clientId = section.dataset.clientId;
        if (clientId) {
            const fresh = await fetchDealContacts(dealId, clientId);
            if (fresh) { dealContactsCache.set(String(dealId), fresh); renderDealNotifyBody(dealId, "ready"); }
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = orig || (icon("mail") + " Отправить уведомление о готовности"); }
    }
}

const DEAL_STATUS_READY = 24873; // статус сделки «Заказ готов»
const ELEMENT_STATUS_COMPLETED_ID = 13953;        // статус позиции «Завершено»
const ELEMENT_STATUS_COMPLETED_NAME = "Завершено";

// При переводе сделки в «Заказ готов» проставляем ВСЕМ позициям статус «Завершено»
// (id 13953) — менеджеры иногда забывают отметить услуги/дизайн. Само уведомление
// потом отправит КРОН (раз в 15 мин), увидев, что все позиции завершены. Прямой
// авто-отправки на фронте больше нет (это и убирает лишние повторы при смене статуса).
async function markAllElementsCompleted(dealId) {
    if (currentUser.role !== "staff") return;
    const deal = dealsCache.get(String(dealId));
    const elements = Array.isArray(deal?.elements) ? deal.elements : [];
    if (!elements.length) return;
    let changed = false;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const curId = getElementStatusInfo(el).statusObj?.id;
        if (Number(curId) === ELEMENT_STATUS_COMPLETED_ID) continue; // уже завершено
        try {
            const resp = await fetchWithTimeout(N8N_URL, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    action: "updateStatus", entity: "element", dealId: Number(dealId),
                    statusId: ELEMENT_STATUS_COMPLETED_ID, statusName: ELEMENT_STATUS_COMPLETED_NAME,
                    elementId: getElementId(el), elementIndex: i
                })
            });
            if (resp.status === 401) { handleUnauthorized(); return; }
            if (resp.ok) {
                el.status = { id: ELEMENT_STATUS_COMPLETED_ID, name: ELEMENT_STATUS_COMPLETED_NAME };
                el.status_id = ELEMENT_STATUS_COMPLETED_ID;
                el.status_name = ELEMENT_STATUS_COMPLETED_NAME;
                changed = true;
            }
        } catch (e) { console.warn("markAllElementsCompleted: позиция не обновилась", getElementId(el), e); }
    }
    if (changed) {
        dealsCache.set(String(dealId), deal);
        if (document.getElementById("deal-tab")) openDealInTab(Number(dealId), { preserveScroll: true });
    }
}

// Собираем позиции заказа для письма: название, кол-во, статус, превью (без цен).
// Превью берём из уже загруженного кэша элементов (временные ссылки Яндекса).
function collectDealElementsForEmail(dealId) {
    const deal = dealsCache.get(String(dealId));
    const elements = Array.isArray(deal?.elements) ? deal.elements : [];
    return elements.map(el => {
        const elId = getElementId(el);
        let preview = "";
        try {
            const cached = elementAssetsCache.get(assetsCacheKey(dealId, elId));
            const raw = cached?.preview?.thumbUrl || cached?.preview?.url || "";
            if (isUsableAssetUrl(raw)) preview = String(raw).trim();
        } catch (_) {}
        return {
            name: getElementName(el),
            quantity: getElementQuantity(el),
            units: getElementUnits(el),
            status: getElementStatusInfo(el).name || "",
            preview
        };
    });
}

// Авто-уведомление при переводе сделки в «Заказ готов».
// n8n дедупит (не шлёт повторно, если уже слали) и молчит, если контакт не выбран.
// Тост показываем только при реальной отправке.
async function maybeAutoNotifyReadiness(dealId) {
    if (currentUser.role !== "staff") return;

    // Каналы — по СОХРАНЁННОМУ выбору галочек (пересечённому с доступностью), как при
    // ручной отправке. Если выбор не сохранён — все доступные. n8n дедупит повтор.
    const selected = getSelectedDealContact(dealId);
    const available = [];
    if (selected) {
        if (contactEmailAddr(selected)) available.push("email");
        if (contactTelegramNick(selected)) available.push("telegram");
    } else {
        available.push("email", "telegram");
    }
    const stored = getStoredNotifyChannels(dealId);
    const channels = stored ? available.filter(c => stored.includes(c)) : available;
    if (!channels.length) return;

    try {
        const sent = [];
        for (const ch of channels) {
            const r = await sendReadinessChannel(dealId, ch, { auto: true });
            if (r?.ok && r?.to) sent.push(`${ch === "email" ? "Email" : "Telegram"}: ${r.to}`);
        }
        if (sent.length) {
            showReadinessToast(`Уведомление о готовности отправлено — ${sent.join(", ")}`);
            const section = getDealNotifySection(dealId);
            const clientId = section?.dataset.clientId;
            if (clientId) {
                const fresh = await fetchDealContacts(dealId, clientId);
                if (fresh) { dealContactsCache.set(String(dealId), fresh); renderDealNotifyBody(dealId, "ready"); }
            }
        }
    } catch (e) {
        console.warn("auto readiness notify failed", e);
    }
}

function showReadinessToast(message) {
    let toast = document.getElementById("readinessToast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "readinessToast";
        toast.className = "readiness-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    // reflow для перезапуска анимации
    void toast.offsetWidth;
    toast.classList.add("is-visible");
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove("is-visible"), 5000);
}

async function deleteDealContactConfirm(dealId, contactId) {
    if (!contactId) return;
    closeAllNotifyDropdowns();
    if (!confirm("Удалить этот контакт из книги? Контакты из CRM удалить нельзя.")) return;

    const section = getDealNotifySection(dealId);
    const clientId = section?.dataset.clientId;
    section?.classList.add("is-saving");

    const ok = await deleteDealContactRequest(dealId, contactId);
    if (!ok) {
        section?.classList.remove("is-saving");
        alert("Не удалось удалить контакт");
        return;
    }

    const data = clientId ? await fetchDealContacts(dealId, clientId) : null;
    if (data) dealContactsCache.set(String(dealId), data);
    section?.classList.remove("is-saving");
    renderDealNotifyBody(dealId, "ready");
}

async function deleteDealContactRequest(dealId, contactId) {
    if (!ensureActiveSession({ silent: true })) return false;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "deleteDealContact",
                dealId: Number(dealId),
                contactId: Number(contactId)
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return false;
        }
        if (!response.ok) return false;
        const data = await response.json();
        const result = Array.isArray(data) ? data[0] : data;
        return result?.ok === true;
    } catch (e) {
        console.warn("deleteDealContact failed", e);
        return false;
    }
}

async function submitDealContactForm(dealId) {
    const section = getDealNotifySection(dealId);
    if (!section) return;
    const name = (section.querySelector(".deal-notify-name")?.value || "").trim();
    const emailRaw = (section.querySelector(".deal-notify-email")?.value || "").trim();
    const tgRaw = (section.querySelector(".deal-notify-telegram")?.value || "").trim();
    const phone = (section.querySelector(".deal-notify-phone")?.value || "").trim();

    // Отдельные поля: email — чисто почта, telegram — ник. На всякий случай парсим
    // email (если по привычке вписали «mail @nick») и берём ник из telegram-поля или оттуда.
    const emailParsed = parseContactReach(emailRaw);
    const email = emailParsed.email;
    const telegram = (tgRaw.replace(/^@+/, "").trim()) || emailParsed.telegram || "";

    if (!email && !telegram && !phone) {
        alert("Укажите email, Telegram-ник или телефон");
        return;
    }
    // Имя по умолчанию, чтобы контакт не отображался как «(без имени)».
    const displayName = name || email || (telegram ? `@${telegram}` : (phone || "Контакт"));
    // email и telegram — РАЗДЕЛЬНО (в CRM/книге email = только почта, ник в своей колонке).
    const payload = { source: "manual", name: displayName, email, phone, telegram };
    // Режим редактирования: передаём contactId → backend обновит существующий контакт.
    const editId = section.querySelector(".deal-notify-modal")?.dataset.editId;
    if (editId) payload.contactId = Number(editId);
    await saveDealContactAndRefresh(dealId, payload);
}

async function saveDealContactAndRefresh(dealId, payload) {
    const section = getDealNotifySection(dealId);
    const clientId = section?.dataset.clientId;
    if (!clientId) {
        alert("Клиент не привязан к сделке");
        return;
    }

    section?.classList.add("is-saving");
    const ok = await saveDealContactRequest(dealId, clientId, payload);
    if (!ok) {
        section?.classList.remove("is-saving");
        renderDealNotifyBody(dealId, "ready"); // вернуть прежний выбор в селекте
        alert("Не удалось сохранить контакт");
        return;
    }

    const data = await fetchDealContacts(dealId, clientId);
    if (data) dealContactsCache.set(String(dealId), data);
    section?.classList.remove("is-saving");
    renderDealNotifyBody(dealId, "ready");
}

async function saveDealContactRequest(dealId, clientId, payload) {
    if (!ensureActiveSession({ silent: true })) return false;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "saveDealContact",
                dealId: Number(dealId),
                clientId: Number(clientId),
                ...payload
            })
        });
        if (response.status === 401) {
            handleUnauthorized();
            return false;
        }
        if (!response.ok) return false;
        const data = await response.json();
        const result = Array.isArray(data) ? data[0] : data;
        return result?.ok === true;
    } catch (e) {
        console.warn("saveDealContact failed", e);
        return false;
    }
}

async function showInvoiceRequisitesModal(dealId) {
    if (!ensureActiveSession()) return;

    // clientId берём из data-атрибута строки счёта (проставлен в renderDealExtraPanel).
    const row = document.querySelector(`.deal-invoice-row[data-deal-id="${CSS.escape(String(dealId))}"]`);
    const clientId = row?.dataset.clientId ? Number(row.dataset.clientId) : null;
    if (!clientId) {
        alert("Клиент не привязан к сделке");
        return;
    }

    let requisites = clientRequisitesCache.get(String(clientId));
    if (!requisites) {
        requisites = await fetchClientRequisites(clientId);
        if (!requisites) {
            alert("Не удалось загрузить реквизиты");
            return;
        }
        clientRequisitesCache.set(String(clientId), requisites);
    }

    const selectedId = readSelectedRequisiteId(dealId);
    const addBtn = `<button type="button" class="invoice-req-add-btn" onclick="openClientRequisitesEditor(${clientId})" title="Добавить реквизиты в карточке клиента">+ Добавить в CRM ↗</button>`;

    const bodyHtml = requisites.length
        ? `<div class="invoice-req-list">
                ${requisites.map(req => `
                    <label class="invoice-req-option">
                        <input type="radio" name="invoice-req" value="${escapeHtml(req.id)}" data-inn="${escapeHtml(req.inn || "")}" ${String(req.id) === String(selectedId) ? 'checked' : ''}>
                        <span class="invoice-req-option-text">
                            <span class="invoice-req-name">${escapeHtml(req.name || req.title)}</span>
                            ${req.inn ? `<span class="invoice-req-inn">ИНН ${escapeHtml(req.inn)}</span>` : ""}
                        </span>
                    </label>
                `).join("")}
            </div>`
        : `<div class="invoice-req-empty">У клиента нет реквизитов в CRM.<br>Добавьте их, чтобы выставить счёт.</div>`;

    const footerHtml = requisites.length
        ? `<button type="button" class="btn-secondary" onclick="closeInvoiceModal()">Отмена</button>
           <button type="button" class="btn-primary" onclick="submitInvoiceWithRequisite(${dealId})">Выставить счёт</button>`
        : `<button type="button" class="btn-secondary" onclick="closeInvoiceModal()">Закрыть</button>`;

    const modalHtml = `
        <div class="invoice-modal-overlay" onmousedown="overlayDown(event)" onclick="if(overlayClickedSelf(event)) closeInvoiceModal()">
            <div class="invoice-modal">
                <div class="invoice-modal-header">
                    <h3>${requisites.length ? "Выберите реквизиты для счёта" : "Реквизиты клиента"}</h3>
                    <div class="invoice-modal-header-actions">
                        ${addBtn}
                        <button type="button" class="invoice-modal-close" onclick="closeInvoiceModal()">${icon("x")}</button>
                    </div>
                </div>
                <div class="invoice-modal-body">
                    ${bodyHtml}
                </div>
                <div class="invoice-modal-footer">
                    ${footerHtml}
                </div>
            </div>
        </div>`;

    let modal = document.getElementById("invoiceModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "invoiceModal";
        document.body.appendChild(modal);
    }
    modal.innerHTML = modalHtml;
    modal.style.display = "block";
}

function closeInvoiceModal() {
    const modal = document.getElementById("invoiceModal");
    if (modal) modal.style.display = "none";
}

async function submitInvoiceWithRequisite(dealId) {
    const modal = document.getElementById("invoiceModal");
    const radioChecked = modal?.querySelector('input[name="invoice-req"]:checked');
    const requisiteId = radioChecked?.value;
    const requisiteInn = radioChecked?.dataset.inn || "";

    if (!requisiteId) {
        alert("Выберите реквизиты");
        return;
    }

    // Запоминаем выбор, чтобы при следующем открытии он был предвыбран.
    saveSelectedRequisiteId(dealId, requisiteId);

    closeInvoiceModal();

    if (!ensureActiveSession({ silent: true })) return;

    const submitBtn = document.querySelector(`.deal-invoice-row[data-deal-id="${dealId}"] .deal-create-invoice-btn`);
    if (submitBtn) submitBtn.disabled = true;

    // Показываем анимацию «счёт выставляется».
    renderInvoiceLoading(dealId);

    let handled = false;
    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "createInvoice",
                dealId: Number(dealId),
                requisiteId: String(requisiteId),
                // ИНН выбранного реквизита — по нему n8n выставляет счёт.
                inn: String(requisiteInn || "")
            })
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }

        if (response.ok) {
            const payload = await response.json();
            // Ответ приходит массивом из одного объекта (может быть и в payload.data).
            const data = Array.isArray(payload)
                ? payload[0]
                : (Array.isArray(payload?.data) ? payload.data[0] : (payload?.data || payload));

            if (data && data.invoice_number != null && data.invoice_number !== "") {
                applyCreatedInvoice(dealId, data);
                handled = true;
            } else {
                alert("Ошибка при выставлении счёта: " + (data?.message || payload?.message || "неизвестная ошибка"));
            }
        } else {
            alert("Ошибка при выставлении счёта");
        }
    } catch (e) {
        console.error("createInvoice failed", e);
        alert("Ошибка: " + (e.message || "неизвестная ошибка"));
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        // При ошибке возвращаем прежнее состояние строки счёта (убираем анимацию).
        if (!handled) renderInvoiceDisplay(dealId);
    }
}

// Применяем данные только что созданного счёта: обновляем кеш, доп.поля и UI,
// затем сразу раскрываем inline-превью, чтобы менеджер увидел результат.
function applyCreatedInvoice(dealId, data) {
    const invoice = {
        number: String(data.invoice_number ?? "").trim(),
        date: String(data.invoice_date ?? "").trim(),
        onlineLink: String(data.invoice_online_link ?? "").trim(),
        editLink: String(data.invoice_edit_link ?? "").trim()
    };
    dealInvoiceCache.set(String(dealId), invoice);

    // Синхронизируем доп.поля CRM в памяти, чтобы перерисовки карточки не затёрли счёт.
    const map = dealAdditionalFieldsCache.get(String(dealId)) || {};
    map[DEAL_FIELD_INVOICE_NUMBER] = invoice.number;
    map[DEAL_FIELD_INVOICE_DATE] = invoice.date;
    map[DEAL_FIELD_INVOICE_PREVIEW] = invoice.onlineLink; // 1106 — превью
    map[DEAL_FIELD_INVOICE_LINK] = invoice.editLink;      // 1104 — редактирование
    dealAdditionalFieldsCache.set(String(dealId), map);

    renderInvoiceDisplay(dealId);
    // Раскрываем превью сразу после создания.
    if (isHttpUrl(invoice.onlineLink)) toggleInvoicePreview(dealId);
}

function ensureDeleteElementBanner(listEl) {
    if (!listEl) return null;
    let banner = listEl.querySelector(".deal-element-delete-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.className = "deal-element-delete-banner";
        banner.hidden = true;
        listEl.prepend(banner);
    }
    return banner;
}

function cancelDeleteDealElement(dealId) {
    pendingElementDelete = null;
    const banner = document.querySelector(`.deal-elements-list[data-deal-id="${CSS.escape(String(dealId))}"] .deal-element-delete-banner`);
    if (banner) banner.hidden = true;
}

function requestDeleteDealElement(event, dealId, elementId, elementIndex = null) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!ensureActiveSession()) return;
    if (currentUser.role !== "staff") return;

    const row = event?.currentTarget?.closest?.(".element-row");
    const list = row?.closest?.(".deal-elements-list")
        || document.querySelector(`.deal-elements-list[data-deal-id="${CSS.escape(String(dealId))}"]`);
    if (!list) return;

    const element = findDealElement?.(dealId, elementId, elementIndex)
        || dealsCache.get(String(dealId))?.elements?.[elementIndex];
    const name = getElementName(element)
        || row?.querySelector(".element-row-text")?.textContent?.split(",")[0]?.trim()
        || "позицию";

    pendingElementDelete = {
        dealId: String(dealId),
        elementId: String(elementId),
        elementIndex: elementIndex != null ? Number(elementIndex) : null,
        name
    };

    const banner = ensureDeleteElementBanner(list);
    if (!banner) return;

    banner.innerHTML = `
        <div class="deal-element-delete-banner-text">Удалить позицию «${escapeHtml(name)}» из заказа?</div>
        <div class="deal-element-delete-banner-actions">
            <button type="button" class="deal-element-delete-cancel" onclick="cancelDeleteDealElement(${dealId})">Отмена</button>
            <button type="button" class="deal-element-delete-confirm" onclick="confirmDeleteDealElement(${dealId})">Удалить</button>
        </div>`;
    banner.hidden = false;
}

async function confirmDeleteDealElement(dealId) {
    if (!ensureActiveSession()) return;
    if (currentUser.role !== "staff") return;

    const pending = pendingElementDelete;
    if (!pending || String(pending.dealId) !== String(dealId)) return;

    const confirmBtn = document.querySelector(`.deal-elements-list[data-deal-id="${CSS.escape(String(dealId))}"] .deal-element-delete-confirm`);
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "…";
    }

    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
                action: "deleteDealElement",
                dealId: Number(dealId),
                elementId: Number(pending.elementId)
            })
        });

        if (response.status === 401) {
            handleUnauthorized();
            return;
        }
        if (!response.ok) throw new Error("delete failed");

        const deal = dealsCache.get(String(dealId));
        if (deal?.elements) {
            deal.elements = deal.elements.filter(el => String(getElementId(el)) !== String(pending.elementId));
            dealsCache.set(String(dealId), normalizeDealForView(deal));
        }

        const row = document.querySelector(
            `.element-row[data-deal-id="${CSS.escape(String(dealId))}"][data-element-id="${CSS.escape(String(pending.elementId))}"]`
        );
        row?.remove();

        const list = document.querySelector(`.deal-elements-list[data-deal-id="${CSS.escape(String(dealId))}"]`);
        if (list) updateDealTotal(list);

        if (typeof syncAdvSearchCacheFromDealsCache === "function") {
            syncAdvSearchCacheFromDealsCache();
        }
        if (document.getElementById("deal-tab")) {
            saveOpenDealState(dealsCache.get(String(dealId)));
        }

        cancelDeleteDealElement(dealId);
    } catch (e) {
        alert("Не удалось удалить позицию");
        console.error(e);
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Удалить";
        }
    }
}

function renderDealListSearchHeader(deal, dealLink, dealActionButtons, statusControl) {
    const client = escapeHtml(deal.client?.name || deal.client_name || "Клиент не указан");
    const date = formatDealCreatedDate(getDealCreatedAt(deal));
    const manager = escapeHtml(getDealResponsibleName(deal));

    return `
        <div class="crm-header crm-list-header">
            <div class="crm-list-header-main">
                <div class="deal-num">${dealLink}${dealActionButtons}</div>
                <div class="crm-list-header-meta">
                    <span class="crm-list-client">${icon("user")} ${client}</span>
                    ${date ? `<span class="crm-list-date">${escapeHtml(date)}</span>` : ""}
                    <span class="crm-list-manager">${manager}</span>
                </div>
            </div>
            <div class="crm-list-header-status">${statusControl}</div>
        </div>
        <div class="client-name client-name--mobile">${icon("user")} ${client}</div>`;
}

function renderDealListSearchFooter(deal, isClosed, isDetailMode) {
    const date = formatDealCreatedDate(getDealCreatedAt(deal));
    const manager = escapeHtml(getDealResponsibleName(deal));

    return `
        <div class="deal-save-area" data-deal-id="${deal.id}" style="display: none;">
            <button onclick="saveDeal(${deal.id}, this)">${icon("save")} Сохранить</button>
        </div>
        <div class="crm-footer crm-list-footer">
            <div class="deal-footer-left">
                <div class="deal-footer-meta deal-footer-meta--mobile">
                    ${date ? `<div>Дата заказа: <b>${escapeHtml(date)}</b></div>` : ""}
                    <div>Менеджер: <b>${manager}</b></div>
                </div>
            </div>
            ${isDetailMode ? renderPaymentSummary(deal, isClosed) : renderDealTotalOnly(deal)}
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
    const elementsSum = sumDealElementsTotal(deal);

    let total = toMoneyNumber(deal?.amount ?? deal?.total ?? deal?.sum, null);
    if (total != null && elementsSum > 0 && total + 0.01 < elementsSum * 0.75) {
        total = elementsSum;
    }
    if (total == null && debtFromApi != null) {
        total = paid + debtFromApi;
    }
    if (total == null && elementsSum > 0) {
        total = elementsSum;
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

// --- Прибыль по сделке (staff, карточка заказа) ---
// Грязная = доход − себестоимость. Чистая = доход − налог 10% − себестоимость.
const DEAL_PROFIT_TAX_RATE = 0.10;

function computeDealProfit(deal) {
    const revenue = Number(getDealFinancials(deal).total) || 0;
    const elements = Array.isArray(deal?.elements) ? deal.elements : [];

    let cost = 0;
    let filled = 0;
    elements.forEach(el => {
        const c = typeof getElementCost === "function" ? getElementCost(el) : null;
        if (c != null) { cost += c; filled++; }
    });

    return {
        revenue,
        cost,
        gross: revenue - cost,
        net: revenue - (revenue * DEAL_PROFIT_TAX_RATE) - cost,
        hasCost: filled > 0,
        partial: filled > 0 && filled < elements.length
    };
}

function renderDealProfitBtn(dealId) {
    return `<button type="button" class="deal-profit-btn" onclick="toggleDealProfit(${dealId})" title="Показать прибыль по сделке">Прибыль</button>`;
}

function renderDealProfitBlock(deal) {
    return `<div class="deal-profit-block" data-deal-id="${deal.id}" data-open="0">${renderDealProfitBtn(deal.id)}</div>`;
}

function renderDealProfitData(deal) {
    const p = computeDealProfit(deal);
    if (!p.hasCost) return `<div class="deal-profit-empty">Себестоимость не заполнена</div>`;

    const money = v => `${Math.round(v).toLocaleString('ru-RU')} ₽`;
    const cls = v => (v >= 0 ? "is-plus" : "is-minus");
    return `
        <div class="deal-profit-row"><span>Грязная</span><b class="${cls(p.gross)}">${money(p.gross)}</b></div>
        <div class="deal-profit-row"><span>Чистая (−10%)</span><b class="${cls(p.net)}">${money(p.net)}</b></div>
        ${p.partial ? `<div class="deal-profit-note">не у всех позиций указана себестоимость</div>` : ""}`;
}

function toggleDealProfit(dealId) {
    const block = document.querySelector(`.deal-profit-block[data-deal-id="${CSS.escape(String(dealId))}"]`);
    if (!block) return;

    if (block.dataset.open === "1") {
        block.dataset.open = "0";
        block.innerHTML = renderDealProfitBtn(dealId);
        return;
    }

    const deal = dealsCache.get(String(dealId));
    block.dataset.open = "1";
    block.innerHTML = `<div class="deal-profit-data" onclick="toggleDealProfit(${dealId})" title="Скрыть">${renderDealProfitData(deal)}</div>`;
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

    modal.addEventListener('mousedown', overlayDown);
    modal.onclick = (e) => { if (overlayClickedSelf(e)) closePaymentModal(); };
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
        ? `<button type="button" class="deal-action-btn" onclick="event.stopPropagation(); showDealContactInfo(${deal.id}, this)" title="Контакты клиента" aria-label="Контакты клиента">${icon("user")}</button>`
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
        ${phone ? `<div style="margin-top:8px;">${icon("phone")} <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ""}
        ${email ? `<div style="margin-top:4px;">${icon("mail")} <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>` : ""}`;

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
        tabBtn.className = 'nav-tab tab-btn nav-tab--deal';
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

// Промис-подтверждение в стиле .deal-confirm-popover → resolve(true/false).
// Отмена: кнопка, клик вне попапа, Esc, либо если попап снесли извне.
function confirmActionPopover({ message, confirmText = "Да", cancelText = "Отмена", anchor = null, danger = false } = {}) {
    return new Promise(resolve => {
        document.querySelectorAll('.deal-confirm-popover').forEach(el => el.remove());

        const popover = document.createElement('div');
        // --await: глобальный document-click НЕ сносит этот попап (иначе клик,
        // из которого он создан — например по пункту статус-меню, — всплывёт
        // до document и убьёт его в тот же тик). Закрытие по клику вне делает
        // собственный отложенный mousedown-обработчик ниже.
        popover.className = 'deal-confirm-popover deal-confirm-popover--await';
        popover.innerHTML = `
            <div style="margin-bottom:10px;">${message}</div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button type="button" class="confirm-no" style="background:#eef1f5; color:#555;">${escapeHtml(cancelText)}</button>
                <button type="button" class="confirm-yes" style="background:${danger ? '#c0392b' : '#27ae60'}; color:white;">${escapeHtml(confirmText)}</button>
            </div>`;
        document.body.appendChild(popover);

        if (anchor && typeof anchor.getBoundingClientRect === "function") {
            const rect = anchor.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - popover.offsetWidth - 12);
            popover.style.left = `${Math.max(12, left)}px`;
            popover.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - popover.offsetHeight - 12)}px`;
        } else {
            popover.style.left = `${Math.max(12, (window.innerWidth - popover.offsetWidth) / 2)}px`;
            popover.style.top = `${Math.max(12, (window.innerHeight - popover.offsetHeight) / 2)}px`;
        }

        let done = false;
        const observer = new MutationObserver(() => {
            if (!document.body.contains(popover)) finish(false);
        });
        function finish(value) {
            if (done) return;
            done = true;
            observer.disconnect();
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('mousedown', onOutside, true);
            popover.remove();
            resolve(value);
        }
        function onKey(e) { if (e.key === 'Escape') finish(false); }
        function onOutside(e) { if (!popover.contains(e.target)) finish(false); }

        observer.observe(document.body, { childList: true });
        popover.querySelector('.confirm-no').onclick = () => finish(false);
        popover.querySelector('.confirm-yes').onclick = () => finish(true);
        setTimeout(() => {
            document.addEventListener('keydown', onKey, true);
            document.addEventListener('mousedown', onOutside, true);
        }, 0);
    });
}

// Подтверждение завершения сделки (статус «Завершено») — чтобы не закрыть заказ случайно.
function confirmDealCompletion(dealId, anchor = null) {
    const deal = dealsCache.get(String(dealId));
    const num = deal?.num ?? deal?.id ?? dealId;
    return confirmActionPopover({
        message: `Завершить сделку <b>№ ${escapeHtml(String(num))}</b>?<br><span style="color:#8c887e;">Заказ будет закрыт.</span>`,
        confirmText: "Завершить",
        cancelText: "Отмена",
        anchor,
        danger: true
    });
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

function renderAdvSearchPagination(targetDiv) {
    if (!targetDiv || targetDiv.id !== "advCrmResults") return;
    if (getCrmViewMode() === "kanban") return;
    if (advSearchPagesCount <= 1) return;

    targetDiv.querySelector(".crm-search-pagination")?.remove();

    const nav = document.createElement("nav");
    nav.className = "crm-search-pagination";
    nav.setAttribute("aria-label", "Страницы результатов поиска");

    const currentPage = advSearchListPage;
    const totalPages = advSearchPagesCount;

    const addBtn = (label, page, { active = false, disabled = false } = {}) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "crm-search-page-btn";
        btn.textContent = label;
        btn.disabled = disabled;
        if (active) btn.classList.add("active");
        if (!disabled && !active) {
            btn.addEventListener("click", () => goToAdvSearchPage(page));
        }
        nav.appendChild(btn);
    };

    addBtn("«", currentPage - 1, { disabled: currentPage <= 1 });

    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    if (start > 1) {
        addBtn("1", 1);
        if (start > 2) {
            const dots = document.createElement("span");
            dots.className = "crm-search-page-dots";
            dots.textContent = "…";
            nav.appendChild(dots);
        }
    }

    for (let page = start; page <= end; page += 1) {
        addBtn(String(page), page, { active: page === currentPage });
    }

    if (end < totalPages) {
        if (end < totalPages - 1) {
            const dots = document.createElement("span");
            dots.className = "crm-search-page-dots";
            dots.textContent = "…";
            nav.appendChild(dots);
        }
        addBtn(String(totalPages), totalPages);
    }

    addBtn("»", currentPage + 1, { disabled: currentPage >= totalPages });

    const info = document.createElement("span");
    info.className = "crm-search-page-info";
    info.textContent = `Страница ${currentPage} из ${totalPages}`;
    nav.appendChild(info);

    targetDiv.appendChild(nav);
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
        card.className = isDetailMode ? 'crm-item' : 'crm-item crm-item--list';
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
            </div>` : renderDealListSearchHeader(deal, dealLink, dealActionButtons, statusControl);

        const addBtnHtml = (currentUser.role === 'staff' && !isClosed)
            ? `
                <div class="add-btn-container">
                    <div class="deal-add-buttons">
                        <button class="add-btn" onclick="addToDeal(${deal.id}, this)">+ Добавить просчет из калькулятора</button>
                        ${isDetailMode ? `<button class="add-btn add-btn-secondary" onclick="openManualElementEditor(${deal.id})">+ Добавить вручную</button>` : ""}
                    </div>
                </div>`
            : '';

        card.innerHTML = isDetailMode ? `
            ${dealHeaderHtml}
            <div class="client-name">${icon("user")} ${escapeHtml(deal.client?.name || deal.client_name || 'Клиент не указан')}</div>
            <div class="elements-list${dealCostsVisible ? "" : " costs-hidden"}">
                ${Array.isArray(deal.elements) && deal.elements.length ? renderElementColsHeader({ isClosed }) : ""}
                <div class="deal-elements-list" data-deal-id="${deal.id}">${elementsHtml}</div>
                ${addBtnHtml}
            </div>
            <div class="deal-save-area" data-deal-id="${deal.id}" style="display: none;">
                <button onclick="saveDeal(${deal.id}, this)">${icon("save")} Сохранить</button>
            </div>
            <div class="crm-footer">
                <div class="deal-footer-left">
                    ${renderDealFooterMeta(deal)}
                </div>
                ${currentUser.role === "staff" ? renderDealProfitBlock(deal) : ""}
                ${renderPaymentSummary(deal, isClosed)}
            </div>
            ${renderDealExtraPanel(deal)}` : `
            ${dealHeaderHtml}
            <div class="elements-list">
                <div class="deal-elements-list" data-deal-id="${deal.id}">${elementsHtml}</div>
                ${addBtnHtml}
            </div>
            ${renderDealListSearchFooter(deal, isClosed, false)}`;
            
        targetDiv.appendChild(card);

        if (isDetailMode && typeof scheduleElementAssetsLoading === "function") {
            scheduleElementAssetsLoading(deal);
        }
        if (isDetailMode && currentUser.role === "staff") {
            scheduleDealExtraFieldsLoading(deal);
        }
    });

    renderAdvSearchPagination(targetDiv);
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
                <a href="https://crm.heavendevelop.ru/editDeal/${id}" target="_blank" style="color: var(--accent); text-decoration: none;">№ ${id} ${icon("link")}</a>
                <small style="font-weight:normal; color:#888; margin-left:8px;">новая сделка</small>
            </div>
            <div class="status-badge" style="background:#eaf3ff; color:#2f7df6;">Новая</div>
        </div>
        <div class="client-name">${icon("user")} Новая сделка создана</div>
        <div class="elements-list">
            <div class="deal-elements-list" data-deal-id="${id}"></div>
            <div class="add-btn-container" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; text-align: left;">
                <button class="add-btn" onclick="addToDeal(${id}, this)">+ Добавить расчет</button>
            </div>
        </div>
        <div class="deal-save-area" data-deal-id="${id}" style="display: none;">
            <button onclick="saveDeal(${id}, this)">${icon("save")} Сохранить</button>
        </div>
        <div class="crm-footer">
            <div class="deal-footer-left">
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
    const categoryId = typeof getDefaultElementCategoryId === "function" ? getDefaultElementCategoryId() : null;
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
    row.setAttribute('data-category-id', categoryId != null ? String(categoryId) : "");
    row.setAttribute('data-units', "шт");

    // Разбивка себестоимости для наглядности/проверки (только staff).
    const _sheets = Number(lastCalcData.sra3Sheets ?? 0);
    const _cost = Math.round(Number(lastCalcData.costTotal ?? s?.totalCost ?? 0));
    const _costHQ = Math.round(Number(lastCalcData.costHQ ?? lastCalcData.costTotal ?? s?.totalCost ?? 0));
    const _costLine = currentUser.role === "staff"
        ? `<small class="new-row-costs">Листов SRA3: <b>${_sheets}</b> · Себест.: <b>${_cost.toLocaleString('ru-RU')} ₽</b> · HQ: <b>${_costHQ.toLocaleString('ru-RU')} ₽</b></small>`
        : "";

    // Стилизуется через CSS (.element-row.new-row) — без инлайн-стилей и side-stripe.
    row.innerHTML = `
        <span class="element-row-text">${escapeHtml(fullName)}, ${lastCalcData.qty} шт${_costLine}</span>
        <span class="element-row-total">${finalTotal.toLocaleString('ru-RU', {minimumFractionDigits: 2})} ₽</span>
        <button type="button" class="element-row-delete-btn" onclick="var l=this.closest('.deal-elements-list');this.closest('.new-row').remove();updateDealTotal(l);" title="Удалить" aria-label="Удалить">×</button>
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
    
    btn.innerHTML = icon("loader", { spin: true }) + " Сохранение...";
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
            const sendCategoryId = Number(r.getAttribute('data-category-id')) || (typeof getDefaultElementCategoryId === "function" ? getDefaultElementCategoryId() : null);
            const sendUnits = String(r.getAttribute('data-units') || "шт").trim() || "шт";

            const item = { 
                name: r.getAttribute('data-full-name'), 
                quantity: sendQty, 
                total: sendTotal, // Итоговая сумма
                price: sendPrice, // Цена за единицу (теперь точно 18.94)
                cost: Number.isFinite(sendCostTotal) ? sendCostTotal : null,
                // Доп.поля для n8n: далее на сервере можно сделать PUT в CRM
                sra3_sheets: Number.isFinite(sendSra3Sheets) ? sendSra3Sheets : null,
                cost_total: Number.isFinite(sendCostTotal) ? sendCostTotal : null,
                cost_hq: Number.isFinite(sendCostHQ) ? sendCostHQ : null,
                category_id: Number.isFinite(sendCategoryId) ? sendCategoryId : null,
                units: sendUnits
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
            btn.innerHTML = icon("save") + " Сохранить";
            btn.disabled = false;
        }
    }
}

function parseElementRowTotal(row) {
    if (!row) return 0;

    const dataPrice = row.getAttribute("data-price");
    if (dataPrice != null && dataPrice !== "") {
        const fromDataPrice = Number(dataPrice);
        if (Number.isFinite(fromDataPrice)) return fromDataPrice;
    }

    const dataTotalSum = row.getAttribute("data-total-sum");
    if (dataTotalSum != null && dataTotalSum !== "") {
        const fromAttr = Number(dataTotalSum);
        if (Number.isFinite(fromAttr)) return fromAttr;
    }

    const totalEl = row.querySelector(".element-row-total");
    if (totalEl) {
        return toMoneyNumber(totalEl.textContent.replace(/\s*(руб\.|₽)\s*$/i, ""), 0);
    }

    return 0;
}

function updateDealTotal(el) {
    if (!el) return;

    let sum = 0;
    el.querySelectorAll(".element-row").forEach(row => {
        const lineTotal = parseElementRowTotal(row);
        if (Number.isFinite(lineTotal)) sum += lineTotal;
        if (row.hasAttribute("data-price") || row.querySelector(".element-row-total")) {
            row.setAttribute("data-price", String(lineTotal));
        }
    });

    const id = el.dataset.dealId || el.id?.replace("list-", "");
    const card = el.closest(".crm-item");
    const deal = dealsCache.get(String(id));
    if (deal) {
        const financials = getDealFinancials(deal);
        deal.amount = sum;
        deal.debt = Math.max(0, sum - financials.paid);
        dealsCache.set(String(id), deal);
        if (document.getElementById("deal-tab")) saveOpenDealState(deal);

        const paymentBlock = card?.querySelector(".deal-payment-block");
        if (paymentBlock) {
            refreshPaymentBlock(id, card);
        } else {
            const totalOnlyEl = card?.querySelector(".deal-total-only");
            if (totalOnlyEl) totalOnlyEl.outerHTML = renderDealTotalOnly(deal);
        }
        return;
    }

    const oldTotalEl = card?.querySelector(`#total-${id}`) || document.getElementById(`total-${id}`);
    if (oldTotalEl) oldTotalEl.innerText = sum.toLocaleString();
}

