// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = () => {
    // Важно: после загрузки всех скриптов (getStatusIcon и др.)
    hydrateCurrentUserFromStorage();

    // Инициализация списков с использованием строковых ID
    fillOptions("paper", papersFull, "Бумага 300 гр."); 
    fillOptions("paperCover", papersFull, "Бумага 300 гр."); 
    fillOptions("paperBlock", papersFull, "Бумага 150 гр.");
    
    fillOptions("colorSheet", colorOptions, "4+0"); 
    fillOptions("colorCover", colorOptions, "4+4"); 
    fillOptions("colorBlock", colorOptions, "4+4");
    
    fillOptions("lamSheet", lamOptions, "Без ламинации"); 
    fillOptions("lamCover", lamOptions, "Без ламинации");
    
    updateType(); 
    setFormat(); 
    renderCalendar();
    validateStoredSessionOnLoad();
    applyPermissions();
    if (typeof initCrmViewToggle === "function") initCrmViewToggle();
    if (currentUser.role === "staff" || currentUser.role === "client") {
        // Восстановление вкладки заказа — без принудительного logout при 401
        restoreOpenDealTab();
    }
    
    document.getElementById('crmSearchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchCRM('main'); });
    document.getElementById('advSearchInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') searchCRM('adv'); });
};
