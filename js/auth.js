// --- СИСТЕМА ПРАВ ---
function isUserLoggedIn() {
    return currentUser.role === "staff" || currentUser.role === "client";
}

function updateAuthModalUi() {
    const loggedInPanel = document.getElementById("auth-logged-in-panel");
    const loginPanel = document.getElementById("auth-login-panel");
    const badge = document.getElementById("role-badge");
    const nameDisp = document.getElementById("user-display-name");
    const authBtn = document.getElementById("authBtn");
    const loggedIn = isUserLoggedIn();

    if (loggedInPanel) loggedInPanel.hidden = !loggedIn;
    if (loginPanel) loginPanel.hidden = loggedIn;

    const isAdmin = typeof isCurrentUserAdmin === "function" && isCurrentUserAdmin();
    const usersBtn = document.getElementById("usersBtn");
    const settingsBtn = document.getElementById("calcSettingsBtn");

    if (loggedIn) {
        if (badge) {
            badge.innerText = currentUser.role === "staff" ? (isAdmin ? "АДМИН" : "СОТРУДНИК") : "КЛИЕНТ";
            badge.className = "auth-role-badge auth-role-badge--" + (isAdmin ? "admin" : currentUser.role);
        }
        if (nameDisp) {
            nameDisp.innerText = currentUser.login || currentUser.name || "Пользователь";
        }
        if (authBtn) {
            authBtn.classList.add("is-logged-in");
            authBtn.title = currentUser.login || "Аккаунт";
        }
        // Управление пользователями и настройки калькулятора — только админам.
        if (usersBtn) usersBtn.style.display = isAdmin ? "" : "none";
        if (settingsBtn) settingsBtn.style.display = isAdmin ? "" : "none";
    } else {
        if (usersBtn) usersBtn.style.display = "none";
        if (settingsBtn) settingsBtn.style.display = "none";
        if (badge) {
            badge.innerText = "ГОСТЬ";
            badge.className = "auth-role-badge auth-role-badge--guest";
        }
        if (nameDisp) nameDisp.innerText = "Режим просмотра";
        if (authBtn) {
            authBtn.classList.remove("is-logged-in");
            authBtn.title = "Войти";
        }
    }
}

function toggleAuthModal(forceOpen = null) {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;

    updateAuthModalUi();

    const shouldOpen = forceOpen == null
        ? (modal.style.display === "none" || modal.style.display === "")
        : Boolean(forceOpen);

    modal.style.display = shouldOpen ? "flex" : "none";

    if (shouldOpen && !isUserLoggedIn() && document.getElementById("loginEmail")) {
        document.getElementById("loginEmail").focus();
    }
}

async function attemptLogin(event) {
    if (event) event.preventDefault();

    const email = String(document.getElementById("loginEmail").value || "").trim().toLowerCase();
    const pass = document.getElementById("loginPass").value;
    const errorDiv = document.getElementById("login-error");
    const btn = document.getElementById("loginSubmitBtn");

    if (!email || !pass) {
        if (errorDiv) errorDiv.innerText = "Введите email и пароль";
        return;
    }
    btn.innerText = "Проверка...";
    btn.disabled = true;

    try {
        // Своя авторизация: email+пароль → наш бэкенд выдаёт токен-сессию.
        const response = await fetchWithTimeout(LOGIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: pass })
        });
        const data = await response.json().catch(() => ({}));
        const token = extractSessionToken(data);

        if (response.ok && data?.role && token) {
            currentUser = buildUserSession({ ...data, token }, email);
            if (typeof applyUserPrefsFromAuth === "function") applyUserPrefsFromAuth(data);
            if (!persistSession(currentUser)) {
                if (errorDiv) {
                    errorDiv.innerText = "Не удалось сохранить сессию. Проверьте, что браузер не блокирует localStorage (режим инкognito, настройки приватности).";
                }
                return;
            }
            toggleAuthModal(false);
            applyPermissions();
            if (typeof initStaffUserPrefs === "function") initStaffUserPrefs();
        } else if (errorDiv) {
            errorDiv.innerText = data?.error || "Неверный email или пароль";
        }
    } catch (e) {
        if (errorDiv) errorDiv.innerText = SERVER_TIMEOUT_MESSAGE;
    } finally {
        btn.innerText = "Войти в систему";
        btn.disabled = false;
    }
}

function logout() {
    // Best-effort инвалидация токена на сервере (не блокируем выход).
    try {
        const token = extractSessionToken(currentUser);
        if (token && typeof LOGOUT_URL === "string") {
            fetchWithTimeout(LOGOUT_URL, { method: "POST", headers: authHeaders() }, 5000).catch(() => {});
        }
    } catch (_) {}
    toggleAuthModal(false);
    localStorage.removeItem("calc_session");
    sessionStorage.removeItem("calc_session_meta");
    clearOpenDealState();
    location.reload();
}

function applyPermissions() {
    const crmContainer = document.getElementById("crm-search-container");
    const searchRow = crmContainer ? crmContainer.querySelector(".row") : null;

    updateAuthModalUi();

    if (isUserLoggedIn()) {
        crmContainer.style.display = "block";

        if (currentUser.role === "client" && searchRow) {
            searchRow.innerHTML = `
                <div class="col">
                    <button onclick="searchCRM('main')" style="margin-top:0; background: var(--accent);">
                        ${typeof icon === "function" ? icon("refresh") : ""} Загрузить список моих заказов
                    </button>
                </div>`;
        }

        if (currentUser.role === "staff") {
            document.querySelectorAll(".gated-nav").forEach(el => { el.style.display = ""; });
            fillStatusFilter();
            fillManagerFilter();
        } else {
            localStorage.setItem(CRM_VIEW_STORAGE_KEY, "list");
        }

        document.querySelectorAll("#adv-search-container .crm-view-toggle").forEach(el => {
            el.style.display = currentUser.role === "staff" ? "" : "none";
        });
        if (typeof applyCrmViewLayoutClass === "function") applyCrmViewLayoutClass();
    }
}
