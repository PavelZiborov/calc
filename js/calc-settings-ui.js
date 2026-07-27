// --- UI: «Настройки калькулятора» (только staff) ---
// Модалка с тремя вкладками: Лист / Материалы / Продукты.
// Работает с рабочей копией (draft); изменения применяются по «Сохранить».

let calcSettingsDraft = null;
let csActiveTab = "sheet";
let csActiveProduct = null;

function _csEsc(v) {
    return String(v == null ? "" : v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function openCalcSettings() {
    if (currentUser.role !== "staff") return;
    if (typeof toggleAuthModal === "function") toggleAuthModal(false);
    calcSettingsDraft = JSON.parse(JSON.stringify(getCalcSettings()));
    csActiveTab = "sheet";
    const products = Object.keys(calcSettingsDraft.productRules || {});
    csActiveProduct = products[0] || null;

    let modal = document.getElementById("calc-settings-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "calc-settings-modal";
        modal.addEventListener("mousedown", (e) => { if (e.target === modal) closeCalcSettings(); });
        document.body.appendChild(modal);
    }
    renderCalcSettingsModal();
    modal.classList.add("open");
}

function closeCalcSettings() {
    const modal = document.getElementById("calc-settings-modal");
    if (modal) modal.classList.remove("open");
}

function csSwitchTab(tab) {
    csActiveTab = tab;
    document.querySelectorAll("#calc-settings-modal .cs-tab").forEach(b => b.classList.toggle("is-active", b.dataset.tab === tab));
    document.querySelectorAll("#calc-settings-modal .cs-pane").forEach(p => { p.hidden = p.dataset.pane !== tab; });
}

function renderCalcSettingsModal() {
    const modal = document.getElementById("calc-settings-modal");
    if (!modal) return;
    const d = calcSettingsDraft;
    modal.innerHTML = `
      <div class="cs-dialog" onmousedown="event.stopPropagation()">
        <div class="cs-head">
          <h3>Настройки калькулятора</h3>
          <button type="button" class="cs-close" onclick="closeCalcSettings()" aria-label="Закрыть">&times;</button>
        </div>
        <div class="cs-tabs" role="tablist">
          <button type="button" class="cs-tab ${csActiveTab==='sheet'?'is-active':''}" data-tab="sheet" onclick="csSwitchTab('sheet')">Лист и зазоры</button>
          <button type="button" class="cs-tab ${csActiveTab==='materials'?'is-active':''}" data-tab="materials" onclick="csSwitchTab('materials')">Материалы</button>
          <button type="button" class="cs-tab ${csActiveTab==='products'?'is-active':''}" data-tab="products" onclick="csSwitchTab('products')">Продукты</button>
        </div>
        <div class="cs-body">
          <div class="cs-pane" data-pane="sheet" ${csActiveTab==='sheet'?'':'hidden'}>${renderCsSheetPane(d)}</div>
          <div class="cs-pane" data-pane="materials" ${csActiveTab==='materials'?'':'hidden'}>${renderCsMaterialsPane(d)}</div>
          <div class="cs-pane" data-pane="products" ${csActiveTab==='products'?'':'hidden'}>${renderCsProductsPane(d)}</div>
        </div>
        <div class="cs-foot">
          <button type="button" class="cs-reset" onclick="csResetDraft()">Сбросить к стандартным</button>
          <button type="button" class="cs-save" onclick="csSave()">Сохранить</button>
        </div>
      </div>`;
}

/* ---------- Вкладка «Лист и зазоры» ---------- */
function renderCsSheetPane(d) {
    const f = (label, key, hint) => `
      <label class="cs-field">
        <span>${label}${hint ? `<i class="cs-hint">${hint}</i>` : ""}</span>
        <input type="number" min="1" step="1" value="${_csEsc(d.sheet[key])}" onchange="csSheetChange('${key}', this.value)">
      </label>`;
    return `
      <p class="cs-note">Размер печатного листа и отступы, по которым считается число изделий на лист. Влияет на расчёт сразу.</p>
      <div class="cs-grid2">
        ${f("Ширина листа, мм", "width")}
        ${f("Высота листа, мм", "height")}
        ${f("Зазор между макетами, мм", "gap")}
        ${f("Поле по краю, мм", "margin")}
        ${f("Поле при плоттерной резке, мм", "marginPlotter")}
      </div>`;
}
function csSheetChange(key, value) {
    const n = parseFloat(value);
    if (Number.isFinite(n) && n >= 0) calcSettingsDraft.sheet[key] = n;
}

/* ---------- Вкладка «Материалы» ---------- */
function renderCsMaterialsPane(d) {
    return `
      <p class="cs-note">Справочники материалов. <b>ID</b> должен совпадать с идентификатором в расчётном движке (сервер). Флаг <b>HQ</b> — бумага не учитывается в себестоимости HQ (покупается отдельно).</p>
      ${renderCsMatList("papers", "Бумаги", true)}
      ${renderCsMatList("colors", "Цветность", false)}
      ${renderCsMatList("laminations", "Ламинация", false)}
      ${renderCsMatList("postpress", "Постпечать", false)}`;
}
function renderCsMatList(kind, title, withHq) {
    const items = calcSettingsDraft.materials[kind] || [];
    const rows = items.map((m, i) => `
      <div class="cs-mat-row">
        <input class="cs-mat-name" type="text" value="${_csEsc(m.name)}" placeholder="Название" onchange="csMatField('${kind}',${i},'name',this.value)">
        <input class="cs-mat-id" type="text" value="${_csEsc(m.id)}" placeholder="id" onchange="csMatField('${kind}',${i},'id',this.value)">
        ${withHq ? `<label class="cs-hq" title="Исключить бумагу из себестоимости HQ"><input type="checkbox" ${m.hqExcluded?'checked':''} onchange="csMatField('${kind}',${i},'hqExcluded',this.checked)"> HQ</label>` : ""}
        <button type="button" class="cs-mat-del" title="Удалить" onclick="csMatDelete('${kind}',${i})">&times;</button>
      </div>`).join("");
    return `
      <details class="cs-cat" open>
        <summary>${title} <span class="cs-count">${items.length}</span></summary>
        <div class="cs-mat-list">${rows || '<div class="cs-empty">Пусто</div>'}</div>
        <button type="button" class="cs-add" onclick="csMatAdd('${kind}')">+ Добавить</button>
      </details>`;
}
function csMatField(kind, idx, field, value) {
    const m = calcSettingsDraft.materials[kind]?.[idx];
    if (!m) return;
    if (field === "hqExcluded") m.hqExcluded = !!value;
    else m[field] = String(value);
}
function csMatAdd(kind) {
    calcSettingsDraft.materials[kind] = calcSettingsDraft.materials[kind] || [];
    const base = { id: "", name: "" };
    if (kind === "papers") base.hqExcluded = false;
    calcSettingsDraft.materials[kind].push(base);
    renderCsMaterialsPane_refresh();
}
function csMatDelete(kind, idx) {
    const arr = calcSettingsDraft.materials[kind];
    if (!arr) return;
    arr.splice(idx, 1);
    renderCsMaterialsPane_refresh();
}
function renderCsMaterialsPane_refresh() {
    const pane = document.querySelector('#calc-settings-modal .cs-pane[data-pane="materials"]');
    if (pane) pane.innerHTML = renderCsMaterialsPane(calcSettingsDraft);
}

/* ---------- Вкладка «Продукты» ---------- */
function renderCsProductsPane(d) {
    const products = Object.keys(d.productRules || {});
    if (!products.length) return `<div class="cs-empty">Нет типов продукции</div>`;
    if (!csActiveProduct || !products.includes(csActiveProduct)) csActiveProduct = products[0];
    const opts = products.map(p => `<option value="${_csEsc(p)}" ${p===csActiveProduct?'selected':''}>${_csEsc(p)}</option>`).join("");
    return `
      <p class="cs-note">Какие материалы показывать для выбранного типа продукции в калькуляторе.</p>
      <label class="cs-field cs-field--inline">
        <span>Тип продукции</span>
        <select onchange="csProductSelect(this.value)">${opts}</select>
      </label>
      <div id="cs-rule-body">${renderCsRuleBody(d, csActiveProduct)}</div>`;
}
function renderCsRuleBody(d, product) {
    const rule = d.productRules[product] || { papers: [], colors: [], laminations: [] };
    const group = (kind, title) => {
        const items = d.materials[kind] || [];
        const allowed = new Set(rule[kind] || []);
        const boxes = items.map(m => `
          <label class="cs-chk">
            <input type="checkbox" ${allowed.has(m.id)?'checked':''} onchange="csRuleToggle('${_csEsc(product)}','${kind}','${_csEsc(m.id)}',this.checked)">
            <span>${_csEsc(m.name)}</span>
          </label>`).join("");
        return `<div class="cs-rule-group"><h4>${title}</h4><div class="cs-chk-grid">${boxes || '<div class="cs-empty">Пусто</div>'}</div></div>`;
    };
    return `${group("papers","Бумаги")}${group("colors","Цветность")}${group("laminations","Ламинация")}`;
}
function csProductSelect(product) {
    csActiveProduct = product;
    const body = document.getElementById("cs-rule-body");
    if (body) body.innerHTML = renderCsRuleBody(calcSettingsDraft, product);
}
function csRuleToggle(product, kind, id, checked) {
    const rule = calcSettingsDraft.productRules[product] = calcSettingsDraft.productRules[product] || { papers: [], colors: [], laminations: [] };
    rule[kind] = rule[kind] || [];
    const has = rule[kind].includes(id);
    if (checked && !has) rule[kind].push(id);
    if (!checked && has) rule[kind] = rule[kind].filter(x => x !== id);
}

/* ---------- Сохранение / сброс ---------- */
function csSave() {
    // очистим пустые материалы (без id) чтобы не мусорить
    ["papers", "colors", "laminations", "postpress"].forEach(k => {
        calcSettingsDraft.materials[k] = (calcSettingsDraft.materials[k] || []).filter(m => String(m.id || "").trim() !== "");
    });
    saveCalcSettings(calcSettingsDraft);
    // применить к открытому калькулятору (не ломая текущий выбор типа)
    if (typeof updateType === "function") updateType();
    // неблокирующая обратная связь на кнопке, затем закрытие
    const btn = document.querySelector("#calc-settings-modal .cs-save");
    if (btn) { btn.textContent = "Сохранено ✓"; btn.disabled = true; }
    setTimeout(closeCalcSettings, 650);
}
let csResetArmed = false;
function csResetDraft() {
    const btn = document.querySelector("#calc-settings-modal .cs-reset");
    if (!csResetArmed) {
        // двойное подтверждение без блокирующего confirm()
        csResetArmed = true;
        if (btn) { btn.textContent = "Точно сбросить?"; btn.classList.add("is-armed"); }
        setTimeout(() => {
            csResetArmed = false;
            if (btn && document.body.contains(btn)) { btn.textContent = "Сбросить к стандартным"; btn.classList.remove("is-armed"); }
        }, 3000);
        return;
    }
    csResetArmed = false;
    calcSettingsDraft = JSON.parse(JSON.stringify(defaultCalcSettings()));
    const products = Object.keys(calcSettingsDraft.productRules || {});
    csActiveProduct = products[0] || null;
    renderCalcSettingsModal();
}
