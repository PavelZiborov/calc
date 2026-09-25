// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = () => {
    // Важно: после загрузки всех скриптов (getStatusIcon и др.)
    hydrateCurrentUserFromStorage();

    // Настройки калькулятора (размер листа, списки материалов, правила) — до расчётов
    if (typeof applyCalcSettings === "function") applyCalcSettings();

    // Инициализация списков с использованием строковых ID
    fillOptions("paper", papersFull, "Бумага 300 гр.");
    fillOptions("paperCover", papersFull, "Бумага 300 гр."); 
    fillOptions("paperBlock", papersFull, "Бумага 150 гр.");
    
    fillOptions("colorSheet", colorOptions, "4+0"); 
    fillOptions("colorCover", colorOptions, "4+4"); 
    fillOptions("colorBlock", colorOptions, "4+4");
    
    fillOptions("lamSheet", lamOptions, "Без ламинации");
    fillOptions("lamCover", lamOptions, "Без ламинации");
    fillOptions("lamBlock", lamOptions, "Без ламинации");
    
    updateType(); 
    setFormat(); 
    renderCalendar();
    validateStoredSessionOnLoad();
    applyPermissions();
    // Материалы калькулятора (бумага/цветность/ламинация + размер листа + HQ) — из прайса (staff).
    if (typeof refreshCalcMaterials === "function") refreshCalcMaterials();
    if (typeof initStaffUserPrefs === "function") initStaffUserPrefs();
    if (typeof restoreAdvSearchUiState === "function") restoreAdvSearchUiState();
    if (typeof initCrmViewToggle === "function") initCrmViewToggle();
    if (typeof restoreAppUiState === "function") restoreAppUiState();
    // По умолчанию для staff открываем раздел «Заказы»; если в URL есть якорь #deal-<№> —
    // открываем именно этот заказ (прямая ссылка). Гость/клиент остаются на калькуляторе.
    if (typeof bootDbOrdersView === "function") setTimeout(bootDbOrdersView, 0);

    // #crmSearchInput (легаси-поиск на калькуляторе) удалён — гвардим.
    document.getElementById('crmSearchInput')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchCRM('main'); });
    document.getElementById('advSearchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchCRM('adv');
    });

    window.addEventListener('resize', () => {
        if (typeof positionAdvFiltersPopover === 'function') positionAdvFiltersPopover();
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (typeof positionAdvFiltersPopover === 'function') positionAdvFiltersPopover();
        }, 120);
    });
};
