// --- РАСЧЁТНЫЙ ЛИСТ (черновик заказа, живёт до перезагрузки/закрытия) ---
// НАБРОСОК. Кнопка «Добавить в расчёт» в синем блоке калькулятора кладёт текущий
// расчёт в этот лист (отдельная вкладка). Можно накапливать несколько расчётов и
// добавлять позиции вручную. Кнопка «Добавить в реальный заказ» — пока заглушка
// со сводкой (интеграцию с CRM допилим по факту).
//
// Данные в памяти (calcSheetItems) — при перезагрузке страницы теряются.

let calcSheetItems = [];
let calcSheetSeq = 0;

const CALC_SHEET_TAB_ID = "calc-sheet-tab";

function csRound2(v) {
    return Math.round((Number(v) || 0) * 100) / 100;
}
function csMoney(v) {
    return Number(v || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function csEsc(v) {
    return (typeof escapeHtml === "function")
        ? escapeHtml(v == null ? "" : String(v))
        : String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// «Добавить в расчёт» из калькулятора
function addCurrentCalcToSheet() {
    if (typeof lastCalcData === "undefined" || !lastCalcData || !(Number(lastCalcData.total) > 0)) {
        alert("Сначала сделайте расчёт");
        return;
    }
    calcSheetItems.push({
        id: ++calcSheetSeq,
        name: lastCalcData.fullName || lastCalcData.name || "Позиция",
        qty: Number(lastCalcData.qty) || 1,
        priceOne: Number(lastCalcData.pricePerOne ?? lastCalcData.priceOne ?? 0),
        total: Number(lastCalcData.total) || 0,
        cost: Number.isFinite(Number(lastCalcData.costTotal)) ? Number(lastCalcData.costTotal) : null,
        costHq: Number.isFinite(Number(lastCalcData.costHQ)) ? Number(lastCalcData.costHQ) : null,
        sra3: (lastCalcData.sra3Sheets != null && lastCalcData.sra3Sheets !== "") ? Number(lastCalcData.sra3Sheets) : null,
        manual: false
    });
    ensureCalcSheetTab();
    renderCalcSheet();
    // Вкладку открываем «в фоне» — НЕ переключаемся на неё автоматически.
    flashAddToSheetBtn();
}

// Короткий фидбэк на кнопке «Добавить в расчёт» + счётчик на вкладке листа
function flashAddToSheetBtn() {
    const btn = document.getElementById("addToSheetBtn");
    if (btn && !btn.dataset.flashing) {
        btn.dataset.flashing = "1";
        const original = btn.innerHTML;
        btn.innerHTML = `<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg> Добавлено в лист`;
        setTimeout(() => { btn.innerHTML = original; delete btn.dataset.flashing; }, 1300);
    }
}

function openCalcSheetTab() {
    const btn = document.querySelector(`.tab-btn[data-tab-target="${CALC_SHEET_TAB_ID}"]`);
    if (typeof switchTab === "function") switchTab(CALC_SHEET_TAB_ID, btn);
}

function ensureCalcSheetTab() {
    let tabBtn = document.querySelector(`.tab-btn[data-tab-target="${CALC_SHEET_TAB_ID}"]`);
    if (!tabBtn) {
        tabBtn = document.createElement("button");
        tabBtn.className = "nav-tab tab-btn nav-tab--sheet";
        tabBtn.dataset.tabTarget = CALC_SHEET_TAB_ID;
        tabBtn.onclick = () => openCalcSheetTab();
        tabBtn.innerHTML = `<svg class="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/><path d="M9 12l2 2l4 -4"/></svg><span>Расчётный лист</span><span class="csh-tab-count" id="cshTabCount" hidden></span><span class="tab-close-btn" onclick="event.stopPropagation(); closeCalcSheet()" title="Закрыть лист">&times;</span>`;
        document.querySelector(".tabs-nav")?.appendChild(tabBtn);
    }
    let tab = document.getElementById(CALC_SHEET_TAB_ID);
    if (!tab) {
        tab = document.createElement("div");
        tab.id = CALC_SHEET_TAB_ID;
        tab.className = "tab-content";
        document.body.appendChild(tab);
    }
}

function closeCalcSheet() {
    calcSheetItems = [];
    const tabBtn = document.querySelector(`.tab-btn[data-tab-target="${CALC_SHEET_TAB_ID}"]`);
    const tab = document.getElementById(CALC_SHEET_TAB_ID);
    const wasActive = tab && tab.classList.contains("active");
    if (tabBtn) tabBtn.remove();
    if (tab) tab.remove();
    if (wasActive && typeof switchTab === "function") {
        switchTab("main-tab", document.querySelector('.tab-btn[data-tab-target="main-tab"]'));
    }
}

function addManualSheetItem() {
    calcSheetItems.push({ id: ++calcSheetSeq, name: "", qty: 1, priceOne: 0, total: 0, cost: null, costHq: null, sra3: null, manual: true });
    renderCalcSheet();
    setTimeout(() => {
        const inputs = document.querySelectorAll("#calc-sheet-tab .csh-item .csh-name-input");
        const last = inputs[inputs.length - 1];
        if (last) last.focus();
    }, 0);
}

function removeSheetItem(id) {
    calcSheetItems = calcSheetItems.filter(it => it.id !== Number(id));
    renderCalcSheet();
}

// Правка позиции (наименование/кол-во/цена) — для ВСЕХ позиций, и расчётных, и
// ручных. Обновляем в месте (без ре-рендера), чтобы не терять фокус при вводе.
function updateSheetItem(id, field, value) {
    const it = calcSheetItems.find(x => x.id === Number(id));
    if (!it) return;
    if (field === "name") it.name = value;
    else if (field === "qty") it.qty = Math.max(0, Number(value) || 0);
    else if (field === "priceOne") it.priceOne = Math.max(0, Number(value) || 0);
    it.total = csRound2(it.qty * it.priceOne);

    const rowTotal = document.querySelector(`#calc-sheet-tab .csh-item[data-id="${it.id}"] .csh-item-total`);
    if (rowTotal) rowTotal.textContent = `${csMoney(it.total)} ₽`;
    const totalEl = document.querySelector("#calc-sheet-tab .csh-total b");
    if (totalEl) totalEl.textContent = `${csMoney(getCalcSheetTotal())} ₽`;
}
// совместимость со старым именем
function updateManualItem(id, field, value) { updateSheetItem(id, field, value); }

function getCalcSheetTotal() {
    return calcSheetItems.reduce((s, it) => s + (Number(it.total) || 0), 0);
}

// Все позиции редактируемые: название / кол-во / цена. У расчётных дополнительно
// строка себест./HQ/SRA3 (staff, справочно — не меняется при правке цены).
function renderCalcSheetItem(it, isStaff) {
    const del = `<button type="button" class="csh-item-del" onclick="removeSheetItem(${it.id})" title="Удалить" aria-label="Удалить">&times;</button>`;
    const costLine = (isStaff && !it.manual && it.cost != null)
        ? `<div class="csh-item-cost">${it.sra3 != null ? `Листов SRA3: <b>${it.sra3}</b> · ` : ""}Себест.: <b>${Math.round(it.cost).toLocaleString("ru-RU")} ₽</b>${it.costHq != null ? ` · HQ: <b>${Math.round(it.costHq).toLocaleString("ru-RU")} ₽</b>` : ""}</div>`
        : "";

    return `
        <div class="csh-item csh-item--edit" data-id="${it.id}">
            <div class="csh-item-main">
                <input class="csh-name-input" type="text" placeholder="Название позиции" value="${csEsc(it.name)}" onchange="updateSheetItem(${it.id},'name',this.value)">
                ${costLine}
            </div>
            <div class="csh-item-calc">
                <input class="csh-qty-input" type="number" min="0" inputmode="numeric" value="${it.qty}" oninput="updateSheetItem(${it.id},'qty',this.value)"><span class="csh-x">шт ×</span>
                <input class="csh-price-input" type="number" min="0" step="0.01" inputmode="decimal" value="${it.priceOne}" oninput="updateSheetItem(${it.id},'priceOne',this.value)"><span class="csh-x">₽/шт</span>
            </div>
            <span class="csh-item-total">${csMoney(it.total)} ₽</span>
            ${del}
        </div>`;
}

function renderCalcSheet() {
    const tab = document.getElementById(CALC_SHEET_TAB_ID);
    if (!tab) return;
    const isStaff = (typeof currentUser !== "undefined") && currentUser.role === "staff";
    const rows = calcSheetItems.map(it => renderCalcSheetItem(it, isStaff)).join("");
    const total = getCalcSheetTotal();

    tab.innerHTML = `
      <div class="container calc-sheet">
        <div class="csh-head">
          <div>
            <h2>Расчётный лист</h2>
            <p class="csh-note">Черновик заказа. Позиции хранятся до перезагрузки страницы или закрытия вкладки.</p>
          </div>
          <span class="csh-count">${calcSheetItems.length}</span>
        </div>

        <div class="csh-items">${rows || '<div class="csh-empty">Пусто. Добавьте расчёт кнопкой «Добавить в расчёт» в калькуляторе или добавьте позицию вручную.</div>'}</div>

        <div class="csh-add-row">
          <button type="button" class="add-btn" onclick="switchTab('main-tab', document.querySelector('.tab-btn[data-tab-target=&quot;main-tab&quot;]'))">＋ Из калькулятора</button>
          <button type="button" class="add-btn add-btn-secondary" onclick="addManualSheetItem()">＋ Добавить вручную</button>
          <button type="button" class="add-btn add-btn-secondary" id="cshCopyBtn" onclick="copyCalcSheetForCustomer()"${calcSheetItems.length ? "" : " disabled"}>Скопировать для заказчика</button>
          <button type="button" class="add-btn add-btn-secondary" id="cshKpBtn" onclick="downloadCalcSheetKp()"${calcSheetItems.length ? "" : " disabled"}>Скачать КП (Word)</button>
        </div>

        <div class="csh-footer">
          <div class="csh-total">Итого: <b>${csMoney(total)} ₽</b></div>
          <div class="csh-actions">
            <button type="button" class="csh-clear" onclick="closeCalcSheet()">Очистить лист</button>
            <button type="button" class="csh-tocrm" onclick="addCalcSheetToRealDeal()"${isStaff ? "" : " disabled title=\"Только для сотрудников\""}>Добавить в реальный заказ</button>
          </div>
        </div>
      </div>`;

    updateCalcSheetTabCount();
}

// Счётчик позиций на вкладке листа (для фоновой осведомлённости)
function updateCalcSheetTabCount() {
    const badge = document.getElementById("cshTabCount");
    if (!badge) return;
    const n = calcSheetItems.length;
    badge.textContent = String(n);
    badge.hidden = n === 0;
}

// Текст для заказчика: все позиции БЕЗ себестоимости + итог (как в калькуляторе, но для списка)
function buildCalcSheetCustomerText() {
    const blocks = calcSheetItems.map(it => {
        const name = it.name || "Позиция";
        const qty = Number(it.qty) || 0;
        const priceOne = Number(it.priceOne) || 0;
        const total = Number(it.total) || 0;
        if (total > 0 && priceOne > 0) {
            return `${name}\n${qty} шт - ${csMoney(total)} ₽ (${priceOne.toFixed(2)} ₽/шт)`;
        }
        if (priceOne > 0) return `${name}\n${qty} шт - (${priceOne.toFixed(2)} ₽/шт)`;
        return `${name}\n—`;
    });
    let text = blocks.join("\n\n");
    if (calcSheetItems.length > 1) {
        text += `\n\nИтого: ${csMoney(getCalcSheetTotal())} ₽`;
    }
    return text;
}

async function copyCalcSheetForCustomer() {
    if (!calcSheetItems.length) return;
    const text = buildCalcSheetCustomerText();
    const btn = document.getElementById("cshCopyBtn");
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
        }
        if (btn) {
            const old = btn.textContent;
            btn.textContent = "Скопировано ✓";
            setTimeout(() => { btn.textContent = old; }, 1500);
        }
    } catch (e) {
        alert("Не удалось скопировать:\n\n" + text);
        console.error(e);
    }
}

// НАБРОСОК: отправка листа в реальный заказ CRM. Пока — сводка + TODO.
function addCalcSheetToRealDeal() {
    if ((typeof currentUser === "undefined") || currentUser.role !== "staff") return;
    if (!calcSheetItems.length) { alert("Расчётный лист пуст"); return; }
    const summary = calcSheetItems
        .map(it => `• ${it.name || "—"} — ${it.qty} шт — ${csMoney(it.total)} ₽`)
        .join("\n");
    alert(
        "Добавить в реальный заказ — в разработке.\n\n" +
        summary +
        `\n\nИтого: ${csMoney(getCalcSheetTotal())} ₽\n\n` +
        "Следующий шаг: создание сделки в CRM и отправка этих позиций."
    );
}

// Скачать коммерческое предложение (Word .docx) по позициям листа
function downloadCalcSheetKp() {
    if (!calcSheetItems.length) return;
    if (typeof buildAndDownloadKpDocx !== "function") { alert("Модуль КП не загружен"); return; }
    const positions = calcSheetItems.map(it => ({
        name: (it.name || "Позиция").trim(),
        unit: "Шт.",
        qty: Number(it.qty) || 0,
        priceOne: Number(it.priceOne) || 0,
        total: Number(it.total) || 0
    }));
    try {
        buildAndDownloadKpDocx(positions);
        const btn = document.getElementById("cshKpBtn");
        if (btn) { const o = btn.textContent; btn.textContent = "Готово ✓"; setTimeout(() => { btn.textContent = o; }, 1500); }
    } catch (e) {
        console.error(e);
        alert("Не удалось сформировать КП: " + (e.message || e));
    }
}
