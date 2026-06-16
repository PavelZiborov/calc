// --- СИСТЕМА ПРАВ ---
function toggleAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.style.display = (modal.style.display === 'none' || modal.style.display === '') ? 'flex' : 'none';
}

// Добавляем event в скобки
async function attemptLogin(event) {
    if (event) event.preventDefault(); // Это предотвратит перезагрузку при отправке формы

    const clientId = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const errorDiv = document.getElementById('login-error');
    const btn = document.getElementById('loginSubmitBtn');

    if (!clientId || !pass) { errorDiv.innerText = "Введите ID и пароль"; return; }
    btn.innerText = "Проверка..."; btn.disabled = true;

    try {
        const response = await fetchWithTimeout(N8N_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'auth', clientId: clientId, password: pass })
        });
        const data = await response.json();
        const session = parseAuthResponse(data);
        const token = extractSessionToken(session);

        if (response.ok && session?.role && token) {
            currentUser = buildUserSession({ ...session, token }, clientId);
            if (!persistSession(currentUser)) {
                errorDiv.innerText = "Не удалось сохранить сессию. Проверьте, что браузер не блокирует localStorage (режим инкognito, настройки приватности).";
                return;
            }
            toggleAuthModal();
            applyPermissions();
        } else {
            errorDiv.innerText = "За получением логина и пароля обратитесь к вашему менеджеру";
        }
    } catch (e) {
        errorDiv.innerText = SERVER_UNAVAILABLE_MESSAGE;
    } finally {
        btn.innerText = "Войти в систему"; btn.disabled = false;
    }
}

function logout() {
    localStorage.removeItem("calc_session");
    sessionStorage.removeItem("calc_session_meta");
    clearOpenDealState();
    location.reload();
}

function applyPermissions() {
    const badge = document.getElementById('role-badge');
    const nameDisp = document.getElementById('user-display-name');
    const authBtn = document.getElementById('authBtn');
    const crmContainer = document.getElementById('crm-search-container');
    const searchRow = crmContainer ? crmContainer.querySelector('.row') : null;

    if (currentUser.role === 'staff' || currentUser.role === 'client') {
        badge.innerText = currentUser.role === 'staff' ? "СОТРУДНИК" : "КЛИЕНТ";
        badge.style.background = currentUser.role === 'staff' ? "#e67e22" : "#27ae60";
        nameDisp.innerText = currentUser.login;
        authBtn.innerText = "Выйти"; 
        authBtn.onclick = logout;
        
        crmContainer.style.display = 'block';

        // Если зашел клиент — убираем инпут и ставим кнопку "Загрузить"
        if (currentUser.role === 'client' && searchRow) {
            searchRow.innerHTML = `
                <div class="col">
                    <button onclick="searchCRM('main')" style="margin-top:0; background: #27ae60;">
                        🔄 Загрузить список моих заказов
                    </button>
                </div>`;
        }
        
        if (currentUser.role === 'staff') {
            document.getElementById('adv-tab-btn').style.display = 'block';
            fillStatusFilter();
            fillManagerFilter();
        } else {
            localStorage.setItem(CRM_VIEW_STORAGE_KEY, "list");
        }

        document.querySelectorAll('#adv-search-container .crm-view-toggle').forEach(el => {
            el.style.display = currentUser.role === 'staff' ? '' : 'none';
        });
        if (typeof applyCrmViewLayoutClass === 'function') applyCrmViewLayoutClass();
    }
}

