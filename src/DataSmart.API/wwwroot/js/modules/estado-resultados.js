// wwwroot/js/modules/estado-resultados.js
console.log('✅ estado-resultados.js (robusto meses/valores + vista dividida)');

class EstadoResultadosModule {
    constructor(app) {
        this.app = app || { userId: 'user-demo' };
        this.currentData = null;
        this._leftTable = null; this._rightTable = null;
        this._leftBox = null; this._rightBox = null;

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
                .replace(/\./g, '')      // puntos como separador de miles
                .replace(/,/g, '.')      // coma decimal → punto
                .replace(/[()]/g, '');   // paréntesis
            const n = Number(s);
            return Number.isFinite(n) ? (isNeg ? -n : n) : 0;
        }
        return 0;
    }

    // Devuelve el objeto que contiene los meses para un nodo
    monthsSource(node) {
        return node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.totales ?? node?.Totales ?? node ?? {};
    }



    //// Obtiene el valor del mes i (0..11) probando múltiples claves
    //monthValue(src, i) {
    //    const idx = i + 1;
    //    const name = this._meses()[i];
    //    const kk = [
    //        String(idx), idx,
    //        name, name?.toLowerCase?.(),
    //        `Mes${idx}`, `mes${idx}`, `MES${idx}`,
    //        `m${idx}`, `m${String(idx).padStart(2, '0')}`
    //    ];
    //    for (const k of kk) {
    //        const val = src?.[k];
    //        if (val != null) return this.toNumber(val);
    //    }
    //    return 0;
    //}




    //monthValue(src, i) {
    //    if (!src || Object.keys(src).length === 0) return 0;
    //    const idx = i + 1;
    //    const name = this._meses()[i];
    //    const keys = [
    //        String(idx), idx,
    //        name, name?.toLowerCase?.(),
    //        `Mes${idx}`, `mes${idx}`, `MES${idx}`,
    //        `m${idx}`, `m${String(idx).padStart(2, '0')}`
    //    ];
    //    for (const k of keys) {
    //        if (Object.prototype.hasOwnProperty.call(src, k)) {
    //            const num = this.toNumber(src[k]);
    //            // ⬇️ devolvemos el valor tal cual, incluso si es 0
    //            return Number.isFinite(num) ? num : 0;
    //        }
    //    }
    //    return 0;
    //}



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
        // soporta: node.meses | node.Meses | node.totalesPorMes | node.TotalesPorMes | node
        const src = node?.meses ?? node?.Meses ?? node?.totalesPorMes ?? node?.TotalesPorMes ?? node ?? {};
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
        return out;
    }



    sum12(a, b) {
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = (a?.[i] || 0) + (b?.[i] || 0);
        return out;
    }
    toMesesObject(arr12) {
        const map = {};
        const names = this._meses();
        for (let i = 0; i < 12; i++) {
            map[names[i]] = arr12[i];
            map[String(i + 1)] = arr12[i];
        }
        return map;
    }


    //totalesDeNivel(nivel) {
    //    // nivel.Cuentas | nivel.cuentas
    //    const cuentas = Array.isArray(nivel.Cuentas ?? nivel.cuentas) ? (nivel.Cuentas ?? nivel.cuentas) : [];
    //    return cuentas.reduce((acc, c) => this.sum12(acc, this.readMonthly(c)), new Array(12).fill(0));
    //}

    //totalesDeGrupo(grupo) {
    //    // grupo.Niveles | grupo.niveles
    //    const niveles = Array.isArray(grupo.Niveles ?? grupo.niveles) ? (grupo.Niveles ?? grupo.niveles) : [];
    //    return niveles.reduce((acc, n) => this.sum12(acc, this.totalesDeNivel(n)), new Array(12).fill(0));
    //}


    construirFilas(anual) {
        // anual.Estructura | anual.estructura | anual.Grupos | anual.grupos
        const grupos = anual.Estructura ?? anual.estructura ?? anual.Grupos ?? anual.grupos ?? [];
        const filas = [];

        grupos.forEach(g => {
            const nombreGrupo = g.NombreGrupo ?? g.nombreGrupo ?? g.Grupo ?? g.grupo ?? "";
            filas.push({ Tipo: "GRUPO_HEAD", Grupo: nombreGrupo, Nivel: "", Cuenta: "", Meses: {} });

            const niveles = g.Niveles ?? g.niveles ?? [];
            niveles.forEach(n => {
                const nombreNivel = n.Nivel ?? n.nivel ?? "";
                const cuentas = n.Cuentas ?? n.cuentas ?? [];

                // Cuentas
                cuentas
                    .sort((a, b) => (a.CodCuenta ?? a.codCuenta ?? "").localeCompare(b.CodCuenta ?? b.codCuenta ?? ""))
                    .forEach(c => {
                        const meses = this.readMonthly(c);
                        filas.push({
                            Tipo: "CUENTA",
                            Grupo: nombreGrupo,
                            Nivel: nombreNivel,
                            CodCuenta: c.CodCuenta ?? c.codCuenta ?? "",
                            Cuenta: c.NombreCuenta ?? c.nombreCuenta ?? c.Cuenta ?? c.cuenta ?? "",
                            Meses: this.toMesesObject(meses)
                        });
                    });

                // Total de nivel = suma de cuentas
                const totNivel = this.totalesDeNivel(n);
                filas.push({
                    Tipo: "TOTAL_NIVEL",
                    Grupo: nombreGrupo,
                    Nivel: nombreNivel,
                    Cuenta: "",
                    Meses: this.toMesesObject(totNivel)
                });
            });

            // Total de grupo = suma de totales de nivel del mismo grupo
            const totGrupo = this.totalesDeGrupo(g);
            filas.push({
                Tipo: "TOTAL_GRUPO",
                Grupo: nombreGrupo,
                Nivel: "",
                Cuenta: "",
                Meses: this.toMesesObject(totGrupo)
            });
        });

        return filas;
    }


    // Agrega este método para debuguear los datos
    debugData(resultados) {
        console.log('🔍 DEBUG - Estructura de datos recibida:', resultados);

        const grupos = resultados.estructura ?? resultados.Grupos ?? resultados.grupos ?? [];
        grupos.forEach((g, gi) => {
            console.log(`Grupo ${gi}:`, g.grupo || g.nombreGrupo);

            const niveles = Array.isArray(g.niveles ?? g.Niveles) ? (g.niveles ?? g.Niveles) : [];
            niveles.forEach((n, ni) => {
                console.log(`  Nivel ${ni}:`, n.nivel || n.nombreNivel);
                console.log(`  Meses del nivel:`, this.readMonthly(n));

                const cuentas = Array.isArray(n.cuentas ?? n.Cuentas) ? (n.cuentas ?? n.Cuentas) : [];
                cuentas.forEach((c, ci) => {
                    console.log(`    Cuenta ${ci}:`, c.cuenta || c.nombreCuenta);
                    console.log(`    Meses de cuenta:`, this.readMonthly(c));
                });
            });
        });
    }


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

            //this.renderAnualTable(this._pickResultados(data));  // pinta en #financial-table

            this.renderAnualTable(data.resultados);
            this.splitAnualTable(3);                            // divide en izq/dcha
            this.hideLoading();
        } catch (err) {
            console.error(err);
            this.showError(err.message || 'Error al cargar.');
        }
    }


    _readMonthly(node) {
        // soporta: totalesPorMes, Meses, meses…
        const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
        return out;
    }
    _toMesesObj(arr12) {
        const o = {}; const N = this._meses();
        for (let i = 0; i < 12; i++) { o[N[i]] = arr12[i]; o[String(i + 1)] = arr12[i]; }
        return o;
    }

    _buildFilasDesdeAPI(apiResultados) {
        const estructura = apiResultados?.estructura ?? [];
        const filas = [];

        estructura.forEach(g => {
            const gNombre = g.nombreGrupo ?? g.Grupo ?? g.grupo ?? '';
            filas.push({ Tipo: 'GRUPO_HEAD', Grupo: gNombre, Nivel: '', Cuenta: '', Meses: {} });

            const niveles = g.niveles ?? g.Niveles ?? [];
            niveles.forEach(n => {
                const nNombre = n.nivel ?? n.Nivel ?? '';
                const cuentas = n.cuentas ?? n.Cuentas ?? [];

                // Cuentas (de la API)
                cuentas
                    .sort((a, b) => (a.codCuenta ?? '').localeCompare(b.codCuenta ?? ''))
                    .forEach(c => {
                        const meses = this._readMonthly(c); // ← LEE de c.totalesPorMes
                        filas.push({
                            Tipo: 'CUENTA',
                            Grupo: gNombre,
                            Nivel: nNombre,
                            CodCuenta: c.codCuenta ?? '',
                            Cuenta: c.nombreCuenta ?? '',
                            Meses: this._toMesesObj(meses)
                        });
                    });

                // Total Nivel (de la API)
                filas.push({
                    Tipo: 'TOTAL_NIVEL',
                    Grupo: gNombre,
                    Nivel: nNombre,
                    Cuenta: '',
                    Meses: this._toMesesObj(this._readMonthly(n)) // ← LEE de n.totalesPorMes
                });
            });

            // Total Grupo (de la API)
            filas.push({
                Tipo: 'TOTAL_GRUPO',
                Grupo: gNombre,
                Nivel: '',
                Cuenta: '',
                Meses: this._toMesesObj(this._readMonthly(g)) // ← LEE de g.totalesPorMes
            });
        });

        return filas;
    }

    // Suma elemento a elemento 12 meses
    sum(a, b) {
        const out = new Array(12).fill(0);
        for (let i = 0; i < 12; i++) out[i] = (a?.[i] || 0) + (b?.[i] || 0);
        return out;
    }

    //// Lee los 12 meses como arreglo numérico
    //readMonthly(node) {
    //    const src = this.monthsSource(node);
    //    const out = new Array(12);
    //    for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i);
    //    return out;
    //}

    //sum(arr) { return arr.reduce((a, b) => a + this.toNumber(b), 0); }

    //debugSums(grupo, groupMonthlyTotals, niveles) {
    //    console.log('🔍 DEBUG SUMA GRUPO:', grupo.grupo || grupo.nombreGrupo);
    //    console.log('Total calculado grupo:', this.sum(groupMonthlyTotals));

    //    niveles.forEach((nivel, ni) => {
    //        const cuentas = Array.isArray(nivel.cuentas ?? nivel.Cuentas) ? (nivel.cuentas ?? nivel.Cuentas) : [];
    //        let nivelSum = new Array(12).fill(0);

    //        cuentas.forEach(cuenta => {
    //            const meses = this.readMonthly(cuenta);
    //            for (let i = 0; i < 12; i++) {
    //                nivelSum[i] += meses[i];
    //            }
    //        });

    //        console.log(`  Nivel ${ni}:`, this.sum(nivelSum));
    //        console.log(`  Cuentas:`, cuentas.length);
    //    });
    //}



    anyNonZero(arr) { return arr.some(v => Math.abs(this.toNumber(v)) > 0); }


    //formatCurrency(n) { return this.toNumber(n).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }


    // Método formatCurrency que no muestra ceros
    formatCurrency(n) {
        const num = this.toNumber(n);
        if (num === 0) return ''; // No mostrar ceros
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

        // estructura desde la API (tu JSON)
        const grupos = apiResultados.estructura ?? apiResultados.Estructura ?? apiResultados.resultados?.estructura ?? [];
        if (!Array.isArray(grupos) || grupos.length === 0) { this.showError('No hay estructura para pintar'); return; }

        // helpers solo lectura
        const readMonthly = (node) => {
            const src = node?.totalesPorMes ?? node?.TotalesPorMes ?? node?.Meses ?? node?.meses ?? {};
            const out = new Array(12).fill(0);
            for (let i = 0; i < 12; i++) out[i] = this.monthValue(src, i); // 0 es válido; no “brinca”
            return out;
        };
        const apiTotal = (node) => {
            const t = this.toNumber(node?.totalAnualGrupo ?? node?.totalAnualNivel ?? node?.totalAnual ?? node?.total ?? null);
            return Number.isFinite(t) ? t : 0;
        };

        const paintRowSplit = (leftCellsHtml, rightMonthsArr, rightTotal) => {
            // izquierda (3 celdas)
            const trL = document.createElement('tr');
            trL.innerHTML = leftCellsHtml;
            leftBody.appendChild(trL);

            // derecha (12 + total)
            const trR = document.createElement('tr');
            trR.innerHTML = `
      ${rightMonthsArr.map(v => {
                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
            }).join('')}
      <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
            rightBody.appendChild(trR);
        };

        const paintRowSingle = (leftCellsHtml, rightMonthsArr, rightTotal) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
      ${leftCellsHtml}
      ${rightMonthsArr.map(v => {
                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
                return `<td class="${cls}">${v !== 0 ? this.formatCurrency(v) : ''}</td>`;
            }).join('')}
      <td>${rightTotal !== 0 ? this.formatCurrency(rightTotal) : ''}</td>`;
            singleBody.appendChild(tr);
        };

        const paintRow = hasSplitTables ? paintRowSplit : paintRowSingle;

        // ───────────── PINTAR: grupo → nivel → cuentas ─────────────
        grupos.forEach((grupo, gi) => {
            const gMeses = readMonthly(grupo);
            const gTotal = apiTotal(grupo);

            // GRUPO
            const leftGrupo = `
      <td class="col-grupo">
        <span class="expand-icon">▸</span>
        <strong>${grupo.nombreGrupo ?? grupo.grupo ?? `Grupo ${gi + 1}`}</strong>
      </td>
      <td class="col-nivel"></td>
      <td class="col-cuenta"></td>`;
            paintRow(leftGrupo, gMeses, gTotal);

            // NIVELES
            const niveles = Array.isArray(grupo.niveles ?? grupo.Niveles) ? (grupo.niveles ?? grupo.Niveles) : [];
            niveles.forEach((nivel, ni) => {
                const nMeses = readMonthly(nivel);
                const nTotal = apiTotal(nivel);

                const leftNivel = `
        <td class="col-grupo"></td>
        <td class="col-nivel">
          <span class="expand-icon">▸</span>
          <strong>${nivel.nivel ?? nivel.nombreNivel ?? `Nivel ${ni + 1}`}</strong>
        </td>
        <td class="col-cuenta"></td>`;
                paintRow(leftNivel, nMeses, nTotal);

                // CUENTAS
                const cuentas = Array.isArray(nivel.cuentas ?? nivel.Cuentas) ? (nivel.cuentas ?? nivel.Cuentas) : [];
                cuentas.forEach((cuenta, ci) => {
                    const cMeses = readMonthly(cuenta);
                    const cTotal = apiTotal(cuenta);

                    const leftCuenta = `
          <td class="col-grupo"></td>
          <td class="col-nivel"></td>
          <td class="col-cuenta">${cuenta.nombreCuenta ?? cuenta.cuenta ?? `Cuenta ${ci + 1}`}</td>`;
                    paintRow(leftCuenta, cMeses, cTotal);
                });
            });
        });

        // expandir/contraer (si ya tienes handlers, mantenlos)
        const container = hasSplitTables ? rightBody : singleBody;
        container.addEventListener('click', (ev) => {
            const icon = ev.target.closest('.expand-icon');
            if (!icon) return;
            const tr = ev.target.closest('tr');
            // en split-table, los índices los puedes guardar vía data-* si los necesitas
            // aquí reuso los que ya tienes:
            const gi = tr.dataset.groupIndex, ni = tr.dataset.levelIndex;
            if (tr.querySelector('.col-nivel strong')) this._toggleLevel?.(gi, ni);
            else this._toggleGroup?.(gi);
            if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable);
        });
    }



    /* =================== EXPAND/CONTRACT =================== */
    expandAll() { this._qsa('.level-header').forEach(r => r.style.display = ''); this._qsa('.account-row').forEach(r => r.style.display = ''); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }
    collapseGroups() { this._qsa('.level-header,.account-row').forEach(r => r.style.display = 'none'); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }
    collapseLevels() { this._qsa('.level-header').forEach(r => r.style.display = ''); this._qsa('.account-row').forEach(r => r.style.display = 'none'); if (this._leftTable && this._rightTable) this.syncRowHeights(this._leftTable, this._rightTable); }

    _toggleGroup(gi) {
        const rows = this._qsa(`tr.level-header[data-group-index="${gi}"], tr.account-row[data-group-index="${gi}"]`);
        const hide = rows.every(r => r.style.display === 'none');
        rows.forEach(r => r.style.display = hide ? '' : 'none');
    }
    _toggleLevel(gi, ni) {
        const rows = this._qsa(`tr.account-row[data-group-index="${gi}"][data-level-index="${ni}"]`);
        const hide = rows.every(r => r.style.display === 'none');
        rows.forEach(r => r.style.display = hide ? '' : 'none');
        // aseguro que el nivel queda visible
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

        left.innerHTML = '<thead></thead><tbody></tbody>';
        right.innerHTML = '<thead></thead><tbody></tbody>';

        // cabezales
        const sHeadRow = src.tHead?.rows[0]; if (!sHeadRow) return;
        const lHead = left.tHead; const lHR = lHead.insertRow();
        const rHead = right.tHead; const rHR = rHead.insertRow();
        Array.from(sHeadRow.cells).forEach((cell, i) => {
            const th = cell.cloneNode(true);
            (i < freezeCount ? lHR : rHR).appendChild(th);
        });

        // body
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
            for (const a of row.attributes) { if (a.name.startsWith('data-')) { ltr.setAttribute(a.name, a.value); rtr.setAttribute(a.name, a.value); } }
        });

        srcWrap.style.display = 'none';
        grid.style.display = 'grid';

        this._leftTable = left; this._rightTable = right;
        this._leftBox = leftBox; this._rightBox = rightBox;

        this.syncRowHeights(left, right);

        rightBox.addEventListener('scroll', () => { leftBox.scrollTop = rightBox.scrollTop; });

        inner.style.width = 'max-content';
        const needed = Math.max(right.scrollWidth, rightBox.clientWidth + 600);
        inner.style.minWidth = needed + 'px';

        this.wireAnualSlider();
    }

    syncRowHeights(leftTable, rightTable) {
        const lh = leftTable.tHead?.rows[0], rh = rightTable.tHead?.rows[0];
        if (lh && rh) {
            const h = Math.max(lh.getBoundingClientRect().height, rh.getBoundingClientRect().height);
            lh.style.height = h + 'px'; rh.style.height = h + 'px';
        }
        const lRows = leftTable.tBodies[0].rows;
        const rRows = rightTable.tBodies[0].rows;
        const n = Math.min(lRows.length, rRows.length);
        for (let i = 0; i < n; i++) {
            const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
            lRows[i].style.height = h + 'px';
            rRows[i].style.height = h + 'px';
        }
        window.addEventListener('resize', () => this.syncRowHeights(leftTable, rightTable), { once: true });
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
}

// Exponer
window.EstadoResultadosModule = EstadoResultadosModule;




///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////


//// wwwroot/js/modules/estado-resultados.js
//console.log('✅ estado-resultados.js cargado correctamente (vista dividida con scroll fijo)');

//class EstadoResultadosModule {
//    constructor(app) {
//        this.app = app || { userId: 'user-demo' };
//        this.currentData = null;
//        this.expandedGroups = new Set();
//        this.expandedLevels = new Set();
//        this._wireStaticUI();
//        console.log('🔄 EstadoResultadosModule inicializado');
//    }

//    /* ===================== UTILIDADES ===================== */
//    _qs(sel, root = document) { return root.querySelector(sel); }
//    _qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
//    _safe(obj, ...keys) {
//        let v = obj;
//        for (const k of keys) {
//            if (v && (k in v)) v = v[k];
//            else return undefined;
//        }
//        return v;
//    }
//    formatCurrency(num) {
//        const n = Number(num) || 0;
//        return n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
//    }
//    _meses() { return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']; }

//    showLoading() {
//        const el = this._qs('#loading'); if (el) el.style.display = 'block';
//        const err = this._qs('#error-message'); if (err) err.style.display = 'none';
//    }
//    hideLoading() {
//        const el = this._qs('#loading'); if (el) el.style.display = 'none';
//    }
//    showError(msg) {
//        const err = this._qs('#error-message');
//        if (err) { err.textContent = msg; err.style.display = 'block'; }
//        this.hideLoading();
//    }

//    /* ===================== INICIO Y CONTROLES ===================== */
//    _wireStaticUI() {
//        // Botones expandir/contraer (si existen)
//        this._qs('#expand-all')?.addEventListener('click', () => this.expandAll());
//        this._qs('#collapse-groups')?.addEventListener('click', () => this.collapseGroups());
//        this._qs('#collapse-levels')?.addEventListener('click', () => this.collapseLevels());

//        // Año
//        this._qs('#year-select')?.addEventListener('change', (e) => this.loadAnualData(e.target.value));
//    }

//    /* ===================== CARGA DE DATOS ===================== */
//    async loadAnualData(year = null) {
//        const y = year || this._qs('#year-select')?.value;
//        if (!y) { this.showError('Por favor selecciona un año'); return; }

//        this.showLoading();
//        try {
//            const url = `/api/Finance/estado-resultados-anual?año=${encodeURIComponent(y)}&userId=${encodeURIComponent(this.app.userId || 'user-demo')}`;
//            console.log('✅ URL de la API:', url);
//            const resp = await fetch(url);
//            console.log('✅ Response status:', resp.status);
//            if (!resp.ok) {
//                const t = await resp.text();
//                throw new Error(`Error ${resp.status}: ${t}`);
//            }
//            const data = await resp.json();
//            console.log('✅ Datos anuales recibidos:', data);
//            this.currentData = data;

//            // render tabla base en #financial-table (fuente)
//            this.renderAnualTable(this._pickResultados(data));

//            // convertir a vista dividida
//            this.splitAnualTable(3);

//            this.hideLoading();
//        } catch (err) {
//            console.error('❌ Error de conexión:', err);
//            this.showError(err.message || 'Error de conexión');
//        }
//    }

//    _pickResultados(data) {
//        if (!data) return null;
//        // soporta diferentes formas: {resultados:{...}}, {Resultados:{...}} o directo
//        return data.resultados || data.Resultados || data.resultado || data.Resultado || data;
//    }

//    /* ===================== RENDER TABLA BASE ===================== */
//    renderAnualTable(resultados) {
//        const tableBody = this._qs('#table-body');
//        if (!tableBody) { console.error('❌ No se encontró #table-body'); return; }
//        tableBody.innerHTML = '';
//        this.expandedGroups.clear();
//        this.expandedLevels.clear();

//        if (!resultados) {
//            this.showError('Estructura de datos no válida');
//            return;
//        }

//        // soportar estructura: resultados.estructura → grupos
//        const grupos = resultados.estructura || resultados.Grupos || resultados.grupos || [];
//        if (!Array.isArray(grupos) || grupos.length === 0) {
//            // fallback: si vienen filas planas
//            const filas = resultados.filas || resultados.rows || [];
//            if (Array.isArray(filas) && filas.length) {
//                filas.forEach((r, i) => {
//                    const tr = document.createElement('tr');
//                    tr.innerHTML = `
//            <td class="col-grupo">${r.grupo ?? ''}</td>
//            <td class="col-nivel">${r.nivel ?? ''}</td>
//            <td class="col-cuenta">${r.cuenta ?? ''}</td>
//            ${this._meses().map((m, ix) => {
//                        const v = (r.meses?.[ix + 1]) ?? r[m] ?? 0;
//                        const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                        return `<td class="${cls}">${this.formatCurrency(v)}</td>`;
//                    }).join('')}
//            <td>${this.formatCurrency(r.total ?? r.totalAnual ?? 0)}</td>
//          `;
//                    tableBody.appendChild(tr);
//                });
//            } else {
//                this.showError('No hay datos para mostrar');
//            }
//            return;
//        }

//        // Con jerarquía: grupos → niveles → cuentas
//        grupos.forEach((g, gi) => {
//            const nombreGrupo = g.grupo || g.nombreGrupo || g.nombre || `Grupo ${gi + 1}`;
//            const totMesG = g.totalesPorMes || g.totales || {};
//            const totalG = g.totalAnualGrupo ?? g.totalAnual ?? g.total ?? 0;

//            // Fila encabezado de grupo
//            const trG = document.createElement('tr');
//            trG.className = 'group-header';
//            trG.dataset.groupIndex = gi;
//            trG.innerHTML = `
//        <td class="col-grupo" colspan="3">
//          <span class="expand-icon">▸</span>
//          <strong>${nombreGrupo}</strong>
//        </td>
//        ${this._meses().map((m, ix) => {
//                const v = totMesG[ix + 1] ?? totMesG[m] ?? 0;
//                const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                return `<td class="${cls}">${this.formatCurrency(v)}</td>`;
//            }).join('')}
//        <td><strong>${this.formatCurrency(totalG)}</strong></td>
//      `;
//            tableBody.appendChild(trG);

//            // niveles
//            const niveles = g.niveles || g.Niveles || [];
//            if (!Array.isArray(niveles)) return;

//            niveles.forEach((n, ni) => {
//                const nomNivel = n.nivel || n.nombreNivel || n.nombre || `Nivel ${ni + 1}`;
//                const totMesN = n.totalesPorMes || n.totales || {};
//                const totalN = n.totalAnualNivel ?? n.totalAnual ?? n.total ?? 0;

//                const trN = document.createElement('tr');
//                trN.className = 'level-header';
//                trN.dataset.groupIndex = gi;
//                trN.dataset.levelIndex = ni;
//                trN.innerHTML = `
//          <td class="col-grupo"></td>
//          <td class="col-nivel">
//            <span class="expand-icon">▸</span>
//            <strong>${nomNivel}</strong>
//          </td>
//          <td class="col-cuenta"></td>
//          ${this._meses().map((m, ix) => {
//                    const v = totMesN[ix + 1] ?? totMesN[m] ?? 0;
//                    const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                    return `<td class="${cls}">${this.formatCurrency(v)}</td>`;
//                }).join('')}
//          <td><strong>${this.formatCurrency(totalN)}</strong></td>
//        `;
//                tableBody.appendChild(trN);

//                // cuentas
//                const cuentas = n.cuentas || n.Cuentas || [];
//                if (!Array.isArray(cuentas)) return;
//                cuentas.forEach((c, ci) => {
//                    const nomCuenta = c.cuenta || c.nombreCuenta || c.nombre || `Cuenta ${ci + 1}`;
//                    const totMesC = c.totalesPorMes || c.totales || {};
//                    const totalC = c.totalAnualCuenta ?? c.totalAnual ?? c.total ?? 0;

//                    const trC = document.createElement('tr');
//                    trC.className = 'account-row';
//                    trC.dataset.groupIndex = gi;
//                    trC.dataset.levelIndex = ni;
//                    trC.dataset.accountIndex = ci;
//                    trC.innerHTML = `
//            <td class="col-grupo"></td>
//            <td class="col-nivel"></td>
//            <td class="col-cuenta">${nomCuenta}</td>
//            ${this._meses().map((m, ix) => {
//                        const v = totMesC[ix + 1] ?? totMesC[m] ?? 0;
//                        const cls = v < 0 ? 'negative' : (v > 0 ? 'positive' : '');
//                        return `<td class="${cls}">${this.formatCurrency(v)}</td>`;
//                    }).join('')}
//            <td>${this.formatCurrency(totalC)}</td>
//          `;
//                    tableBody.appendChild(trC);
//                });
//            });
//        });

//        // Toggle de expandir/contraer con delegación
//        tableBody.addEventListener('click', (ev) => {
//            const icon = ev.target.closest('.expand-icon');
//            if (!icon) return;

//            const tr = ev.target.closest('tr');
//            if (tr.classList.contains('group-header')) {
//                const gi = tr.dataset.groupIndex;
//                this._toggleGroup(gi);
//            } else if (tr.classList.contains('level-header')) {
//                const gi = tr.dataset.groupIndex;
//                const ni = tr.dataset.levelIndex;
//                this._toggleLevel(gi, ni);
//            }
//        });
//    }

//    expandAll() {
//        // mostrar todas las cuentas
//        this._qsa('.account-row').forEach(r => r.style.display = '');
//        this._qsa('.level-header').forEach(r => r.style.display = '');
//    }
//    collapseGroups() {
//        // oculta niveles y cuentas
//        this._qsa('.level-header').forEach(r => r.style.display = 'none');
//        this._qsa('.account-row').forEach(r => r.style.display = 'none');
//    }
//    collapseLevels() {
//        // oculta cuentas, deja niveles
//        this._qsa('.level-header').forEach(r => r.style.display = '');
//        this._qsa('.account-row').forEach(r => r.style.display = 'none');
//    }
//    _toggleGroup(gi) {
//        const rows = this._qsa(`tr.level-header[data-group-index="${gi}"], tr.account-row[data-group-index="${gi}"]`);
//        const isHidden = rows.every(r => r.style.display === 'none');
//        rows.forEach(r => r.style.display = isHidden ? '' : 'none');
//    }
//    _toggleLevel(gi, ni) {
//        const rows = this._qsa(`tr.account-row[data-group-index="${gi}"][data-level-index="${ni}"]`);
//        const isHidden = rows.every(r => r.style.display === 'none');
//        rows.forEach(r => r.style.display = isHidden ? '' : 'none');
//        // asegurar que el nivel sea visible
//        this._qsa(`tr.level-header[data-group-index="${gi}"][data-level-index="${ni}"]`).forEach(r => r.style.display = '');
//    }

//    /* ===================== VISTA DIVIDIDA ===================== */
//    splitAnualTable(freezeCount = 3) {
//        const sourceWrap = this._qs('#anual-source');
//        const src = this._qs('#financial-table');
//        const grid = this._qs('#anual-grid');
//        const left = this._qs('#financial-table-left');
//        const right = this._qs('#financial-table-right');
//        const rightBox = this._qs('#anual-right');
//        const leftBox = this._qs('#anual-left');
//        const inner = this._qs('#anual-inner');

//        if (!src || !grid || !left || !right || !rightBox || !leftBox || !inner) {
//            console.warn('⚠️ splitAnualTable: elementos faltantes');
//            return;
//        }

//        // limpiar previos
//        left.innerHTML = '<thead></thead><tbody></tbody>';
//        right.innerHTML = '<thead></thead><tbody></tbody>';

//        // Clonar encabezado
//        const sHeadRow = src.tHead?.rows[0];
//        if (!sHeadRow) { console.warn('⚠️ No hay thead en tabla fuente'); return; }
//        const lHead = left.tHead; const lHeadRow = lHead.insertRow();
//        const rHead = right.tHead; const rHeadRow = rHead.insertRow();
//        Array.from(sHeadRow.cells).forEach((cell, i) => {
//            const th = cell.cloneNode(true);
//            if (i < freezeCount) lHeadRow.appendChild(th); else rHeadRow.appendChild(th);
//        });

//        // Clonar cuerpo
//        const sBody = src.tBodies[0];
//        const lBody = left.tBodies[0];
//        const rBody = right.tBodies[0];
//        Array.from(sBody.rows).forEach(row => {
//            const ltr = lBody.insertRow();
//            const rtr = rBody.insertRow();
//            Array.from(row.cells).forEach((cell, i) => {
//                const td = cell.cloneNode(true);
//                if (i < freezeCount) ltr.appendChild(td); else rtr.appendChild(td);
//            });
//            // copiar clases para estilos (group-header, level-header, etc)
//            ltr.className = row.className;
//            rtr.className = row.className;
//            // copiar data-attrs
//            for (const a of row.attributes) {
//                if (a.name.startsWith('data-')) { ltr.setAttribute(a.name, a.value); rtr.setAttribute(a.name, a.value); }
//            }
//        });

//        // Mostrar la vista dividida
//        sourceWrap.style.display = 'none';
//        grid.style.display = 'grid';

//        // Alinear alturas
//        this.syncRowHeights(left, right);

//        // Sincronizar scroll vertical
//        rightBox.addEventListener('scroll', () => { leftBox.scrollTop = rightBox.scrollTop; });

//        // Asegurar overflow horizontal en derecha
//        inner.style.width = 'max-content';
//        const monthsWidth = Math.max(right.scrollWidth, rightBox.clientWidth + 800);
//        inner.style.minWidth = monthsWidth + 'px';

//        // Slider
//        this.wireAnualSlider();
//    }

//    syncRowHeights(leftTable, rightTable) {
//        const lHead = leftTable.tHead?.rows[0], rHead = rightTable.tHead?.rows[0];
//        if (lHead && rHead) {
//            const h = Math.max(lHead.getBoundingClientRect().height, rHead.getBoundingClientRect().height);
//            lHead.style.height = h + 'px'; rHead.style.height = h + 'px';
//        }
//        const lRows = leftTable.tBodies[0].rows;
//        const rRows = rightTable.tBodies[0].rows;
//        const n = Math.min(lRows.length, rRows.length);
//        for (let i = 0; i < n; i++) {
//            const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
//            lRows[i].style.height = h + 'px';
//            rRows[i].style.height = h + 'px';
//        }
//        // Recalcular tras resize
//        window.addEventListener('resize', () => this.syncRowHeights(leftTable, rightTable), { once: true });
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

//    /* ===================== RESUMEN / STUBS (placeholder) ===================== */
//    // Stubs para compatibilidad con llamadas anteriores
//    enhanceTableScroll() { /* noop: manejado por vista dividida */ }
//    renderKPIs() { /* pendiente: render de KPIs si lo usas */ }

//    async loadResumenData() {
//        // Si tienes endpoint real, reemplázalo. Se deja noop para no romper.
//        // console.log('ℹ️ loadResumenData() placeholder');
//    }
//}

//// Instancia global (si tu app.js lo espera)
//window.EstadoResultadosModule = EstadoResultadosModule;






















////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////




//// wwwroot/js/modules/estado-resultados.js
//console.log('✅ estado-resultados.js cargado correctamente');

//class EstadoResultadosModule {
//    constructor(app) {
//        console.log('🔄 EstadoResultadosModule inicializado');
//        this.app = app;
//        this.expandedState = {};
//        this.currentData = null;
//        this.init();
//    }

//    init() {
//        console.log('🔄 Inicializando módulo Estado de Resultados');
//        this.setupTableControls();
//        this.loadResumenData();
//        this.setupAnualTab();
//    }

//    setupTableControls() {
//        console.log('🔄 Configurando controles de tabla');
//        const expandAllBtn = document.getElementById('expand-all');
//        const collapseGroupsBtn = document.getElementById('collapse-groups');
//        const collapseLevelsBtn = document.getElementById('collapse-levels');

//        if (expandAllBtn) expandAllBtn.addEventListener('click', () => this.expandAll());
//        if (collapseGroupsBtn) collapseGroupsBtn.addEventListener('click', () => this.collapseGroups());
//        if (collapseLevelsBtn) collapseLevelsBtn.addEventListener('click', () => this.collapseLevels());
//    }

//    setupAnualTab() {
//        console.log('🔄 Configurando pestaña anual');
//        this.setupTableControls();
//    }

//    async loadAvailableYears() {
//        try {
//            console.log('🔄 Cargando años disponibles');
//            const response = await fetch(`/api/Finance/anios-disponibles?userId=${this.app.userId}`);
//            if (response.ok) {
//                const years = await response.json();
//                this.populateYearSelect(years);
//            }
//        } catch (error) {
//            console.error('❌ Error cargando años:', error);
//        }
//    }

//    populateYearSelect(years) {
//        const yearSelect = document.getElementById('year-select');
//        if (!yearSelect || !years) return;

//        yearSelect.innerHTML = '';
//        if (years && years.length > 0) {
//            years.forEach(year => {
//                const option = document.createElement('option');
//                option.value = year;
//                option.textContent = year;
//                yearSelect.appendChild(option);
//            });

//            const latestYear = Math.max(...years);
//            yearSelect.value = latestYear;
//            this.loadAnualData(latestYear);
//        } else {
//            yearSelect.innerHTML = '<option value="">No hay datos</option>';
//        }
//    }

//    async loadAnualData(year = null) {
//        const selectedYear = year || document.getElementById('year-select')?.value;

//        if (!selectedYear) {
//            console.log('❌ No se seleccionó ningún año');
//            this.showError('Por favor selecciona un año');
//            return;
//        }

//        console.log('✅ Cargando datos anuales para el año:', selectedYear);
//        this.showLoading();

//        try {
//            const url = `/api/Finance/estado-resultados-anual?año=${selectedYear}&userId=${this.app.userId}`;
//            console.log('✅ URL de la API:', url);

//            const response = await fetch(url);

//            console.log('✅ Response status:', response.status);
//            console.log('✅ Response ok:', response.ok);

//            if (response.ok) {
//                const data = await response.json();
//                console.log('✅ Datos anuales recibidos:', data);

//                if (data && data.resultados) {
//                    console.log('✅ Renderizando tabla...');
//                    this.renderAnualTable(data.resultados);
//                    this.renderKPIs(data.resultados);
//                    console.log('✅ Tabla renderizada exitosamente');
//                } else {
//                    console.error('❌ Estructura de datos inválida');
//                    throw new Error('Estructura de datos inválida');
//                }
//            } else {
//                const errorText = await response.text();
//                console.error('❌ Error cargando datos anuales:', response.status, errorText);
//                this.showError(`Error ${response.status}: ${errorText}`);
//            }
//        } catch (error) {
//            console.error('❌ Error de conexión:', error);
//            this.showError('Error de conexión: ' + error.message);
//        }
//    }

//    renderAnualTable(resultados) {
//        const tableBody = document.getElementById('table-body');
//        if (!tableBody) {
//            console.error('❌ table-body no encontrado');
//            return;
//        }

//        tableBody.innerHTML = '';
//        this.expandedState = {};

//        if (!resultados || !resultados.estructura) {
//            this.showError('Estructura de datos no válida');
//            return;
//        }

//        console.log('✅ Renderizando tabla con', resultados.estructura.length, 'grupos');

//        // Renderizar grupos, niveles y cuentas
//        resultados.estructura.forEach((grupo, grupoIndex) => {
//            if (!grupo) return;

//            const grupoId = `grupo-${grupoIndex}`;
//            this.expandedState[grupoId] = true;

//            const grupoRow = document.createElement('tr');
//            grupoRow.className = 'group-header';
//            grupoRow.dataset.id = grupoId;
//            grupoRow.dataset.type = 'grupo';
//            grupoRow.innerHTML = `
//                <td class="col-grupo">
//                    <span class="expand-icon">▼</span>
//                    <strong>${grupo.nombreGrupo || grupo.grupo || 'Grupo sin nombre'}</strong>
//                </td>
//                <td class="col-nivel"></td>
//                <td class="col-cuenta"></td>
//                ${this.generateMonthlyCells(grupo.totalesPorMes || {})}
//                <td><strong class="group-total">${this.formatCurrency(grupo.totalAnualGrupo || 0)}</strong></td>
//            `;
//            tableBody.appendChild(grupoRow);

//            if (grupo.niveles && Array.isArray(grupo.niveles)) {
//                grupo.niveles.forEach((nivel, nivelIndex) => {
//                    if (!nivel) return;

//                    const nivelId = `${grupoId}-nivel-${nivelIndex}`;
//                    this.expandedState[nivelId] = true;

//                    const nivelRow = document.createElement('tr');
//                    nivelRow.className = `level-header`;
//                    nivelRow.dataset.id = nivelId;
//                    nivelRow.dataset.type = 'nivel';
//                    nivelRow.dataset.parent = grupoId;
//                    nivelRow.innerHTML = `
//                        <td class="col-grupo"></td>
//                        <td class="col-nivel">
//                            <span class="expand-icon">▼</span>
//                            <strong>${nivel.nivel || 'Nivel sin nombre'}</strong>
//                        </td>
//                        <td class="col-cuenta"></td>
//                        ${this.generateMonthlyCells(nivel.totalesPorMes || {})}
//                        <td><strong class="level-total">${this.formatCurrency(nivel.totalAnualNivel || 0)}</strong></td>
//                    `;
//                    tableBody.appendChild(nivelRow);

//                    if (nivel.cuentas && Array.isArray(nivel.cuentas)) {
//                        nivel.cuentas.forEach((cuenta) => {
//                            if (!cuenta) return;

//                            const cuentaRow = document.createElement('tr');
//                            cuentaRow.className = `account-row`;
//                            cuentaRow.dataset.parent = nivelId;
//                            cuentaRow.innerHTML = `
//                                <td class="col-grupo"></td>
//                                <td class="col-nivel"></td>
//                                <td class="col-cuenta">${cuenta.nombreCuenta || 'Cuenta sin nombre'}</td>
//                                ${this.generateMonthlyCells(cuenta.totalesPorMes || {})}
//                                <td>${this.formatCurrency(cuenta.totalAnual || 0)}</td>
//                            `;
//                            tableBody.appendChild(cuentaRow);
//                        });
//                    }
//                });
//            }
//        });

//        const totalGeneralRow = document.createElement('tr');
//        totalGeneralRow.className = 'total-row';
//        totalGeneralRow.innerHTML = `
//            <td class="col-grupo" colspan="3"><strong>TOTAL GENERAL</strong></td>
//            ${this.generateMonthlyCells(resultados.totalesPorMes || {})}
//            <td><strong>${this.formatCurrency(resultados.totalAnual || 0)}</strong></td>
//        `;
//        tableBody.appendChild(totalGeneralRow);

//        this.addExpandCollapseListeners();
//        this.updateExpandIcons();
//        this.hideLoading();
//        this.enhanceTableScroll?.();
//        this.wireHorizontalSlider();

//        (function forceOverflowWithWrapper() {
//            const wrap = document.querySelector('.anual-table-wrapper');
//            const content = document.getElementById('anual-table-content'); // NUEVO
//            const table = document.getElementById('financial-table');
//            if (!wrap || !content || !table) return;

//            // Asegura que el contenido sea MÁS ancho que el visible (para generar barra)
//            const needed = Math.max(table.scrollWidth, wrap.clientWidth + 800); // ajusta el buffer si quieres
//            content.style.minWidth = needed + 'px';

//            // Diagnóstico útil
//            console.log('[FORCE-WRAP] wrap cw/sw:', wrap.clientWidth, '/', wrap.scrollWidth,
//                '| content minWidth:', content.style.minWidth,
//                '| table sw:', table.scrollWidth);
//        })();


//        // Debug & scroll asegurado
//        this.debugTableStructure();
//        this.enhanceTableScroll(); // ← CAMBIO: asegura overflow horizontal
//        console.log('✅ Tabla renderizada correctamente');
//    }

//    generateMonthlyCells(monthlyData) {
//        let cells = '';
//        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
//            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

//        for (let mes = 1; mes <= 12; mes++) {
//            const value = monthlyData[mes] || monthlyData[meses[mes - 1]] || 0;
//            const cellClass = value < 0 ? 'negative' : value > 0 ? 'positive' : '';
//            cells += `<td class="${cellClass}">${this.formatCurrency(value)}</td>`;
//        }
//        return cells;
//    }

//    addExpandCollapseListeners() {
//        document.querySelectorAll('.group-header').forEach(row => {
//            row.addEventListener('click', () => {
//                const grupoId = row.dataset.id;
//                this.expandedState[grupoId] = !this.expandedState[grupoId];
//                document.querySelectorAll(`[data-parent="${grupoId}"]`).forEach(child => {
//                    child.classList.toggle('collapsed', !this.expandedState[grupoId]);
//                });
//                this.updateExpandIcons();
//            });
//        });

//        document.querySelectorAll('.level-header').forEach(row => {
//            row.addEventListener('click', (e) => {
//                e.stopPropagation();
//                const nivelId = row.dataset.id;
//                this.expandedState[nivelId] = !this.expandedState[nivelId];
//                document.querySelectorAll(`[data-parent="${nivelId}"]`).forEach(child => {
//                    child.classList.toggle('collapsed', !this.expandedState[nivelId]);
//                });
//                this.updateExpandIcons();
//            });
//        });
//    }

//    updateExpandIcons() {
//        document.querySelectorAll('[data-type="grupo"], [data-type="nivel"]').forEach(row => {
//            const id = row.dataset.id;
//            const icon = row.querySelector('.expand-icon');
//            if (icon) icon.textContent = this.expandedState[id] ? '▼' : '►';
//        });
//    }

//    expandAll() {
//        console.log('✅ Expandir todo');
//        document.querySelectorAll('[data-type="grupo"], [data-type="nivel"]').forEach(row => {
//            const id = row.dataset.id;
//            this.expandedState[id] = true;
//        });
//        document.querySelectorAll('.collapsed').forEach(row => row.classList.remove('collapsed'));
//        this.updateExpandIcons();
//    }

//    collapseGroups() {
//        console.log('✅ Contraer grupos');
//        document.querySelectorAll('[data-type="grupo"]').forEach(row => {
//            const grupoId = row.dataset.id;
//            this.expandedState[grupoId] = false;
//            document.querySelectorAll(`[data-parent="${grupoId}"]`).forEach(child => child.classList.add('collapsed'));
//        });
//        this.updateExpandIcons();
//    }

//    collapseLevels() {
//        console.log('✅ Contraer niveles');
//        document.querySelectorAll('[data-type="nivel"]').forEach(row => {
//            const nivelId = row.dataset.id;
//            this.expandedState[nivelId] = false;
//            document.querySelectorAll(`[data-parent="${nivelId}"]`).forEach(child => child.classList.add('collapsed'));
//        });
//        this.updateExpandIcons();
//    }

//    renderKPIs(resultados) {
//        const kpiGrid = document.getElementById('kpi-grid');
//        if (!kpiGrid) return;

//        kpiGrid.innerHTML = '';

//        if (resultados && resultados.kpIs && typeof resultados.kpIs === 'object') {
//            console.log('✅ Renderizando KPIs:', resultados.kpIs);
//            Object.entries(resultados.kpIs).forEach(([key, value]) => {
//                const kpiCard = document.createElement('div');
//                kpiCard.className = 'kpi-card';

//                let displayValue = value;
//                if (key.includes('%') && typeof value === 'number') {
//                    displayValue = value.toFixed(2) + '%';
//                } else if (typeof value === 'number') {
//                    displayValue = this.formatCurrency(value);
//                }

//                kpiCard.innerHTML = `
//                    <div class="kpi-value">${displayValue}</div>
//                    <div class="kpi-label">${this.formatKpiLabel(key)}</div>
//                `;
//                kpiGrid.appendChild(kpiCard);
//            });

//            document.getElementById('kpi-section').style.display = 'block';
//        } else {
//            document.getElementById('kpi-section').style.display = 'none';
//        }
//    }

//    formatKpiLabel(key) {
//        const labels = {
//            'MARGEN_BRUTO': 'Margen Bruto',
//            'MARGEN_BRUTO_%': 'Margen Bruto %',
//            'TOTAL_GASTOS_OPERACIONALES': 'Gastos Operacionales',
//            'TOTAL_INGRESOS_NO_OPERACIONALES': 'Ingresos No Operacionales',
//            'TOTAL_GASTOS_NO_OPERACIONALES': 'Gastos No Operacionales',
//            'UTILIDAD_OPERACIONAL': 'Utilidad Operacional',
//            'UTILIDAD_NETA': 'Utilidad Neta'
//        };
//        return labels[key] || key.replace(/_/g, ' ');
//    }

//    loadResumenData() {
//        if (!this.app.currentData) return;
//        const resumenCards = document.getElementById('resumen-cards');
//        if (resumenCards) resumenCards.innerHTML = this.generateResumenCards(this.app.currentData);
//    }

//    generateResumenCards(data) {
//        return `
//            <div class="metric-card">
//                <h3>Ingresos Totales</h3>
//                <div class="metric-value">${this.formatCurrency(data.totalAnual || 0)}</div>
//                <div class="metric-trend positive">+12% vs año anterior</div>
//            </div>
//            <div class="metric-card">
//                <h3>Registros Procesados</h3>
//                <div class="metric-value">${data.totalMovimientos || 0}</div>
//                <div class="metric-trend positive">Datos actualizados</div>
//            </div>
//            <div class="metric-card">
//                <h3>Centros de Costo</h3>
//                <div class="metric-value">${data.totalClasificaciones || 0}</div>
//                <div class="metric-trend positive">Clasificados</div>
//            </div>
//        `;
//    }

//    formatCurrency(value) {
//        if (typeof value !== 'number') value = parseFloat(value) || 0;
//        return new Intl.NumberFormat('es-CO', {
//            style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0
//        }).format(value);
//    }

//    showLoading() {
//        const loadingElement = document.getElementById('loading');
//        const tableWrapper = document.querySelector('.anual-table-wrapper');
//        if (loadingElement) loadingElement.style.display = 'block';
//        if (tableWrapper) tableWrapper.style.display = 'none';
//    }

//    hideLoading() {
//        const loadingElement = document.getElementById('loading');
//        const tableWrapper = document.querySelector('.anual-table-wrapper');
//        if (loadingElement) loadingElement.style.display = 'none';
//        if (tableWrapper) tableWrapper.style.display = 'block';
//    }

//    showError(message) {
//        const errorElement = document.getElementById('error-message');
//        if (errorElement) {
//            errorElement.textContent = message;
//            errorElement.style.display = 'block';
//        }
//        this.hideLoading();
//        this.enhanceTableScroll?.();
//        this.wireHorizontalSlider();

//        (function forceOverflowWithWrapper() {
//            const wrap = document.querySelector('.anual-table-wrapper');
//            const content = document.getElementById('anual-table-content'); // NUEVO
//            const table = document.getElementById('financial-table');
//            if (!wrap || !content || !table) return;

//            // Asegura que el contenido sea MÁS ancho que el visible (para generar barra)
//            const needed = Math.max(table.scrollWidth, wrap.clientWidth + 800); // ajusta el buffer si quieres
//            content.style.minWidth = needed + 'px';

//            // Diagnóstico útil
//            console.log('[FORCE-WRAP] wrap cw/sw:', wrap.clientWidth, '/', wrap.scrollWidth,
//                '| content minWidth:', content.style.minWidth,
//                '| table sw:', table.scrollWidth);
//        })();

//    }

//    debugTableStructure() {
//        setTimeout(() => {
//            const table = document.getElementById('financial-table');
//            const wrapper = document.querySelector('.anual-table-wrapper');
//            const rows = table.querySelectorAll('tr');

//            console.log('🔍 DEBUG Estructura de la tabla:');
//            console.log('- Filas totales:', rows.length);

//            if (rows.length > 0) {
//                const firstRow = rows[0];
//                const cells = firstRow.querySelectorAll('td, th');
//                console.log('- Columnas en primera fila:', cells.length);
//                console.log('- Ancho tabla:', table.offsetWidth, 'px');
//                console.log('- Ancho contenedor:', wrapper.offsetWidth, 'px');
//                console.log('- Scroll horizontal necesario:', wrapper.scrollWidth > wrapper.clientWidth);
//                console.log('- Scroll vertical necesario:', table.offsetHeight > wrapper.clientHeight);

//                wrapper.style.overflowX = 'auto';
//                wrapper.style.overflowY = 'auto';
//            }
//        }, 100);
//    }


//    enhanceTableScroll() {
//        const wrap = document.querySelector('.anual-table-wrapper') || document.querySelector('.table-scroll-container');
//        const table = document.getElementById('financial-table');
//        const bottom = document.getElementById('anual-bottom-scroll');
//        if (!wrap || !table || !bottom) { return; }

//        // Asegura que el contenedor sea el que scrollea (no el body)
//        wrap.style.overflowX = 'auto';
//        wrap.style.overflowY = 'auto';
//        wrap.style.width = '100%';
//        wrap.style.maxWidth = '100%';

//        // La tabla debe medirse por contenido (para que sea más ancha que el wrapper)
//        table.style.width = 'max-content';
//        table.style.tableLayout = 'fixed';

//        // Asigna min-widths razonables a encabezados (en caso de que falten)
//        const ths = table.querySelectorAll('thead th');
//        if (ths.length >= 16) {
//            ths[0].style.minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-grupo').trim() || '140px';
//            ths[1].style.minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-nivel').trim() || '110px';
//            ths[2].style.minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-cuenta').trim() || '220px';
//            for (let i = 3; i < ths.length - 1; i++) ths[i].style.minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-mes').trim() || '120px';
//            ths[ths.length - 1].style.minWidth = getComputedStyle(document.documentElement).getPropertyValue('--col-total').trim() || '150px';
//        }

//        // Si la tabla no supera el visible, empujamos min-width para forzar overflow horizontal
//        const ensureOverflow = () => {
//            const visible = wrap.clientWidth;
//            if (table.scrollWidth <= visible) {
//                table.style.minWidth = (visible + 600) + 'px';
//            }
//            // Configurar barra inferior "espejo"
//            const spacer = bottom.querySelector('.spacer');
//            spacer.style.width = (table.scrollWidth + 1) + 'px';
//            // Sincronización de scroll
//            let lock = false;
//            bottom.onscroll = () => { if (lock) return; lock = true; wrap.scrollLeft = bottom.scrollLeft; lock = false; };
//            wrap.onscroll = () => { if (lock) return; lock = true; bottom.scrollLeft = wrap.scrollLeft; lock = false; };
//        };

//        // Verificar ahora y tras el layout
//        ensureOverflow();
//        setTimeout(ensureOverflow, 0);
//        window.addEventListener('resize', () => setTimeout(ensureOverflow, 0));
//    }


//    wireHorizontalSlider() {
//        const wrap = document.querySelector('.anual-table-wrapper') || document.querySelector('.table-scroll-container');
//        const table = document.getElementById('financial-table');
//        const slider = document.getElementById('anual-hslider');
//        if (!wrap || !table || !slider) return;

//        // 1) Asegura overflow real: la tabla debe ser más ancha que el contenedor
//        table.style.width = 'max-content';
//        table.style.tableLayout = 'fixed';
//        const ensureOverflow = () => {
//            // empuja el minWidth para que exista desplazamiento
//            const needed = wrap.clientWidth + 600; // 600px más allá de lo visible
//            const current = parseInt((table.style.minWidth || '0').replace('px', '')) || 0;
//            if (current < needed) table.style.minWidth = needed + 'px';
//        };
//        ensureOverflow();

//        // 2) Helpers del slider (rango 0..max donde max = scrollWidth - visible)
//        const computeMax = () => Math.max(0, table.scrollWidth - wrap.clientWidth);
//        const refresh = () => {
//            const max = computeMax();
//            slider.min = '0';
//            slider.max = String(max);
//            slider.step = '1';
//            slider.value = String(Math.min(wrap.scrollLeft, max));
//            // mostrar slider sólo si hay overflow
//            slider.style.display = max > 0 ? 'block' : 'none';
//        };

//        // 3) Sincronización en ambos sentidos
//        const onSlider = () => {
//            const max = computeMax();
//            const val = Math.min(Math.max(0, slider.valueAsNumber || 0), max);
//            wrap.scrollLeft = val;
//        };
//        const onWrap = () => {
//            slider.value = String(wrap.scrollLeft);
//        };

//        slider.removeEventListener('input', onSlider);
//        slider.removeEventListener('change', onSlider);
//        wrap.removeEventListener('scroll', onWrap);

//        slider.addEventListener('input', onSlider);
//        slider.addEventListener('change', onSlider);
//        wrap.addEventListener('scroll', onWrap);

//        // 4) Inicializar y revalidar tras layout/resize
//        requestAnimationFrame(refresh);
//        setTimeout(refresh, 50);
//        window.addEventListener('resize', () => setTimeout(() => { ensureOverflow(); refresh(); }, 0));
//    }



//}



































//// wwwroot/js/modules/estado-resultados.js
//console.log('✅ estado-resultados.js cargado correctamente');

//class EstadoResultadosModule {
//    constructor(app) {
//        console.log('🔄 EstadoResultadosModule inicializado');
//        this.app = app;
//        this.expandedState = {};
//        this.currentData = null;
//        this.init();
//    }

//    init() {
//        console.log('🔄 Inicializando módulo Estado de Resultados');
//        this.setupTableControls();
//        this.loadResumenData();
//        this.setupAnualTab();
//    }

//    setupTableControls() {
//        console.log('🔄 Configurando controles de tabla');
//        // Controles de expandir/contraer
//        const expandAllBtn = document.getElementById('expand-all');
//        const collapseGroupsBtn = document.getElementById('collapse-groups');
//        const collapseLevelsBtn = document.getElementById('collapse-levels');

//        if (expandAllBtn) {
//            expandAllBtn.addEventListener('click', () => this.expandAll());
//        }
//        if (collapseGroupsBtn) {
//            collapseGroupsBtn.addEventListener('click', () => this.collapseGroups());
//        }
//        if (collapseLevelsBtn) {
//            collapseLevelsBtn.addEventListener('click', () => this.collapseLevels());
//        }
//    }

//    setupAnualTab() {
//        console.log('🔄 Configurando pestaña anual');
//        this.setupTableControls();
//    }

//    async loadAvailableYears() {
//        try {
//            console.log('🔄 Cargando años disponibles');
//            const response = await fetch(`/api/Finance/anios-disponibles?userId=${this.app.userId}`);
//            if (response.ok) {
//                const years = await response.json();
//                this.populateYearSelect(years);
//            }
//        } catch (error) {
//            console.error('❌ Error cargando años:', error);
//        }
//    }

//    populateYearSelect(years) {
//        const yearSelect = document.getElementById('year-select');
//        if (!yearSelect || !years) return;

//        yearSelect.innerHTML = '';
//        if (years && years.length > 0) {
//            years.forEach(year => {
//                const option = document.createElement('option');
//                option.value = year;
//                option.textContent = year;
//                yearSelect.appendChild(option);
//            });

//            const latestYear = Math.max(...years);
//            yearSelect.value = latestYear;
//            this.loadAnualData(latestYear);
//        } else {
//            yearSelect.innerHTML = '<option value="">No hay datos</option>';
//        }
//    }

//    async loadAnualData(year = null) {
//        const selectedYear = year || document.getElementById('year-select')?.value;

//        if (!selectedYear) {
//            console.log('❌ No se seleccionó ningún año');
//            this.showError('Por favor selecciona un año');
//            return;
//        }

//        console.log('✅ Cargando datos anuales para el año:', selectedYear);
//        this.showLoading();

//        try {
//            const url = `/api/Finance/estado-resultados-anual?año=${selectedYear}&userId=${this.app.userId}`;
//            console.log('✅ URL de la API:', url);

//            const response = await fetch(url);

//            console.log('✅ Response status:', response.status);
//            console.log('✅ Response ok:', response.ok);

//            if (response.ok) {
//                const data = await response.json();
//                console.log('✅ Datos anuales recibidos:', data);

//                if (data && data.resultados) {
//                    console.log('✅ Renderizando tabla...');
//                    this.renderAnualTable(data.resultados);
//                    this.renderKPIs(data.resultados);
//                    console.log('✅ Tabla renderizada exitosamente');
//                } else {
//                    console.error('❌ Estructura de datos inválida');
//                    throw new Error('Estructura de datos inválida');
//                }
//            } else {
//                const errorText = await response.text();
//                console.error('❌ Error cargando datos anuales:', response.status, errorText);
//                this.showError(`Error ${response.status}: ${errorText}`);
//            }
//        } catch (error) {
//            console.error('❌ Error de conexión:', error);
//            this.showError('Error de conexión: ' + error.message);
//        }
//    }

//    renderAnualTable(resultados) {
//        const tableBody = document.getElementById('table-body');
//        if (!tableBody) {
//            console.error('❌ table-body no encontrado');
//            return;
//        }

//        tableBody.innerHTML = '';
//        this.expandedState = {};

//        if (!resultados || !resultados.estructura) {
//            this.showError('Estructura de datos no válida');
//            return;
//        }

//        console.log('✅ Renderizando tabla con', resultados.estructura.length, 'grupos');

//        // Renderizar grupos, niveles y cuentas
//        resultados.estructura.forEach((grupo, grupoIndex) => {
//            if (!grupo) return;

//            const grupoId = `grupo-${grupoIndex}`;
//            this.expandedState[grupoId] = true;

//            // Fila del Grupo - CORREGIDO: Estructura de 16 columnas
//            const grupoRow = document.createElement('tr');
//            grupoRow.className = 'group-header';
//            grupoRow.dataset.id = grupoId;
//            grupoRow.dataset.type = 'grupo';
//            grupoRow.innerHTML = `
//                <td class="col-grupo">
//                    <span class="expand-icon">▼</span>
//                    <strong>${grupo.nombreGrupo || grupo.grupo || 'Grupo sin nombre'}</strong>
//                </td>
//                <td class="col-nivel"></td>
//                <td class="col-cuenta"></td>
//                ${this.generateMonthlyCells(grupo.totalesPorMes || {})}
//                <td><strong class="group-total">${this.formatCurrency(grupo.totalAnualGrupo || 0)}</strong></td>
//            `;
//            tableBody.appendChild(grupoRow);

//            // Niveles del grupo
//            if (grupo.niveles && Array.isArray(grupo.niveles)) {
//                grupo.niveles.forEach((nivel, nivelIndex) => {
//                    if (!nivel) return;

//                    const nivelId = `${grupoId}-nivel-${nivelIndex}`;
//                    this.expandedState[nivelId] = true;

//                    const nivelRow = document.createElement('tr');
//                    nivelRow.className = `level-header`;
//                    nivelRow.dataset.id = nivelId;
//                    nivelRow.dataset.type = 'nivel';
//                    nivelRow.dataset.parent = grupoId;
//                    nivelRow.innerHTML = `
//                        <td class="col-grupo"></td>
//                        <td class="col-nivel">
//                            <span class="expand-icon">▼</span>
//                            <strong>${nivel.nivel || 'Nivel sin nombre'}</strong>
//                        </td>
//                        <td class="col-cuenta"></td>
//                        ${this.generateMonthlyCells(nivel.totalesPorMes || {})}
//                        <td><strong class="level-total">${this.formatCurrency(nivel.totalAnualNivel || 0)}</strong></td>
//                    `;
//                    tableBody.appendChild(nivelRow);

//                    // Cuentas del nivel
//                    if (nivel.cuentas && Array.isArray(nivel.cuentas)) {
//                        nivel.cuentas.forEach((cuenta, cuentaIndex) => {
//                            if (!cuenta) return;

//                            const cuentaRow = document.createElement('tr');
//                            cuentaRow.className = `account-row`;
//                            cuentaRow.dataset.parent = nivelId;
//                            cuentaRow.innerHTML = `
//                                <td class="col-grupo"></td>
//                                <td class="col-nivel"></td>
//                                <td class="col-cuenta">${cuenta.nombreCuenta || 'Cuenta sin nombre'}</td>
//                                ${this.generateMonthlyCells(cuenta.totalesPorMes || {})}
//                                <td>${this.formatCurrency(cuenta.totalAnual || 0)}</td>
//                            `;
//                            tableBody.appendChild(cuentaRow);
//                        });
//                    }
//                });
//            }
//        });

//        // Total general - CORREGIDO: colspan="3" para las primeras 3 columnas
//        const totalGeneralRow = document.createElement('tr');
//        totalGeneralRow.className = 'total-row';
//        totalGeneralRow.innerHTML = `
//            <td class="col-grupo" colspan="3"><strong>TOTAL GENERAL</strong></td>
//            ${this.generateMonthlyCells(resultados.totalesPorMes || {})}
//            <td><strong>${this.formatCurrency(resultados.totalAnual || 0)}</strong></td>
//        `;
//        tableBody.appendChild(totalGeneralRow);

//        this.addExpandCollapseListeners();
//        this.updateExpandIcons();
//        this.hideLoading();

//        // Debug para verificar la estructura
//        this.debugTableStructure();

//        console.log('✅ Tabla renderizada correctamente');
//    }

//    generateMonthlyCells(monthlyData) {
//        let cells = '';
//        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
//            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

//        for (let mes = 1; mes <= 12; mes++) {
//            const value = monthlyData[mes] || monthlyData[meses[mes - 1]] || 0;
//            const cellClass = value < 0 ? 'negative' : value > 0 ? 'positive' : '';
//            cells += `<td class="${cellClass}">${this.formatCurrency(value)}</td>`;
//        }
//        return cells;
//    }

//    addExpandCollapseListeners() {
//        // Listeners para grupos
//        document.querySelectorAll('.group-header').forEach(row => {
//            row.addEventListener('click', () => {
//                const grupoId = row.dataset.id;
//                this.expandedState[grupoId] = !this.expandedState[grupoId];

//                // Mostrar/ocultar niveles y cuentas del grupo
//                document.querySelectorAll(`[data-parent="${grupoId}"]`).forEach(child => {
//                    child.classList.toggle('collapsed', !this.expandedState[grupoId]);
//                });
//                this.updateExpandIcons();
//            });
//        });

//        // Listeners para niveles
//        document.querySelectorAll('.level-header').forEach(row => {
//            row.addEventListener('click', (e) => {
//                e.stopPropagation(); // Evitar que se active el listener del grupo
//                const nivelId = row.dataset.id;
//                this.expandedState[nivelId] = !this.expandedState[nivelId];

//                // Mostrar/ocultar cuentas del nivel
//                document.querySelectorAll(`[data-parent="${nivelId}"]`).forEach(child => {
//                    child.classList.toggle('collapsed', !this.expandedState[nivelId]);
//                });
//                this.updateExpandIcons();
//            });
//        });
//    }

//    updateExpandIcons() {
//        document.querySelectorAll('[data-type="grupo"], [data-type="nivel"]').forEach(row => {
//            const id = row.dataset.id;
//            const icon = row.querySelector('.expand-icon');
//            if (icon) {
//                icon.textContent = this.expandedState[id] ? '▼' : '►';
//            }
//        });
//    }

//    expandAll() {
//        console.log('✅ Expandir todo');
//        document.querySelectorAll('[data-type="grupo"], [data-type="nivel"]').forEach(row => {
//            const id = row.dataset.id;
//            this.expandedState[id] = true;
//        });
//        document.querySelectorAll('.collapsed').forEach(row => {
//            row.classList.remove('collapsed');
//        });
//        this.updateExpandIcons();
//    }

//    collapseGroups() {
//        console.log('✅ Contraer grupos');
//        document.querySelectorAll('[data-type="grupo"]').forEach(row => {
//            const grupoId = row.dataset.id;
//            this.expandedState[grupoId] = false;

//            document.querySelectorAll(`[data-parent="${grupoId}"]`).forEach(child => {
//                child.classList.add('collapsed');
//            });
//        });
//        this.updateExpandIcons();
//    }

//    collapseLevels() {
//        console.log('✅ Contraer niveles');
//        document.querySelectorAll('[data-type="nivel"]').forEach(row => {
//            const nivelId = row.dataset.id;
//            this.expandedState[nivelId] = false;

//            document.querySelectorAll(`[data-parent="${nivelId}"]`).forEach(child => {
//                child.classList.add('collapsed');
//            });
//        });
//        this.updateExpandIcons();
//    }

//    renderKPIs(resultados) {
//        const kpiGrid = document.getElementById('kpi-grid');
//        if (!kpiGrid) return;

//        kpiGrid.innerHTML = '';

//        if (resultados && resultados.kpIs && typeof resultados.kpIs === 'object') {
//            console.log('✅ Renderizando KPIs:', resultados.kpIs);
//            Object.entries(resultados.kpIs).forEach(([key, value]) => {
//                const kpiCard = document.createElement('div');
//                kpiCard.className = 'kpi-card';

//                let displayValue = value;
//                if (key.includes('%') && typeof value === 'number') {
//                    displayValue = value.toFixed(2) + '%';
//                } else if (typeof value === 'number') {
//                    displayValue = this.formatCurrency(value);
//                }

//                kpiCard.innerHTML = `
//                    <div class="kpi-value">${displayValue}</div>
//                    <div class="kpi-label">${this.formatKpiLabel(key)}</div>
//                `;
//                kpiGrid.appendChild(kpiCard);
//            });

//            document.getElementById('kpi-section').style.display = 'block';
//        } else {
//            document.getElementById('kpi-section').style.display = 'none';
//        }
//    }

//    formatKpiLabel(key) {
//        const labels = {
//            'MARGEN_BRUTO': 'Margen Bruto',
//            'MARGEN_BRUTO_%': 'Margen Bruto %',
//            'TOTAL_GASTOS_OPERACIONALES': 'Gastos Operacionales',
//            'TOTAL_INGRESOS_NO_OPERACIONALES': 'Ingresos No Operacionales',
//            'TOTAL_GASTOS_NO_OPERACIONALES': 'Gastos No Operacionales',
//            'UTILIDAD_OPERACIONAL': 'Utilidad Operacional',
//            'UTILIDAD_NETA': 'Utilidad Neta'
//        };
//        return labels[key] || key.replace(/_/g, ' ');
//    }

//    loadResumenData() {
//        if (!this.app.currentData) return;

//        const resumenCards = document.getElementById('resumen-cards');
//        if (resumenCards) {
//            resumenCards.innerHTML = this.generateResumenCards(this.app.currentData);
//        }
//    }

//    generateResumenCards(data) {
//        return `
//            <div class="metric-card">
//                <h3>Ingresos Totales</h3>
//                <div class="metric-value">${this.formatCurrency(data.totalAnual || 0)}</div>
//                <div class="metric-trend positive">+12% vs año anterior</div>
//            </div>
//            <div class="metric-card">
//                <h3>Registros Procesados</h3>
//                <div class="metric-value">${data.totalMovimientos || 0}</div>
//                <div class="metric-trend positive">Datos actualizados</div>
//            </div>
//            <div class="metric-card">
//                <h3>Centros de Costo</h3>
//                <div class="metric-value">${data.totalClasificaciones || 0}</div>
//                <div class="metric-trend positive">Clasificados</div>
//            </div>
//        `;
//    }

//    formatCurrency(value) {
//        if (typeof value !== 'number') {
//            value = parseFloat(value) || 0;
//        }
//        return new Intl.NumberFormat('es-CO', {
//            style: 'currency',
//            currency: 'COP',
//            minimumFractionDigits: 0,
//            maximumFractionDigits: 0
//        }).format(value);
//    }

//    showLoading() {
//        const loadingElement = document.getElementById('loading');
//        const tableWrapper = document.querySelector('.anual-table-wrapper');
//        if (loadingElement) loadingElement.style.display = 'block';
//        if (tableWrapper) tableWrapper.style.display = 'none';
//    }

//    hideLoading() {
//        const loadingElement = document.getElementById('loading');
//        const tableWrapper = document.querySelector('.anual-table-wrapper');
//        if (loadingElement) loadingElement.style.display = 'none';
//        if (tableWrapper) tableWrapper.style.display = 'block';
//    }

//    showError(message) {
//        const errorElement = document.getElementById('error-message');
//        if (errorElement) {
//            errorElement.textContent = message;
//            errorElement.style.display = 'block';
//        }
//        this.hideLoading();
//    }





//    debugTableStructure() {
//        // Debug para verificar que la tabla tiene la estructura correcta
//        setTimeout(() => {
//            const table = document.getElementById('financial-table');
//            const wrapper = document.querySelector('.anual-table-wrapper');
//            const rows = table.querySelectorAll('tr');

//            console.log('🔍 DEBUG Estructura de la tabla:');
//            console.log('- Filas totales:', rows.length);

//            if (rows.length > 0) {
//                const firstRow = rows[0];
//                const cells = firstRow.querySelectorAll('td, th');
//                console.log('- Columnas en primera fila:', cells.length);
//                console.log('- Ancho tabla:', table.offsetWidth, 'px');
//                console.log('- Ancho contenedor:', wrapper.offsetWidth, 'px');
//                console.log('- Scroll horizontal necesario:', wrapper.scrollWidth > wrapper.clientWidth);
//                console.log('- Scroll vertical necesario:', table.offsetHeight > wrapper.clientHeight);

//                // Forzar estilos de scroll
//                wrapper.style.overflow = 'auto';
//                wrapper.style.overflowX = 'scroll';
//                wrapper.style.overflowY = 'auto';
//            }

//        }, 100);
//    }

//    enhanceTableScroll() {
//        const tableWrapper = document.querySelector('.anual-table-wrapper');
//        if (!tableWrapper) {
//            console.error('❌ No se encontró .anual-table-wrapper');
//            return;
//        }

//        // Forzar scroll horizontal y vertical
//        tableWrapper.style.overflow = 'auto';
//        tableWrapper.style.overflowX = 'scroll';
//        tableWrapper.style.overflowY = 'auto';

//        console.log('✅ Scroll horizontal y vertical habilitado');

//        // Verificar después de un delay
//        setTimeout(() => {
//            const hasHorizontalScroll = tableWrapper.scrollWidth > tableWrapper.clientWidth;
//            const hasVerticalScroll = tableWrapper.scrollHeight > tableWrapper.clientHeight;

//            console.log('📊 Estado del scroll:');
//            console.log('- Horizontal:', hasHorizontalScroll);
//            console.log('- Vertical:', hasVerticalScroll);
//            console.log('- Ancho tabla:', tableWrapper.scrollWidth, 'px');
//            console.log('- Ancho visible:', tableWrapper.clientWidth, 'px');

//            if (!hasHorizontalScroll) {
//                console.warn('⚠️ No hay scroll horizontal. Forzando...');
//                // Forzar ancho mínimo mayor si es necesario
//                const table = document.getElementById('financial-table');
//                if (table) {
//                    table.style.minWidth = '1600px';
//                }
//            }
//        }, 500);
//    }
//}