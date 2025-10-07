// wwwroot/js/app.js
console.log('🔄 app.js se está cargando...');

class DataSmartApp {
    constructor() {
        console.log('🔄 Constructor de DataSmartApp ejecutándose...');
        this.currentModule = 'inicio';
        this.currentData = null;
        this.userId = this.getUserId();
        console.log('🔄 UserId obtenido:', this.userId);
        this.init();
    }

    init() {
        console.log('🔄 Inicializando aplicación...');
        this.setupNavigation();
        this.setupUpload();
        this.setupGlobalControls(); // ✅ Esta línea está bien
        this.displayUserId();
        this.loadModule('inicio');
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');

        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', function () {
                sidebar.classList.toggle('open');
            });

            this.checkMobileView();
            window.addEventListener('resize', () => this.checkMobileView());
        }
    }

    checkMobileView() {
        const menuToggle = document.getElementById('menu-toggle');
        const sidebar = document.getElementById('sidebar');

        if (window.innerWidth <= 576) {
            menuToggle.style.display = 'block';
            sidebar.classList.remove('open');
        } else {
            menuToggle.style.display = 'none';
            sidebar.classList.remove('open');
        }
    }

    setupNavigation() {
        // Navegación lateral
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const module = e.currentTarget.dataset.module;
                this.loadModule(module);

                // Cerrar sidebar en móvil
                if (window.innerWidth <= 576) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });

        // Navegación por tabs dentro de módulos
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-button')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
    }

    setupUpload() {
        const fileInput = document.getElementById('file-input');
        const selectedFile = document.getElementById('selected-file');
        const uploadBtn = document.getElementById('upload-btn');

        if (!fileInput || !uploadBtn) return;

        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                selectedFile.innerHTML = '<i class="fas fa-file"></i> ' + fileInput.files[0].name;
                uploadBtn.disabled = false;
            } else {
                selectedFile.innerHTML = '<i class="fas fa-file"></i> Ningún archivo seleccionado';
                uploadBtn.disabled = true;
            }
        });

        uploadBtn.addEventListener('click', () => this.uploadFile());
    }


    async loadModule(moduleName) {
        console.log('✅ Cargando módulo:', moduleName);

        // Actualizar navegación lateral
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.querySelector(`[data-module="${moduleName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Ocultar todos los módulos
        document.querySelectorAll('.module-container').forEach(module => {
            module.classList.remove('active');
        });

        // Mostrar módulo seleccionado
        const moduleElement = document.getElementById(`${moduleName}-module`);
        if (moduleElement) {
            moduleElement.classList.add('active');
        }

        // Actualizar el módulo actual
        this.currentModule = moduleName;

        // Actualizar controles del header
        this.updateHeaderControls(moduleName);
        this.updatePageTitle(moduleName);

        // ✅ CORREGIDO: Siempre inicializar el módulo si tiene datos
        if (moduleName !== 'inicio') {
            await this.initializeModule(moduleName);
        }

        // ✅ NUEVO: Cargar datos del tab Anual si es el módulo correcto
        if (moduleName === 'estado-resultados') {
            this.handleEstadoResultadosLoad();
        }
    }

    // ✅ AÑADE este nuevo método:
    async initializeModule(moduleName) {
        try {
            console.log(`🔄 Inicializando módulo: ${moduleName}`);

            if (moduleName === 'estado-resultados') {
                // Verificar si el módulo ya está inicializado
                if (!window.estadoResultadosModule) {
                    if (typeof EstadoResultadosModule !== 'undefined') {
                        window.estadoResultadosModule = new EstadoResultadosModule(this);
                        console.log('✅ EstadoResultadosModule inicializado');
                    } else {
                        console.error('❌ EstadoResultadosModule no definido');
                        return;
                    }
                }

                // Cargar años disponibles
                await this.loadAvailableYears();
            }
        } catch (error) {
            console.error('❌ Error inicializando módulo:', error);
        }
    }

    // ✅ AÑADE este método para manejar la carga de estado de resultados:
    handleEstadoResultadosLoad() {
        console.log('🔄 Manejando carga de estado de resultados');

        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
            const activeTab = document.querySelector('.tab-button.active');
            console.log('🔍 Tab activo detectado:', activeTab?.dataset.tab);

            if (activeTab && activeTab.dataset.tab === 'anual') {
                console.log('✅ Tab Anual activo, cargando datos...');
                this.loadDataForAnualTab();
            } else {
                console.log('ℹ️ Tab Anual no está activo');
            }
        }, 150);
    }



    updateHeaderControls(moduleName) {
        const headerControls = document.getElementById('header-controls');
        if (!headerControls) return;

        // Mostrar controles solo para módulos que los necesiten
        const needsControls = ['estado-resultados', 'balance-general', 'flujo-caja'].includes(moduleName);
        headerControls.style.display = needsControls ? 'flex' : 'none';

        // Si es estado de resultados, cargar años disponibles
        if (moduleName === 'estado-resultados') {
            this.loadAvailableYears();
        }
    }


    async loadAvailableYears() {
        try {
            console.log('🔄 Cargando años disponibles para selector global');
            const response = await fetch(`/api/Finance/anios-disponibles?userId=${this.userId}`);

            if (response.ok) {
                const years = await response.json();
                console.log('✅ Años disponibles:', years);
                this.populateYearSelect(years);

                // ✅ MEJORADO: Cargar datos inmediatamente si estamos en el tab Anual
                if (years && years.length > 0 && this.currentModule === 'estado-resultados') {
                    const latestYear = Math.max(...years);

                    // Verificar si el tab Anual está activo
                    const activeTab = document.querySelector('.tab-button.active');
                    if (activeTab && activeTab.dataset.tab === 'anual') {
                        console.log('✅ Tab Anual activo, cargando datos automáticamente para año:', latestYear);
                        this.loadDataForAnualTab();
                    } else {
                        console.log('ℹ️ Tab Anual no está activo, no se cargan datos automáticamente');
                    }
                }
            } else {
                console.error('❌ Error en la respuesta de años disponibles:', response.status);
            }
        } catch (error) {
            console.error('❌ Error cargando años:', error);
        }
    }


    async loadEstadoResultadosData(year) {
        if (window.estadoResultadosModule) {
            console.log('✅ Cargando datos para año:', year);
            await window.estadoResultadosModule.loadAnualData(year);
        } else {
            console.error('❌ estadoResultadosModule no disponible');
        }
    }

    // ✅ CORREGIDO: Cambiado de populateGlobalYearSelect a populateYearSelect
    populateYearSelect(years) {
        // ✅ CORREGIDO: Usar 'year-select' en lugar de 'global-year-select'
        const yearSelect = document.getElementById('year-select');
        if (!yearSelect) {
            console.error('❌ year-select no encontrado');

            // Debug: mostrar todos los elementos disponibles
            console.log('🔍 Elementos en header-controls:');
            const headerControls = document.getElementById('header-controls');
            if (headerControls) {
                console.log('Contenido de header-controls:', headerControls.innerHTML);
            }
            return;
        }

        yearSelect.innerHTML = '';

        if (years && years.length > 0) {
            console.log('✅ Poblando selector con años:', years);

            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            });

            const latestYear = Math.max(...years);
            yearSelect.value = latestYear;
            console.log('✅ Año seleccionado por defecto:', latestYear);

        } else {
            console.log('⚠️ No hay años disponibles');
            yearSelect.innerHTML = '<option value="">No hay datos disponibles</option>';
        }
    }

    // ✅ CORREGIDO: Un solo método setupGlobalControls (eliminado el duplicado)
    setupGlobalControls() {
        console.log('🔄 Configurando controles globales...');

        // ✅ CORREGIDO: Usar 'year-select' en lugar de 'global-year-select'
        const yearSelect = document.getElementById('year-select');

        if (yearSelect) {
            yearSelect.addEventListener('change', () => {
                const selectedYear = yearSelect.value;
                console.log('✅ Año seleccionado:', selectedYear);

                if (selectedYear && this.currentModule === 'estado-resultados') {
                    if (window.estadoResultadosModule) {
                        window.estadoResultadosModule.loadAnualData(selectedYear);
                    } else {
                        console.error('❌ estadoResultadosModule no disponible');
                    }
                }
            });
        } else {
            console.error('❌ year-select no encontrado en setupGlobalControls');
        }

        // ✅ CORREGIDO: Buscar el botón correcto (puede que no exista en tu HTML)
        const refreshBtn = document.getElementById('global-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('✅ Botón actualizar clickeado');
                if (this.currentModule === 'estado-resultados') {
                    const selectedYear = document.getElementById('year-select')?.value;
                    if (selectedYear && window.estadoResultadosModule) {
                        window.estadoResultadosModule.loadAnualData(selectedYear);
                    }
                }
            });
        } else {
            console.log('ℹ️ global-refresh-btn no encontrado, creando dinámicamente...');
            this.createRefreshButton();
        }
    }

    createRefreshButton() {
        const headerControls = document.getElementById('header-controls');
        if (!headerControls) return;

        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'global-refresh-btn';
        refreshBtn.className = 'btn-secondary';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Actualizar';

        refreshBtn.addEventListener('click', () => {
            console.log('✅ Botón actualizar clickeado');
            if (this.currentModule === 'estado-resultados') {
                const selectedYear = document.getElementById('year-select')?.value;
                if (selectedYear && window.estadoResultadosModule) {
                    window.estadoResultadosModule.loadAnualData(selectedYear);
                }
            }
        });

        headerControls.appendChild(refreshBtn);
        console.log('✅ Botón de actualizar creado dinámicamente');
    }

    updatePageTitle(moduleName) {
        const titles = {
            'inicio': 'DataSmart Finance - Inicio',
            'estado-resultados': 'Estado de Resultados',
            'balance-general': 'Balance General',
            'flujo-caja': 'Flujo de Caja',
            'kpis': 'KPIs Financieros',
            'presupuesto': 'Presupuesto',
            'configuracion': 'Configuración'
        };

        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[moduleName] || 'DataSmart Finance';
        }
    }

    // ✅ CORRIGE el método switchTab:
    switchTab(tabName) {
        console.log('✅ Cambiando tab:', tabName);
        console.log('📊 Módulo actual:', this.currentModule);

        // Ocultar todos los tabs del módulo activo
        const activeModule = document.querySelector('.module-container.active');
        if (!activeModule) {
            console.error('❌ No se encontró módulo activo');
            return;
        }

        activeModule.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        activeModule.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Mostrar tab seleccionado
        const activeTab = document.getElementById(`${tabName}-tab`);
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);

        if (activeTab) {
            activeTab.classList.add('active');
            console.log('✅ Tab pane activado:', activeTab.id);
        }
        if (activeButton) {
            activeButton.classList.add('active');
            console.log('✅ Botón tab activado:', activeButton.dataset.tab);
        }

        // ✅ MEJORADO: Verificación más robusta
        if (tabName === 'anual' && this.currentModule === 'estado-resultados') {
            console.log('🔄 Cambio al tab Anual detectado, verificando módulo...');

            if (window.estadoResultadosModule) {
                console.log('✅ Módulo disponible, cargando datos...');
                this.loadDataForAnualTab();
            } else {
                console.log('🔄 Módulo no disponible, reintentando en 200ms...');
                setTimeout(() => {
                    if (window.estadoResultadosModule) {
                        this.loadDataForAnualTab();
                    } else {
                        console.error('❌ Módulo aún no disponible después de timeout');
                    }
                }, 200);
            }
        }
    }

    // ✅ MEJORA el método loadDataForAnualTab:
    loadDataForAnualTab() {
        console.log('🔄 loadDataForAnualTab() ejecutándose...');

        const yearSelect = document.getElementById('year-select');
        if (!yearSelect) {
            console.error('❌ year-select no encontrado');

            // Reintentar después de un breve delay
            setTimeout(() => {
                const retrySelect = document.getElementById('year-select');
                if (retrySelect) {
                    console.log('✅ year-select encontrado en reintento');
                    this.loadDataForAnualTab();
                }
            }, 100);
            return;
        }

        const selectedYear = yearSelect.value;
        console.log('✅ Año seleccionado:', selectedYear);

        if (!selectedYear || selectedYear === '') {
            console.log('ℹ️ No hay año seleccionado o está vacío');
            return;
        }

        if (window.estadoResultadosModule && typeof window.estadoResultadosModule.loadAnualData === 'function') {
            console.log('✅ Llamando a loadAnualData con año:', selectedYear);
            window.estadoResultadosModule.loadAnualData(selectedYear);
        } else {
            console.error('❌ estadoResultadosModule o loadAnualData no disponible');
        }
    }


    async uploadFile() {
        console.log('✅ Iniciando uploadFile...');

        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-btn');
        const processingSection = document.getElementById('processing-section');

        if (!fileInput || fileInput.files.length === 0) {
            this.mostrarError('Por favor selecciona un archivo primero');
            return;
        }

        // Mostrar procesamiento
        document.querySelector('.upload-container').style.display = 'none';
        processingSection.style.display = 'block';
        uploadBtn.disabled = true;

        const formData = new FormData();
        formData.append('ArchivoExcel', fileInput.files[0]);

        try {
            console.log('✅ Enviando archivo a la API con userId:', this.userId);

            const response = await fetch(`/api/Finance/upload?userId=${this.userId}`, {
                method: 'POST',
                body: formData
            });

            console.log('✅ Respuesta recibida. Status:', response.status);

            if (response.ok) {
                const result = await response.json();
                this.currentData = result;

                processingSection.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <i class="fas fa-check-circle" style="font-size: 50px; color: var(--success-color);"></i>
                        <h3>${result.message || 'Archivo procesado correctamente'}</h3>
                        <p>Registros procesados: ${result.totalMovimientos}</p>
                        <p>Clasificaciones: ${result.totalClasificaciones}</p>
                        <p>Redirigiendo al Estado de Resultados...</p>
                    </div>
                `;

                setTimeout(() => {
                    console.log('✅ Redirigiendo a Estado de Resultados via SPA');
                    this.loadModule('estado-resultados');
                    this.resetUploadInterface();
                }, 2000);

            } else {
                const errorText = await response.text();
                console.error('❌ Error del servidor:', errorText);
                this.mostrarError('Error del servidor: ' + errorText);
                this.resetUploadInterface();
            }
        } catch (error) {
            console.error('❌ Error de conexión:', error);
            this.mostrarError('Error de conexión: ' + error.message);
            this.resetUploadInterface();
        }
    }

    resetUploadInterface() {
        document.querySelector('.upload-container').style.display = 'block';
        document.getElementById('processing-section').style.display = 'none';
        document.getElementById('upload-btn').disabled = false;
    }

    getUserId() {
        let userId = localStorage.getItem('datasmart_userId');
        if (!userId) {
            userId = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('datasmart_userId', userId);
            console.log('✅ Nuevo userId generado:', userId);
        }
        return userId;
    }

    displayUserId() {
        const userId = this.userId;
        const userInfo = document.querySelector('.user-info');
        if (userInfo) {
            const existingId = userInfo.querySelector('.user-id');
            if (!existingId) {
                userInfo.innerHTML += `<div class="user-id" style="font-size: 10px; color: #666;">ID: ${userId.substr(0, 8)}...</div>`;
            }
        }
    }

    mostrarError(mensaje) {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = mensaje;
            errorDiv.style.display = 'block';
            setTimeout(() => errorDiv.style.display = 'none', 5000);
        }
    }

    async loadModuleData(moduleName) {
        try {
            console.log(`✅ Cargando datos para: ${moduleName}`);

            if (moduleName === 'estado-resultados') {
                if (typeof EstadoResultadosModule !== 'undefined') {
                    window.estadoResultadosModule = new EstadoResultadosModule(this);
                    console.log('✅ EstadoResultadosModule inicializado correctamente');

                    // Cargar años disponibles después de inicializar el módulo
                    setTimeout(() => {
                        this.loadAvailableYears();
                    }, 100);
                } else {
                    console.error('❌ EstadoResultadosModule no definido');
                }
            }
        } catch (error) {
            console.error('❌ Error cargando datos del módulo:', error);
        }
    }
}



// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM cargado, iniciando DataSmartApp...');
    const saved = localStorage.getItem('ds_theme') || 'corporate';
    document.body.setAttribute('data-theme', saved);
    window.dataSmartApp = new DataSmartApp();
});


console.log('🔧 Configurando debug para tabs...');

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-button')) {
        console.log('🎯 Click en tab-button detectado:', e.target.dataset.tab);
        console.log('📊 currentModule:', window.dataSmartApp?.currentModule);
        console.log('🔧 estadoResultadosModule disponible:', !!window.estadoResultadosModule);
    }
});

// Override temporal para debug
const originalSwitchTab = DataSmartApp.prototype.switchTab;
DataSmartApp.prototype.switchTab = function (tabName) {
    console.log('🎯 SWITCH TAB INTERCEPTADO:', tabName);
    console.log('currentModule:', this.currentModule);
    return originalSwitchTab.call(this, tabName);
};



<script>
  // ============ THEME ENGINE (simple, con localStorage) ============
    function setTheme(name) {
    const html = document.documentElement;
    if (!name || name === 'light') html.removeAttribute('data-theme');
    else html.setAttribute('data-theme', name);
    try {localStorage.setItem('ds.theme', name || 'light'); } catch (e) { }
  }

    (function initTheme() {
        let saved = 'light';
    try {saved = localStorage.getItem('ds.theme') || 'light'; } catch (e) { }
    setTheme(saved);
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = saved;
  })();

  document.addEventListener('DOMContentLoaded', () => {
    const sel = document.getElementById('theme-select');
    const saveBtn = document.getElementById('save-theme');
    const badge = document.getElementById('theme-status');

    if (sel) {
        // vista previa inmediata
        sel.addEventListener('change', (e) => setTheme(e.target.value));
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            // Si luego quieres persistir al backend, descomenta este fetch:
            // await fetch(`/api/Users/preferences/theme?userId=${encodeURIComponent(window.app?.userId || '')}`, {
            //   method: 'POST', headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ theme: document.getElementById('theme-select')?.value || 'light' })
            // });
            if (badge) { badge.style.display = 'inline-block'; setTimeout(() => badge.style.display = 'none', 1200); }
        });
    }
  });
</script>
