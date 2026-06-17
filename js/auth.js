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

    if (loggedIn) {
        if (badge) {
            badge.innerText = currentUser.role === "staff" ? "СОТРУДНИК" : "КЛИЕНТ";
            badge.className = "auth-role-badge auth-role-badge--" + currentUser.role;
        }
        if (nameDisp) {
            nameDisp.innerText = currentUser.login || currentUser.name || "Пользователь";
        }
        if (authBtn) {
            authBtn.classList.add("is-logged-in");
            authBtn.title = currentUser.login || "Аккаунт";
        }
    } else {
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

    const clientId = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPass").value;
    const errorDiv = document.getElementById("login-error");
    const btn = document.getElementById("loginSubmitBtn");

    if (!clientId || !pass) {
        if (errorDiv) errorDiv.innerText = "Введите ID и пароль";
        return;
    }
    btn.innerText = "Проверка...";
    btn.disabled = true;

    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "auth", clientId: clientId, password: pass })
        });
        const data = await response.json();
        const session = parseAuthResponse(data);
        const token = extractSessionToken(session);

        if (response.ok && session?.role && token) {
            currentUser = buildUserSession({ ...session, token }, clientId);
            if (typeof applyUserPrefsFromAuth === "function") applyUserPrefsFromAuth(session);
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
            errorDiv.innerText = "За получением логина и пароля обратитесь к вашему менеджеру";
        }
    } catch (e) {
        if (errorDiv) errorDiv.innerText = SERVER_TIMEOUT_MESSAGE;
    } finally {
        btn.innerText = "Войти в систему";
        btn.disabled = false;
    }
}

function logout() {
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
                    <button onclick="searchCRM('main')" style="margin-top:0; background: #27ae60;">
                        🔄 Загрузить список моих заказов
                    </button>
                </div>`;
        }

        if (currentUser.role === "staff") {
            document.getElementById("adv-tab-btn").style.display = "block";
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
