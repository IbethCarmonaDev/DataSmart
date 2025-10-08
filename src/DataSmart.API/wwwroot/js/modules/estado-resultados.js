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

        document.addEventListener('ds:theme-change', () => {
            if (this._leftTable && this._rightTable) {
                this.syncRowHeightsTables(this._leftTable, this._rightTable);
            }
        });

    }

    /* =================== UTILIDADES =================== */
    _qs(s, r = document) { return r.querySelector(s); }
    _qsa(s, r = document) { return Array.from(r.querySelectorAll(s)); }


    _meses() {
        return [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
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
            const leftTable = leftBody.closest('table');
            const rightTable = rightBody.closest('table');

            const syncAll = () => {
                this.syncRowHeightsTables(leftTable, rightTable);
                this.updateBottomGutter();
            };

            requestAnimationFrame(() => {
                syncAll();
                this.setupSplitScrollSync();
            });

            this.wireAnualSlider();
            window.addEventListener('resize', syncAll);

            try {
                const ro = new ResizeObserver(syncAll);
                ro.observe(leftTable.tBodies[0]);
                ro.observe(rightTable.tBodies[0]);
            } catch { }

            document.addEventListener('ds:theme-change', () => requestAnimationFrame(syncAll));
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

        // Reset contenedores
        left.innerHTML = '<thead></thead><tbody id="table-body-left"></tbody>';
        right.innerHTML = '<thead></thead><tbody id="table-body-right"></tbody>';

        // Copiar encabezados
        const sHeadRow = src.tHead?.rows?.[0];
        if (!sHeadRow) return;

        const lHead = left.tHead; const lHR = lHead.insertRow();
        const rHead = right.tHead; const rHR = rHead.insertRow();

        Array.from(sHeadRow.cells).forEach((cell, i) => {
            const th = cell.cloneNode(true);
            if (th.id) th.id = th.id + '_clone';
            (i < freezeCount ? lHR : rHR).appendChild(th);
        });

        // Copiar filas del cuerpo
        const sBody = src.tBodies[0];
        const lBody = left.tBodies[0];
        const rBody = right.tBodies[0];

        Array.from(sBody.rows).forEach(row => {
            const ltr = lBody.insertRow();
            const rtr = rBody.insertRow();

            Array.from(row.cells).forEach((cell, i) => {
                const td = cell.cloneNode(true);
                if (td.id) td.id = td.id + '_clone';
                (i < freezeCount ? ltr : rtr).appendChild(td);
            });

            // copiar clases y data-attrs
            ltr.className = row.className;
            rtr.className = row.className;
            for (const a of row.attributes) {
                if (a.name.startsWith('data-')) {
                    ltr.setAttribute(a.name, a.value);
                    rtr.setAttribute(a.name, a.value);
                }
            }
        });

        // Mostrar grid partido
        srcWrap.style.display = 'none';
        grid.style.display = 'grid';

        // Refs para otros métodos
        this._leftTable = left;
        this._rightTable = right;
        this._leftBox = leftBox;
        this._rightBox = rightBox;

        // Ancho mínimo para meses (activar scroll horizontal si hace falta)
        inner.style.width = 'max-content';
        const needed = Math.max(right.scrollWidth, rightBox.clientWidth);
        inner.style.minWidth = needed + 'px';

        // Scroll vertical sincronizado
        rightBox.addEventListener('scroll', () => { leftBox.scrollTop = rightBox.scrollTop; }, { passive: true });

        // ---- Sincronizaciones iniciales
        this.syncRowHeightsTables(left, right);
        if (this.computeLeftFrozenWidth) this.computeLeftFrozenWidth(freezeCount); // ← asegura ver “Cuenta”
        if (this.ensureBottomSpacer) this.ensureBottomSpacer();
        if (this.updateBottomGutter) this.updateBottomGutter();
        if (this.wireAnualSlider) this.wireAnualSlider();
        this.attachStickyHead();   // ← fija los títulos al hacer scroll vertical


        // ---- Re-sincronizar en resize (explícito)
        window.addEventListener('resize', () => {
            this.syncRowHeightsTables(left, right);
            if (this.computeLeftFrozenWidth) this.computeLeftFrozenWidth(freezeCount);
            if (this.ensureBottomSpacer) this.ensureBottomSpacer();
            if (this.updateBottomGutter) this.updateBottomGutter();
            if (this.wireAnualSlider) this.wireAnualSlider();
            //this.updateStickyHeaderWidths();
        });

        // (opcional) Re-sincronizar si cambias de tema
        document.addEventListener('ds:theme-change', () => {
            requestAnimationFrame(() => {
                this.syncRowHeightsTables(left, right);
                if (this.computeLeftFrozenWidth) this.computeLeftFrozenWidth(freezeCount);
                if (this.ensureBottomSpacer) this.ensureBottomSpacer();
                if (this.updateBottomGutter) this.updateBottomGutter();
                if (this.wireAnualSlider) this.wireAnualSlider();
                //this.updateStickyHeaderWidths();

            });
        });
    }



    syncRowHeightsTables(leftTable, rightTable) {
        if (!leftTable || !rightTable) return;

        // thead
        const lh = leftTable.tHead?.rows[0], rh = rightTable.tHead?.rows[0];
        if (lh && rh) {
            lh.style.height = rh.style.height = 'auto';
            const hHead = Math.ceil(Math.max(lh.clientHeight, rh.clientHeight));
            lh.style.height = rh.style.height = hHead + 'px';
        }

        const lRows = Array.from(leftTable.tBodies[0].rows);
        const rRows = Array.from(rightTable.tBodies[0].rows);

        // quita el spacer de la izquierda (si existe)
        const lastL = lRows[lRows.length - 1];
        const hasSpacer = lastL && lastL.classList.contains('ds-bottom-spacer');
        if (hasSpacer) lRows.pop();

        const n = Math.min(lRows.length, rRows.length);
        for (let i = 0; i < n; i++) {
            const L = lRows[i], R = rRows[i];
            L.style.height = R.style.height = 'auto';
            const h = Math.ceil(Math.max(L.clientHeight, R.clientHeight));
            L.style.height = R.style.height = h + 'px';
        }
    }


    wireAnualSlider() {
        const right = this._rightBox || this._qs('#anual-right');
        const slider = this._slider || this._qs('#anual-hslider');
        const row = this._sliderRow || this._qs('#anual-hslider-row');
        if (!right || !slider || !row) return;

        const refresh = () => {
            const max = Math.max(0, right.scrollWidth - right.clientWidth);
            if (max > 0) {
                slider.min = '0'; slider.max = String(max); slider.step = '1';
                slider.value = String(Math.min(right.scrollLeft, max));
                row.style.display = 'flex';
                document.getElementById('anual-grid')?.style.setProperty('--hscroll', '16px'); // alto fila slider
            } else {
                row.style.display = 'none';
                document.getElementById('anual-grid')?.style.setProperty('--hscroll', '0px');
            }
        };

        slider.addEventListener('input', () => {
            right.scrollLeft = Number(slider.value) || 0;
        });
        right.addEventListener('scroll', () => {
            const max = Math.max(0, right.scrollWidth - right.clientWidth);
            if (Number(slider.max) !== max) refresh();
            slider.value = String(right.scrollLeft);
        }, { passive: true });

        // Primera evaluación
        requestAnimationFrame(refresh);
    }




    setupSplitScrollSync() {
        const leftBox = this._leftBox || this._qs('#anual-left');
        const rightBox = this._rightBox || this._qs('#anual-right');
        if (!leftBox || !rightBox) return;

        let syncing = false;

        const syncFromTo = (from, to) => {
            if (syncing) return;
            syncing = true;
            to.scrollTop = from.scrollTop;
            requestAnimationFrame(() => { syncing = false; });
        };

        // scroll vertical sincronizado en ambos sentidos
        rightBox.addEventListener('scroll', () => syncFromTo(rightBox, leftBox), { passive: true });
        leftBox.addEventListener('scroll', () => syncFromTo(leftBox, rightBox), { passive: true });
    }




    // alto nativo del scrollbar (se calcula una vez)
    _getScrollbarDims() {
        if (this.__sbDims) return this.__sbDims;
        const outer = document.createElement('div');
        outer.style.cssText = 'visibility:hidden;position:absolute;top:-9999px;left:-9999px;width:120px;height:120px;overflow:scroll;';
        const inner = document.createElement('div');
        inner.style.cssText = 'width:100%;height:200px;';
        outer.appendChild(inner);
        document.body.appendChild(outer);
        // grosor = diferencia entre offset y client
        const width = outer.offsetWidth - outer.clientWidth;
        const height = outer.offsetHeight - outer.clientHeight;
        outer.remove();
        this.__sbDims = { width, height };
        return this.__sbDims;
    }

    // reserva en el panel izquierdo el alto de la barra horizontal del derecho
    updateBottomGutter() {
        const leftBox = this._leftBox || this._qs('#anual-left');
        const rightBox = this._rightBox || this._qs('#anual-right');
        if (!leftBox || !rightBox) return;

        // ¿hay overflow horizontal?
        const hasHOverflow = rightBox.scrollWidth > rightBox.clientWidth;
        const { height } = this._getScrollbarDims();

        //const pad = hasHOverflow ? height : 0; // en Windows suele ser ~17px

        const pad = hasHOverflow ? (height + 1) : 0;


        leftBox.style.paddingBottom = pad + 'px';
        leftBox.style.setProperty('--hscrollbar', pad + 'px');

        // por si cambió la última fila
        if (this._leftTable && this._rightTable) {
            this.syncRowHeightsTables(this._leftTable, this._rightTable);
        }
    }

    // calcula alto de scrollbar nativo (una vez)
    _getScrollbarHeight() {
        if (this.__sbH != null) return this.__sbH;
        const outer = document.createElement('div');
        outer.style.cssText = 'position:absolute;visibility:hidden;top:-9999px;left:-9999px;width:120px;height:120px;overflow:scroll;';
        const inner = document.createElement('div'); inner.style.height = '200px'; outer.appendChild(inner);
        document.body.appendChild(outer);
        this.__sbH = outer.offsetHeight - outer.clientHeight; // ~17 en Win
        outer.remove();
        return this.__sbH || 18;
    }



    // alto del scrollbar horizontal nativo del panel derecho
    _getHScrollbarHeight() {
        const rightBox = this._rightBox || this._qs('#anual-right');
        if (!rightBox) return 0;
        const h = Math.max(0, rightBox.offsetHeight - rightBox.clientHeight);
        return h; // ~17px en Windows
    }

    // asegura un <tr> espaciador al final de la TABLA IZQUIERDA
    ensureBottomSpacer() {
        const leftTable = this._leftTable;
        if (!leftTable) return;

        const TB = leftTable.tBodies && leftTable.tBodies[0];
        if (!TB) return;

        // crear si no existe
        let tr = TB.querySelector('tr.ds-bottom-spacer');
        if (!tr) {
            tr = document.createElement('tr');
            tr.className = 'ds-bottom-spacer';
            const td = document.createElement('td');
            td.colSpan = leftTable.tHead?.rows?.[0]?.cells?.length || 1;
            tr.appendChild(td);
            TB.appendChild(tr);
        }

        // setear altura exacta del scrollbar horizontal del derecho
        const pad = this._getHScrollbarHeight();
        tr.firstElementChild.style.height = pad + 'px';

        // publicar para CSS (por si lo usas)
        const leftBox = this._leftBox || this._qs('#anual-left');
        if (leftBox) leftBox.style.setProperty('--hscrollbar', pad + 'px');
    }


    computeLeftFrozenWidth(freezeCount = 3) {
        const grid = this._qs('#anual-grid');
        const headRow = this._leftTable?.tHead?.rows?.[0];
        if (!grid || !headRow) return;

        let sum = 0;
        const max = Math.min(freezeCount, headRow.cells.length);
        for (let i = 0; i < max; i++) {
            sum += Math.ceil(headRow.cells[i].getBoundingClientRect().width);
        }
        if (!sum) sum = 840; // fallback (Grupo+Nivel+Cuenta aprox)
        grid.style.setProperty('--left-col', (sum + 1) + 'px'); // +1 para evitar wrap
    }


    buildStickyHeaders() {
        const leftBox = this._leftBox || this._qs('#anual-left');
        const rightBox = this._rightBox || this._qs('#anual-right');
        const leftTbl = this._leftTable;
        const rightTbl = this._rightTable;
        if (!leftBox || !rightBox || !leftTbl || !rightTbl) return;

        // Crea contenedores si no existen
        if (!this._leftSticky) {
            this._leftSticky = document.createElement('div');
            this._leftSticky.className = 'ds-sticky-head';
            this._leftSticky.innerHTML = `<table class="financial-table"><thead><tr></tr></thead></table>`;
            leftBox.insertBefore(this._leftSticky, leftBox.firstChild);
        }
        if (!this._rightSticky) {
            this._rightSticky = document.createElement('div');
            this._rightSticky.className = 'ds-sticky-head';
            this._rightSticky.innerHTML = `<table class="financial-table"><thead><tr></tr></thead></table>`;
            rightBox.insertBefore(this._rightSticky, rightBox.firstChild);
        }

        // Clonar contenidos de los thead originales
        const cloneHead = (srcTbl, dstDiv) => {
            const srcRow = srcTbl.tHead?.rows?.[0]; if (!srcRow) return;
            const dstRow = dstDiv.querySelector('thead tr');
            dstRow.innerHTML = '';
            Array.from(srcRow.cells).forEach(th => {
                const c = th.cloneNode(true);
                if (c.id) c.id += '_sticky';
                dstRow.appendChild(c);
            });
        };
        cloneHead(leftTbl, this._leftSticky);
        cloneHead(rightTbl, this._rightSticky);

        // Oculta visualmente los thead originales (mantienen altura)
        leftTbl.classList.add('thead-hidden');
        rightTbl.classList.add('thead-hidden');

        // Ajusta anchos
        this.updateStickyHeaderWidths();
    }

    updateStickyHeaderWidths() {
        const measure = (tbl, stickyDiv) => {
            const srcRow = tbl.tHead?.rows?.[0];
            const dstRow = stickyDiv.querySelector('thead tr');
            if (!srcRow || !dstRow) return;
            const n = Math.min(srcRow.cells.length, dstRow.cells.length);
            for (let i = 0; i < n; i++) {
                const w = Math.ceil(srcRow.cells[i].getBoundingClientRect().width);
                dstRow.cells[i].style.width = w + 'px';
                dstRow.cells[i].style.minWidth = w + 'px';
                dstRow.cells[i].style.maxWidth = w + 'px';
            }
        };
        if (this._leftTable && this._leftSticky) measure(this._leftTable, this._leftSticky);
        if (this._rightTable && this._rightSticky) measure(this._rightTable, this._rightSticky);
    }

    // Fija los encabezados moviéndolos en sentido contrario al scroll vertical
    attachStickyHead() {
        const leftHead = this._leftTable?.tHead;
        const rightHead = this._rightTable?.tHead;
        const leftBox = this._leftBox || this._qs('#anual-left');
        const rightBox = this._rightBox || this._qs('#anual-right');
        if (!leftHead || !rightHead || !leftBox || !rightBox) return;

        let lock = false;

        const apply = () => {
            const y = rightBox.scrollTop;             // usamos el derecho como “referencia”
            leftHead.style.transform = `translateY(${y}px)`;
            rightHead.style.transform = `translateY(${y}px)`;
        };

        const syncFromTo = (from, to) => {
            if (lock) return;
            lock = true;
            to.scrollTop = from.scrollTop;
            requestAnimationFrame(() => { lock = false; apply(); });
        };

        // scroll bidireccional (por si el usuario arrastra el izquierdo)
        rightBox.addEventListener('scroll', () => syncFromTo(rightBox, leftBox), { passive: true });
        leftBox.addEventListener('scroll', () => syncFromTo(leftBox, rightBox), { passive: true });

        // primera posición correcta
        requestAnimationFrame(apply);
    }
}

/* ===== Exponer a global ===== */
window.EstadoResultadosModule = EstadoResultadosModule;



