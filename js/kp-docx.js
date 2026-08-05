// --- Генерация коммерческого предложения (Word .docx) на клиенте ---
// Без внешних библиотек: минимальный ZIP (метод store) + OOXML.
// Основа — шаблон КП ИП Зиборов: шапка-реквизиты, «Исх. № {номер} от {дата}»,
// таблица позиций (№ / Наименование / Ед.изм / Кол-во / Цена за шт / Итого без
// НДС), итог прописью + УСН, срок действия, подпись. Номер = ГГММДД, дата —
// сегодня. Логотип и адресат-тендер из оригинала опущены (для универсального КП).

(function () {
    "use strict";

    // ---------- CRC32 ----------
    let crcTable = null;
    function crc32(u8) {
        if (!crcTable) {
            crcTable = new Uint32Array(256);
            for (let n = 0; n < 256; n++) {
                let c = n;
                for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                crcTable[n] = c >>> 0;
            }
        }
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < u8.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ u8[i]) & 0xFF];
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // ---------- ZIP (store) ----------
    function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
    function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

    function zipStore(files) {
        const enc = new TextEncoder();
        const parts = [];      // локальные записи (заголовок+имя+данные)
        const central = [];    // записи центрального каталога
        let offset = 0;

        files.forEach(f => {
            const nameBytes = enc.encode(f.name);
            const data = (f.data instanceof Uint8Array) ? f.data : enc.encode(f.data);
            const crc = crc32(data);
            const size = data.length;

            const local = new Uint8Array([].concat(
                u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0)
            ));
            parts.push(local, nameBytes, data);

            central.push(new Uint8Array([].concat(
                u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                u32(crc), u32(size), u32(size), u16(nameBytes.length),
                u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
            )), nameBytes);

            offset += local.length + nameBytes.length + size;
        });

        const centralStart = offset;
        let centralSize = 0;
        central.forEach(c => centralSize += c.length);
        const eocd = new Uint8Array([].concat(
            u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
            u32(centralSize), u32(centralStart), u16(0)
        ));

        const all = parts.concat(central, [eocd]);
        let total = 0;
        all.forEach(a => total += a.length);
        const out = new Uint8Array(total);
        let p = 0;
        all.forEach(a => { out.set(a, p); p += a.length; });
        return out;
    }

    // ---------- helpers ----------
    function xmlEsc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function pad2(n) { return String(n).padStart(2, "0"); }
    function fmtMoney(v) { return (Number(v) || 0).toFixed(2).replace(".", ","); }

    // число → пропись (рубли), с родом для тысяч/миллионов
    function plural(n, one, few, many) {
        n = Math.abs(n) % 100;
        const n1 = n % 10;
        if (n > 10 && n < 20) return many;
        if (n1 > 1 && n1 < 5) return few;
        if (n1 === 1) return one;
        return many;
    }
    function rublesToWords(num) {
        num = Math.floor(Math.abs(Number(num) || 0));
        if (num === 0) return "ноль";
        const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
        const onesF = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
        const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
        const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
        const hund = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
        function triple(n, female) {
            const w = [];
            const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
            if (h) w.push(hund[h]);
            if (t === 1) w.push(teens[o]);
            else { if (t) w.push(tens[t]); if (o) w.push((female ? onesF : ones)[o]); }
            return w.join(" ");
        }
        const parts = [];
        const millions = Math.floor(num / 1000000);
        const thousands = Math.floor((num % 1000000) / 1000);
        const rest = num % 1000;
        if (millions) { parts.push(triple(millions, false)); parts.push(plural(millions, "миллион", "миллиона", "миллионов")); }
        if (thousands) { parts.push(triple(thousands, true)); parts.push(plural(thousands, "тысяча", "тысячи", "тысяч")); }
        if (rest) parts.push(triple(rest, false));
        return parts.filter(Boolean).join(" ");
    }

    // абзац; size — половины пунктов (24 = 12pt)
    function para(text, opt) {
        opt = opt || {};
        const size = opt.size || 24;
        const rpr = `<w:rPr>${opt.bold ? "<w:b/>" : ""}${opt.italic ? "<w:i/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`;
        const ppr = `<w:pPr><w:jc w:val="${opt.align || "left"}"/><w:spacing w:after="${opt.after != null ? opt.after : 120}" w:line="240" w:lineRule="auto"/></w:pPr>`;
        return `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
    }

    function cell(text, w, opt) {
        opt = opt || {};
        const size = opt.size || 22;
        const align = opt.align || "center";
        return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
            `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
            `<w:r><w:rPr>${opt.bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>` +
            `<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p></w:tc>`;
    }

    const COLS = [611, 4377, 878, 1603, 1540, 1435];

    function buildTable(positions) {
        const borders = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"]
            .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`).join("")}</w:tblBorders>`;
        const grid = `<w:tblGrid>${COLS.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;

        const head = `<w:tr><w:trPr><w:jc w:val="center"/><w:tblHeader/></w:trPr>` +
            cell("№ п/п", COLS[0], { bold: true }) +
            cell("Наименование товара", COLS[1], { bold: true }) +
            cell("Ед. изм.", COLS[2], { bold: true }) +
            cell("Кол-во", COLS[3], { bold: true }) +
            cell("Цена за шт. руб.", COLS[4], { bold: true }) +
            cell("Итого руб. без НДС", COLS[5], { bold: true }) +
            `</w:tr>`;

        const rows = positions.map((p, i) =>
            `<w:tr><w:trPr><w:jc w:val="center"/></w:trPr>` +
            cell(String(i + 1), COLS[0]) +
            cell(p.name || "Позиция", COLS[1], { align: "left" }) +
            cell(p.unit || "Шт.", COLS[2]) +
            cell(String(p.qty), COLS[3]) +
            cell(fmtMoney(p.priceOne), COLS[4]) +
            cell(fmtMoney(p.total), COLS[5]) +
            `</w:tr>`
        ).join("");

        return `<w:tbl><w:tblPr><w:tblW w:w="10444" w:type="dxa"/><w:jc w:val="center"/>${borders}` +
            `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
            grid + head + rows + `</w:tbl>`;
    }

    const COMPANY = [
        { t: "ИП Зиборов Павел Игоревич", bold: true },
        { t: "Юридический адрес: 429965, г. Новочебоксарск, ул. Семенова 35, кв. 5" },
        { t: "ИНН: 212401553304, ОГРНИП: 315212400001429" },
        { t: "Расчетный счет: 40802810002690000465" },
        { t: 'Банк: АО "АЛЬФА-БАНК" БИК: 044525593' },
        { t: "Корр. счет: 30101810200000000593" },
        { t: "Тел. номер: +7 (926) 300-00-85" },
        { t: "E-mail: zakaz@heavenprint.ru" },
        { t: "www.heavenprint.ru" }
    ];

    function buildDocumentXml(positions) {
        const now = new Date();
        const number = `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
        const dateStr = `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${now.getFullYear()}`;
        const valid = new Date(now.getTime() + 7 * 86400000);
        const validStr = `${pad2(valid.getDate())}.${pad2(valid.getMonth() + 1)}.${valid.getFullYear()}`;

        const total = positions.reduce((s, p) => s + (Number(p.total) || 0), 0);
        const rub = Math.floor(total);
        const kop = Math.round((total - rub) * 100);
        const totalStr = fmtMoney(total);
        const words = rublesToWords(rub);
        const rubW = plural(rub, "рубль", "рубля", "рублей");
        const kopW = plural(kop, "копейка", "копейки", "копеек");

        const header = COMPANY.map((l, i) =>
            para(l.t, { size: 18, bold: !!l.bold, after: i === COMPANY.length - 1 ? 200 : 20 })).join("");

        const body =
            header +
            para(`Исх. № ${number} от ${dateStr} г.`, { size: 24, after: 160 }) +
            para("Направляем коммерческое предложение на поставку товара (выполнение работ) в соответствии с требованиями Заказчика:", { size: 24, after: 160 }) +
            buildTable(positions) +
            para("", { after: 0 }) +
            para(`Итоговая стоимость составляет ${totalStr.replace(",", ",")} (${words}) ${rubW} ${pad2(kop)} ${kopW}. НДС не облагается в связи с применением УСН, на основании Главы 26.2 ст. 346.12 и 346.13 Налогового кодекса РФ.`, { size: 24, after: 160 }) +
            para("Цена предложения включает в себя подготовку макетов к печати, налоги, сборы и другие обязательные платежи, стоимость упаковки, погрузо-разгрузочные работы, а также транспортные расходы, в том числе доставку до места назначения.", { size: 24, after: 160 }) +
            para(`Данное коммерческое предложение действительно до ${validStr} г.`, { size: 24, after: 300 }) +
            para("Уполномоченное лицо  __________________  ИП Зиборов Павел Игоревич", { size: 24, after: 120 }) +
            para("М.П.", { size: 24, after: 0 });

        const sect = `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
            `<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
            `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
            `<w:body>${body}${sect}</w:body></w:document>`;
    }

    const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
        `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
        `</Types>`;

    const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
        `</Relationships>`;

    const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`;

    const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>` +
        `<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault>` +
        `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
        `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
        `</w:styles>`;

    function buildKpDocxBytes(positions) {
        const documentXml = buildDocumentXml(positions);
        return zipStore([
            { name: "[Content_Types].xml", data: CONTENT_TYPES },
            { name: "_rels/.rels", data: RELS },
            { name: "word/_rels/document.xml.rels", data: DOC_RELS },
            { name: "word/document.xml", data: documentXml },
            { name: "word/styles.xml", data: STYLES }
        ]);
    }

    // Публичная функция: собрать и скачать .docx
    function buildAndDownloadKpDocx(positions) {
        if (!Array.isArray(positions) || !positions.length) return;
        const now = new Date();
        const number = `${pad2(now.getFullYear() % 100)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
        const bytes = buildKpDocxBytes(positions);
        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `КП_№${number}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }

    // экспорт в глобальную область (вызывается из calc-sheet.js)
    window.buildAndDownloadKpDocx = buildAndDownloadKpDocx;
    window._kpDocxInternals = { buildDocumentXml, buildKpDocxBytes, rublesToWords, zipStore };
})();
