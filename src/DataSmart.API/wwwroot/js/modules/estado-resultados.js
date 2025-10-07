// wwwroot/js/modules/estado-resultados.js
console.log('✅ estado-resultados.js (robusto meses/valores + vista dividida)');

class EstadoResultadosModule {
    constructor(app) {
        this.app = app || { userId: 'user-demo' };
        this.currentData = null;

        // referencias para vista dividida
        this._leftTable = null;
        this._rightTable = null;
        this._leftBox = null;
        this._rightBox = null;

        this._wireStaticUI();
    }

    /* =================== UTILIDADES =================== */
    _qs(s, r = document) { return r.querySelector(s); }
    _qsa(s, r = document) { return Array.from(r.querySelectorAll(s)); }

    _meses() {
        return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    }

    // Convierte a número: "$ 1.234.567,89" | "1.234.567" | "(123)" → -123
    toNumber(v) {
        if (v == null) return 0;
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            const isNeg = /\(/.test(v);
            let s = v.trim()
                .replace(/\s+/g, '')
                .replace(/\$/g, '')
                .replace(/\./g, '')      // miles
                .replace(/,/g, '.')      // decimal
                .replace(/[()]/g, '');
            const n = Number(s);
            return Number.isFinite(n) ? (isNeg ? -n : n) : 0;
        }
        return 0;
    }

    // Devuelve el objeto que contiene los meses para un nodo
    monthsSource(node) {
        return node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.totales ?? node?.Totales ?? node ?? {};
    }

    monthValue(src, i) {
        if (!src || Object.keys(src).length === 0) return 0;
        const idx = i + 1;
        const name = this._meses()[i];
        const keys = [String(idx), idx, name, name?.toLowerCase?.(), `Mes${idx}`, `mes${idx}`, `MES${idx}`, `m${idx}`, `m${String(idx).padStart(2, '0')}`];
        for (const k of keys) {
            if (Object.prototype.hasOwnProperty.call(src, k)) {
                const num = this.toNumber(src[k]);
                return Number.isFinite(num) ? num : 0; // 0 es válido
            }
        }
        return 0;
    }

    // Lee 12 meses de un nodo cualquiera (cuenta / nivel / grupo)
    readMonthly(node) {
        const src = node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node ?? {};
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
        return out;
    }

    // Suma elemento a elemento 12 meses (por si lo necesitas en otras vistas)
    sum(a, b) {
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = (a?.[i] || 0) + (b?.[i] || 0);
        return out;
    }

    anyNonZero(arr) { return arr.some(v => Math.abs(this.toNumber(v)) > 0); }

    // No muestra ceros
    formatCurrency(n) {
        const num = this.toNumber(n);
        if (num === 0) return '';
        return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    }

    showLoading() { this._qs('#loading')?.style.setProperty('display', 'block'); this._qs('#error-message')?.style.setProperty('display', 'none'); }
    hideLoading() { this._qs('#loading')?.style.setProperty('display', 'none'); }
    showError(msg) { const e = this._qs('#error-message'); if (e) { e.textContent = msg; e.style.display = 'block'; } this.hideLoading(); }

    /* =================== UI FIJA =================== */
    _wireStaticUI() {
        this._qs('#expand-all')?.addEventListener('click', () => this.expandAll());
        this._qs('#collapse-groups')?.addEventListener('click', () => this.collapseGroups());
        this._qs('#collapse-levels')?.addEventListener('click', () => this.collapseLevels());
        this._qs('#year-select')?.addEventListener('change', (e) => this.loadAnualData(e.target.value));
    }

    _pickResultados(data) {
        return data?.resultados ?? data?.Resultados ?? data?.resultado ?? data?.Resultado ?? data;
    }

    /* =================== CARGA =================== */
    async loadAnualData(year = null) {
        const y = year || this._qs('#year-select')?.value;
        if (!y) { this.showError('Por favor selecciona un año'); return; }

        this.showLoading();
        try {
            const url = `/api/Finance/estado-resultados-anual?año=${encodeURIComponent(y)}&userId=${encodeURIComponent(this.app.userId || 'user-demo')}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`Error ${resp.status}: ${await resp.text()}`);
            const data = await resp.json();
            this.currentData = data;

            // Render directo desde API (no re-sumar)
            this.renderAnualTable(data.resultados);

            // Divide en izq/dcha y sincroniza
            this.splitAnualTable(3);
            this.hideLoading();
        } catch (err) {
            console.error(err);
            this.showError(err.message || 'Error al cargar.');
        }
    }

    /* =================== RENDER ANUAL (API ONLY) =================== */
    renderAnualTable(apiResultados) {
        // Detecta si hay tablas divididas (izquierda: Grupo/Nivel/Cuenta; derecha: meses + total)
        const leftBody = this._qs('#table-body-left');
        const rightBody = this._qs('#table-body-right');
        const singleBody = this._qs('#table-body');

        const hasSplitTables = !!(leftBody && rightBody);
        const clear = (el) => { if (el) el.innerHTML = ''; };

        if (hasSplitTables) { clear(leftBody); clear(rightBody); }
        else { if (!singleBody) { console.error('No table body'); return; } singleBody.innerHTML = ''; }

        if (!apiResultados) { this.showError('Estructura de datos no válida'); return; }

        // estructura desde la API
        const grupos = apiResultados.estructura ?? apiResultados.Estructura ?? apiResultados.resultados?.estructura ?? [];
        if (!Array.isArray(grupos) || grupos.length === 0) { this.showError('No hay estructura para pintar'); return; }

        // helpers solo lectura
        const readMonthly = (node) => {
            const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
            const out = new Array(12).fill(0);
            for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
            return out;
        };
        const apiTotal = (node) => {
            const t = this.toNumber(node?.totalAnualGrupo ?? node?.totalAnualNivel ?? node?.totalAnual ?? node?.total ?? null);
            return Number.isFinite(t) ? t : 0;
        };

        const applyDataset = (tr, ds) => {
            if (!ds) return;
            Object.entries(ds).forEach(([k, v]) => {
                if (v !== undefined && v !== null) tr.setAttribute(`data-${k}`, String(v));
            });
        };

        // === pintado split (izq/dcha) con clases por tipo de fila
        const paintRowSplit = (rowClass, dataset, leftCellsHtml, rightMonthsArr, rightTotal) => {
            const trL = document.createElement('tr');
            trL.className = `ds-row ${rowClass}`;
            trL.innerHTML = leftCellsHtml;
            applyDataset(trL, dataset);
            leftBody.appendChild(trL);

            const trR = document.createElement('tr');
            trR.className = `ds-row ${rowClass}`;
            trR.innerHTML = `
        ${rightMonthsArr.map(v => {
                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
            }).join('')}
        <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
            applyDataset(trR, dataset);
            rightBody.appendChild(trR);
        };

        // === pintado en una sola tabla
        const paintRowSingle = (rowClass, dataset, leftCellsHtml, rightMonthsArr, rightTotal) => {
            const tr = document.createElement('tr');
            tr.className = `ds-row ${rowClass}`;
            tr.innerHTML = `
        ${leftCellsHtml}
        ${rightMonthsArr.map(v => {
                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
            }).join('')}
        <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
            applyDataset(tr, dataset);
            singleBody.appendChild(tr);
        };

        const paintRow = hasSplitTables ? paintRowSplit : paintRowSingle;

        // ───────────── PINTAR: grupo → nivel → cuentas ─────────────
        grupos.forEach((grupo, gi) => {
            const gMeses = readMonthly(grupo);
            const gTotal = apiTotal(grupo);

            // GRUPO = TOTAL_GRUPO
            const leftGrupo = `
        <td class="col-grupo">
          <span class="expand-icon">▸</span>
          <strong>${grupo.nombreGrupo ?? grupo.grupo ?? `Grupo ${gi + 1}`}</strong>
        </td>
        <td class="col-nivel"></td>
        <td class="col-cuenta"></td>`;
            paintRow('row-total-grupo group-header TOTAL_GRUPO', { 'group-index': gi }, leftGrupo, gMeses, gTotal);

            // NIVELES
            const niveles = Array.isArray(grupo.niveles ?? grupo.Niveles) ? (grupo.niveles ?? grupo.Niveles) : [];
            niveles.forEach((nivel, ni) => {
                const nMeses = readMonthly(nivel);
                const nTotal = apiTotal(nivel);

                // NIVEL = TOTAL_NIVEL
                const leftNivel = `
          <td class="col-grupo"></td>
          <td class="col-nivel">
            <span class="expand-icon">▸</span>
            <strong>${nivel.nivel ?? nivel.nombreNivel ?? `Nivel ${ni + 1}`}</strong>
          </td>
          <td class="col-cuenta"></td>`;
                paintRow('row-total-nivel level-header TOTAL_NIVEL', { 'group-index': gi, 'level-index': ni }, leftNivel, nMeses, nTotal);

                // CUENTAS
                const cuentas = Array.isArray(nivel.cuentas ?? nivel.Cuentas) ? (nivel.cuentas ?? nivel.Cuentas) : [];
                cuentas.forEach((cuenta, ci) => {
                    const cMeses = readMonthly(cuenta);
                    const cTotal = apiTotal(cuenta);

                    const leftCuenta = `
            <td class="col-grupo"></td>
            <td class="col-nivel"></td>
            <td class="col-cuenta">${cuenta.nombreCuenta ?? cuenta.cuenta ?? `Cuenta ${ci + 1}`}</td>`;
                    paintRow('account-row', { 'group-index': gi, 'level-index': ni, 'account-index': ci }, leftCuenta, cMeses, cTotal);
                });
            });
        });

        // Delegación para expandir/contraer
        const clickContainer = hasSplitTables ? rightBody : singleBody;
        clickContainer.addEventListener('click', (ev) => {
            const icon = ev.target.closest('.expand-icon');
            if (!icon) return;
            const tr = ev.target.closest('tr');
            const gi = tr?.getAttribute('data-group-index');
            const ni = tr?.getAttribute('data-level-index');
            if (tr?.classList.contains('level-header')) {
                this._toggleLevel(gi, ni);
            } else {
                this._toggleGroup(gi);
            }
            if (this._leftTable && this._rightTable) {
                this.syncRowHeightsTables(this._leftTable, this._rightTable);
            }
        });

        // Ajustes finales split
        if (hasSplitTables) {
            // Igualar alturas de ambas tablas y armar scroll sincronizado
            const leftTable = leftBody.closest('table');
            const rightTable = rightBody.closest('table');
            this.syncRowHeightsTables(leftTable, rightTable);
            this.setupSplitScrollSync();
            window.addEventListener('resize', () => this.syncRowHeightsTables(leftTable, rightTable));
        }
    }

    /* =================== EXPAND/CONTRACT =================== */
    expandAll() {
        this._qsa('.level-header').forEach(r => r.style.display = '');
        this._qsa('.account-row').forEach(r => r.style.display = '');
        if (this._leftTable && this._rightTable) this.syncRowHeightsTables(this._leftTable, this._rightTable);
    }
    collapseGroups() {
        this._qsa('.level-header,.account-row').forEach(r => r.style.display = 'none');
        if (this._leftTable && this._rightTable) this.syncRowHeightsTables(this._leftTable, this._rightTable);
    }
    collapseLevels() {
        this._qsa('.level-header').forEach(r => r.style.display = '');
        this._qsa('.account-row').forEach(r => r.style.display = 'none');
        if (this._leftTable && this._rightTable) this.syncRowHeightsTables(this._leftTable, this._rightTable);
    }

    _toggleGroup(gi) {
        const rows = this._qsa(`tr.level-header[data-group-index="${gi}"], tr.account-row[data-group-index="${gi}"]`);
        const hide = rows.every(r => r.style.display === 'none');
        rows.forEach(r => r.style.display = hide ? '' : 'none');
    }
    _toggleLevel(gi, ni) {
        const rows = this._qsa(`tr.account-row[data-group-index="${gi}"][data-level-index="${ni}"]`);
        const hide = rows.every(r => r.style.display === 'none');
        rows.forEach(r => r.style.display = hide ? '' : 'none');
        this._qsa(`tr.level-header[data-group-index="${gi}"][data-level-index="${ni}"]`).forEach(r => r.style.display = '');
    }

    /* =================== VISTA DIVIDIDA =================== */
    splitAnualTable(freezeCount = 3) {
        const srcWrap = this._qs('#anual-source');
        const src = this._qs('#financial-table');
        const grid = this._qs('#anual-grid');
        const left = this._qs('#financial-table-left');
        const right = this._qs('#financial-table-right');
        const rightBox = this._qs('#anual-right');
        const leftBox = this._qs('#anual-left');
        const inner = this._qs('#anual-inner');

        if (!src || !grid || !left || !right || !rightBox || !leftBox || !inner) return;

        left.innerHTML = '<thead></thead><tbody id="table-body-left"></tbody>';
        right.innerHTML = '<thead></thead><tbody id="table-body-right"></tbody>';

        // copia encabezados
        const sHeadRow = src.tHead?.rows[0]; if (!sHeadRow) return;
        const lHead = left.tHead; const lHR = lHead.insertRow();
        const rHead = right.tHead; const rHR = rHead.insertRow();
        Array.from(sHeadRow.cells).forEach((cell, i) => {
            const th = cell.cloneNode(true);
            (i < freezeCount ? lHR : rHR).appendChild(th);
        });

        // copia filas existentes del source (si las hubiera)
        const sBody = src.tBodies[0];
        const lBody = left.tBodies[0];
        const rBody = right.tBodies[0];
        Array.from(sBody.rows).forEach(row => {
            const ltr = lBody.insertRow();
            const rtr = rBody.insertRow();
            Array.from(row.cells).forEach((cell, i) => {
                const td = cell.cloneNode(true);
                (i < freezeCount ? ltr : rtr).appendChild(td);
            });
            ltr.className = row.className; rtr.className = row.className;
            for (const a of row.attributes) {
                if (a.name.startsWith('data-')) {
                    ltr.setAttribute(a.name, a.value);
                    rtr.setAttribute(a.name, a.value);
                }
            }
        });

        srcWrap.style.display = 'none';
        grid.style.display = 'grid';

        this._leftTable = left; this._rightTable = right;
        this._leftBox = leftBox; this._rightBox = rightBox;

        this.syncRowHeightsTables(left, right);

        // scroll vertical sincronizado
        rightBox.addEventListener('scroll', () => { leftBox.scrollTop = rightBox.scrollTop; });

        // ancho para meses
        inner.style.width = 'max-content';
        const needed = Math.max(right.scrollWidth, rightBox.clientWidth + 600);
        inner.style.minWidth = needed + 'px';

        this.wireAnualSlider();
    }

    syncRowHeightsTables(leftTable, rightTable) {
        const lh = leftTable.tHead?.rows[0], rh = rightTable.tHead?.rows[0];
        if (lh && rh) {
            const h = Math.max(lh.getBoundingClientRect().height, rh.getBoundingClientRect().height);
            lh.style.height = h + 'px';
            rh.style.height = h + 'px';
        }
        const lRows = leftTable.tBodies[0].rows;
        const rRows = rightTable.tBodies[0].rows;
        const n = Math.min(lRows.length, rRows.length);
        for (let i = 0; i < n; i++) {
            const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
            lRows[i].style.height = h + 'px';
            rRows[i].style.height = h + 'px';
        }
        window.addEventListener('resize', () => this.syncRowHeightsTables(leftTable, rightTable), { once: true });
    }

    wireAnualSlider() {
        const rightBox = this._qs('#anual-right');
        const slider = this._qs('#anual-hslider');
        if (!rightBox || !slider) return;

        const refresh = () => {
            const max = Math.max(0, rightBox.scrollWidth - rightBox.clientWidth);
            slider.min = '0'; slider.max = String(max); slider.step = '1';
            slider.value = String(Math.min(rightBox.scrollLeft, max));
            slider.style.display = max > 0 ? 'block' : 'none';
        };
        slider.oninput = () => { rightBox.scrollLeft = slider.valueAsNumber; };
        rightBox.addEventListener('scroll', () => { slider.value = String(rightBox.scrollLeft); });

        requestAnimationFrame(refresh);
        setTimeout(refresh, 50);
        window.addEventListener('resize', () => setTimeout(refresh, 0));
    }

    setupSplitScrollSync() {
        // Asume contenedores:
        // <div id="table-left"  class="ds-left"> ... <tbody id="table-body-left">
        // <div id="table-right" class="ds-right"> ... <tbody id="table-body-right">
        const left = document.getElementById('table-left');
        const right = document.getElementById('table-right');
        if (!left || !right) return;

        left.style.overflowY = 'hidden';
        let syncing = false;
        const onScroll = () => {
            if (syncing) return;
            syncing = true;
            left.scrollTop = right.scrollTop;
            requestAnimationFrame(() => { syncing = false; });
        };
        right.removeEventListener('scroll', onScroll);
        right.addEventListener('scroll', onScroll);

        const fixBottom = () => { left.scrollTop = right.scrollTop; };
        right.addEventListener('wheel', fixBottom, { passive: true });
        right.addEventListener('touchmove', fixBottom, { passive: true });
    }
}

/* ===== Exponer a global ===== */
window.EstadoResultadosModule = EstadoResultadosModule;



//// wwwroot/js/modules/estado-resultados.js
//console.log('✅ estado-resultados.js (robusto meses/valores + vista dividida)');

//class EstadoResultadosModule {
//    constructor(app) {
//        this.app = app || { userId: 'user-demo' };
//        this.currentData = null;
//        this._leftTable = null; this._rightTable = null;
//        this._leftBox = null; this._rightBox = null;

//        this._wireStaticUI();
//    }

//    /* =================== UTILIDADES =================== */
//    _qs(s, r = document) { return r.querySelector(s); }
//    _qsa(s, r = document) { return Array.from(r.querySelectorAll(s)); }

//    _meses() {
//        return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
//    }

//    // Convierte a número: "$ 1.234.567,89" | "1.234.567" | "(123)" → -123
//    toNumber(v) {
//        if (v == null) return 0;
//        if (typeof v === 'number' && Number.isFinite(v)) return v;
//        if (typeof v === 'string') {
//            const isNeg = /\(/.test(v);
//            let s = v.trim()
//                .replace(/\s+/g, '')
//                .replace(/\$/g, '')
//                .replace(/\./g, '')      // puntos como separador de miles
//                .replace(/,/g, '.')      // coma decimal → punto
//                .replace(/[()]/g, '');   // paréntesis
//            const n = Number(s);
//            return Number.isFinite(n) ? (isNeg ? -n : n) : 0;
//        }
//        return 0;
//    }

//    // Devuelve el objeto que contiene los meses para un nodo
//    monthsSource(node) {
//        return node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.totales ?? node?.Totales ?? node ?? {};
//    }

//    monthValue(src, i) {
//        if (!src || Object.keys(src).length === 0) return 0;
//        const idx = i + 1;
//        const name = this._meses()[i];
//        const keys = [String(idx), idx, name, name?.toLowerCase?.(), `Mes${idx}`, `mes${idx}`, `MES${idx}`, `m${idx}`, `m${String(idx).padStart(2, '0')}`];
//        for (const k of keys) {
//            if (Object.prototype.hasOwnProperty.call(src, k)) {
//                const num = this.toNumber(src[k]);
//                return Number.isFinite(num) ? num : 0; // 0 es válido
//            }
//        }
//        return 0;
//    }

//    // Lee 12 meses de un nodo cualquiera (cuenta / nivel / grupo)
//    readMonthly(node) {
//        // soporta: node.meses | node.Meses | node.totalesPorMes | node.TotalesPorMes | node
//        const src = node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node ?? {};
//        const out = new Array(12).fill(0);
//        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
//        return out;
//    }



//    sum12(a, b) {
//        const out = new Array(12).fill(0);
//        for (let i = 0; i < 12; i++) out[i] = (a?.[i] || 0) + (b?.[i] || 0);
//        return out;
//    }
//    toMesesObject(arr12) {
//        const map = {};
//        const names = this._meses();
//        for (let i = 0; i < 12; i++) {
//            map[names[i]] = arr12[i];
//            map[String(i + 1)] = arr12[i];
//        }
//        return map;
//    }



//    construirFilas(anual) {
//        // anual.Estructura | anual.estructura | anual.Grupos | anual.grupos
//        const grupos = anual.Estructura ?? anual.estructura ?? anual.Grupos ?? anual.grupos ?? [];
//        const filas = [];

//        grupos.forEach(g => {
//            const nombreGrupo = g.NombreGrupo ?? g.nombreGrupo ?? g.Grupo ?? g.grupo ?? "";
//            filas.push({ Tipo: "GRUPO_HEAD", Grupo: nombreGrupo, Nivel: "", Cuenta: "", Meses: {} });

//            const niveles = g.Niveles ?? g.niveles ?? [];
//            niveles.forEach(n => {
//                const nombreNivel = n.Nivel ?? n.nivel ?? "";
//                const cuentas = n.Cuentas ?? n.cuentas ?? [];

//                // Cuentas
//                cuentas
//                    .sort((a, b) => (a.CodCuenta ?? a.codCuenta ?? "").localeCompare(b.CodCuenta ?? b.codCuenta ?? ""))
//                    .forEach(c => {
//                        const meses = this.readMonthly(c);
//                        filas.push({
//                            Tipo: "CUENTA",
//                            Grupo: nombreGrupo,
//                            Nivel: nombreNivel,
//                            CodCuenta: c.CodCuenta ?? c.codCuenta ?? "",
//                            Cuenta: c.NombreCuenta ?? c.nombreCuenta ?? c.Cuenta ?? c.cuenta ?? "",
//                            Meses: this.toMesesObject(meses)
//                        });
//                    });

//                // Total de nivel = suma de cuentas
//                const totNivel = this.totalesDeNivel(n);
//                filas.push({
//                    Tipo: "TOTAL_NIVEL",
//                    Grupo: nombreGrupo,
//                    Nivel: nombreNivel,
//                    Cuenta: "",
//                    Meses: this.toMesesObject(totNivel)
//                });
//            });

//            // Total de grupo = suma de totales de nivel del mismo grupo
//            const totGrupo = this.totalesDeGrupo(g);
//            filas.push({
//                Tipo: "TOTAL_GRUPO",
//                Grupo: nombreGrupo,
//                Nivel: "",
//                Cuenta: "",
//                Meses: this.toMesesObject(totGrupo)
//            });
//        });

//        return filas;
//    }


//    // Agrega este método para debuguear los datos
//    debugData(resultados) {
//        console.log('🔍 DEBUG - Estructura de datos recibida:', resultados);

//        const grupos = resultados.estructura ?? resultados.Grupos ?? resultados.grupos ?? [];
//        grupos.forEach((g, gi) => {
//            console.log(`Grupo ${gi}:`, g.grupo || g.nombreGrupo);

//            const niveles = Array.isArray(g.niveles ?? g.Niveles) ? (g.niveles ?? g.Niveles) : [];
//            niveles.forEach((n, ni) => {
//                console.log(`  Nivel ${ni}:`, n.nivel || n.nombreNivel);
//                console.log(`  Meses del nivel:`, this.readMonthly(n));

//                const cuentas = Array.isArray(n.cuentas ?? n.Cuentas) ? (n.cuentas ?? n.Cuentas) : [];
//                cuentas.forEach((c, ci) => {
//                    console.log(`    Cuenta ${ci}:`, c.cuenta || c.nombreCuenta);
//                    console.log(`    Meses de cuenta:`, this.readMonthly(c));
//                });
//            });
//        });
//    }


//    async loadAnualData(year = null) {
//        const y = year || this._qs('#year-select')?.value;
//        if (!y) { this.showError('Por favor selecciona un año'); return; }

//        this.showLoading();
//        try {
//            const url = `/api/Finance/estado-resultados-anual?año=${encodeURIComponent(y)}&userId=${encodeURIComponent(this.app.userId || 'user-demo')}`;
//            const resp = await fetch(url);
//            if (!resp.ok) throw new Error(`Error ${resp.status}: ${await resp.text()}`);
//            const data = await resp.json();
//            this.currentData = data;
//            this.renderAnualTable(data.resultados);
//            this.splitAnualTable(3);                            // divide en izq/dcha
//            this.hideLoading();
//        } catch (err) {
//            console.error(err);
//            this.showError(err.message || 'Error al cargar.');
//        }
//    }


//    _readMonthly(node) {
//        // soporta: totalesPorMes, Meses, meses…
//        const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
//        const out = new Array(12).fill(0);
//        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
//        return out;
//    }
//    _toMesesObj(arr12) {
//        const o = {}; const N = this._meses();
//        for (let i = 0; i < 12; i++) { o[N[i]] = arr12[i]; o[String(i + 1)] = arr12[i]; }
//        return o;
//    }

//    _buildFilasDesdeAPI(apiResultados) {
//        const estructura = apiResultados?.estructura ?? [];
//        const filas = [];

//        estructura.forEach(g => {
//            const gNombre = g.nombreGrupo ?? g.Grupo ?? g.grupo ?? '';
//            filas.push({ Tipo: 'GRUPO_HEAD', Grupo: gNombre, Nivel: '', Cuenta: '', Meses: {} });

//            const niveles = g.niveles ?? g.Niveles ?? [];
//            niveles.forEach(n => {
//                const nNombre = n.nivel ?? n.Nivel ?? '';
//                const cuentas = n.cuentas ?? n.Cuentas ?? [];

//                // Cuentas (de la API)
//                cuentas
//                    .sort((a, b) => (a.codCuenta ?? '').localeCompare(b.codCuenta ?? ''))
//                    .forEach(c => {
//                        const meses = this._readMonthly(c); // ← LEE de c.totalesPorMes
//                        filas.push({
//                            Tipo: 'CUENTA',
//                            Grupo: gNombre,
//                            Nivel: nNombre,
//                            CodCuenta: c.codCuenta ?? '',
//                            Cuenta: c.nombreCuenta ?? '',
//                            Meses: this._toMesesObj(meses)
//                        });
//                    });

//                // Total Nivel (de la API)
//                filas.push({
//                    Tipo: 'TOTAL_NIVEL',
//                    Grupo: gNombre,
//                    Nivel: nNombre,
//                    Cuenta: '',
//                    Meses: this._toMesesObj(this._readMonthly(n)) // ← LEE de n.totalesPorMes
//                });
//            });

//            // Total Grupo (de la API)
//            filas.push({
//                Tipo: 'TOTAL_GRUPO',
//                Grupo: gNombre,
//                Nivel: '',
//                Cuenta: '',
//                Meses: this._toMesesObj(this._readMonthly(g)) // ← LEE de g.totalesPorMes
//            });
//        });

//        return filas;
//    }

//    // Suma elemento a elemento 12 meses
//    sum(a, b) {
//        const out = new Array(12).fill(0);
//        for (let i = 0; i < 12; i++) out[i] = (a?.[i] || 0) + (b?.[i] || 0);
//        return out;
//    }




//    anyNonZero(arr) { return arr.some(v => Math.abs(this.toNumber(v)) > 0); }


//    //formatCurrency(n) { return this.toNumber(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }


//    // Método formatCurrency que no muestra ceros
//    formatCurrency(n) {
//        const num = this.toNumber(n);
//        if (num === 0) return ''; // No mostrar ceros
//        return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
//    }


//    showLoading() { this._qs('#loading')?.style.setProperty('display', 'block'); this._qs('#error-message')?.style.setProperty('display', 'none'); }
//    hideLoading() { this._qs('#loading')?.style.setProperty('display', 'none'); }
//    showError(msg) { const e = this._qs('#error-message'); if (e) { e.textContent = msg; e.style.display = 'block'; } this.hideLoading(); }

//    /* =================== UI FIJA =================== */
//    _wireStaticUI() {
//        this._qs('#expand-all')?.addEventListener('click', () => this.expandAll());
//        this._qs('#collapse-groups')?.addEventListener('click', () => this.collapseGroups());
//        this._qs('#collapse-levels')?.addEventListener('click', () => this.collapseLevels());
//        this._qs('#year-select')?.addEventListener('change', (e) => this.loadAnualData(e.target.value));
//    }


//    _pickResultados(data) {
//        return data?.resultados ?? data?.Resultados ?? data?.resultado ?? data?.Resultado ?? data;
//    }



//    //renderAnualTable(apiResultados) {
//    //    // Detecta si hay tablas divididas (izquierda: Grupo/Nivel/Cuenta; derecha: meses + total)
//    //    const leftBody = this._qs('#table-body-left');
//    //    const rightBody = this._qs('#table-body-right');
//    //    const singleBody = this._qs('#table-body');

//    //    const hasSplitTables = !!(leftBody && rightBody);
//    //    const clear = (el) => { if (el) el.innerHTML = ''; };

//    //    if (hasSplitTables) { clear(leftBody); clear(rightBody); }
//    //    else { if (!singleBody) { console.error('No table body'); return; } singleBody.innerHTML = ''; }

//    //    if (!apiResultados) { this.showError('Estructura de datos no válida'); return; }

//    //    // estructura desde la API (tu JSON)
//    //    const grupos = apiResultados.estructura ?? apiResultados.Estructura ?? apiResultados.resultados?.estructura ?? [];
//    //    if (!Array.isArray(grupos) || grupos.length === 0) { this.showError('No hay estructura para pintar'); return; }

//    //    // helpers solo lectura
//    //    const readMonthly = (node) => {
//    //        const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
//    //        const out = new Array(12).fill(0);
//    //        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i); // 0 es válido; no “brinca”
//    //        return out;
//    //    };
//    //    const apiTotal = (node) => {
//    //        const t = this.toNumber(node?.totalAnualGrupo ?? node?.totalAnualNivel ?? node?.totalAnual ?? node?.total ?? null);
//    //        return Number.isFinite(t) ? t : 0;
//    //    };

//    //    const paintRowSplit = (leftCellsHtml, rightMonthsArr, rightTotal) => {
//    //        // izquierda (3 celdas)
//    //        const trL = document.createElement('tr');
//    //        trL.innerHTML = leftCellsHtml;
//    //        leftBody.appendChild(trL);

//    //        // derecha (12 + total)
//    //        const trR = document.createElement('tr');
//    //        trR.innerHTML = `
//    //  ${rightMonthsArr.map(v => {
//    //            const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//    //            return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
//    //        }).join('')}
//    //  <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
//    //        rightBody.appendChild(trR);
//    //    };

//    //    const paintRowSingle = (leftCellsHtml, rightMonthsArr, rightTotal) => {
//    //        const tr = document.createElement('tr');
//    //        tr.innerHTML = `
//    //  ${leftCellsHtml}
//    //  ${rightMonthsArr.map(v => {
//    //            const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//    //            return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
//    //        }).join('')}
//    //  <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
//    //        singleBody.appendChild(tr);
//    //    };

//    //    const paintRow = hasSplitTables ? paintRowSplit : paintRowSingle;

//    //    // ───────────── PINTAR: grupo → nivel → cuentas ─────────────
//    //    grupos.forEach((grupo, gi) => {
//    //        const gMeses = readMonthly(grupo);
//    //        const gTotal = apiTotal(grupo);

//    //        // GRUPO
//    //        const leftGrupo = `
//    //              <td class="col-grupo">
//    //                <span class="expand-icon">▸</span>
//    //                <strong>${grupo.nombreGrupo ?? grupo.grupo ?? `Grupo ${gi + 1}`}</strong>
//    //              </td>
//    //              <td class="col-nivel"></td>
//    //              <td class="col-cuenta"></td>`;
//    //        paintRow(leftGrupo, gMeses, gTotal);

//    //        // NIVELES
//    //        const niveles = Array.isArray(grupo.niveles ?? grupo.Niveles) ? (grupo.niveles ?? grupo.Niveles) : [];
//    //        niveles.forEach((nivel, ni) => {
//    //            const nMeses = readMonthly(nivel);
//    //            const nTotal = apiTotal(nivel);

//    //            const leftNivel = `
//    //    <td class="col-grupo"></td>
//    //    <td class="col-nivel">
//    //      <span class="expand-icon">▸</span>
//    //      <strong>${nivel.nivel ?? nivel.nombreNivel ?? `Nivel ${ni + 1}`}</strong>
//    //    </td>
//    //    <td class="col-cuenta"></td>`;
//    //            paintRow(leftNivel, nMeses, nTotal);

//    //            // CUENTAS
//    //            const cuentas = Array.isArray(nivel.cuentas ?? nivel.Cuentas) ? (nivel.cuentas ?? nivel.Cuentas) : [];
//    //            cuentas.forEach((cuenta, ci) => {
//    //                const cMeses = readMonthly(cuenta);
//    //                const cTotal = apiTotal(cuenta);

//    //                const leftCuenta = `
//    //      <td class="col-grupo"></td>
//    //      <td class="col-nivel"></td>
//    //      <td class="col-cuenta">${cuenta.nombreCuenta ?? cuenta.cuenta ?? `Cuenta ${ci + 1}`}</td>`;
//    //                paintRow(leftCuenta, cMeses, cTotal);
//    //            });
//    //        });
//    //    });

//    //    // expandir/contraer (si ya tienes handlers, mantenlos)
//    //    const container = hasSplitTables ? rightBody : singleBody;
//    //    container.addEventListener('click', (ev) => {
//    //        const icon = ev.target.closest('.expand-icon');
//    //        if (!icon) return;
//    //        const tr = ev.target.closest('tr');
//    //        // en split-table, los índices los puedes guardar vía data-* si los necesitas
//    //        // aquí reuso los que ya tienes:
//    //        const gi = tr.dataset.groupIndex, ni = tr.dataset.levelIndex;
//    //        if (tr.querySelector('.col-nivel strong')) this._toggleLevel?.(gi, ni);
//    //        else this._toggleGroup?.(gi);
//    //        if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable);
//    //    });

//    //    // Si usas split:
//    //    const leftBody = document.getElementById('table-body-left');
//    //    const rightBody = document.getElementById('table-body-right');
//    //    this._markTotalRows(leftBody, rightBody);
//    //    this.syncRowHeights(leftBody, rightBody);
//    //    this.setupSplitScrollSync();

//    //    // También al redimensionar:
//    //    window.addEventListener('resize', () => this.syncRowHeights(leftBody, rightBody));

//    //}



//    renderAnualTable(apiResultados) {
//        // Detecta si hay tablas divididas (izquierda: Grupo/Nivel/Cuenta; derecha: meses + total)
//        const leftBody = this._qs('#table-body-left');
//        const rightBody = this._qs('#table-body-right');
//        const singleBody = this._qs('#table-body');

//        const hasSplitTables = !!(leftBody && rightBody);
//        const clear = (el) => { if (el) el.innerHTML = ''; };

//        if (hasSplitTables) { clear(leftBody); clear(rightBody); }
//        else { if (!singleBody) { console.error('No table body'); return; } singleBody.innerHTML = ''; }

//        if (!apiResultados) { this.showError('Estructura de datos no válida'); return; }

//        // estructura desde la API
//        const grupos = apiResultados.estructura ?? apiResultados.Estructura ?? apiResultados.resultados?.estructura ?? [];
//        if (!Array.isArray(grupos) || grupos.length === 0) { this.showError('No hay estructura para pintar'); return; }

//        // helpers solo lectura
//        const readMonthly = (node) => {
//            const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
//            const out = new Array(12).fill(0);
//            for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i); // 0 es válido
//            return out;
//        };
//        const apiTotal = (node) => {
//            const t = this.toNumber(node?.totalAnualGrupo ?? node?.totalAnualNivel ?? node?.totalAnual ?? node?.total ?? null);
//            return Number.isFinite(t) ? t : 0;
//        };

//        // util para aplicar data-* a una fila
//        const applyDataset = (tr, ds) => {
//            if (!ds) return;
//            Object.entries(ds).forEach(([k, v]) => {
//                if (v !== undefined && v !== null) tr.setAttribute(`data-${k}`, String(v));
//            });
//        };

//        // === pintado en dos tablas (izq/dcha) con clases por tipo de fila ===
//        const paintRowSplit = (rowClass, dataset, leftCellsHtml, rightMonthsArr, rightTotal) => {
//            // izquierda (3 celdas)
//            const trL = document.createElement('tr');
//            trL.className = `ds-row ${rowClass}`;
//            trL.innerHTML = leftCellsHtml;
//            applyDataset(trL, dataset);
//            leftBody.appendChild(trL);

//            // derecha (12 + total)
//            const trR = document.createElement('tr');
//            trR.className = `ds-row ${rowClass}`;
//            trR.innerHTML = `
//      ${rightMonthsArr.map(v => {
//                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
//            }).join('')}
//      <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
//            applyDataset(trR, dataset);
//            rightBody.appendChild(trR);
//        };

//        // === pintado en una sola tabla ===
//        const paintRowSingle = (rowClass, dataset, leftCellsHtml, rightMonthsArr, rightTotal) => {
//            const tr = document.createElement('tr');
//            tr.className = `ds-row ${rowClass}`;
//            tr.innerHTML = `
//      ${leftCellsHtml}
//      ${rightMonthsArr.map(v => {
//                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
//            }).join('')}
//      <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
//            applyDataset(tr, dataset);
//            singleBody.appendChild(tr);
//        };

//        const paintRow = hasSplitTables ? paintRowSplit : paintRowSingle;

//        // ───────────── PINTAR: grupo → nivel → cuentas ─────────────
//        grupos.forEach((grupo, gi) => {
//            const gMeses = readMonthly(grupo);
//            const gTotal = apiTotal(grupo);

//            // GRUPO = TOTAL_GRUPO
//            const leftGrupo = `
//      <td class="col-grupo">
//        <span class="expand-icon">▸</span>
//        <strong>${grupo.nombreGrupo ?? grupo.grupo ?? `Grupo ${gi + 1}`}</strong>
//      </td>
//      <td class="col-nivel"></td>
//      <td class="col-cuenta"></td>`;
//            paintRow('row-total-grupo group-header TOTAL_GRUPO', { group- index: gi }, leftGrupo, gMeses, gTotal);

//        // NIVELES
//        const niveles = Array.isArray(grupo.niveles ?? grupo.Niveles) ? (grupo.niveles ?? grupo.Niveles) : [];
//        niveles.forEach((nivel, ni) => {
//            const nMeses = readMonthly(nivel);
//            const nTotal = apiTotal(nivel);

//            // NIVEL = TOTAL_NIVEL
//            const leftNivel = `
//        <td class="col-grupo"></td>
//        <td class="col-nivel">
//          <span class="expand-icon">▸</span>
//          <strong>${nivel.nivel ?? nivel.nombreNivel ?? `Nivel ${ni + 1}`}</strong>
//        </td>
//        <td class="col-cuenta"></td>`;
//            paintRow('row-total-nivel level-header TOTAL_NIVEL', { group- index: gi, level - index: ni }, leftNivel, nMeses, nTotal);

//        // CUENTAS
//        const cuentas = Array.isArray(nivel.cuentas ?? nivel.Cuentas) ? (nivel.cuentas ?? nivel.Cuentas) : [];
//        cuentas.forEach((cuenta, ci) => {
//            const cMeses = readMonthly(cuenta);
//            const cTotal = apiTotal(cuenta);

//            const leftCuenta = `
//          <td class="col-grupo"></td>
//          <td class="col-nivel"></td>
//          <td class="col-cuenta">${cuenta.nombreCuenta ?? cuenta.cuenta ?? `Cuenta ${ci + 1}`}</td>`;
//            paintRow('account-row', { group- index: gi, level - index: ni, account - index: ci }, leftCuenta, cMeses, cTotal);
//    });
//});
//  });

//// expandir/contraer (click en iconos)
//const clickContainer = hasSplitTables ? rightBody : singleBody;
//clickContainer.addEventListener('click', (ev) => {
//    const icon = ev.target.closest('.expand-icon');
//    if (!icon) return;
//    const tr = ev.target.closest('tr');
//    const gi = tr?.getAttribute('data-group-index');
//    const ni = tr?.getAttribute('data-level-index');
//    if (tr?.classList.contains('level-header')) {
//        this._toggleLevel(gi, ni);
//    } else {
//        this._toggleGroup(gi);
//    }
//    if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable);
//});

//// Ajustes finales split
//if (hasSplitTables) {
//    // Ya no necesitamos inferir por texto, pero no molesta si quieres conservarlo
//    // this._markTotalRows(leftBody, rightBody);
//    this.syncRowHeights(this._leftTable ?? leftBody.closest('table'), this._rightTable ?? rightBody.closest('table'));
//    this.setupSplitScrollSync();
//    window.addEventListener('resize', () =>
//        this.syncRowHeights(this._leftTable ?? leftBody.closest('table'), this._rightTable ?? rightBody.closest('table'))
//    );
//}
//}



//    /* =================== EXPAND/CONTRACT =================== */
//    expandAll() { this._qsa('.level-header').forEach(r => r.style.display = ''); this._qsa('.account-row').forEach(r => r.style.display = ''); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }
//    collapseGroups() { this._qsa('.level-header,.account-row').forEach(r => r.style.display = 'none'); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }
//    collapseLevels() { this._qsa('.level-header').forEach(r => r.style.display = ''); this._qsa('.account-row').forEach(r => r.style.display = 'none'); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }

//    _toggleGroup(gi) {
//        const rows = this._qsa(`tr.level-header[data-group-index="${gi}"], tr.account-row[data-group-index="${gi}"]`);
//        const hide = rows.every(r => r.style.display === 'none');
//        rows.forEach(r => r.style.display = hide ? '' : 'none');
//    }
//    _toggleLevel(gi, ni) {
//        const rows = this._qsa(`tr.account-row[data-group-index="${gi}"][data-level-index="${ni}"]`);
//        const hide = rows.every(r => r.style.display === 'none');
//        rows.forEach(r => r.style.display = hide ? '' : 'none');
//        // aseguro que el nivel queda visible
//        this._qsa(`tr.level-header[data-group-index="${gi}"][data-level-index="${ni}"]`).forEach(r => r.style.display = '');
//    }

//    /* =================== VISTA DIVIDIDA =================== */
//    splitAnualTable(freezeCount = 3) {
//        const srcWrap = this._qs('#anual-source');
//        const src = this._qs('#financial-table');
//        const grid = this._qs('#anual-grid');
//        const left = this._qs('#financial-table-left');
//        const right = this._qs('#financial-table-right');
//        const rightBox = this._qs('#anual-right');
//        const leftBox = this._qs('#anual-left');
//        const inner = this._qs('#anual-inner');

//        if (!src || !grid || !left || !right || !rightBox || !leftBox || !inner) return;

//        left.innerHTML = '<thead></thead><tbody></tbody>';
//        right.innerHTML = '<thead></thead><tbody></tbody>';

//        // cabezales
//        const sHeadRow = src.tHead?.rows[0]; if (!sHeadRow) return;
//        const lHead = left.tHead; const lHR = lHead.insertRow();
//        const rHead = right.tHead; const rHR = rHead.insertRow();
//        Array.from(sHeadRow.cells).forEach((cell, i) => {
//            const th = cell.cloneNode(true);
//            (i < freezeCount ? lHR : rHR).appendChild(th);
//        });

//        // body
//        const sBody = src.tBodies[0];
//        const lBody = left.tBodies[0];
//        const rBody = right.tBodies[0];
//        Array.from(sBody.rows).forEach(row => {
//            const ltr = lBody.insertRow();
//            const rtr = rBody.insertRow();
//            Array.from(row.cells).forEach((cell, i) => {
//                const td = cell.cloneNode(true);
//                (i < freezeCount ? ltr : rtr).appendChild(td);
//            });
//            ltr.className = row.className; rtr.className = row.className;
//            for (const a of row.attributes) { if (a.name.startsWith('data-')) { ltr.setAttribute(a.name, a.value); rtr.setAttribute(a.name, a.value); } }
//        });

//        srcWrap.style.display = 'none';
//        grid.style.display = 'grid';

//        this._leftTable = left; this._rightTable = right;
//        this._leftBox = leftBox; this._rightBox = rightBox;

//        //this.syncRowHeights(left, right);
//        this.syncRowHeightsTables(left, right);

//        this.syncRowHeightsBodies(leftBody, rightBody);

//        rightBox.addEventListener('scroll', () => { leftBox.scrollTop = rightBox.scrollTop; });

//        inner.style.width = 'max-content';
//        const needed = Math.max(right.scrollWidth, rightBox.clientWidth + 600);
//        inner.style.minWidth = needed + 'px';

//        this.wireAnualSlider();
//    }

//    syncRowHeights(leftTable, rightTable) {
//        const lh = leftTable.tHead?.rows[0], rh = rightTable.tHead?.rows[0];
//        if (lh && rh) {
//            const h = Math.max(lh.getBoundingClientRect().height, rh.getBoundingClientRect().height);
//            lh.style.height = h + 'px'; rh.style.height = h + 'px';
//        }
//        const lRows = leftTable.tBodies[0].rows;
//        const rRows = rightTable.tBodies[0].rows;
//        const n = Math.min(lRows.length, rRows.length);
//        for (let i = 0; i < n; i++) {
//            const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
//            lRows[i].style.height = h + 'px';
//            rRows[i].style.height = h + 'px';
//        }
//        window.addEventListener('resize', () => this.syncRowHeightsBodies(leftTable, rightTable), { once: true });
//    }

//    wireAnualSlider() {
//        const rightBox = this._qs('#anual-right');
//        const slider = this._qs('#anual-hslider');
//        if (!rightBox || !slider) return;

//        const refresh = () => {
//            const max = Math.max(0, rightBox.scrollWidth - rightBox.clientWidth);
//            slider.min = '0'; slider.max = String(max); slider.step = '1';
//            slider.value = String(Math.min(rightBox.scrollLeft, max));
//            slider.style.display = max > 0 ? 'block' : 'none';
//        };
//        slider.oninput = () => { rightBox.scrollLeft = slider.valueAsNumber; };
//        rightBox.addEventListener('scroll', () => { slider.value = String(rightBox.scrollLeft); });

//        requestAnimationFrame(refresh);
//        setTimeout(refresh, 50);
//        window.addEventListener('resize', () => setTimeout(refresh, 0));
//    }


//    //setupSplitScrollSync() {
//    //    // Asume contenedores:
//    //    // <div id="table-left"  class="ds-left"> ... <tbody id="table-body-left">
//    //    // <div id="table-right" class="ds-right"> ... <tbody id="table-body-right">
//    //    const left = document.getElementById('table-left');
//    //    const right = document.getElementById('table-right');
//    //    if (!left || !right) return;

//    //    // Izquierda no debe scrollear; sincronizamos al scrolleo de la derecha
//    //    left.style.overflowY = 'hidden';
//    //    let syncing = false;
//    //    const onScroll = () => {
//    //        if (syncing) return;
//    //        syncing = true;
//    //        left.scrollTop = right.scrollTop;   // ← clave
//    //        requestAnimationFrame(() => { syncing = false; });
//    //    };
//    //    right.removeEventListener('scroll', onScroll);
//    //    right.addEventListener('scroll', onScroll);

//    //    // Ajuste final al llegar al fondo: evita “salto” por bordes/1px
//    //    const fixBottom = () => { left.scrollTop = right.scrollTop; };
//    //    right.addEventListener('wheel', fixBottom, { passive: true });
//    //    right.addEventListener('touchmove', fixBottom, { passive: true });
//    //}


//    syncRowHeights(leftBody, rightBody) {
//        if (!leftBody || !rightBody) return;
//        const lRows = Array.from(leftBody.querySelectorAll('tr'));
//        const rRows = Array.from(rightBody.querySelectorAll('tr'));
//        const len = Math.min(lRows.length, rRows.length);

//        for (let i = 0; i < len; i++) {
//            const l = lRows[i], r = rRows[i];
//            l.style.height = r.style.height = 'auto';
//            const h = Math.max(l.offsetHeight, r.offsetHeight);
//            l.style.height = r.style.height = `${h}px`;
//        }
//    },

//    /* Helpers para marcar estilos de totales */
//    _markTotalRows(leftBody, rightBody) {
//        const mark = (tbody) => {
//            for (const tr of tbody.querySelectorAll('tr')) {
//                const txt = tr.querySelector('.col-nivel strong, .col-grupo strong, .col-cuenta')?.textContent?.toUpperCase() || '';
//                if (txt.startsWith('TOTAL GRUPO') || tr.classList.contains('TOTAL_GRUPO')) tr.classList.add('row-total-grupo');
//                if (txt.startsWith('TOTAL ') || tr.classList.contains('TOTAL_NIVEL')) tr.classList.add('row-total-nivel');
//            }
//        };
//        if (leftBody) mark(leftBody);
//        if (rightBody) mark(rightBody);
//    }


//    // --- SIN COMA AL FINAL ---
//    setupSplitScrollSync() {
//        const left = document.getElementById('table-left');
//        const right = document.getElementById('table-right');
//        if (!left || !right) return;

//        left.style.overflowY = 'hidden';
//        let syncing = false;
//        const onScroll = () => {
//            if (syncing) return;
//            syncing = true;
//            left.scrollTop = right.scrollTop;
//            requestAnimationFrame(() => { syncing = false; });
//        };
//        right.removeEventListener('scroll', onScroll);
//        right.addEventListener('scroll', onScroll);

//        const fixBottom = () => { left.scrollTop = right.scrollTop; };
//        right.addEventListener('wheel', fixBottom, { passive: true });
//        right.addEventListener('touchmove', fixBottom, { passive: true });
//    }

//    // ⇣⇣ Renombrados para evitar colisión y ser explícitos

//    // Sincroniza alturas cuando tienes tablas completas (thead/tbody)
//    syncRowHeightsTables(leftTable, rightTable) {
//        const lh = leftTable.tHead?.rows[0], rh = rightTable.tHead?.rows[0];
//        if (lh && rh) {
//            const h = Math.max(lh.getBoundingClientRect().height, rh.getBoundingClientRect().height);
//            lh.style.height = h + 'px'; rh.style.height = h + 'px';
//        }
//        const lRows = leftTable.tBodies[0].rows;
//        const rRows = rightTable.tBodies[0].rows;
//        const n = Math.min(lRows.length, rRows.length);
//        for (let i = 0; i < n; i++) {
//            const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
//            lRows[i].style.height = h + 'px';
//            rRows[i].style.height = h + 'px';
//        }
//        window.addEventListener('resize', () => this.syncRowHeightsTables(leftTable, rightTable), { once: true });
//    }

//    // Sincroniza alturas cuando sólo pasas los TBODY de la tabla dividida
//    syncRowHeightsBodies(leftBody, rightBody) {
//        if (!leftBody || !rightBody) return;
//        const lRows = Array.from(leftBody.querySelectorAll('tr'));
//        const rRows = Array.from(rightBody.querySelectorAll('tr'));
//        const len = Math.min(lRows.length, rRows.length);
//        for (let i = 0; i < len; i++) {
//            const l = lRows[i], r = rRows[i];
//            l.style.height = r.style.height = 'auto';
//            const h = Math.max(l.offsetHeight, r.offsetHeight);
//            l.style.height = r.style.height = `${h}px`;
//        }
//    }
//}

//// Exponer
//window.EstadoResultadosModule = EstadoResultadosModule;




