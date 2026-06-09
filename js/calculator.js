// --- РАСЧЕТ ---
async function calc() {
    const type = document.getElementById("type").value;
    const tir = Number(document.getElementById("tirazh").value);
    const lay = Number(document.getElementById("layout").value);
    const width = Number(document.getElementById("width").value);
    const height = Number(document.getElementById("height").value);
    const pagesInput = Number(document.getElementById("pages")?.value || 0);

    // Для каталогов нормализуем только layout для серверного расчета:
    // A4 -> 2 разворота, A5 -> 4 разворота, A6 -> 8 разворотов на SRA3.
    // Полосность отправляем исходную, иначе n8n посчитает листы в 2 раза меньше.
    let layoutForRequest = lay;
    if (type === "catalog") {
        const divisor = getCatalogDivisorBySize(width, height);
        layoutForRequest = Math.max(1, Math.round(divisor / 2));
    }
    
    const btn = document.querySelector('button[onclick="calc()"]');
    if (btn.disabled) return; 

    // Скрываем старые результаты и убираем класс анимации
    const resultMain = document.getElementById("resultMain");
    resultMain.style.display = "none";
    resultMain.classList.remove("price-animate");
    
    const markupSelectContainer = document.getElementById("markupSelectContainer");
    if (markupSelectContainer) markupSelectContainer.style.display = "none";

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.style.opacity = "0.7";
    btn.innerText = "⏳ Считаем...";

    const calcData = {
        action: 'calculate',
        hp: document.getElementById("honey_field").value,
        type: type,
        product: document.getElementById("product").value,
        tirazh: tir,
        layout: layoutForRequest,
        options: {
            cut: type === "catalog" ? true : document.getElementById("cut").checked,
            rounding: type === "sheet" ? document.getElementById("rounding").checked : false,
            cutMethod: document.getElementById("cutMethod") ? document.getElementById("cutMethod").value : 'straight'
        }
    };

    // Сбор данных по типу (как было раньше)
    if (type === "sheet") {
        calcData.paperId = document.getElementById("paper").value;
        calcData.color = document.getElementById("colorSheet").value;
        calcData.lamination = document.getElementById("lamSheet").value;
    } else {
        calcData.pages = pagesInput;
        calcData.binding = document.getElementById("binding").value;
        calcData.paperCoverId = document.getElementById("paperCover").value;
        calcData.colorCoverId = document.getElementById("colorCover").value;
        calcData.lamCoverId = document.getElementById("lamCover").value;
        calcData.paperBlockId = document.getElementById("paperBlock").value;
        calcData.colorBlockId = document.getElementById("colorBlock").value;
    }

    try {
        // Запускаем таймер на 1 секунды одновременно с запросом
        const timerPromise = new Promise(res => setTimeout(res, 1000));
        
        const fetchPromise = fetchWithTimeout(N8N_URL, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(calcData)
        });

        // Ждем выполнения ОБОИХ событий: и ответа сервера, и таймера
        const [response] = await Promise.all([fetchPromise, timerPromise]);

        if (!response.ok) throw new Error('Ошибка сервера');
        
        let result = await response.json();
        if (Array.isArray(result)) result = result[0];

        if (result.status === 'ok' && !result.total) return;

        window.currentCalcState = result.state; 
        lastCalcData = result.lastCalc;

        // Формируем "полное наименование" для staff/CRM (только sheet-режим, где используется paper/colorSheet)
        if (type === "sheet") {
            try {
                lastCalcData.fullName = buildFullNameForSheet();
            } catch (e) {
                // Если что-то пошло не так с чтением UI — не ломаем расчёт
                lastCalcData.fullName = lastCalcData.fullName || lastCalcData.name;
            }
        } else if (type === "catalog") {
            try {
                lastCalcData.fullName = buildFullNameForCatalog();
            } catch (e) {
                // Если что-то пошло не так с чтением UI — не ломаем расчёт
                lastCalcData.fullName = lastCalcData.fullName || lastCalcData.name;
            }
        }

        // Наполняем данными
        document.getElementById("recMultiplierLabel").innerText = (currentUser.role === 'staff') ? "Рекомендованная цена" : "Итоговая стоимость";
        document.getElementById("recPriceVal").innerHTML = `${formatPriceTotal(result.total)} ₽ <small>(${Number(result.priceOne).toFixed(2)} ₽/шт)</small>`;
        const roundControls = document.getElementById("roundPriceControls");
        if (roundControls) roundControls.style.display = (currentUser.role === 'staff') ? "flex" : "none";
        
        // --- ЛОГИКА ДЛЯ СОТРУДНИКОВ ---
        const markupSelectContainer = document.getElementById("markupSelectContainer");
        const costDetailDiv = document.getElementById("costDetail");
        const techDataDiv = document.getElementById("techData");

        if (currentUser.role === 'staff') {
            if (techDataDiv) {
                // Определяем выбранную наценку (под текущие result.total / result.priceOne)
                const currentMultMatch = Array.isArray(result.markupList)
                    ? result.markupList.find(m => {
                        const t = Number(m.total);
                        const p = Number(m.perOne);
                        const rt = Number(result.total);
                        const rp = Number(result.priceOne);
                        // В серверных данных возможны небольшие расхождения из-за округления
                        return Math.abs(t - rt) < 0.01 && Math.abs(p - rp) < 0.01;
                    })
                    : null;

                lastCalcData.selectedMultiplier = currentMultMatch ? currentMultMatch.multiplier : null;
                renderMarkupSelect(result.markupList, result.cost, lastCalcData.selectedMultiplier);
                // Берём структурированные данные из n8n; локальный расчёт оставляем как fallback.
                lastCalcData.sra3Sheets = toFiniteNumber(
                    result.totalSheets ?? result.lastCalc?.totalSheets,
                    calculateSra3Sheets(type, tir, lay)
                );
                // Fallback, если не удалось посчитать локально
                if (lastCalcData.sra3Sheets == null) {
                    lastCalcData.sra3Sheets = extractSra3SheetsFromTechInfo(result.techInfo);
                }
                lastCalcData.itemsOnSra3 = toFiniteNumber(result.itemsOnSra3 ?? result.lastCalc?.itemsOnSra3, lay);
                lastCalcData.costBreakdownHtml = formatCostBreakdown(result.costDetails, result.costBreakdown);
                lastCalcData.costTotal = toFiniteNumber(result.cost, result.lastCalc?.costTotal);
                lastCalcData.costHQ = toFiniteNumber(result.costHQ ?? result.lastCalc?.costHQ);
                // Инициализируем цену для блока "для заказчика" (и для CRM при сохранении)
                lastCalcData.total = result.total;
                lastCalcData.pricePerOne = result.priceOne;
                lastCalcData.priceOne = result.priceOne;
                refreshSelectedPriceUI("Рекомендованная цена");

                renderStaffTechAndCopyUI();
                techDataDiv.style.display = "block";
            }
            if (costDetailDiv) costDetailDiv.style.display = "none";
        } else {
            if (markupSelectContainer) markupSelectContainer.style.display = "none";
        }

        // Показываем результат с анимацией
        resultMain.style.display = "block";
        resultMain.classList.add("price-animate");

    } catch (e) {
        alert(SERVER_UNAVAILABLE_MESSAGE);
        console.error(e);
    } finally {
        // Разблокируем кнопку через 2 секунды после завершения (включая ожидание выше)
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerText = originalText;
    }
}

