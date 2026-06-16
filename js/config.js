// --- КОНФИГУРАЦИЯ И СЕССИЯ ---
const SRA3_W = 320, SRA3_H = 450;
const N8N_URL = "https://n8n.heavenprint.digital/webhook/search-crm";
const SERVER_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 120000;
const DELETE_ASSETS_TIMEOUT_MS = 45000;
const SERVER_UNAVAILABLE_MESSAGE = "Сервер не отвечает, попробуйте позднее";
function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeoutId));
}

function extractSessionToken(session) {
    if (!session || typeof session !== "object") return "";
    return String(
        session.token
        || session.access_token
        || session.accessToken
        || session.authToken
        || ""
    ).trim();
}

function readSessionMeta() {
    try {
        const raw = sessionStorage.getItem("calc_session_meta");
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        sessionStorage.removeItem("calc_session_meta");
        return null;
    }
}

function persistSessionMeta(user = currentUser) {
    try {
        sessionStorage.setItem("calc_session_meta", JSON.stringify({
            statuses: user.statuses || [],
            paymentMethods: user.paymentMethods || [],
            elementStatuses: user.elementStatuses || [],
            managers: user.managers || []
        }));
    } catch (e) {
        console.warn("Не удалось сохранить метаданные сессии", e);
    }
}

function readSession() {
    let raw;
    try {
        raw = JSON.parse(localStorage.getItem("calc_session"));
    } catch (e) {
        localStorage.removeItem("calc_session");
        sessionStorage.removeItem("calc_session_meta");
        return { role: "guest", login: "", token: "" };
    }

    if (!raw || typeof raw !== "object") {
        return { role: "guest", login: "", token: "" };
    }

    const token = extractSessionToken(raw);
    const role = raw.role;
    if (!token || (role !== "staff" && role !== "client")) {
        return { role: "guest", login: "", token: "" };
    }

    try {
        const meta = readSessionMeta();
        return buildUserSession({
            ...raw,
            token,
            statuses: meta?.statuses || raw.statuses,
            paymentMethods: meta?.paymentMethods || raw.paymentMethods,
            elementStatuses: meta?.elementStatuses || raw.elementStatuses,
            managers: meta?.managers || raw.managers
        }, raw.login || raw.name || "");
    } catch (e) {
        console.warn("Не удалось восстановить метаданные сессии, используем компактную", e);
        return buildUserSession({
            role: raw.role,
            token,
            login: raw.login || raw.name || "",
            name: raw.login || raw.name || "",
            crmId: raw.crmId,
            clientName: raw.clientName || "",
            expiresAt: raw.expiresAt,
            statuses: [],
            paymentMethods: [],
            elementStatuses: [],
            managers: []
        }, raw.login || raw.name || "");
    }
}

function persistSession(user = currentUser) {
    const token = extractSessionToken(user);
    if (!token || (user.role !== "staff" && user.role !== "client")) {
        localStorage.removeItem("calc_session");
        sessionStorage.removeItem("calc_session_meta");
        return false;
    }

    const compact = {
        token,
        role: user.role,
        login: user.login || user.name || "",
        name: user.login || user.name || "",
        crmId: user.crmId,
        clientName: user.clientName || "",
        expiresAt: user.expiresAt
    };

    try {
        localStorage.setItem("calc_session", JSON.stringify(compact));
        persistSessionMeta(user);
        return localStorage.getItem("calc_session") != null;
    } catch (e) {
        console.warn("Не удалось сохранить сессию в localStorage", e);
        return false;
    }
}

let currentUser = { role: "guest", login: "", token: "" };

function hydrateCurrentUserFromStorage() {
    currentUser = readSession();
}
let lastCalcData = null;
const dealsCache = new Map();
let dealTabFetchToken = 0;
const tabScrollPositions = {};
let lastNonDealTabId = "main-tab";
let calendarMonth = new Date();
let calendarRangeStart = "";
let calendarRangeEnd = "";

function getSessionExpiryTime(session = currentUser) {
    const value = session?.expiresAt;
    if (value == null || value === "") return null;

    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : null;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        return value < 1000000000000 ? value * 1000 : value;
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && String(value).trim() !== "") {
        // Игнорируем явно некорректные маленькие числа (мусор из CRM/таблицы)
        if (asNumber > 0 && asNumber < 1000000000) return null;
        return asNumber < 1000000000000 ? asNumber * 1000 : asNumber;
    }

    const asDate = Date.parse(String(value));
    return Number.isFinite(asDate) ? asDate : null;
}

function isSessionExpired(session = currentUser) {
    if (session?.role !== 'staff' && session?.role !== 'client') return false;
    if (!String(session?.token || "").trim()) return true;

    const expiresAt = getSessionExpiryTime(session);
    // Нет валидного expiresAt — считаем сессию живой до 401 от сервера
    if (expiresAt == null) return false;

    return Date.now() >= expiresAt;
}

function validateStoredSessionOnLoad() {
    if (currentUser.role !== "staff" && currentUser.role !== "client") return;
    if (!extractSessionToken(currentUser)) {
        resetAuthToGuest();
    }
}

function resetAuthToGuest() {
    localStorage.removeItem("calc_session");
    sessionStorage.removeItem("calc_session_meta");
    currentUser = { role: "guest", login: "", token: "" };

    const badge = document.getElementById('role-badge');
    const nameDisp = document.getElementById('user-display-name');
    const authBtn = document.getElementById('authBtn');
    const crmContainer = document.getElementById('crm-search-container');
    const advTabBtn = document.getElementById('adv-tab-btn');

    if (badge) {
        badge.innerText = "ГОСТЬ";
        badge.style.background = "#7f8c8d";
    }
    if (nameDisp) nameDisp.innerText = "Режим просмотра";
    if (authBtn) {
        authBtn.innerText = "Войти";
        authBtn.onclick = toggleAuthModal;
    }
    if (crmContainer) crmContainer.style.display = 'none';
    if (advTabBtn) advTabBtn.style.display = 'none';
}

function ensureActiveSession(options = {}) {
    if (currentUser.role !== "staff" && currentUser.role !== "client") {
        if (!options.silent) {
            const modal = document.getElementById("auth-modal");
            if (modal) modal.style.display = "flex";
        }
        return false;
    }

    if (!extractSessionToken(currentUser)) {
        resetAuthToGuest();
        if (!options.silent) alert("Сессия истекла. Войдите снова.");
        const modal = document.getElementById("auth-modal");
        if (modal) modal.style.display = "flex";
        return false;
    }

    return true;
}

function handleUnauthorized(options = {}) {
    if (options.silent) return;
    resetAuthToGuest();
    alert("Сессия истекла. Войдите снова.");
    const modal = document.getElementById("auth-modal");
    if (modal) modal.style.display = "flex";
}

function normalizeStatuses(statuses) {
    if (!Array.isArray(statuses)) return [];

    return statuses
        .map(status => ({
            id: Number(status.status_id ?? status.statusId ?? status.id),
            name: status.name || "",
            bk_color: status.bk_color || "#dfdfdf",
            text_color: status.text_color || "black",
            type: status.type,
            is_email: status.is_email,
            is_preliminary: status.is_preliminary
        }))
        .filter(status => Number.isInteger(status.id) && status.name);
}

function normalizePaymentMethods(methods) {
    if (!Array.isArray(methods)) return [];

    return methods
        .map(method => ({
            id: Number(method.payment_id ?? method.payment_method_id ?? method.paymentMethodId ?? method.id),
            name: method.name || "",
            show_in_expenses: Boolean(method.show_in_expenses),
            is_cash: Boolean(method.is_cash),
            is_balance: Boolean(method.is_balance)
        }))
        .filter(method => Number.isFinite(method.id) && method.name);
}

function resolveStatusIconMeta(name) {
    if (typeof getStatusIcon === "function") {
        return getStatusIcon(name);
    }
    const label = (name || "").trim() || "Без статуса";
    const n = label.toLowerCase();
    if (!n || n === "без статуса") return { icon: "⚪", color: "#95a5a6", label: "Без статуса" };
    if (n === "печать") return { icon: "🖨️", color: "#3498db", label: "Печать" };
    if (n === "постпечать") return { icon: "✂️", color: "#e67e22", label: "Постпечать" };
    if (n === "завершено") return { icon: "✅", color: "#27ae60", label: "Завершено" };
    return { icon: "📦", color: "#9b59b6", label };
}

function normalizeElementStatuses(statuses) {
    if (!Array.isArray(statuses)) return [];

    return statuses
        .map(status => {
            const name = (status.name || "").trim();
            const iconMeta = resolveStatusIconMeta(name);
            const isManual = typeof status.is_manual === "boolean"
                ? status.is_manual
                : name.toLowerCase() !== "постпечать";

            return {
                id: Number(status.status_id ?? status.statusId ?? status.id),
                name: name || iconMeta.label,
                bk_color: status.bk_color || iconMeta.color,
                text_color: status.text_color || "white",
                is_manual: isManual,
                icon: status.icon || iconMeta.icon
            };
        })
        .filter(status => Number.isFinite(status.id) && status.name);
}

function parseAuthResponse(data) {
    let session = Array.isArray(data) ? data[0] : data;
    if (Array.isArray(session)) session = session[0];
    if (session?.json) session = session.json;
    if (session?.body && typeof session.body === "object") session = session.body;
    if (session?.data && typeof session.data === "object" && !session.token) {
        session = { ...session.data, ...session };
    }
    return session;
}

function buildUserSession(session, fallbackLogin = "") {
    const token = extractSessionToken(session);
    return {
        role: session.role,
        login: session.name || session.login || fallbackLogin,
        token,
        crmId: session.crmId,
        clientName: session.name || session.clientName || "",
        expiresAt: session.expiresAt,
        statuses: normalizeStatuses(session.dealStatuses || session.statuses),
        paymentMethods: normalizePaymentMethods(session.paymentMethods),
        elementStatuses: normalizeElementStatuses(session.elementStatuses),
        managers: normalizeManagers(session.managers || session.employees || session.responsibles)
    };
}

function normalizeManagers(managers) {
    if (!Array.isArray(managers)) return [];

    return managers
        .filter(manager => manager?.fired !== true && manager?.active !== false)
        .map(manager => ({
            id: Number(manager.user_id ?? manager.userId ?? manager.employee_id ?? manager.manager_id ?? manager.crmId ?? manager.id),
            name: (manager.fio || manager.name || "").trim()
        }))
        .filter(manager => Number.isFinite(manager.id) && manager.name)
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

function getCrmStatuses() {
    return normalizeStatuses(currentUser.statuses);
}

function getManagers() {
    return normalizeManagers(currentUser.managers);
}

function getPaymentMethods() {
    return normalizePaymentMethods(currentUser.paymentMethods);
}

function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = extractSessionToken(currentUser);
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

