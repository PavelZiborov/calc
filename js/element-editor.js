// --- РЕДАКТОР ПОЗИЦИИ (превью + макеты + доп. поля) ---

const elementAssetsCache = new Map();
const dealLayoutsPrefetchToken = new Map();
const dealElementFieldsPrefetchToken = new Map();
let currentElementEditor = null;
let elementEditorUploadState = null;

const ELEMENT_FIELD_COST_HQ = 1057;
const ELEMENT_FIELD_SRA3 = 1066;
const MAX_PREVIEW_BYTES = 512000;
const PREVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PREVIEW_FETCH_MAX_RETRIES = 3;
const ELEMENT_ASSETS_TIMEOUT_MS = 45000;
const previewRefreshInFlight = new Map();

function assetsCacheKey(dealId, elementId) {
    return `${dealId}:${elementId}`;
}

function isUsableAssetUrl(value) {
    if (value == null) return false;
    const url = String(value).trim();
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower === "undefined" || lower === "null" || lower === "nan") return false;
    return /^https?:\/\//i.test(url);
}

function getPreviewDisplayUrls(preview) {
    if (!preview) return { primary: null, fallback: null };
    const full = isUsableAssetUrl(preview.url) ? String(preview.url).trim() : null;
    const thumb = isUsableAssetUrl(preview.thumbUrl) ? String(preview.thumbUrl).trim() : null;
    const primary = thumb || full;
    const fallback = full && full !== primary ? full : null;
    return { primary, fallback };
}

function bindPreviewImgFallback(img, fallbackUrl) {
    if (!img || !fallbackUrl) return;
    img.addEventListener("error", () => {
        if (img.dataset.fallbackApplied === "1") return;
        img.dataset.fallbackApplied = "1";
        img.src = fallbackUrl;
    }, { once: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function previewNeedsFetch(cached) {
    if (!cached) return true;
    if (isUsableAssetUrl(cached.preview?.url) || isUsableAssetUrl(cached.preview?.thumbUrl)) return false;
    if (cached.status === "loading") return false;
    if (cached.previewMissing === true) return false;
    return (cached.previewRetryCount || 0) < PREVIEW_FETCH_MAX_RETRIES;
}

function bindPreviewImgRefresh(img, dealId, elementId) {
    if (!img || !dealId || !elementId) return;

    img.addEventListener("error", async () => {
        if (img.dataset.previewRefreshDone === "1") return;
        img.dataset.previewRefreshDone = "1";

        const refreshed = await refreshElementPreview(dealId, elementId);
        if (!refreshed) return;

        const cached = elementAssetsCache.get(assetsCacheKey(dealId, elementId));
        const { primary, fallback } = getPreviewDisplayUrls(cached?.preview);
        if (!primary) return;

        img.dataset.previewRefreshDone = "";
        img.dataset.fallbackApplied = "";
        img.src = primary;
        if (fallback) bindPreviewImgFallback(img, fallback);
        bindPreviewImgRefresh(img, dealId, elementId);
    }, { once: true });
}

function setPreviewImgContent(container, preview, altText = "", context = null) {
    const { primary, fallback } = getPreviewDisplayUrls(preview);
    if (!primary) {
        container.innerHTML = "";
        return false;
    }

    container.innerHTML = `<img src="${escapeHtml(primary)}" alt="${escapeHtml(altText)}" referrerpolicy="no-referrer">`;
    const img = container.querySelector("img");
    if (img && fallback) bindPreviewImgFallback(img, fallback);
    if (img && context?.dealId && context?.elementId) {
        bindPreviewImgRefresh(img, context.dealId, context.elementId);
    }
    return true;
}

function normalizePreview(raw) {
    if (!raw || typeof raw !== "object") return null;

    const url = isUsableAssetUrl(raw.url) ? String(raw.url).trim() : null;
    if (!url) return null;

    const thumbCandidate = raw.thumbUrl || raw.thumb_url || raw.url;
    const thumbUrl = isUsableAssetUrl(thumbCandidate) ? String(thumbCandidate).trim() : url;

    return {
        id: raw.id ?? raw.file_id ?? null,
        url,
        thumbUrl,
        diskFileName: raw.diskFileName || raw.disk_file_name || null
    };
}

function inferLayoutType(item) {
    if (item.type === "file" || item.type === 1 || item.type === "1") return "file";
    if (item.type === "link" || item.type === 2 || item.type === "2") return "link";
    if (item.crm_type === 1 || item.crmType === 1) return "file";
    if (item.crm_type === 2 || item.crmType === 2) return "link";

    const url = String(item.url || item.file_name || item.fileName || "");
    if (/^https?:\/\//i.test(url) && !/downloader\.disk\.yandex/i.test(url)) {
        if (/yadi\.sk/i.test(url)) return "link";
        if (/disk\.yandex\./i.test(url)) return "link";
        if (!/\.(pdf|jpg|jpeg|png|webp|gif|tif|tiff|ai|eps|psd|zip|rar|7z|doc|docx|cdr|svg)$/i.test(url)) {
            return "link";
        }
    }
    if (/yadi\.sk/i.test(url)) return "link";
    return "file";
}

function layoutDisplayName(fileName, fallbackUrl = "") {
    const raw = String(fileName || fallbackUrl || "").trim();
    if (!raw) return "файл";
    if (!/^https?:\/\//i.test(raw)) return raw;

    try {
        const base = decodeURIComponent(new URL(raw).pathname.split("/").filter(Boolean).pop() || "");
        if (base) return base;
    } catch (e) {
        // ignore malformed URL
    }

    return raw.replace(/^https?:\/\//, "").slice(0, 80);
}

function layoutIsDeletable(item) {
    const id = Number(item.id ?? item.layout_id ?? item.layoutId);
    if (!Number.isFinite(id) || id <= 0) return false;
    if (item.isCanDelete === false || item.is_can_delete === false) return false;
    return true;
}

function resolveLayoutItemUrl(item) {
    if (isUsableAssetUrl(item?.url)) return String(item.url).trim();

    const type = inferLayoutType(item);
    if (type !== "link") return "";

    for (const candidate of [item?.file_name, item?.fileName, item?.name]) {
        if (isUsableAssetUrl(candidate)) return String(candidate).trim();
    }
    return "";
}

function normalizeLayouts(rawLayouts) {
    if (!Array.isArray(rawLayouts)) return [];

    return rawLayouts
        .map(item => {
            const url = resolveLayoutItemUrl(item);
            if (!url) return null;

            const name = layoutDisplayName(item.name || item.file_name || item.fileName, url);
            const id = item.id ?? item.file_id ?? item.layout_id ?? name;
            const type = item.type === "file" || item.type === "link"
                ? item.type
                : inferLayoutType({ ...item, url });

            return {
                id,
                type,
                name,
                url,
                size: item.size ?? null,
                isCanDelete: item.isCanDelete !== false && item.is_can_delete !== false
            };
        })
        .filter(Boolean);
}

function normalizeAssetsResponse(data) {
    const payload = Array.isArray(data) ? (data[0]?.json || data[0]) : (data?.data || data);
    if (!payload || typeof payload !== "object") {
        return { preview: null, layouts: [] };
    }

    return {
        preview: normalizePreview(payload.preview),
        layouts: normalizeLayouts(payload.layouts)
    };
}

function getElementAdditionalField(element, fieldId) {
    const fields = element?.additional_fields || element?.additionalFields || [];
    if (!Array.isArray(fields)) return null;

    const found = fields.find(field => {
        const id = field.id ?? field.field_id ?? field.additional_field_id;
        return String(id) === String(fieldId);
    });

    return found?.value ?? found?.val ?? found?.text ?? null;
}

function getElementCostHq(element) {
    const raw = element?.cost_hq ?? element?.costHq ?? getElementAdditionalField(element, ELEMENT_FIELD_COST_HQ);
    return toMoneyNumber(raw, null);
}

function getElementCost(element) {
    const raw = element?.cost ?? element?.cost_total ?? element?.costTotal;
    return toMoneyNumber(raw, null);
}

function getElementSra3Sheets(element) {
    const raw = element?.sra3_sheets ?? element?.sra3Sheets ?? getElementAdditionalField(element, ELEMENT_FIELD_SRA3);
    if (raw == null || raw === "") return null;
    const n = Number(String(raw).replace(/\s+/g, ""));
    return Number.isFinite(n) ? n : null;
}

function normalizeElementResponsibles(raw) {
    if (!Array.isArray(raw)) return [];

    return raw.map(item => {
        if (item == null) return null;
        const id = Number(item.id ?? item.user_id ?? item.userId);
        const name = String(item.name || item.fio || "").trim();
        if (!Number.isFinite(id) || id <= 0) return null;
        return { id, name: name || `#${id}` };
    }).filter(Boolean);
}

function getElementResponsibles(element) {
    return normalizeElementResponsibles(element?.responsibles);
}

function buildResponsibleOptionsOrdered(selectedResponsibles = []) {
    const PRINTER_NAME = "Печатник";
    const byId = new Map();

    for (const manager of getManagers()) {
        byId.set(Number(manager.id), { id: Number(manager.id), name: manager.name });
    }
    for (const responsible of selectedResponsibles) {
        if (!byId.has(responsible.id)) {
            byId.set(responsible.id, responsible);
        }
    }

    const all = [...byId.values()];
    const printer = all.find(item => item.name === PRINTER_NAME) || null;
    const others = all
        .filter(item => item.name !== PRINTER_NAME)
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));

    const ordered = [];
    if (printer) ordered.push(printer);
    ordered.push(...others);
    return ordered;
}

function toggleElementEditorResponsiblesDropdown() {
    document.getElementById("elementEditorResponsiblesDropdown")?.classList.toggle("open");
}

function updateElementEditorResponsiblesLabel() {
    const btn = document.getElementById("elementEditorResponsiblesBtn");
    const list = document.getElementById("elementEditorResponsiblesList");
    if (!btn || !list) return;

    const noneInput = list.querySelector('input[data-none="1"]');
    if (noneInput?.checked) {
        btn.innerText = "";
        return;
    }

    const selected = [...list.querySelectorAll('input[type="checkbox"]:checked:not([data-none="1"])')];
    if (selected.length === 0) {
        btn.innerText = "";
    } else if (selected.length === 1) {
        btn.innerText = selected[0].dataset.name || "";
    } else {
        btn.innerText = `Выбрано ${selected.length}`;
    }
}

function handleElementEditorResponsibleChange(event) {
    const input = event.target;
    const list = document.getElementById("elementEditorResponsiblesList");
    if (!list || !input) return;

    if (input.dataset.none === "1") {
        if (input.checked) {
            list.querySelectorAll('input[type="checkbox"]:not([data-none="1"])').forEach(el => {
                el.checked = false;
            });
        }
    } else if (input.checked) {
        const noneInput = list.querySelector('input[data-none="1"]');
        if (noneInput) noneInput.checked = false;
    }

    const hasSelected = list.querySelector('input[type="checkbox"]:checked:not([data-none="1"])');
    const noneInput = list.querySelector('input[data-none="1"]');
    if (!hasSelected && noneInput && !noneInput.checked) {
        noneInput.checked = true;
    }

    updateElementEditorResponsiblesLabel();
}

function getSelectedElementEditorResponsibleIds() {
    const list = document.getElementById("elementEditorResponsiblesList");
    if (!list) return [];

    const noneInput = list.querySelector('input[data-none="1"]');
    if (noneInput?.checked) return [];

    return [...list.querySelectorAll('input[type="checkbox"]:checked:not([data-none="1"])')]
        .map(input => Number(input.value))
        .filter(id => Number.isFinite(id) && id > 0);
}

function collectSelectedResponsiblesFromEditor() {
    const list = document.getElementById("elementEditorResponsiblesList");
    if (!list) return [];

    const noneInput = list.querySelector('input[data-none="1"]');
    if (noneInput?.checked) return [];

    return [...list.querySelectorAll('input[type="checkbox"]:checked:not([data-none="1"])')]
        .map(input => ({
            id: Number(input.value),
            name: String(input.dataset.name || "").trim() || `#${input.value}`
        }))
        .filter(item => Number.isFinite(item.id) && item.id > 0);
}

function renderElementEditorResponsiblesList(element) {
    const list = document.getElementById("elementEditorResponsiblesList");
    const readonlyEl = document.getElementById("elementEditorResponsiblesReadonly");
    if (!list) return;

    const responsibles = getElementResponsibles(element);
    const selectedIds = new Set(responsibles.map(item => item.id));
    const noneSelected = responsibles.length === 0;
    const options = buildResponsibleOptionsOrdered(responsibles);

    const items = [
        `<label class="status-option element-responsible-option element-responsible-none">
            <input type="checkbox" value="" data-name="" data-none="1"${noneSelected ? " checked" : ""}>
            <span class="status-option-name">&nbsp;</span>
            <span class="status-checkmark">✓</span>
        </label>`
    ];

    items.push(...options.map(item => {
        const checked = selectedIds.has(item.id) ? " checked" : "";
        return `<label class="status-option element-responsible-option">
            <input type="checkbox" value="${item.id}" data-name="${escapeHtml(item.name)}"${checked}>
            <span class="status-option-name">${escapeHtml(item.name)}</span>
            <span class="status-checkmark">✓</span>
        </label>`;
    }));

    list.innerHTML = items.join("");
    list.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener("change", handleElementEditorResponsibleChange);
    });

    updateElementEditorResponsiblesLabel();

    if (readonlyEl) {
        readonlyEl.textContent = responsibles.length
            ? responsibles.map(item => item.name).join(", ")
            : "—";
    }
}

function fillElementEditorResponsibles(element) {
    renderElementEditorResponsiblesList(element);
}

const ELEMENT_UNIT_PRESETS = ["шт", "услуга"];

function normalizeElementUnitsValue(units) {
    const value = String(units || "").trim();
    return value || "шт";
}

function getElementEditorUnitsValue() {
    const customInput = document.getElementById("elementEditorUnitsCustom");
    const custom = String(customInput?.value || "").trim();
    const activePreset = document.querySelector("#elementEditorUnitsList .element-units-preset.is-selected");
    if (activePreset?.dataset?.units) return activePreset.dataset.units;
    if (custom) return custom;
    return "шт";
}

function updateElementEditorUnitsLabel() {
    const btn = document.getElementById("elementEditorUnitsBtn");
    const readonlyEl = document.getElementById("elementEditorUnitsReadonly");
    const value = getElementEditorUnitsValue();
    if (btn) btn.textContent = value;
    if (readonlyEl) readonlyEl.textContent = value || "—";
}

function setElementEditorUnitsValue(units) {
    const value = normalizeElementUnitsValue(units);
    const customInput = document.getElementById("elementEditorUnitsCustom");
    const presets = document.querySelectorAll("#elementEditorUnitsList .element-units-preset");

    if (ELEMENT_UNIT_PRESETS.includes(value)) {
        presets.forEach(btn => {
            btn.classList.toggle("is-selected", btn.dataset.units === value);
        });
        if (customInput) customInput.value = "";
    } else {
        presets.forEach(btn => btn.classList.remove("is-selected"));
        if (customInput) customInput.value = value;
    }

    updateElementEditorUnitsLabel();
}

function fillElementEditorUnits(element) {
    setElementEditorUnitsValue(getElementUnits(element));
}

function toggleElementEditorUnitsDropdown() {
    document.getElementById("elementEditorUnitsDropdown")?.classList.toggle("open");
}

function handleElementEditorUnitsPreset(event) {
    event.preventDefault();
    event.stopPropagation();
    const units = event.currentTarget?.dataset?.units;
    if (!units) return;
    setElementEditorUnitsValue(units);
    document.getElementById("elementEditorUnitsDropdown")?.classList.remove("open");
}

function handleElementEditorUnitsCustomInput() {
    document.querySelectorAll("#elementEditorUnitsList .element-units-preset").forEach(btn => {
        btn.classList.remove("is-selected");
    });
    updateElementEditorUnitsLabel();
}

function fillElementEditorMeta(element) {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    fillElementEditorUnits(element);
    fillElementEditorResponsibles(element);
}

async function fetchElementResponsibles(dealId, elementId) {
    const data = await elementAssetsApi("getElementResponsibles", { dealId, elementId }, { silent401: true });
    return normalizeElementResponsibles(data?.responsibles ?? data);
}

async function ensureElementResponsiblesLoaded(dealId, elementId, elementIndex = null) {
    const element = findDealElement(dealId, elementId, elementIndex);
    if (!element) return null;

    if (element._responsiblesLoaded === true) {
        if (isElementEditorOpen(dealId, elementId)) {
            fillElementEditorResponsibles(element);
        }
        return element;
    }

    try {
        element.responsibles = await fetchElementResponsibles(dealId, elementId);
    } catch (e) {
        console.warn("getElementResponsibles failed", e);
        element.responsibles = getElementResponsibles(element);
    }

    element._responsiblesLoaded = true;

    if (typeof saveOpenDealState === "function") {
        const deal = dealsCache.get(String(dealId));
        if (deal) saveOpenDealState(deal);
    }

    if (isElementEditorOpen(dealId, elementId)) {
        fillElementEditorResponsibles(element);
    }

    return element;
}

function findDealElement(dealId, elementId, elementIndex = null) {
    const deal = dealsCache.get(String(dealId));
    if (!deal || !Array.isArray(deal.elements)) return null;

    if (elementId) {
        const found = deal.elements.find(el => String(getElementId(el)) === String(elementId));
        if (found) return found;
    }

    if (elementIndex != null && deal.elements[elementIndex]) {
        return deal.elements[elementIndex];
    }

    return null;
}

async function parseApiResponse(response) {
    const text = await response.text();
    if (!text || !text.trim()) return {};
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
    }
}

async function elementAssetsApi(action, body, options = {}) {
    if (!ensureActiveSession()) throw new Error("Unauthorized");

    const response = await fetchWithTimeout(N8N_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            action,
            hp: document.getElementById("honey_field")?.value || "",
            ...body
        })
    }, options.timeoutMs ?? SERVER_TIMEOUT_MS);

    if (response.status === 401) {
        handleUnauthorized({ silent: options.silent401 === true });
        throw new Error("Unauthorized");
    }
    if (!response.ok) {
        let detail = "";
        try {
            const errBody = await parseApiResponse(response);
            detail = errBody?.message || errBody?.error || errBody?.description || "";
            if (!detail && typeof errBody === "string") detail = errBody;
        } catch (e) {
            detail = String(e?.message || "").trim();
        }
        throw new Error(detail || `API ${action} failed (${response.status})`);
    }

    return parseApiResponse(response);
}

function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error("compress failed"));
        }, mimeType, quality);
    });
}

async function loadPreviewImageSource(file) {
    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("image load failed"));
            image.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function compressPreviewImage(file) {
    if (file.size <= MAX_PREVIEW_BYTES) return file;

    const image = await loadPreviewImageSource(file);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const outputMime = "image/jpeg";
    const baseName = String(file.name || "preview").replace(/\.[^.]+$/, "") || "preview";
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;
    let quality = 0.92;

    while (width >= 64 && height >= 64) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        let blob = await canvasToBlob(canvas, outputMime, quality);
        while (blob.size > MAX_PREVIEW_BYTES && quality > 0.45) {
            quality -= 0.08;
            blob = await canvasToBlob(canvas, outputMime, quality);
        }
        if (blob.size <= MAX_PREVIEW_BYTES) {
            return new File([blob], `${baseName}.jpg`, { type: outputMime });
        }

        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);
        quality = 0.88;
    }

    throw new Error("preview too large");
}

async function uploadFileToYandexUrl(uploadUrl, file, mimeType = null, onProgress = null, timeoutMs = UPLOAD_TIMEOUT_MS) {
    if (typeof onProgress !== "function") {
        const response = await fetchWithTimeout(uploadUrl, {
            method: "PUT",
            body: file,
            headers: {
                "Content-Type": mimeType || file.type || "application/octet-stream"
            }
        }, timeoutMs);

        if (!response.ok) {
            throw new Error(`Yandex upload failed (${response.status})`);
        }
        return;
    }

    await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.timeout = timeoutMs;
        xhr.setRequestHeader("Content-Type", mimeType || file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) {
                onProgress(event.loaded / event.total);
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
                return;
            }
            reject(new Error(`Yandex upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Yandex upload failed"));
        xhr.ontimeout = () => reject(new Error("Yandex upload timeout"));
        xhr.send(file);
    });
}

function renderEditorProgressBlock(label, progress = null) {
    const pct = progress != null && Number.isFinite(progress)
        ? Math.max(0, Math.min(100, Math.round(progress * 100)))
        : null;
    const barClass = pct != null
        ? "element-editor-progress-bar determinate"
        : "element-editor-progress-bar";
    const barStyle = pct != null ? ` style="width:${pct}%"` : "";
    const labelText = pct != null ? `${label} ${pct}%` : label;

    return `<div class="element-editor-progress">
        <div class="element-editor-progress-label">${escapeHtml(labelText)}</div>
        <div class="element-editor-progress-track"><div class="${barClass}"${barStyle}></div></div>
    </div>`;
}

function setPreviewEditorProgress(label, progress = null, meta = {}) {
    elementEditorUploadState = {
        type: meta.type || "preview",
        label,
        progress
    };
    renderElementEditorAssets();
}

function setLayoutUploadProgress(label, progress = null, meta = {}) {
    elementEditorUploadState = {
        type: meta.type || "layout",
        label,
        progress,
        fileIndex: meta.fileIndex,
        fileTotal: meta.fileTotal,
        layoutId: meta.layoutId
    };
    renderElementEditorAssets();
}

function isElementEditorAssetBusy() {
    return elementEditorUploadState != null;
}

function clearElementEditorUploadState() {
    elementEditorUploadState = null;
    renderElementEditorAssets();
}

function getDropZoneFiles(dataTransfer) {
    if (!dataTransfer?.files?.length) return [];
    return [...dataTransfer.files].filter(file => file && file.size > 0);
}

function bindElementEditorDropZone(element, onFiles) {
    if (!element || typeof onFiles !== "function") return;

    element.addEventListener("dragenter", (event) => {
        if (!canEditElementAssets()) return;
        event.preventDefault();
        event.stopPropagation();
        element.classList.add("drop-active");
    });

    element.addEventListener("dragover", (event) => {
        if (!canEditElementAssets()) return;
        event.preventDefault();
        event.stopPropagation();
        element.classList.add("drop-active");
    });

    element.addEventListener("dragleave", (event) => {
        if (!element.contains(event.relatedTarget)) {
            element.classList.remove("drop-active");
        }
    });

    element.addEventListener("drop", (event) => {
        if (!canEditElementAssets()) return;
        event.preventDefault();
        event.stopPropagation();
        element.classList.remove("drop-active");
        const files = getDropZoneFiles(event.dataTransfer);
        if (files.length) onFiles(files);
    });
}

function buildElementAssetsPayload(dealId, elementId, dealNum) {
    const payload = {
        dealId: Number(dealId),
        elementId: Number(elementId)
    };

    const num = dealNum || getDealNum(dealId);
    if (num) payload.dealNum = num;

    return payload;
}

async function refreshElementPreview(dealId, elementId, dealNum = null) {
    const key = assetsCacheKey(dealId, elementId);
    if (previewRefreshInFlight.has(key)) {
        return previewRefreshInFlight.get(key);
    }

    const task = (async () => {
        const prev = elementAssetsCache.get(key) || {};
        elementAssetsCache.set(key, { ...prev, status: "loading" });
        updateElementThumb(dealId, elementId);
        if (isElementEditorOpen(dealId, elementId)) renderElementEditorAssets();

        const assets = await fetchElementAssets(
            dealId,
            elementId,
            dealNum || getDealNum(dealId),
            { previewOnly: true, silent401: true, timeoutMs: ELEMENT_ASSETS_TIMEOUT_MS }
        );

        const preview = normalizePreview(assets.preview);
        const hasPreview = !!(preview?.url || preview?.thumbUrl);
        const retryCount = hasPreview ? 0 : (prev.previewRetryCount || 0) + 1;

        elementAssetsCache.set(key, {
            ...prev,
            status: "ready",
            preview,
            previewRetryCount: retryCount,
            previewMissing: !hasPreview && retryCount >= PREVIEW_FETCH_MAX_RETRIES,
            previewChecked: hasPreview || retryCount >= PREVIEW_FETCH_MAX_RETRIES,
            layouts: prev.layouts || [],
            layoutsLoaded: prev.layoutsLoaded === true,
            layoutsLoading: prev.layoutsLoading === true
        });

        updateElementThumb(dealId, elementId);
        if (isElementEditorOpen(dealId, elementId)) renderElementEditorAssets();
        return hasPreview;
    })().finally(() => {
        previewRefreshInFlight.delete(key);
    });

    previewRefreshInFlight.set(key, task);
    return task;
}

function applyPreviewBatchResult(dealId, elementId, assets, batchFailed) {
    const key = assetsCacheKey(dealId, elementId);
    const prev = elementAssetsCache.get(key) || {};
    const preview = normalizePreview(assets?.preview);
    const hasPreview = !!(preview?.url || preview?.thumbUrl);
    const retryCount = batchFailed || !hasPreview ? (prev.previewRetryCount || 0) + 1 : 0;

    elementAssetsCache.set(key, {
        ...prev,
        status: batchFailed ? "error" : "ready",
        preview: hasPreview ? preview : null,
        previewRetryCount: retryCount,
        previewMissing: !hasPreview && !batchFailed && retryCount >= PREVIEW_FETCH_MAX_RETRIES,
        previewChecked: hasPreview || (!batchFailed && retryCount >= PREVIEW_FETCH_MAX_RETRIES),
        layouts: prev.layouts || [],
        layoutsLoaded: prev.layoutsLoaded === true,
        layoutsLoading: prev.layoutsLoading === true
    });

    updateElementThumb(dealId, elementId);
    return hasPreview;
}

async function fetchElementAssets(dealId, elementId, dealNum, options = {}) {
    try {
        const payload = buildElementAssetsPayload(dealId, elementId, dealNum);
        if (options.layoutsOnly) payload.layoutsOnly = true;
        if (options.previewOnly) payload.previewOnly = true;

        const data = await elementAssetsApi(
            "getElementAssets",
            payload,
            { silent401: options.silent401 === true, timeoutMs: options.timeoutMs ?? ELEMENT_ASSETS_TIMEOUT_MS }
        );
        return { ...normalizeAssetsResponse(data), layoutsLoaded: true };
    } catch (e) {
        console.warn("getElementAssets", dealId, elementId, e);
        return { preview: null, layouts: [], layoutsLoaded: true };
    }
}

async function fetchDealElementAssetsBatch(dealId, dealNum, elementIds, options = {}) {
    if (!elementIds?.length) return {};

    try {
        const payload = {
            dealId: Number(dealId),
            dealNum: dealNum || getDealNum(dealId),
            elementIds: elementIds.map(id => Number(id)).filter(Number.isFinite)
        };

        if (options.layoutsOnly) {
            payload.layoutsOnly = true;
        } else {
            payload.previewOnly = options.previewOnly !== false;
        }

        const data = await elementAssetsApi(
            "getElementAssets",
            payload,
            { silent401: options.silent401 === true, timeoutMs: options.timeoutMs ?? ELEMENT_ASSETS_TIMEOUT_MS }
        );
        return normalizeBatchAssetsResponse(data);
    } catch (e) {
        console.warn("getElementAssets batch", dealId, e);
        return null;
    }
}

function normalizeBatchAssetsResponse(data) {
    const payload = Array.isArray(data) ? (data[0]?.json || data[0]) : (data?.data || data);
    if (!payload || typeof payload !== "object") return {};

    const elements = payload.elements;
    if (!elements || typeof elements !== "object") return {};

    const result = {};
    for (const [elementId, assets] of Object.entries(elements)) {
        const normalized = normalizeAssetsResponse(assets);
        result[String(elementId)] = {
            ...normalized,
            layoutsLoaded: payload.layoutsOnly === true || payload.previewOnly !== true
        };
    }
    return result;
}

function normalizeElementFieldsResponse(data) {
    const payload = Array.isArray(data) ? (data[0]?.json || data[0]) : (data?.data || data);
    if (!payload || typeof payload !== "object") {
        return { cost_hq: null, sra3_sheets: null };
    }

    return {
        cost_hq: getElementCostHq(payload),
        sra3_sheets: getElementSra3Sheets(payload)
    };
}

function normalizeBatchFieldsResponse(data) {
    const payload = Array.isArray(data) ? (data[0]?.json || data[0]) : (data?.data || data);
    if (!payload || typeof payload !== "object") return {};

    const elements = payload.elements;
    if (!elements || typeof elements !== "object") return {};

    const result = {};
    for (const [elementId, fields] of Object.entries(elements)) {
        result[String(elementId)] = normalizeElementFieldsResponse(fields);
    }
    return result;
}

async function fetchElementFieldsBatch(dealId, elementIds, options = {}) {
    if (!elementIds?.length) return {};

    try {
        const data = await elementAssetsApi(
            "getElementFields",
            {
                dealId: Number(dealId),
                elementIds: elementIds.map(id => Number(id)).filter(Number.isFinite)
            },
            { silent401: options.silent401 === true }
        );
        return normalizeBatchFieldsResponse(data);
    } catch (e) {
        console.warn("getElementFields batch", dealId, e);
        return null;
    }
}

async function fetchElementFieldsSingle(dealId, elementId, options = {}) {
    try {
        const data = await elementAssetsApi(
            "getElementFields",
            {
                dealId: Number(dealId),
                elementId: Number(elementId)
            },
            { silent401: options.silent401 === true }
        );
        return normalizeElementFieldsResponse(data);
    } catch (e) {
        console.warn("getElementFields", dealId, elementId, e);
        return { cost_hq: null, sra3_sheets: null };
    }
}

function mergeElementFieldsIntoElement(element, fields) {
    if (!element || !fields) return;

    element.cost_hq = fields.cost_hq ?? null;
    element.sra3_sheets = fields.sra3_sheets ?? null;
    element._fieldsLoaded = true;

    const additional = [];
    if (fields.cost_hq != null) {
        additional.push({ id: ELEMENT_FIELD_COST_HQ, value: fields.cost_hq });
    }
    if (fields.sra3_sheets != null) {
        additional.push({ id: ELEMENT_FIELD_SRA3, value: fields.sra3_sheets });
    }
    if (additional.length) {
        element.additional_fields = additional;
    }
}

function applyElementFieldsToDeal(dealId, fieldsByElementId) {
    const deal = dealsCache.get(String(dealId));
    if (!deal || !Array.isArray(deal.elements) || !fieldsByElementId) return;

    for (const [elementId, fields] of Object.entries(fieldsByElementId)) {
        const element = deal.elements.find(el => String(getElementId(el)) === String(elementId));
        if (!element) continue;
        mergeElementFieldsIntoElement(element, fields);
    }

    if (typeof saveOpenDealState === "function") {
        saveOpenDealState(deal);
    }
}

function elementFieldsReady(element) {
    if (!element) return false;
    if (element._fieldsLoaded === true) return true;
    return getElementCostHq(element) != null || getElementSra3Sheets(element) != null;
}

function fillElementEditorFields(element) {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    const cost = getElementCost(element);
    const costHq = getElementCostHq(element);
    const sra3 = getElementSra3Sheets(element);

    const costInput = modal.querySelector("#elementEditorCost");
    const costHqInput = modal.querySelector("#elementEditorCostHq");
    const sra3Input = modal.querySelector("#elementEditorSra3");

    const staffEditable = currentUser.role === "staff" && !currentElementEditor?.isLocked;

    if (costInput) {
        costInput.value = cost != null ? Math.round(cost) : "";
        costInput.placeholder = "";
        costInput.readOnly = !staffEditable;
    }
    if (costHqInput) {
        costHqInput.value = costHq != null ? Math.round(costHq) : "";
        costHqInput.placeholder = "";
        costHqInput.readOnly = !staffEditable;
    }
    if (sra3Input) {
        sra3Input.value = sra3 != null ? sra3 : "";
        sra3Input.placeholder = "";
        sra3Input.readOnly = !staffEditable;
    }
}

function setElementEditorFieldsLoading() {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    modal.querySelectorAll("#elementEditorCostHq, #elementEditorSra3").forEach(input => {
        if (!input) return;
        input.value = "";
        input.placeholder = "загрузка…";
        input.readOnly = true;
    });
}

async function prefetchElementFieldsBatch(dealId, elementIds) {
    if (!elementIds?.length || currentUser.role !== "staff") return;

    const token = (dealElementFieldsPrefetchToken.get(String(dealId)) || 0) + 1;
    dealElementFieldsPrefetchToken.set(String(dealId), token);

    const batch = await fetchElementFieldsBatch(dealId, elementIds, { silent401: true });
    if (dealElementFieldsPrefetchToken.get(String(dealId)) !== token) return;
    if (!batch) return;

    applyElementFieldsToDeal(dealId, batch);

    if (currentElementEditor && String(currentElementEditor.dealId) === String(dealId)) {
        const element = findDealElement(
            currentElementEditor.dealId,
            currentElementEditor.elementId,
            currentElementEditor.elementIndex
        );
        if (element && elementFieldsReady(element)) {
            fillElementEditorFields(element);
        }
    }
}

async function ensureElementFieldsLoaded(dealId, elementId) {
    const element = findDealElement(dealId, elementId, currentElementEditor?.elementIndex);
    if (!element) return null;
    if (elementFieldsReady(element)) return element;

    const fields = await fetchElementFieldsSingle(dealId, elementId, { silent401: true });
    mergeElementFieldsIntoElement(element, fields);

    if (typeof saveOpenDealState === "function") {
        const deal = dealsCache.get(String(dealId));
        if (deal) saveOpenDealState(deal);
    }

    return element;
}

function formatFileSize(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function openPreviewLightbox(dealId, elementId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    void openPreviewLightboxAsync(dealId, elementId);
}

async function openPreviewLightboxAsync(dealId, elementId) {
    let cached = elementAssetsCache.get(assetsCacheKey(dealId, elementId));
    let url = cached?.preview?.url || cached?.preview?.thumbUrl;

    if (!isUsableAssetUrl(url)) {
        const refreshed = await refreshElementPreview(dealId, elementId);
        if (refreshed) {
            cached = elementAssetsCache.get(assetsCacheKey(dealId, elementId));
            url = cached?.preview?.url || cached?.preview?.thumbUrl;
        }
    }

    if (!isUsableAssetUrl(url)) return;

    document.querySelectorAll(".preview-lightbox").forEach(el => el.remove());

    const lightbox = document.createElement("div");
    lightbox.className = "preview-lightbox";
    lightbox.innerHTML = `
        <button type="button" class="preview-lightbox-close" aria-label="Закрыть">&times;</button>
        <img src="${escapeHtml(String(url).trim())}" alt="Превью позиции" referrerpolicy="no-referrer">`;

    const close = () => {
        lightbox.remove();
        document.body.style.overflow = "";
        document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (e) => {
        if (e.key === "Escape") close();
    };

    lightbox.addEventListener("click", close);
    lightbox.querySelector(".preview-lightbox-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        close();
    });
    lightbox.querySelector("img")?.addEventListener("click", (e) => e.stopPropagation());

    const img = lightbox.querySelector("img");
    if (img) {
        bindPreviewImgRefresh(img, dealId, elementId);
    }

    document.body.appendChild(lightbox);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
}

function updateElementThumb(dealId, elementId) {
    const key = assetsCacheKey(dealId, elementId);
    const cached = elementAssetsCache.get(key);
    const selector = `.element-preview-thumb[data-deal-id="${dealId}"][data-element-id="${elementId}"]`;

    document.querySelectorAll(selector).forEach(thumb => {
        thumb.classList.remove("has-preview", "is-loading", "is-error");

        if (!cached || cached.status === "loading") {
            thumb.classList.remove("element-preview-thumb-clickable");
            thumb.onclick = null;
            thumb.removeAttribute("title");
            thumb.classList.add("is-loading");
            thumb.innerHTML = "";
            return;
        }

        if (cached.status === "error") {
            thumb.classList.remove("element-preview-thumb-clickable");
            thumb.onclick = null;
            thumb.removeAttribute("title");
            thumb.classList.add("is-error");
            thumb.innerHTML = "";
            return;
        }

        if (cached.preview?.thumbUrl || cached.preview?.url) {
            thumb.classList.add("has-preview", "element-preview-thumb-clickable");
            thumb.title = "Открыть превью";
            thumb.innerHTML = "";
            setPreviewImgContent(thumb, cached.preview, "", { dealId, elementId });
            thumb.onclick = (event) => openPreviewLightbox(dealId, elementId, event);
        } else {
            thumb.classList.remove("element-preview-thumb-clickable");
            thumb.onclick = null;
            thumb.removeAttribute("title");
            thumb.innerHTML = "";
        }
    });
}

function scheduleElementAssetsLoading(deal) {
    if (!deal?.id || !Array.isArray(deal.elements)) return;

    const dealId = String(deal.id);
    const dealNum = getDealNum(deal);
    const elementIds = deal.elements
        .map(element => getElementId(element))
        .filter(Boolean);

    const previewIds = [];
    const layoutIds = [];

    elementIds.forEach(elementId => {
        const key = assetsCacheKey(dealId, elementId);
        let prev = elementAssetsCache.get(key);
        const previewReady = !!(prev?.preview?.url || prev?.preview?.thumbUrl);

        if (!prev) {
            prev = {
                status: "loading",
                preview: null,
                layouts: [],
                layoutsLoaded: false,
                layoutsLoading: false
            };
            elementAssetsCache.set(key, prev);
            previewIds.push(elementId);
            layoutIds.push(elementId);
        } else {
            if (previewNeedsFetch(prev)) {
                elementAssetsCache.set(key, { ...prev, status: "loading" });
                previewIds.push(elementId);
            }
            if (!prev.layoutsLoaded) {
                layoutIds.push(elementId);
            }
        }

        updateElementThumb(dealId, elementId);
    });

    if (previewIds.length) {
        loadDealPreviewsBatch(dealId, dealNum, previewIds, layoutIds);
    } else if (layoutIds.length) {
        prefetchDealLayoutsBatch(dealId, dealNum, layoutIds);
    }

    prefetchElementFieldsBatch(deal.id, elementIds);
}

async function loadDealPreviewsBatch(dealId, dealNum, elementIds, layoutIdsToPrefetch = null, attempt = 1) {
    const batch = await fetchDealElementAssetsBatch(dealId, dealNum, elementIds, {
        previewOnly: true,
        silent401: true
    });

    if (batch == null && attempt < PREVIEW_FETCH_MAX_RETRIES) {
        await sleep(400 * attempt);
        return loadDealPreviewsBatch(dealId, dealNum, elementIds, layoutIdsToPrefetch, attempt + 1);
    }

    const missingIds = [];

    for (const elementId of elementIds) {
        const assets = batch?.[String(elementId)];
        const hasPreview = applyPreviewBatchResult(dealId, elementId, assets, batch == null);
        if (!hasPreview && previewNeedsFetch(elementAssetsCache.get(assetsCacheKey(dealId, elementId)))) {
            missingIds.push(elementId);
        }
    }

    // Батч на сервере резолвит download-ссылку Яндекс.Диска для каждой позиции отдельным
    // последовательным запросом — при множестве позиций часть упирается в троттлинг и
    // возвращается без превью. Добираем недостающие поштучно (тот же путь, что при клике на
    // позицию), он надёжнее и обходит лимиты пачки.
    if (missingIds.length) {
        await Promise.all(missingIds.map(elementId => refreshElementPreview(dealId, elementId, dealNum)));
    }

    const layoutTargets = (layoutIdsToPrefetch || elementIds).filter(elementId => {
        const prev = elementAssetsCache.get(assetsCacheKey(dealId, elementId));
        return prev && !prev.layoutsLoaded;
    });

    if (layoutTargets.length) {
        prefetchDealLayoutsBatch(dealId, dealNum, layoutTargets);
    }
}

async function prefetchDealLayoutsBatch(dealId, dealNum, elementIds) {
    if (!elementIds?.length) return;

    const token = (dealLayoutsPrefetchToken.get(String(dealId)) || 0) + 1;
    dealLayoutsPrefetchToken.set(String(dealId), token);

    for (const elementId of elementIds) {
        const key = assetsCacheKey(dealId, elementId);
        const prev = elementAssetsCache.get(key);
        if (!prev || prev.layoutsLoaded) continue;

        elementAssetsCache.set(key, {
            ...prev,
            layoutsLoading: true
        });

        if (isElementEditorOpen(dealId, elementId)) {
            renderElementEditorAssets();
        }
    }

    const batch = await fetchDealElementAssetsBatch(dealId, dealNum, elementIds, {
        layoutsOnly: true,
        silent401: true
    });

    if (dealLayoutsPrefetchToken.get(String(dealId)) !== token) return;

    for (const elementId of elementIds) {
        const key = assetsCacheKey(dealId, elementId);
        const prev = elementAssetsCache.get(key);
        if (!prev) continue;

        const assets = batch?.[String(elementId)];
        if (!assets) {
            elementAssetsCache.set(key, {
                ...prev,
                layoutsLoading: false
            });
            continue;
        }

        elementAssetsCache.set(key, {
            ...prev,
            status: "ready",
            layouts: assets.layouts || [],
            layoutsLoaded: true,
            layoutsLoading: false
        });

        if (isElementEditorOpen(dealId, elementId)) {
            renderElementEditorAssets();
        }
    }
}

function ensureElementAssetsForEditor(dealId, elementId, dealNum) {
    const key = assetsCacheKey(dealId, elementId);
    let prev = elementAssetsCache.get(key);

    if (!prev) {
        elementAssetsCache.set(key, {
            status: "loading",
            preview: null,
            layouts: [],
            layoutsLoaded: false,
            layoutsLoading: false
        });
        loadElementAssetsFull(dealId, elementId, dealNum);
        return;
    }

    const previewReady = !!(prev.preview?.url || prev.preview?.thumbUrl);
    const needsPreview = !previewReady && previewNeedsFetch(prev);
    const needsLayouts = !prev.layoutsLoaded && !prev.layoutsLoading;

    if (!needsPreview && !needsLayouts) return;

    loadElementAssetsFull(dealId, elementId, dealNum, {
        fetchPreview: needsPreview,
        fetchLayouts: needsLayouts
    });
}

async function loadElementAssetsFull(dealId, elementId, dealNum, options = {}) {
    const key = assetsCacheKey(dealId, elementId);
    const prev = elementAssetsCache.get(key) || {};
    const hasPreview = !!(prev.preview?.url || prev.preview?.thumbUrl);
    const fetchLayouts = options.fetchLayouts !== false && !prev.layoutsLoaded && !prev.layoutsLoading;
    const fetchPreview = options.fetchPreview === true
        || (!hasPreview && previewNeedsFetch(prev) && options.fetchPreview !== false);

    if (!fetchLayouts && !fetchPreview) {
        if (isElementEditorOpen(dealId, elementId)) renderElementEditorAssets();
        return;
    }

    elementAssetsCache.set(key, {
        ...prev,
        status: hasPreview || !fetchPreview ? "ready" : "loading",
        layoutsLoading: fetchLayouts ? true : prev.layoutsLoading === true,
        layoutsLoaded: fetchLayouts ? false : prev.layoutsLoaded === true,
        layouts: prev.layouts || []
    });

    if (isElementEditorOpen(dealId, elementId)) {
        renderElementEditorAssets();
    }

    const fetchOptions = { silent401: true };
    if (fetchLayouts && (hasPreview || !fetchPreview)) {
        fetchOptions.layoutsOnly = true;
    } else if (fetchPreview && !fetchLayouts && prev.layoutsLoaded) {
        fetchOptions.previewOnly = true;
    }

    const assets = await fetchElementAssets(dealId, elementId, dealNum, fetchOptions);

    elementAssetsCache.set(key, {
        ...prev,
        status: "ready",
        preview: assets.preview ?? prev.preview ?? null,
        layouts: assets.layouts?.length ? assets.layouts : (prev.layouts || []),
        layoutsLoaded: fetchLayouts ? true : prev.layoutsLoaded === true,
        layoutsLoading: false
    });

    if (isElementEditorOpen(dealId, elementId)) {
        renderElementEditorAssets();
    }
}

function clearDealAssetsCache(dealId) {
    dealLayoutsPrefetchToken.set(String(dealId), (dealLayoutsPrefetchToken.get(String(dealId)) || 0) + 1);
    dealElementFieldsPrefetchToken.set(String(dealId), (dealElementFieldsPrefetchToken.get(String(dealId)) || 0) + 1);

    for (const key of [...elementAssetsCache.keys()]) {
        if (key.startsWith(`${dealId}:`)) elementAssetsCache.delete(key);
    }
}

function isElementEditorOpen(dealId, elementId) {
    return currentElementEditor
        && String(currentElementEditor.dealId) === String(dealId)
        && String(currentElementEditor.elementId) === String(elementId);
}

function canEditElementAssets() {
    if (currentUser.role !== "staff" || !currentElementEditor || currentElementEditor.isLocked) return false;
    if (currentElementEditor.isCreate && !currentElementEditor.showAssets) return false;
    return Boolean(currentElementEditor.elementId);
}

function fillElementEditorCategorySelect(modal) {
    const select = modal?.querySelector("#elementEditorCategory");
    if (!select) return;

    const categories = typeof getCategories === "function" ? getCategories() : [];
    select.innerHTML = categories.length
        ? categories.map(cat => `<option value="${escapeHtml(cat.id)}">${escapeHtml(cat.name)}</option>`).join("")
        : `<option value="">Категории не загружены</option>`;

    const defaultId = typeof getDefaultElementCategoryId === "function" ? getDefaultElementCategoryId() : 2896;
    const preferred = categories.find(cat => cat.id === defaultId) || categories[0];
    if (preferred) select.value = String(preferred.id);
}

function setElementEditorLayout({ isCreate = false, showAssets = true } = {}) {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    modal.classList.toggle("element-editor-create-mode", isCreate);
    modal.classList.toggle("element-editor-assets-hidden", !showAssets);

    const categoryWrap = modal.querySelector("#elementEditorCategoryWrap");
    if (categoryWrap) categoryWrap.style.display = isCreate ? "" : "none";

    const nameInput = modal.querySelector("#elementEditorName");
    if (nameInput) {
        nameInput.readOnly = !isCreate;
        nameInput.classList.toggle("element-editor-input-readonly", !isCreate);
        nameInput.tabIndex = isCreate ? 0 : -1;
    }

    const saveAssetsBtn = modal.querySelector("#elementEditorSaveAssets");
    if (saveAssetsBtn) {
        saveAssetsBtn.style.display = isCreate && !showAssets ? "" : "none";
    }
}

function unwrapSaveElementResponse(data) {
    let payload = data;
    if (Array.isArray(payload)) payload = payload[0]?.json ?? payload[0];
    if (payload?.json && typeof payload.json === "object") payload = payload.json;

    const element = payload?.element && typeof payload.element === "object" ? payload.element : payload;
    const elementId = Number(
        payload?.elementId
        ?? payload?.element_id
        ?? element?.id
        ?? element?.element_id
        ?? element?.elementId
    );

    return {
        elementId: Number.isFinite(elementId) && elementId > 0 ? elementId : null,
        element
    };
}

async function saveNewDealElement(dealId, item) {
    const response = await fetchWithTimeout(N8N_URL, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
            action: "save",
            dealId: Number(dealId),
            item
        })
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
    }
    if (!response.ok) throw new Error("save failed");

    return unwrapSaveElementResponse(await parseApiResponse(response));
}

async function resolveCreatedElementId(dealId, item, saveResult) {
    if (saveResult?.elementId) return saveResult.elementId;

    if (typeof reloadDealTabContent === "function") {
        await reloadDealTabContent(dealId);
    }

    const deal = dealsCache.get(String(dealId));
    if (!deal?.elements?.length) throw new Error("element not found after save");

    const byName = deal.elements.find(el => getElementName(el) === item.name);
    const fallback = deal.elements[deal.elements.length - 1];
    const elementId = Number(getElementId(byName || fallback));
    if (!Number.isFinite(elementId) || elementId <= 0) {
        throw new Error("elementId missing after save");
    }
    return elementId;
}

function collectNewElementItemFromEditor(modal) {
    const name = String(modal.querySelector("#elementEditorName")?.value || "").trim();
    const qty = Number(modal.querySelector("#elementEditorQty")?.value) || 0;
    const price = Number(modal.querySelector("#elementEditorPrice")?.value);
    const total = Number(modal.querySelector("#elementEditorTotal")?.value);
    const costRaw = modal.querySelector("#elementEditorCost")?.value;
    const costHqRaw = modal.querySelector("#elementEditorCostHq")?.value;
    const sra3Raw = modal.querySelector("#elementEditorSra3")?.value;
    const categoryId = Number(modal.querySelector("#elementEditorCategory")?.value);

    const resolvedTotal = Number.isFinite(total)
        ? total
        : (Number.isFinite(price) && qty > 0 ? qty * price : 0);
    const resolvedPrice = Number.isFinite(price)
        ? price
        : (qty > 0 ? resolvedTotal / qty : 0);

    const item = {
        name,
        quantity: qty,
        total: resolvedTotal,
        price: resolvedPrice,
        units: getElementEditorUnitsValue() || "шт"
    };

    if (Number.isFinite(categoryId) && categoryId > 0) {
        item.category_id = categoryId;
    }

    if (costRaw !== "") {
        const cost = Math.round(Number(costRaw));
        if (Number.isFinite(cost)) {
            item.cost = cost;
            item.cost_total = cost;
        }
    }
    if (costHqRaw !== "") {
        const costHq = Math.round(Number(costHqRaw));
        if (Number.isFinite(costHq)) item.cost_hq = costHq;
    }
    if (sra3Raw !== "") {
        const sra3 = Number(sra3Raw);
        if (Number.isFinite(sra3)) item.sra3_sheets = sra3;
    }

    const responsibleIds = getSelectedElementEditorResponsibleIds();
    if (responsibleIds.length) {
        item.responsible_ids = responsibleIds;
    }

    return item;
}

function seedEmptyElementAssetsCache(dealId, elementId) {
    elementAssetsCache.set(assetsCacheKey(dealId, elementId), {
        status: "ready",
        preview: null,
        previewMissing: true,
        layouts: [],
        layoutsLoaded: true,
        layoutsLoading: false
    });
}

async function activateElementEditorAfterCreate(dealId, elementId, savedResponsibles = null) {
    const deal = dealsCache.get(String(dealId));
    const elementIndex = Array.isArray(deal?.elements)
        ? deal.elements.findIndex(el => String(getElementId(el)) === String(elementId))
        : -1;

    currentElementEditor = {
        dealId: String(dealId),
        dealNum: getDealNum(dealId),
        elementId: String(elementId),
        elementIndex: elementIndex >= 0 ? elementIndex : null,
        isLocked: false,
        isCreate: false,
        showAssets: true
    };

    const modal = document.getElementById("element-editor-modal");
    const element = findDealElement(dealId, elementId, currentElementEditor.elementIndex);
    if (!modal || !element) return;

    if (Array.isArray(savedResponsibles)) {
        element.responsibles = savedResponsibles;
        element._responsiblesLoaded = true;
    }

    setElementEditorStaffMode(true);
    setElementEditorLayout({ isCreate: false, showAssets: true });

    modal.querySelector("#elementEditorName").value = getElementName(element);
    modal.querySelector("#elementEditorQty").value = getElementQuantity(element) || "";
    modal.querySelector("#elementEditorPrice").value = Number.isFinite(getElementPrice(element)) ? getElementPrice(element) : "";
    modal.querySelector("#elementEditorTotal").value = Number.isFinite(getElementLineTotal(element)) ? getElementLineTotal(element) : "";
    modal.querySelector("#elementEditorLinkInput").value = "";

    fillElementEditorFields(element);
    fillElementEditorMeta(element);
    seedEmptyElementAssetsCache(dealId, elementId);
    renderElementEditorAssets();
}

async function saveNewElementFromEditor(openAssetsAfter = false) {
    if (!currentElementEditor?.isCreate || currentUser.role !== "staff") return;

    const modal = document.getElementById("element-editor-modal");
    const saveBtn = modal?.querySelector("#elementEditorSave");
    const saveAssetsBtn = modal?.querySelector("#elementEditorSaveAssets");
    if (saveBtn?.disabled || saveAssetsBtn?.disabled) return;

    const item = collectNewElementItemFromEditor(modal);
    const savedResponsibles = collectSelectedResponsiblesFromEditor();
    if (!item.name) {
        alert("Введите наименование позиции");
        return;
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        alert("Укажите количество больше 0");
        return;
    }
    if (!item.category_id) {
        alert("Выберите категорию");
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "…";
    }
    if (saveAssetsBtn) {
        saveAssetsBtn.disabled = true;
        saveAssetsBtn.textContent = "…";
    }

    try {
        const saveResult = await saveNewDealElement(currentElementEditor.dealId, item);
        const elementId = await resolveCreatedElementId(currentElementEditor.dealId, item, saveResult);

        if (openAssetsAfter) {
            seedEmptyElementAssetsCache(currentElementEditor.dealId, elementId);
            if (typeof reloadDealTabContent === "function") {
                await reloadDealTabContent(currentElementEditor.dealId);
            }
            await activateElementEditorAfterCreate(
                currentElementEditor.dealId,
                elementId,
                savedResponsibles
            );
            return;
        }

        if (typeof reloadDealTabContent === "function") {
            await reloadDealTabContent(currentElementEditor.dealId);
        } else if (document.getElementById("deal-tab")) {
            await reloadDealTabContent?.(currentElementEditor.dealId);
        }
        closeElementEditor();
    } catch (e) {
        alert("Не удалось сохранить позицию");
        console.error(e);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить и закрыть";
        }
        if (saveAssetsBtn) {
            saveAssetsBtn.disabled = false;
            saveAssetsBtn.textContent = "Сохранить и добавить макеты";
        }
    }
}

function openManualElementEditor(dealId) {
    if (!ensureActiveSession()) return;
    if (currentUser.role !== "staff") return;

    currentElementEditor = {
        dealId: String(dealId),
        dealNum: getDealNum(dealId),
        elementId: null,
        elementIndex: null,
        isLocked: false,
        isCreate: true,
        showAssets: false
    };

    const modal = getElementEditorModal();
    setElementEditorStaffMode(true);
    setElementEditorLayout({ isCreate: true, showAssets: false });
    fillElementEditorCategorySelect(modal);

    modal.querySelector("#elementEditorName").value = "";
    modal.querySelector("#elementEditorQty").value = "1";
    modal.querySelector("#elementEditorPrice").value = "";
    modal.querySelector("#elementEditorTotal").value = "";
    modal.querySelector("#elementEditorCost").value = "";
    modal.querySelector("#elementEditorCostHq").value = "";
    modal.querySelector("#elementEditorSra3").value = "";
    modal.querySelector("#elementEditorLinkInput").value = "";

    fillElementEditorFields({});
    fillElementEditorMeta({});
    setElementEditorUnitsValue("шт");
    renderElementEditorAssets();

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    modal.querySelector("#elementEditorName")?.focus();
}

function getElementEditorModal() {
    const MODAL_VERSION = "8";
    let modal = document.getElementById("element-editor-modal");
    if (modal && modal.dataset.version !== MODAL_VERSION) {
        modal.remove();
        modal = null;
    }
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "element-editor-modal";
    modal.className = "element-editor-backdrop";
    modal.dataset.version = "8";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="element-editor-modal" onclick="event.stopPropagation()">
            <div class="element-editor-header element-editor-header-minimal">
                <button type="button" class="element-editor-close" onclick="closeElementEditor()" aria-label="Закрыть">&times;</button>
            </div>
            <div class="element-editor-body">
                <label class="element-editor-label" title="Название задаётся при добавлении позиции в CRM; API не позволяет переименовать">Наименование</label>
                <textarea id="elementEditorName" rows="2" class="element-editor-input element-editor-input-readonly" readonly tabindex="-1"></textarea>
                <div id="elementEditorCategoryWrap" class="element-editor-create-only" style="display:none;">
                    <label class="element-editor-label">Категория</label>
                    <select id="elementEditorCategory" class="element-editor-input"></select>
                </div>
                <div class="element-editor-row4">
                    <div>
                        <label class="element-editor-label">Кол-во</label>
                        <input id="elementEditorQty" type="text" inputmode="numeric" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                    <div>
                        <label class="element-editor-label">Цена</label>
                        <input id="elementEditorPrice" type="text" inputmode="decimal" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                    <div class="staff-only-fields">
                        <label class="element-editor-label">Себест.</label>
                        <input id="elementEditorCost" type="text" inputmode="numeric" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                    <div>
                        <label class="element-editor-label">Итого</label>
                        <input id="elementEditorTotal" type="text" inputmode="decimal" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                </div>
                <div class="element-editor-secondary-row">
                    <div class="staff-only-fields">
                        <label class="element-editor-label">Себ. HQ</label>
                        <input id="elementEditorCostHq" type="text" inputmode="numeric" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                    <div class="staff-only-fields">
                        <label class="element-editor-label">Листов SRA3</label>
                        <input id="elementEditorSra3" type="text" inputmode="numeric" autocomplete="off" class="element-editor-input element-editor-input-num">
                    </div>
                    <div class="element-editor-units-wrap">
                        <label class="element-editor-label">Ед. изм.</label>
                        <div class="status-dropdown element-editor-units-dropdown" id="elementEditorUnitsDropdown">
                            <button type="button" class="status-dropdown-btn element-editor-units-btn" id="elementEditorUnitsBtn"></button>
                            <div class="status-dropdown-list element-editor-units-list" id="elementEditorUnitsList">
                                <button type="button" class="element-units-preset" data-units="шт">шт</button>
                                <button type="button" class="element-units-preset" data-units="услуга">услуга</button>
                                <div class="element-units-custom-row">
                                    <input id="elementEditorUnitsCustom" type="text" maxlength="32" placeholder="Своё значение" inputmode="text" autocomplete="off" class="element-editor-input">
                                </div>
                            </div>
                        </div>
                        <div id="elementEditorUnitsReadonly" class="element-editor-readonly-text"></div>
                    </div>
                    <div class="element-editor-responsibles-wrap">
                        <label class="element-editor-label">Ответственные</label>
                        <div class="status-dropdown element-editor-responsibles-dropdown" id="elementEditorResponsiblesDropdown">
                            <button type="button" class="status-dropdown-btn element-editor-responsibles-btn" id="elementEditorResponsiblesBtn"></button>
                            <div class="status-dropdown-list" id="elementEditorResponsiblesList"></div>
                        </div>
                        <div id="elementEditorResponsiblesReadonly" class="element-editor-readonly-text"></div>
                    </div>
                </div>
                <div class="element-editor-assets-block">
                <div class="element-editor-preview-wrap">
                    <div class="element-editor-preview-box element-editor-drop-target" id="elementEditorPreviewDrop">
                        <div id="elementEditorPreview" class="element-editor-preview">
                            <span class="element-editor-preview-placeholder">нет превью</span>
                        </div>
                        <div id="elementEditorPreviewUploadOverlay" class="element-editor-preview-upload-overlay" hidden></div>
                        <div class="element-editor-preview-actions staff-only-fields">
                            <label class="element-editor-mini-btn" title="Загрузить превью">
                                ${typeof icon === "function" ? icon("camera") : ""}
                                <input id="elementEditorPreviewFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>
                            </label>
                            <button type="button" id="elementEditorPreviewDelete" class="element-editor-mini-btn danger" title="Удалить превью" style="display:none;">×</button>
                        </div>
                    </div>
                </div>
                <div class="element-editor-section-title">Макеты</div>
                <div id="elementEditorLayouts" class="element-editor-layouts"></div>
                <div id="elementEditorLayoutDropZone" class="element-editor-layout-drop-zone element-editor-drop-target staff-only-fields">
                    <span class="element-editor-layout-drop-title">Перетащите файлы макетов сюда</span>
                    <span class="element-editor-layout-drop-hint">или нажмите, чтобы выбрать на компьютере</span>
                </div>
                <div class="element-editor-layout-add staff-only-fields">
                    <input id="elementEditorLinkInput" type="url" placeholder="Ссылка на макет" class="element-editor-input">
                    <button type="button" id="elementEditorAddLink" class="element-editor-mini-btn primary" title="Добавить ссылку">+</button>
                    <label class="element-editor-mini-btn" title="Загрузить файлы">
                        ${typeof icon === "function" ? icon("clip") : ""}
                        <input id="elementEditorLayoutFile" type="file" multiple hidden>
                    </label>
                </div>
                </div>
            </div>
            <div class="element-editor-footer">
                <button type="button" class="element-editor-cancel" onclick="closeElementEditor()">Закрыть</button>
                <button type="button" id="elementEditorSaveAssets" class="element-editor-save element-editor-save-secondary staff-only-fields" style="display:none;">Сохранить и добавить макеты</button>
                <button type="button" id="elementEditorSave" class="element-editor-save staff-only-fields">Сохранить и закрыть</button>
            </div>
        </div>`;

    modal.addEventListener("mousedown", overlayDown);
    modal.addEventListener("click", (e) => { if (overlayClickedSelf(e)) closeElementEditor(); });
    document.body.appendChild(modal);
    bindElementEditorEvents(modal);
    return modal;
}

function bindElementEditorEvents(modal) {
    const priceInput = modal.querySelector("#elementEditorPrice");
    const totalInput = modal.querySelector("#elementEditorTotal");
    const qtyInput = modal.querySelector("#elementEditorQty");

    qtyInput?.addEventListener("input", () => {
        const qty = Number(qtyInput.value) || 0;
        const price = Number(priceInput?.value);
        if (qty > 0 && Number.isFinite(price)) {
            totalInput.value = Number((price * qty).toFixed(2));
        }
    });

    priceInput?.addEventListener("input", () => {
        const qty = Number(qtyInput?.value) || 0;
        const price = Number(priceInput.value);
        if (qty > 0 && Number.isFinite(price)) {
            totalInput.value = Number((price * qty).toFixed(2));
        }
    });

    totalInput?.addEventListener("input", () => {
        const qty = Number(qtyInput?.value) || 0;
        const total = Number(totalInput.value);
        if (qty > 0 && Number.isFinite(total)) {
            priceInput.value = Number((total / qty).toFixed(2));
        }
    });

    modal.querySelector("#elementEditorPreviewFile")?.addEventListener("change", handlePreviewUpload);
    modal.querySelector("#elementEditorPreviewDelete")?.addEventListener("click", handlePreviewDelete);
    modal.querySelector("#elementEditorAddLink")?.addEventListener("click", handleLayoutLinkAdd);
    modal.querySelector("#elementEditorLayoutFile")?.addEventListener("change", handleLayoutFileUpload);
    bindElementEditorDropZone(modal.querySelector("#elementEditorPreviewDrop"), (files) => {
        uploadPreviewFiles(files);
    });
    const layoutDropZone = modal.querySelector("#elementEditorLayoutDropZone");
    bindElementEditorDropZone(layoutDropZone, (files) => {
        uploadLayoutFiles(files);
    });
    layoutDropZone?.addEventListener("click", (event) => {
        if (!canEditElementAssets() || isElementEditorAssetBusy()) return;
        if (event.target.closest("a, button, input, label")) return;
        modal.querySelector("#elementEditorLayoutFile")?.click();
    });
    modal.querySelector("#elementEditorSave")?.addEventListener("click", () => {
        if (currentElementEditor?.isCreate) {
            saveNewElementFromEditor(false);
            return;
        }
        saveElementEditor();
    });
    modal.querySelector("#elementEditorSaveAssets")?.addEventListener("click", () => saveNewElementFromEditor(true));
    modal.querySelector("#elementEditorResponsiblesBtn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        document.getElementById("elementEditorUnitsDropdown")?.classList.remove("open");
        toggleElementEditorResponsiblesDropdown();
    });
    modal.querySelector("#elementEditorUnitsBtn")?.addEventListener("click", (event) => {
        event.stopPropagation();
        document.getElementById("elementEditorResponsiblesDropdown")?.classList.remove("open");
        toggleElementEditorUnitsDropdown();
    });
    modal.querySelectorAll("#elementEditorUnitsList .element-units-preset").forEach(btn => {
        btn.addEventListener("click", handleElementEditorUnitsPreset);
    });
    modal.querySelector("#elementEditorUnitsCustom")?.addEventListener("input", handleElementEditorUnitsCustomInput);
    modal.querySelector("#elementEditorUnitsCustom")?.addEventListener("focus", handleElementEditorUnitsCustomInput);
    modal.querySelector("#elementEditorUnitsCustom")?.addEventListener("click", (event) => {
        event.stopPropagation();
    });
    modal.querySelector(".element-editor-modal")?.addEventListener("click", (event) => {
        ["#elementEditorResponsiblesDropdown", "#elementEditorUnitsDropdown"].forEach(selector => {
            const dropdown = modal.querySelector(selector);
            if (dropdown && !dropdown.contains(event.target)) {
                dropdown.classList.remove("open");
            }
        });
    });
}

function setElementEditorStaffMode(isStaff) {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    modal.querySelectorAll(".staff-only-fields").forEach(el => {
        el.style.display = isStaff ? "" : "none";
    });

    modal.querySelectorAll("#elementEditorPrice, #elementEditorTotal, #elementEditorQty, #elementEditorCost, #elementEditorCostHq, #elementEditorSra3, #elementEditorUnitsCustom")
        .forEach(input => {
            if (!input) return;
            input.readOnly = !isStaff;
        });

    const unitsDropdown = modal.querySelector("#elementEditorUnitsDropdown");
    const unitsReadonly = modal.querySelector("#elementEditorUnitsReadonly");
    if (unitsDropdown && unitsReadonly) {
        unitsDropdown.style.display = isStaff ? "" : "none";
        unitsReadonly.style.display = isStaff ? "none" : "";
    }

    const responsiblesDropdown = modal.querySelector("#elementEditorResponsiblesDropdown");
    const responsiblesReadonly = modal.querySelector("#elementEditorResponsiblesReadonly");
    if (responsiblesDropdown && responsiblesReadonly) {
        responsiblesDropdown.style.display = isStaff ? "" : "none";
        responsiblesReadonly.style.display = isStaff ? "none" : "";
    }

    const nameInput = modal.querySelector("#elementEditorName");
    if (nameInput && !currentElementEditor?.isCreate) {
        nameInput.readOnly = true;
    }
}

function openElementEditor(event, trigger) {
    if (event) event.stopPropagation();
    if (!ensureActiveSession()) return;

    const dealId = trigger?.dataset?.dealId;
    const elementId = trigger?.dataset?.elementId;
    const elementIndex = trigger?.dataset?.elementIndex;
    if (!dealId || !elementId) return;

    const element = findDealElement(dealId, elementId, elementIndex);
    if (!element) return;

    const isLocked = trigger?.dataset?.lockStatus === "1";
    currentElementEditor = {
        dealId: String(dealId),
        dealNum: getDealNum(dealId),
        elementId: String(elementId),
        elementIndex: elementIndex != null ? Number(elementIndex) : null,
        isLocked,
        isCreate: false,
        showAssets: true
    };

    const modal = getElementEditorModal();
    const isStaff = currentUser.role === "staff" && !isLocked;
    setElementEditorStaffMode(isStaff);
    setElementEditorLayout({ isCreate: false, showAssets: true });

    const name = getElementName(element);
    const qty = getElementQuantity(element);
    const price = getElementPrice(element);
    const total = getElementLineTotal(element);
    modal.querySelector("#elementEditorName").value = name;
    modal.querySelector("#elementEditorQty").value = qty || "";
    modal.querySelector("#elementEditorPrice").value = Number.isFinite(price) ? price : "";
    modal.querySelector("#elementEditorTotal").value = Number.isFinite(total) ? total : "";
    modal.querySelector("#elementEditorLinkInput").value = "";

    fillElementEditorFields(element);
    fillElementEditorMeta(element);
    if (isStaff && !elementFieldsReady(element)) {
        setElementEditorFieldsLoading();
    }

    renderElementEditorAssets();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    const key = assetsCacheKey(dealId, elementId);
    if (elementAssetsCache.get(key)?.previewMissing) {
        elementAssetsCache.delete(key);
    }
    ensureElementAssetsForEditor(
        dealId,
        elementId,
        currentElementEditor.dealNum || getDealNum(dealId)
    );

    ensureElementResponsiblesLoaded(dealId, elementId, elementIndex);

    if (isStaff && !elementFieldsReady(element)) {
        ensureElementFieldsLoaded(dealId, elementId).then((loadedElement) => {
            if (!isElementEditorOpen(dealId, elementId) || !loadedElement) return;
            fillElementEditorFields(loadedElement);
        });
    }
}

function closeElementEditor() {
    document.getElementById("elementEditorResponsiblesDropdown")?.classList.remove("open");
    document.getElementById("elementEditorUnitsDropdown")?.classList.remove("open");
    elementEditorUploadState = null;
    const modal = document.getElementById("element-editor-modal");
    if (modal) modal.style.display = "none";
    document.body.style.overflow = "";
    currentElementEditor = null;
}

function renderElementEditorAssets() {
    if (!currentElementEditor) return;

    const { dealId, elementId } = currentElementEditor;
    const key = assetsCacheKey(dealId, elementId);
    const cached = elementAssetsCache.get(key) || { status: "loading", preview: null, layouts: [] };
    const previewEl = document.getElementById("elementEditorPreview");
    const previewOverlay = document.getElementById("elementEditorPreviewUploadOverlay");
    const deleteBtn = document.getElementById("elementEditorPreviewDelete");
    const layoutsEl = document.getElementById("elementEditorLayouts");
    const isStaff = currentUser.role === "staff" && !currentElementEditor.isLocked;
    const uploadState = elementEditorUploadState;
    const previewBusy = uploadState?.type === "preview" || uploadState?.type === "preview-delete";
    const layoutBusy = uploadState?.type === "layout"
        || uploadState?.type === "link"
        || uploadState?.type === "layout-delete";

    if (!previewEl || !layoutsEl) return;

    const previewReady = !!(cached.preview?.url || cached.preview?.thumbUrl);
    const layoutsLoading = cached.layoutsLoading === true;
    const showPreviewLoading = cached.status === "loading" && !previewReady && !previewBusy;

    if (showPreviewLoading) {
        previewEl.innerHTML = renderEditorProgressBlock("Загрузка превью…");
        if (deleteBtn) deleteBtn.style.display = "none";
    } else if (previewReady) {
        previewEl.innerHTML = "";
        setPreviewImgContent(previewEl, cached.preview, "Превью", { dealId, elementId });
        if (deleteBtn) {
            deleteBtn.style.display = isStaff ? "inline-flex" : "none";
            deleteBtn.disabled = previewBusy;
        }
    } else {
        previewEl.innerHTML = `<span class="element-editor-preview-placeholder">нет превью</span>`;
        if (deleteBtn) deleteBtn.style.display = "none";
    }

    if (previewOverlay) {
        if (previewBusy) {
            previewOverlay.hidden = false;
            previewOverlay.innerHTML = renderEditorProgressBlock(uploadState.label, uploadState.progress);
        } else {
            previewOverlay.hidden = true;
            previewOverlay.innerHTML = "";
        }
    }

    let layoutsHtml = "";

    if (layoutsLoading && !cached.layouts?.length && !layoutBusy) {
        layoutsHtml = renderEditorProgressBlock("Загрузка макетов…");
    } else if (showPreviewLoading && !layoutsLoading && !cached.layouts?.length && !layoutBusy) {
        layoutsHtml = renderEditorProgressBlock("Загрузка макетов…");
    } else {
        if (cached.layouts?.length) {
            layoutsHtml = cached.layouts.map(layout => {
                const size = layout.size ? `<span class="element-layout-size">${escapeHtml(formatFileSize(layout.size))}</span>` : "";
                const typeIcon = (typeof icon === "function") ? (layout.type === "link" ? icon("link") : icon("file")) : "";
                const isDeleting = layoutBusy
                    && uploadState?.type === "layout-delete"
                    && String(uploadState.layoutId) === String(layout.id);
                const deleteBtnHtml = isStaff && layout.type === "file" && layoutIsDeletable(layout)
                    ? `<button type="button" class="element-layout-del" data-layout-id="${escapeHtml(layout.id)}" title="Удалить"${layoutBusy ? " disabled" : ""}>×</button>`
                    : "";

                return `
                    <div class="element-layout-item${isDeleting ? " is-deleting" : ""}">
                        <a href="${escapeHtml(layout.url)}" target="_blank" rel="noopener" class="element-layout-link">${typeIcon} ${escapeHtml(layout.name)}</a>
                        ${size}
                        ${deleteBtnHtml}
                        ${isDeleting ? `<div class="element-layout-item-progress">${renderEditorProgressBlock(uploadState.label, uploadState.progress)}</div>` : ""}
                    </div>`;
            }).join("");
        } else if (!layoutBusy) {
            layoutsHtml = `<div class="element-editor-layout-empty">макетов пока нет</div>`;
        }

        if (layoutBusy && uploadState?.type !== "layout-delete") {
            layoutsHtml += `<div class="element-layout-upload-item">${renderEditorProgressBlock(uploadState.label, uploadState.progress)}</div>`;
        }
    }

    layoutsEl.innerHTML = layoutsHtml;

    layoutsEl.querySelectorAll(".element-layout-del").forEach(btn => {
        btn.addEventListener("click", () => handleLayoutDelete(btn.dataset.layoutId));
    });
}

async function uploadSinglePreviewFile(file) {
    if (!PREVIEW_IMAGE_TYPES.includes(file.type)) {
        throw new Error("unsupported preview type");
    }
    if (file.size > 16 * 1024 * 1024) {
        throw new Error("preview source too large");
    }

    setPreviewEditorProgress("Сжатие изображения…", 0.08);
    const uploadFile = await compressPreviewImage(file);
    if (uploadFile.size > MAX_PREVIEW_BYTES) {
        throw new Error("preview too large");
    }

    const payload = buildElementAssetsPayload(
        currentElementEditor.dealId,
        currentElementEditor.elementId,
        currentElementEditor.dealNum
    );

    setPreviewEditorProgress("Регистрация превью…", 0.18);
    const prep = await elementAssetsApi("uploadElementPreview", {
        ...payload,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || "image/jpeg",
        clientUpload: true
    }, { timeoutMs: SERVER_TIMEOUT_MS });

    if (!prep?.uploadUrl) throw new Error("uploadUrl missing");

    await uploadFileToYandexUrl(prep.uploadUrl, uploadFile, uploadFile.type, (ratio) => {
        setPreviewEditorProgress("Загрузка превью…", 0.2 + ratio * 0.65);
    });

    setPreviewEditorProgress("Сохранение превью…", 0.92);
    const data = await elementAssetsApi("uploadElementPreview", {
        ...payload,
        uploadComplete: true,
        diskFileName: prep.diskFileName || undefined
    }, { timeoutMs: SERVER_TIMEOUT_MS });

    const assets = normalizeAssetsResponse(data);
    const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
    const prev = elementAssetsCache.get(key) || { layouts: [] };
    const preview = normalizePreview(assets.preview) || normalizePreview(prev.preview);
    if (preview && prep.diskFileName) {
        preview.diskFileName = prep.diskFileName;
    }
    elementAssetsCache.set(key, {
        ...prev,
        status: "ready",
        preview,
        layouts: assets.layouts?.length ? assets.layouts : (prev.layouts || []),
        layoutsLoaded: prev.layoutsLoaded === true,
        layoutsLoading: false
    });

    updateElementThumb(currentElementEditor.dealId, currentElementEditor.elementId);
}

async function uploadPreviewFiles(files) {
    if (!canEditElementAssets()) return;

    const images = [...files].filter(file => PREVIEW_IMAGE_TYPES.includes(file.type));
    if (!images.length) {
        alert("Превью: только JPG, PNG, WebP или GIF");
        return;
    }

    setPreviewEditorProgress("Подготовка изображения…");

    try {
        for (let i = 0; i < images.length; i++) {
            const file = images[i];
            const prefix = images.length > 1 ? `(${i + 1}/${images.length}) ` : "";
            try {
                setPreviewEditorProgress(`${prefix}Подготовка…`);
                await uploadSinglePreviewFile(file);
            } catch (e) {
                console.warn("uploadElementPreview", file.name, e);
                if (images.length === 1) throw e;
            }
        }
    } catch (e) {
        alert(images[0]?.size > MAX_PREVIEW_BYTES
            ? "Не удалось сжать превью до 500 КБ"
            : "Не удалось загрузить превью");
    } finally {
        clearElementEditorUploadState();
        renderElementEditorAssets();
    }
}

async function handlePreviewUpload(event) {
    const files = [...(event?.target?.files || [])];
    if (event?.target) event.target.value = "";
    if (!files.length) return;
    await uploadPreviewFiles(files);
}

function getLayoutUploadTimeoutMs(fileSize = 0) {
    const mb = Number(fileSize) / (1024 * 1024);
    const scaled = UPLOAD_TIMEOUT_MS + Math.max(0, mb) * 4000;
    return Math.min(2 * 60 * 60 * 1000, Math.max(UPLOAD_TIMEOUT_MS, scaled));
}

async function uploadSingleLayoutFile(file, options = {}) {
    const uploadTimeoutMs = getLayoutUploadTimeoutMs(file.size);

    const payload = buildElementAssetsPayload(
        currentElementEditor.dealId,
        currentElementEditor.elementId,
        currentElementEditor.dealNum
    );
    const safeFileName = toSafeUploadFileName(file.name, "layout");
    const updateProgress = (label, progress) => {
        if (typeof options.onProgress === "function") {
            options.onProgress(label, progress);
        } else {
            setLayoutUploadProgress(label, progress, options.meta);
        }
    };

    updateProgress("Регистрация макета…", 0.15);
    const prep = await elementAssetsApi("addElementLayout", {
        ...payload,
        type: "file",
        fileName: safeFileName,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        clientUpload: true
    }, { timeoutMs: SERVER_TIMEOUT_MS });

    if (!prep?.uploadUrl) throw new Error("uploadUrl missing");

    await uploadFileToYandexUrl(prep.uploadUrl, file, file.type || "application/octet-stream", (ratio) => {
        updateProgress("Загрузка файла…", 0.2 + ratio * 0.65);
    }, uploadTimeoutMs);

    updateProgress("Сохранение макета…", 0.92);
    const data = await elementAssetsApi("addElementLayout", {
        ...payload,
        type: "file",
        uploadComplete: true
    }, { timeoutMs: Math.max(SERVER_TIMEOUT_MS, uploadTimeoutMs) });

    const assets = normalizeAssetsResponse(data);
    const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
    const prev = elementAssetsCache.get(key) || {};
    elementAssetsCache.set(key, {
        ...prev,
        status: "ready",
        preview: assets.preview ?? prev.preview ?? null,
        layouts: assets.layouts?.length ? assets.layouts : (prev.layouts || []),
        layoutsLoaded: true,
        layoutsLoading: false
    });
}

async function uploadLayoutFiles(files) {
    if (!canEditElementAssets()) return;

    const list = [...files].filter(file => file && file.size > 0);
    if (!list.length) return;

    setLayoutUploadProgress("Подготовка файла…", 0.05);

    const errors = [];

    try {
        for (let i = 0; i < list.length; i++) {
            const file = list[i];
            const labelPrefix = list.length > 1 ? `Файл ${i + 1}/${list.length}: ` : "";

            try {
                await uploadSingleLayoutFile(file, {
                    onProgress: (label, ratio) => {
                        const base = i / list.length;
                        setLayoutUploadProgress(`${labelPrefix}${label}`, base + ratio / list.length, {
                            type: "layout",
                            fileIndex: i + 1,
                            fileTotal: list.length
                        });
                    }
                });
            } catch (e) {
                console.warn("addElementLayout file", file.name, e);
                errors.push(file.name);
            }
        }
    } finally {
        clearElementEditorUploadState();
        renderElementEditorAssets();
    }

    if (errors.length) {
        alert(`Не удалось загрузить: ${errors.join(", ")}`);
    }
}

async function handleLayoutFileUpload(event) {
    const files = [...(event?.target?.files || [])];
    if (event?.target) event.target.value = "";
    if (!files.length) return;
    await uploadLayoutFiles(files);
}

async function handlePreviewDelete() {
    if (!canEditElementAssets() || isElementEditorAssetBusy()) return;

    const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
    const cached = elementAssetsCache.get(key);
    if (!cached?.preview) return;

    if (!confirm("Удалить превью?")) return;

    const payload = buildElementAssetsPayload(
        currentElementEditor.dealId,
        currentElementEditor.elementId,
        currentElementEditor.dealNum
    );
    if (cached.preview.diskFileName) {
        payload.diskFileName = cached.preview.diskFileName;
    }

    setPreviewEditorProgress("Удаление превью…", null, { type: "preview-delete" });

    try {
        await elementAssetsApi("deleteElementPreview", payload, {
            timeoutMs: DELETE_ASSETS_TIMEOUT_MS
        });

        elementAssetsCache.set(key, {
            ...cached,
            preview: null,
            status: "ready",
            layouts: cached.layouts || [],
            layoutsLoaded: cached.layoutsLoaded === true || !!(cached.layouts?.length),
            layoutsLoading: false
        });
        updateElementThumb(currentElementEditor.dealId, currentElementEditor.elementId);
    } catch (e) {
        console.warn("deleteElementPreview", e);
        const detail = String(e?.message || "").trim();
        alert(detail.includes("abort") || detail.includes("Abort")
            ? "Удаление превью заняло слишком много времени. Попробуйте ещё раз."
            : (detail || "Не удалось удалить превью"));
    } finally {
        clearElementEditorUploadState();
        renderElementEditorAssets();
    }
}

async function handleLayoutLinkAdd() {
    if (!canEditElementAssets()) return;

    const input = document.getElementById("elementEditorLinkInput");
    const url = (input?.value || "").trim();
    if (!url) return;

    setLayoutUploadProgress("Добавление ссылки…", null, { type: "link" });

    try {
        const data = await elementAssetsApi("addElementLayout", {
            ...buildElementAssetsPayload(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum
            ),
            type: "link",
            url,
            name: url.replace(/^https?:\/\//, "").slice(0, 60)
        });

        const assets = normalizeAssetsResponse(data);
        const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
        const prev = elementAssetsCache.get(key) || {};
        elementAssetsCache.set(key, {
            status: "ready",
            preview: assets.preview ?? prev.preview ?? null,
            layouts: assets.layouts?.length ? assets.layouts : (prev.layouts || []),
            layoutsLoaded: true,
            layoutsLoading: false
        });

        if (input) input.value = "";
        clearElementEditorUploadState();
        renderElementEditorAssets();
    } catch (e) {
        console.warn("addElementLayout link", e);
        clearElementEditorUploadState();
        alert("Не удалось добавить ссылку");
        renderElementEditorAssets();
    }
}

async function handleLayoutDelete(layoutId) {
    if (!canEditElementAssets() || !layoutId || isElementEditorAssetBusy()) return;
    if (!confirm("Удалить макет?")) return;

    const numericLayoutId = Number(layoutId);
    if (!Number.isFinite(numericLayoutId) || numericLayoutId <= 0) {
        alert("Не удалось определить ID макета в CRM");
        return;
    }

    setLayoutUploadProgress("Удаление макета…", null, {
        type: "layout-delete",
        layoutId: numericLayoutId
    });

    try {
        const data = await elementAssetsApi("deleteElementLayout", {
            ...buildElementAssetsPayload(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum
            ),
            layoutId: numericLayoutId
        }, { timeoutMs: DELETE_ASSETS_TIMEOUT_MS });

        let assets = normalizeAssetsResponse(data);
        if (!assets.layouts?.length) {
            const refreshed = await fetchElementAssets(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum,
                { layoutsOnly: true, silent401: true }
            );
            if (refreshed?.layouts?.length) assets = refreshed;
        }

        const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
        const prev = elementAssetsCache.get(key) || {};
        elementAssetsCache.set(key, {
            status: "ready",
            preview: assets.preview ?? prev.preview ?? null,
            layouts: assets.layouts ?? [],
            layoutsLoaded: true,
            layoutsLoading: false
        });
    } catch (e) {
        console.warn("deleteElementLayout", e);
        const detail = String(e?.message || "").trim();
        alert(detail.includes("abort") || detail.includes("Abort")
            ? "Удаление макета заняло слишком много времени. Попробуйте ещё раз."
            : (detail || "Не удалось удалить макет"));
    } finally {
        clearElementEditorUploadState();
        renderElementEditorAssets();
    }
}

function updateElementRowDom(dealId, elementId, element) {
    const rowEl = document.querySelector(
        `.element-row[data-deal-id="${dealId}"][data-element-id="${elementId}"]`
    );
    if (!rowEl) return;

    const name = getElementName(element);
    const qty = getElementQuantity(element);
    const price = getElementPrice(element);
    const units = getElementUnits(element);

    // Компактная строка (мобильные)
    const compact = rowEl.querySelector(".element-row-text");
    if (compact) compact.textContent = `${name}, ${qty} ${units}, ${price} руб.`;

    // Десктопные столбцы
    const nameCol = rowEl.querySelector(".element-row-name");
    if (nameCol) nameCol.textContent = name;
    const qtyCol = rowEl.querySelector(".element-row-qty");
    if (qtyCol) qtyCol.textContent = `${qty} ${units}`;
    const costCol = rowEl.querySelector(".element-row-cost");
    if (costCol) {
        const cost = getElementCost(element);
        if (cost == null) {
            costCol.classList.add("is-empty");
            costCol.title = "Себестоимость не заполнена";
            costCol.textContent = "не указана";
        } else {
            costCol.classList.remove("is-empty");
            costCol.removeAttribute("title");
            const num = Math.round(cost).toLocaleString("ru-RU");
            costCol.innerHTML = `<span class="cost-val">${num}</span><span class="cost-mask">•••••</span>`;
        }
    }

    const lineTotal = getElementLineTotal(element);
    const totalEl = rowEl.querySelector(".element-row-total");
    if (totalEl) {
        totalEl.innerHTML = `${lineTotal.toLocaleString("ru-RU", { minimumFractionDigits: 2 })}<span class="rub-suffix"> руб.</span>`;
    }
    rowEl.setAttribute("data-price", String(lineTotal));
}

async function saveElementEditor() {
    if (currentElementEditor?.isCreate) {
        return saveNewElementFromEditor(false);
    }
    if (!canEditElementAssets()) return;

    const modal = document.getElementById("element-editor-modal");
    const saveBtn = modal?.querySelector("#elementEditorSave");
    if (saveBtn?.disabled) return;

    const price = Number(modal.querySelector("#elementEditorPrice")?.value);
    const total = Number(modal.querySelector("#elementEditorTotal")?.value);
    const costHqRaw = modal.querySelector("#elementEditorCostHq")?.value;
    const costRaw = modal.querySelector("#elementEditorCost")?.value;
    const sra3Raw = modal.querySelector("#elementEditorSra3")?.value;
    const qty = Number(modal.querySelector("#elementEditorQty")?.value) || 0;

    if (qty <= 0) {
        alert("Укажите количество больше 0");
        return;
    }

    const fields = {
        quantity: qty,
        price: Number.isFinite(price) ? price : 0,
        total: Number.isFinite(total) ? total : 0
    };

    if (costRaw !== "") {
        const cost = Math.round(Number(costRaw));
        if (Number.isFinite(cost)) fields.cost = cost;
    }
    if (costHqRaw !== "") {
        const costHq = Math.round(Number(costHqRaw));
        if (Number.isFinite(costHq)) fields.cost_hq = costHq;
    }
    if (sra3Raw !== "") {
        const sra3 = Number(sra3Raw);
        if (Number.isFinite(sra3)) fields.sra3_sheets = sra3;
    }

    const units = getElementEditorUnitsValue();
    if (units) fields.units = units;

    fields.responsible_ids = getSelectedElementEditorResponsibleIds();

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "…";
    }

    try {
        const saveResult = await elementAssetsApi("updateElement", {
            ...buildElementAssetsPayload(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum
            ),
            fields
        });

        const deal = dealsCache.get(String(currentElementEditor.dealId));
        const element = findDealElement(
            currentElementEditor.dealId,
            currentElementEditor.elementId,
            currentElementEditor.elementIndex
        );

        if (element) {
            element.quantity = qty;
            element.price = fields.price;
            element.total = fields.total;
            if (fields.cost != null) element.cost = fields.cost;
            if (fields.cost_hq != null) element.cost_hq = fields.cost_hq;
            if (fields.sra3_sheets != null) element.sra3_sheets = fields.sra3_sheets;
            if (fields.units) element.units = fields.units;
            if (Array.isArray(fields.responsible_ids)) {
                const options = buildResponsibleOptionsOrdered(getElementResponsibles(element));
                const byId = new Map(options.map(item => [item.id, item.name]));
                element.responsibles = fields.responsible_ids.map(id => ({
                    id,
                    name: byId.get(id) || `#${id}`
                }));
                element._responsiblesLoaded = true;
            }
            element._fieldsLoaded = true;
            updateElementRowDom(currentElementEditor.dealId, currentElementEditor.elementId, element);
            updateDealTotal(document.querySelector(
                `.deal-elements-list[data-deal-id="${currentElementEditor.dealId}"]`
            ));
        }

        if (saveResult?.nameNote) {
            console.info(saveResult.nameNote);
        }

        closeElementEditor();
    } catch (e) {
        alert("Не удалось сохранить изменения");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить и закрыть";
        }
    }
}
