// --- РЕДАКТОР ПОЗИЦИИ (превью + макеты + доп. поля) ---

const elementAssetsCache = new Map();
const dealLayoutsPrefetchToken = new Map();
const dealElementFieldsPrefetchToken = new Map();
let currentElementEditor = null;

const ELEMENT_FIELD_COST_HQ = 1057;
const ELEMENT_FIELD_SRA3 = 1066;
const MAX_LAYOUT_FILE_MB = 50;
const MAX_PREVIEW_BYTES = 512000;
const PREVIEW_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

function setPreviewImgContent(container, preview, altText = "") {
    const { primary, fallback } = getPreviewDisplayUrls(preview);
    if (!primary) {
        container.innerHTML = "";
        return false;
    }

    container.innerHTML = `<img src="${escapeHtml(primary)}" alt="${escapeHtml(altText)}" referrerpolicy="no-referrer">`;
    const img = container.querySelector("img");
    if (img && fallback) bindPreviewImgFallback(img, fallback);
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
        thumbUrl
    };
}

function inferLayoutType(item) {
    if (item.type === "link" || item.type === 2) return "link";
    if (item.type === "file" || item.type === 1) return "file";

    const url = String(item.url || "");
    if (/yadi\.sk/i.test(url)) return "link";
    if (/disk\.yandex\./i.test(url) && !/downloader\.disk\.yandex/i.test(url)) return "link";
    return "file";
}

function normalizeLayouts(rawLayouts) {
    if (!Array.isArray(rawLayouts)) return [];

    return rawLayouts
        .map(item => {
            const url = isUsableAssetUrl(item.url) ? String(item.url).trim() : "";
            if (!url) return null;

            const name = (item.name || item.file_name || url).trim();
            const id = item.id ?? item.file_id ?? item.layout_id ?? name;

            return {
                id,
                type: inferLayoutType(item),
                name,
                url,
                size: item.size ?? null,
                isCanDelete: item.is_can_delete !== false && item.isCanDelete !== false
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

function getElementSra3Sheets(element) {
    const raw = element?.sra3_sheets ?? element?.sra3Sheets ?? getElementAdditionalField(element, ELEMENT_FIELD_SRA3);
    if (raw == null || raw === "") return null;
    const n = Number(String(raw).replace(/\s+/g, ""));
    return Number.isFinite(n) ? n : null;
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
    if (!response.ok) throw new Error(`API ${action} failed`);

    return response.json();
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

async function uploadFileToYandexUrl(uploadUrl, file, mimeType = null) {
    const response = await fetchWithTimeout(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": mimeType || file.type || "application/octet-stream"
        }
    }, UPLOAD_TIMEOUT_MS);

    if (!response.ok) {
        throw new Error(`Yandex upload failed (${response.status})`);
    }
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

async function fetchElementAssets(dealId, elementId, dealNum, options = {}) {
    try {
        const payload = buildElementAssetsPayload(dealId, elementId, dealNum);
        if (options.layoutsOnly) payload.layoutsOnly = true;

        const data = await elementAssetsApi(
            "getElementAssets",
            payload,
            { silent401: options.silent401 === true }
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
            { silent401: options.silent401 === true }
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

    const costHq = getElementCostHq(element);
    const sra3 = getElementSra3Sheets(element);

    const costHqInput = modal.querySelector("#elementEditorCostHq");
    const sra3Input = modal.querySelector("#elementEditorSra3");

    if (costHqInput) {
        costHqInput.value = costHq != null ? Math.round(costHq) : "";
        costHqInput.placeholder = "";
        costHqInput.readOnly = currentUser.role !== "staff" || currentElementEditor?.isLocked;
    }
    if (sra3Input) {
        sra3Input.value = sra3 != null ? sra3 : "";
        sra3Input.placeholder = "";
        sra3Input.readOnly = currentUser.role !== "staff" || currentElementEditor?.isLocked;
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

    const cached = elementAssetsCache.get(assetsCacheKey(dealId, elementId));
    const url = cached?.preview?.url || cached?.preview?.thumbUrl;
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
            setPreviewImgContent(thumb, cached.preview);
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

    clearDealAssetsCache(deal.id);

    const dealNum = getDealNum(deal);
    const elementIds = deal.elements
        .map(element => getElementId(element))
        .filter(Boolean);

    elementIds.forEach(elementId => {
        const key = assetsCacheKey(deal.id, elementId);
        elementAssetsCache.set(key, {
            status: "loading",
            preview: null,
            layouts: [],
            layoutsLoaded: false
        });
        updateElementThumb(deal.id, elementId);
    });

    loadDealPreviewsBatch(deal.id, dealNum, elementIds);
    prefetchElementFieldsBatch(deal.id, elementIds);
}

async function loadDealPreviewsBatch(dealId, dealNum, elementIds) {
    const batch = await fetchDealElementAssetsBatch(dealId, dealNum, elementIds, {
        previewOnly: true,
        silent401: true
    });

    for (const elementId of elementIds) {
        const key = assetsCacheKey(dealId, elementId);
        const assets = batch?.[String(elementId)];

        if (assets) {
            elementAssetsCache.set(key, {
                status: "ready",
                preview: assets.preview,
                layouts: [],
                layoutsLoaded: false
            });
        } else {
            elementAssetsCache.set(key, {
                status: batch == null ? "error" : "ready",
                preview: null,
                layouts: [],
                layoutsLoaded: false
            });
        }

        updateElementThumb(dealId, elementId);
    }

    prefetchDealLayoutsBatch(dealId, dealNum, elementIds);
}

async function prefetchDealLayoutsBatch(dealId, dealNum, elementIds) {
    if (!elementIds?.length) return;

    const token = (dealLayoutsPrefetchToken.get(String(dealId)) || 0) + 1;
    dealLayoutsPrefetchToken.set(String(dealId), token);

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
        if (!assets) continue;

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

async function loadElementAssetsFull(dealId, elementId, dealNum) {
    const key = assetsCacheKey(dealId, elementId);
    const prev = elementAssetsCache.get(key) || {};
    const hasPreview = !!(prev.preview?.url || prev.preview?.thumbUrl);

    if (prev.layoutsLoaded) {
        if (isElementEditorOpen(dealId, elementId)) renderElementEditorAssets();
        return;
    }

    elementAssetsCache.set(key, {
        ...prev,
        status: hasPreview ? "ready" : "loading",
        layoutsLoading: true,
        layoutsLoaded: false,
        layouts: prev.layouts || []
    });

    if (isElementEditorOpen(dealId, elementId)) {
        renderElementEditorAssets();
    }

    const assets = await fetchElementAssets(dealId, elementId, dealNum, {
        silent401: true,
        layoutsOnly: hasPreview
    });

    elementAssetsCache.set(key, {
        status: "ready",
        preview: assets.preview || prev.preview || null,
        layouts: assets.layouts || [],
        layoutsLoaded: true,
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
    return currentUser.role === "staff"
        && currentElementEditor
        && !currentElementEditor.isLocked;
}

function getElementEditorModal() {
    let modal = document.getElementById("element-editor-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "element-editor-modal";
    modal.className = "element-editor-backdrop";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="element-editor-modal" onclick="event.stopPropagation()">
            <div class="element-editor-header">
                <span class="element-editor-title">Позиция</span>
                <button type="button" class="element-editor-close" onclick="closeElementEditor()" aria-label="Закрыть">&times;</button>
            </div>
            <div class="element-editor-body">
                <label class="element-editor-label">Наименование</label>
                <textarea id="elementEditorName" rows="2" class="element-editor-input"></textarea>
                <div class="element-editor-row3">
                    <div>
                        <label class="element-editor-label">Цена/шт</label>
                        <input id="elementEditorPrice" type="number" step="0.01" class="element-editor-input">
                    </div>
                    <div>
                        <label class="element-editor-label">Кол-во</label>
                        <input id="elementEditorQty" type="number" step="1" class="element-editor-input" readonly>
                    </div>
                    <div>
                        <label class="element-editor-label">Сумма</label>
                        <input id="elementEditorTotal" type="number" step="0.01" class="element-editor-input">
                    </div>
                </div>
                <div class="element-editor-row2 staff-only-fields">
                    <div>
                        <label class="element-editor-label">Себ. HQ</label>
                        <input id="elementEditorCostHq" type="number" step="1" class="element-editor-input">
                    </div>
                    <div>
                        <label class="element-editor-label">Листов SRA3</label>
                        <input id="elementEditorSra3" type="number" step="1" class="element-editor-input">
                    </div>
                </div>
                <div class="element-editor-preview-wrap">
                    <div id="elementEditorPreview" class="element-editor-preview">
                        <span class="element-editor-preview-placeholder">нет превью</span>
                    </div>
                    <div class="element-editor-preview-actions staff-only-fields">
                        <label class="element-editor-mini-btn">
                            📷
                            <input id="elementEditorPreviewFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
                        </label>
                        <button type="button" id="elementEditorPreviewDelete" class="element-editor-mini-btn danger" title="Удалить превью" style="display:none;">×</button>
                    </div>
                </div>
                <div class="element-editor-section-title">Макеты</div>
                <div id="elementEditorLayouts" class="element-editor-layouts"></div>
                <div class="element-editor-layout-add staff-only-fields">
                    <input id="elementEditorLinkInput" type="url" placeholder="Ссылка на макет" class="element-editor-input">
                    <button type="button" id="elementEditorAddLink" class="element-editor-mini-btn primary" title="Добавить ссылку">+</button>
                    <label class="element-editor-mini-btn" title="Загрузить файл">
                        📎
                        <input id="elementEditorLayoutFile" type="file" hidden>
                    </label>
                </div>
            </div>
            <div class="element-editor-footer">
                <button type="button" class="element-editor-cancel" onclick="closeElementEditor()">Закрыть</button>
                <button type="button" id="elementEditorSave" class="element-editor-save staff-only-fields">Сохранить</button>
            </div>
        </div>`;

    modal.addEventListener("click", closeElementEditor);
    document.body.appendChild(modal);
    bindElementEditorEvents(modal);
    return modal;
}

function bindElementEditorEvents(modal) {
    const priceInput = modal.querySelector("#elementEditorPrice");
    const totalInput = modal.querySelector("#elementEditorTotal");
    const qtyInput = modal.querySelector("#elementEditorQty");

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
    modal.querySelector("#elementEditorSave")?.addEventListener("click", saveElementEditor);
}

function setElementEditorStaffMode(isStaff) {
    const modal = document.getElementById("element-editor-modal");
    if (!modal) return;

    modal.querySelectorAll(".staff-only-fields").forEach(el => {
        el.style.display = isStaff ? "" : "none";
    });

    modal.querySelectorAll("#elementEditorName, #elementEditorPrice, #elementEditorTotal, #elementEditorCostHq, #elementEditorSra3")
        .forEach(input => {
            if (!input) return;
            if (input.id === "elementEditorQty") {
                input.readOnly = true;
                return;
            }
            input.readOnly = !isStaff;
        });
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
        isLocked
    };

    const modal = getElementEditorModal();
    const isStaff = currentUser.role === "staff" && !isLocked;
    setElementEditorStaffMode(isStaff);

    const name = getElementName(element);
    const qty = getElementQuantity(element);
    const price = getElementPrice(element);
    const total = getElementLineTotal(element);
    modal.querySelector("#elementEditorName").value = name;
    modal.querySelector("#elementEditorQty").value = qty || "";
    modal.querySelector("#elementEditorPrice").value = Number.isFinite(price) ? price : "";
    modal.querySelector("#elementEditorTotal").value = Number.isFinite(total) ? total : "";
    modal.querySelector("#elementEditorLinkInput").value = "";

    if (isStaff && !elementFieldsReady(element)) {
        setElementEditorFieldsLoading();
    } else {
        fillElementEditorFields(element);
    }

    renderElementEditorAssets();
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    const key = assetsCacheKey(dealId, elementId);
    const cached = elementAssetsCache.get(key);
    if (!cached?.layoutsLoaded) {
        loadElementAssetsFull(
            dealId,
            elementId,
            currentElementEditor.dealNum || getDealNum(dealId)
        );
    }

    if (isStaff && !elementFieldsReady(element)) {
        ensureElementFieldsLoaded(dealId, elementId).then((loadedElement) => {
            if (!isElementEditorOpen(dealId, elementId) || !loadedElement) return;
            fillElementEditorFields(loadedElement);
        });
    }
}

function closeElementEditor() {
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
    const deleteBtn = document.getElementById("elementEditorPreviewDelete");
    const layoutsEl = document.getElementById("elementEditorLayouts");
    const isStaff = currentUser.role === "staff" && !currentElementEditor.isLocked;

    if (!previewEl || !layoutsEl) return;

    const previewReady = !!(cached.preview?.url || cached.preview?.thumbUrl);
    const layoutsLoading = cached.layoutsLoading === true;
    const showPreviewLoading = cached.status === "loading" && !previewReady;

    if (showPreviewLoading) {
        previewEl.innerHTML = `<span class="element-editor-preview-placeholder loading">загрузка…</span>`;
        if (deleteBtn) deleteBtn.style.display = "none";
    } else if (previewReady) {
        previewEl.innerHTML = "";
        setPreviewImgContent(previewEl, cached.preview, "Превью");
        if (deleteBtn) deleteBtn.style.display = isStaff ? "inline-flex" : "none";
    } else {
        previewEl.innerHTML = `<span class="element-editor-preview-placeholder">нет превью</span>`;
        if (deleteBtn) deleteBtn.style.display = "none";
    }

    if (layoutsLoading) {
        layoutsEl.innerHTML = `<div class="element-editor-layout-empty">загрузка макетов…</div>`;
        return;
    }

    if (showPreviewLoading && !layoutsLoading) {
        layoutsEl.innerHTML = `<div class="element-editor-layout-empty">загрузка макетов…</div>`;
        return;
    }

    if (!cached.layouts?.length) {
        layoutsEl.innerHTML = `<div class="element-editor-layout-empty">макетов пока нет</div>`;
        return;
    }

    layoutsEl.innerHTML = cached.layouts.map(layout => {
        const size = layout.size ? `<span class="element-layout-size">${escapeHtml(formatFileSize(layout.size))}</span>` : "";
        const icon = layout.type === "link" ? "🔗" : "📄";
        const deleteBtnHtml = isStaff
            ? `<button type="button" class="element-layout-del" data-layout-id="${escapeHtml(layout.id)}" title="Удалить">×</button>`
            : "";

        return `
            <div class="element-layout-item">
                <a href="${escapeHtml(layout.url)}" target="_blank" rel="noopener" class="element-layout-link">${icon} ${escapeHtml(layout.name)}</a>
                ${size}
                ${deleteBtnHtml}
            </div>`;
    }).join("");

    layoutsEl.querySelectorAll(".element-layout-del").forEach(btn => {
        btn.addEventListener("click", () => handleLayoutDelete(btn.dataset.layoutId));
    });
}

async function handlePreviewUpload(event) {
    if (!canEditElementAssets()) return;

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!PREVIEW_IMAGE_TYPES.includes(file.type)) {
        alert("Превью: только JPG, PNG, WebP или GIF");
        return;
    }
    if (file.size > 16 * 1024 * 1024) {
        alert("Превью: исходник не больше 16 МБ");
        return;
    }

    const previewEl = document.getElementById("elementEditorPreview");
    if (previewEl) previewEl.innerHTML = `<span class="element-editor-preview-placeholder loading">загрузка…</span>`;

    try {
        const uploadFile = await compressPreviewImage(file);
        if (uploadFile.size > MAX_PREVIEW_BYTES) {
            throw new Error("preview too large");
        }

        const payload = buildElementAssetsPayload(
            currentElementEditor.dealId,
            currentElementEditor.elementId,
            currentElementEditor.dealNum
        );

        const prep = await elementAssetsApi("uploadElementPreview", {
            ...payload,
            fileName: uploadFile.name,
            mimeType: uploadFile.type || "image/jpeg",
            clientUpload: true
        }, { timeoutMs: SERVER_TIMEOUT_MS });

        if (!prep?.uploadUrl) throw new Error("uploadUrl missing");

        await uploadFileToYandexUrl(prep.uploadUrl, uploadFile, uploadFile.type);

        const data = await elementAssetsApi("uploadElementPreview", {
            ...payload,
            uploadComplete: true,
            diskFileName: prep.diskFileName || undefined
        }, { timeoutMs: SERVER_TIMEOUT_MS });

        const assets = normalizeAssetsResponse(data);
        const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
        const prev = elementAssetsCache.get(key) || { layouts: [] };
        elementAssetsCache.set(key, {
            status: "ready",
            preview: assets.preview || prev.preview,
            layouts: assets.layouts?.length ? assets.layouts : (prev.layouts || [])
        });

        updateElementThumb(currentElementEditor.dealId, currentElementEditor.elementId);
        renderElementEditorAssets();
    } catch (e) {
        console.warn("uploadElementPreview", e);
        alert(file.size > MAX_PREVIEW_BYTES
            ? "Не удалось сжать превью до 500 КБ"
            : "Не удалось загрузить превью");
        renderElementEditorAssets();
    }
}

async function handlePreviewDelete() {
    if (!canEditElementAssets()) return;

    const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
    const cached = elementAssetsCache.get(key);
    if (!cached?.preview) return;

    if (!confirm("Удалить превью?")) return;

    try {
        await elementAssetsApi("deleteElementPreview", {
            ...buildElementAssetsPayload(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum
            ),
            previewId: cached.preview.id
        });

        elementAssetsCache.set(key, { ...cached, preview: null, status: "ready" });
        updateElementThumb(currentElementEditor.dealId, currentElementEditor.elementId);
        renderElementEditorAssets();
    } catch (e) {
        alert("Не удалось удалить превью");
    }
}

async function handleLayoutLinkAdd() {
    if (!canEditElementAssets()) return;

    const input = document.getElementById("elementEditorLinkInput");
    const url = (input?.value || "").trim();
    if (!url) return;

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
        renderElementEditorAssets();
    } catch (e) {
        console.warn("addElementLayout link", e);
        alert("Не удалось добавить ссылку");
    }
}

async function handleLayoutFileUpload(event) {
    if (!canEditElementAssets()) return;

    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_LAYOUT_FILE_MB * 1024 * 1024) {
        alert(`Файл не больше ${MAX_LAYOUT_FILE_MB} МБ`);
        return;
    }

    const layoutsEl = document.getElementById("elementEditorLayouts");
    if (layoutsEl) layoutsEl.innerHTML = `<div class="element-editor-layout-empty loading">загрузка файла…</div>`;

    try {
        const payload = buildElementAssetsPayload(
            currentElementEditor.dealId,
            currentElementEditor.elementId,
            currentElementEditor.dealNum
        );

        const prep = await elementAssetsApi("addElementLayout", {
            ...payload,
            type: "file",
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            clientUpload: true
        }, { timeoutMs: SERVER_TIMEOUT_MS });

        if (!prep?.uploadUrl) throw new Error("uploadUrl missing");

        await uploadFileToYandexUrl(prep.uploadUrl, file);

        const data = await elementAssetsApi("addElementLayout", {
            ...payload,
            type: "file",
            uploadComplete: true
        }, { timeoutMs: SERVER_TIMEOUT_MS });

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

        renderElementEditorAssets();
    } catch (e) {
        console.warn("addElementLayout file", e);
        alert("Не удалось загрузить макет");
        renderElementEditorAssets();
    }
}

async function handleLayoutDelete(layoutId) {
    if (!canEditElementAssets() || !layoutId) return;
    if (!confirm("Удалить макет?")) return;

    try {
        const data = await elementAssetsApi("deleteElementLayout", {
            ...buildElementAssetsPayload(
                currentElementEditor.dealId,
                currentElementEditor.elementId,
                currentElementEditor.dealNum
            ),
            layoutId
        });

        const assets = normalizeAssetsResponse(data);
        const key = assetsCacheKey(currentElementEditor.dealId, currentElementEditor.elementId);
        const prev = elementAssetsCache.get(key) || {};
        elementAssetsCache.set(key, {
            status: "ready",
            preview: assets.preview ?? prev.preview ?? null,
            layouts: assets.layouts ?? [],
            layoutsLoaded: true,
            layoutsLoading: false
        });

        renderElementEditorAssets();
    } catch (e) {
        console.warn("deleteElementLayout", e);
        alert("Не удалось удалить макет");
    }
}

function updateElementRowDom(dealId, elementId, element) {
    const row = document.querySelector(
        `.element-row[data-deal-id="${dealId}"][data-element-id="${elementId}"] .element-row-text`
    );
    if (!row) return;

    const name = getElementName(element);
    const qty = getElementQuantity(element);
    const price = getElementPrice(element);
    row.textContent = `${name}, ${qty} шт, ${price} руб.`;

    const totalEl = row.closest(".element-row")?.querySelector(".element-row-total");
    if (totalEl) {
        totalEl.textContent = `${getElementLineTotal(element).toLocaleString("ru-RU", { minimumFractionDigits: 2 })} руб.`;
    }
}

async function saveElementEditor() {
    if (!canEditElementAssets()) return;

    const modal = document.getElementById("element-editor-modal");
    const saveBtn = modal?.querySelector("#elementEditorSave");
    if (saveBtn?.disabled) return;

    const name = modal.querySelector("#elementEditorName")?.value?.trim() || "";
    const price = Number(modal.querySelector("#elementEditorPrice")?.value);
    const total = Number(modal.querySelector("#elementEditorTotal")?.value);
    const costHqRaw = modal.querySelector("#elementEditorCostHq")?.value;
    const sra3Raw = modal.querySelector("#elementEditorSra3")?.value;
    const qty = Number(modal.querySelector("#elementEditorQty")?.value) || 0;

    if (!name) {
        alert("Укажите наименование");
        return;
    }

    const fields = {
        name,
        quantity: qty,
        price: Number.isFinite(price) ? price : 0,
        total: Number.isFinite(total) ? total : 0
    };

    if (costHqRaw !== "") {
        const costHq = Math.round(Number(costHqRaw));
        if (Number.isFinite(costHq)) fields.cost_hq = costHq;
    }
    if (sra3Raw !== "") {
        const sra3 = Number(sra3Raw);
        if (Number.isFinite(sra3)) fields.sra3_sheets = sra3;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "…";
    }

    try {
        await elementAssetsApi("updateElement", {
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
            element.name = name;
            element.category_and_name = name;
            element.quantity = qty;
            element.price = fields.price;
            element.total = fields.total;
            if (fields.cost_hq != null) element.cost_hq = fields.cost_hq;
            if (fields.sra3_sheets != null) element.sra3_sheets = fields.sra3_sheets;
            element._fieldsLoaded = true;
            updateElementRowDom(currentElementEditor.dealId, currentElementEditor.elementId, element);
            updateDealTotal(document.querySelector(
                `.deal-elements-list[data-deal-id="${currentElementEditor.dealId}"]`
            ));
        }

        closeElementEditor();
    } catch (e) {
        alert("Не удалось сохранить изменения");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Сохранить";
        }
    }
}
