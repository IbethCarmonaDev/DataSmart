using ClosedXML.Excel;
using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using DocumentFormat.OpenXml.Spreadsheet;
using Microsoft.Extensions.Logging;
using System.Globalization;
using DataSmart.Core.Utils;

namespace DataSmart.Core.Services;



public class ExcelService : IExcelService
{
    private readonly ILogger<ExcelService> _logger;
    private readonly IGrupoMaestroRepository _grupoRepo;
    private readonly IExcelDataService _excelDataService;


    public ExcelService(
        ILogger<ExcelService> logger,
        IGrupoMaestroRepository grupoRepo,
        IExcelDataService excelDataService) // ← Inyectar el nuevo servicio
    {
        _logger = logger;
        _grupoRepo = grupoRepo;
        _excelDataService = excelDataService;
    }


    public async Task<ProcesamientoExcelResult> ProcesarArchivoAsync(string filePath, string userId)
    {
        try
        {
            _logger.LogInformation($"Iniciando procesamiento del archivo para usuario {userId}: {filePath}");

            using (var workbook = new XLWorkbook(filePath))
            {
                // 1. Verificar hojas
                if (!workbook.Worksheets.Any(ws => ws.Name == "DATOS_FINANCIEROS"))
                    throw new Exception("El archivo no contiene la hoja 'DATOS_FINANCIEROS'");

                if (!workbook.Worksheets.Any(ws => ws.Name == "CLASIFICACION_CUENTAS"))
                    throw new Exception("El archivo no contiene la hoja 'CLASIFICACION_CUENTAS'");

                // ✅ 2. OBTENER ORDEN DE GRUPOS DESDE LA BASE DE DATOS
                var ordenGruposDesdeBD = await _excelDataService.ObtenerOrdenGruposDesdeBDAsync();

                // 3. Leer hojas
                var clasificacionCuentas = LeerHojaClasificacionCuentas(workbook);
                var datosFinancieros = LeerHojaDatosFinancieros(workbook, userId);

                // ✅ 4. PASAR EL ORDEN CORRECTO AL MÉTODO
                var resultados = ClasificarYCalcularMovimientos(
                    datosFinancieros,
                    clasificacionCuentas,
                    userId,
                    ordenGruposDesdeBD);

                // 6. Guardar en base de datos
                await _excelDataService.GuardarMovimientosContablesAsync(datosFinancieros);
                await _excelDataService.GuardarDatosProcesadosAsync(resultados);

                _logger.LogInformation($"Procesamiento completo para usuario {userId}. Generados {resultados.Count} totales de grupo.");

                return new ProcesamientoExcelResult
                {
                    Exito = true,
                    Mensaje = "Archivo procesado exitosamente. Estado de Resultados calculado.",
                    TotalClasificaciones = clasificacionCuentas.Count,
                    TotalMovimientos = datosFinancieros.Count,
                    Resultados = resultados
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error procesando el archivo Excel para usuario {userId}", userId);
            return new ProcesamientoExcelResult
            {
                Exito = false,
                Mensaje = $"Error: {ex.Message}"
            };
        }
    }

    //private List<ClasificacionCuenta> LeerHojaClasificacionCuentas(XLWorkbook workbook)
    //{
    //    var lista = new List<ClasificacionCuenta>();
    //    var worksheet = workbook.Worksheet("CLASIFICACION_CUENTAS");

    //    if (worksheet == null) return lista;

    //    var firstRowUsed = worksheet.FirstRowUsed();
    //    var row = firstRowUsed.RowBelow();

    //    while (!row.Cell(1).IsEmpty())
    //    {
    //        var clasificacion = new ClasificacionCuenta
    //        {
    //            Prefijo = row.Cell(1).GetString(),
    //            Grupo = row.Cell(2).GetString(),
    //            NaturalezaContable = row.Cell(3).GetString(),
    //            Nivel = row.Cell(4).GetString()
    //        };

    //        lista.Add(clasificacion);
    //        row = row.RowBelow();
    //    }

    //    return lista;
    //}


    private List<ClasificacionCuenta> LeerHojaClasificacionCuentas(XLWorkbook workbook)
    {
        var lista = new List<ClasificacionCuenta>();
        var worksheet = workbook.Worksheet("CLASIFICACION_CUENTAS");

        if (worksheet == null) return lista;

        var firstRowUsed = worksheet.FirstRowUsed();
        var row = firstRowUsed.RowBelow();

        int ordenActual = 1;

        while (!row.Cell(1).IsEmpty())
        {
            var clasificacion = new ClasificacionCuenta
            {
                Prefijo = row.Cell(1).GetString(),
                Grupo = row.Cell(2).GetString(),
                NaturalezaContable = row.Cell(3).GetString(),
                Nivel = row.Cell(4).GetString(), // ← El nombre que el usuario puso
                OrdenNivel = ordenActual // ← El orden que calculamos
            };

            lista.Add(clasificacion);
            row = row.RowBelow();
            ordenActual++;
        }

        return lista;
    }

    private List<MovimientoContable> LeerHojaDatosFinancieros(XLWorkbook workbook, string userId)
    {
        var lista = new List<MovimientoContable>();
        var worksheet = workbook.Worksheet("DATOS_FINANCIEROS");

        if (worksheet == null) return lista;

        var firstRowUsed = worksheet.FirstRowUsed();
        var row = firstRowUsed.RowBelow();

        while (!row.Cell(1).IsEmpty())
        {
            var movimiento = new MovimientoContable
            {
                UserId = userId, // ← ASIGNAR USERID DIRECTAMENTE AQUÍ
                Ano = row.Cell(1).GetValue<int>(),
                Mes = row.Cell(2).GetValue<int>(),
                CodCuenta = row.Cell(3).GetString(),
                Cuenta = row.Cell(4).GetString(),
                CodCC = row.Cell(5).GetString(),
                CentroCostos = row.Cell(6).GetString(),
                Debito = row.Cell(7).GetValue<decimal>(),
                Credito = row.Cell(8).GetValue<decimal>()
            };

            lista.Add(movimiento);
            row = row.RowBelow();
        }

        return lista;
    }



    //private List<ResultadoGrupo> ClasificarYCalcularMovimientos(
    //    List<MovimientoContable> movimientos,
    //    List<ClasificacionCuenta> clasificaciones,
    //    string userId,
    //    Dictionary<string, int> ordenGruposDesdeBD)
    //{
    //    var resultados = new List<ResultadoGrupo>();

    //    // ✅ 1. AGRUPAR MOVIMIENTOS POR CUENTA, MES Y AÑO
    //    var movimientosAgrupados = movimientos
    //        .GroupBy(m => new { m.CodCuenta, m.Mes, m.Ano })
    //        .ToList();

    //    foreach (var grupoMovimientos in movimientosAgrupados)
    //    {
    //        var primerMovimiento = grupoMovimientos.First();
    //        var codCuenta = primerMovimiento.CodCuenta;

    //        // ✅ 2. ENCONTRAR CLASIFICACIÓN PARA ESTA CUENTA
    //        var clasificacion = clasificaciones.FirstOrDefault(c =>
    //            MovimientoCoincideConPrefijo(codCuenta, c.Prefijo));

    //        if (clasificacion != null)
    //        {
    //            // ✅ 3. CALCULAR SALDO TOTAL
    //            decimal totalDebito = grupoMovimientos.Sum(m => m.Debito);
    //            decimal totalCredito = grupoMovimientos.Sum(m => m.Credito);

    //            decimal saldo = clasificacion.NaturalezaContable == "DEBITO"
    //                ? totalDebito - totalCredito
    //                : totalCredito - totalDebito;

    //            // ✅ 4. NORMALIZAR EL NOMBRE DEL GRUPO PARA BUSCAR EN EL ORDEN
    //            var grupoNormalizado = StringUtils.NormalizarNombreGrupo(clasificacion.Grupo);

    //            // ✅ 5. OBTENER ORDEN DEL GRUPO DESDE LA BD (USANDO NOMBRE NORMALIZADO)
    //            int ordenGrupo = ordenGruposDesdeBD.TryGetValue(grupoNormalizado, out int ord)
    //                ? ord
    //                : 999;

    //            // ✅ 6. OBTENER NOMBRE VISIBLE DESDE LA BD SI EXISTE
    //            string nombreVisible = ObtenerNombreVisible(grupoNormalizado, ordenGruposDesdeBD);

    //            // ✅ 7. CREAR RESULTADO
    //            resultados.Add(new ResultadoGrupo
    //            {
    //                UserId = userId,
    //                Grupo = clasificacion.Grupo,
    //                NombreVisible = nombreVisible, // ← USAR NOMBRE VISIBLE
    //                CodCuenta = codCuenta,
    //                Cuenta = primerMovimiento.Cuenta,
    //                Nivel = clasificacion.Nivel,
    //                Mes = primerMovimiento.Mes,
    //                Ano = primerMovimiento.Ano,
    //                Total = saldo,
    //                Naturaleza = clasificacion.NaturalezaContable,
    //                OrdenGrupo = ordenGrupo,
    //                OrdenNivel = ObtenerOrdenNivel(clasificacion.Nivel)
    //            });
    //        }
    //    }

    //    // ✅ 8. ORDENAR RESULTADOS SEGÚN ORDEN DE LA BD
    //    return resultados
    //        .OrderBy(r => r.OrdenGrupo)
    //        .ThenBy(r => r.OrdenNivel)
    //        .ThenBy(r => r.CodCuenta)
    //        .ThenBy(r => r.Mes)
    //        .ThenBy(r => r.Ano)
    //        .ToList();
    //}

    private List<ResultadoGrupo> ClasificarYCalcularMovimientos(
        List<MovimientoContable> movimientos,
        List<ClasificacionCuenta> clasificaciones,
        string userId,
        Dictionary<string, int> ordenGruposDesdeBD)
    {
        var resultados = new List<ResultadoGrupo>();

        // ✅ 1. AGRUPAR MOVIMIENTOS POR CUENTA, MES Y AÑO
        var movimientosAgrupados = movimientos
            .GroupBy(m => new { m.CodCuenta, m.Mes, m.Ano })
            .ToList();

        foreach (var grupoMovimientos in movimientosAgrupados)
        {
            var primerMovimiento = grupoMovimientos.First();
            var codCuenta = primerMovimiento.CodCuenta;

            // ✅ 2. ENCONTRAR CLASIFICACIÓN PARA ESTA CUENTA
            var clasificacion = clasificaciones.FirstOrDefault(c =>
                MovimientoCoincideConPrefijo(codCuenta, c.Prefijo));

            if (clasificacion != null)
            {
                // ✅ 3. CALCULAR SALDO TOTAL
                decimal totalDebito = grupoMovimientos.Sum(m => m.Debito);
                decimal totalCredito = grupoMovimientos.Sum(m => m.Credito);

                decimal saldo = clasificacion.NaturalezaContable == "DEBITO"
                    ? totalDebito - totalCredito
                    : totalCredito - totalDebito;

                // ✅ 4. NORMALIZAR EL NOMBRE DEL GRUPO PARA BUSCAR EN EL ORDEN
                var grupoNormalizado = StringUtils.NormalizarNombreGrupo(clasificacion.Grupo);

                // ✅ 5. OBTENER ORDEN DEL GRUPO DESDE LA BD (USANDO NOMBRE NORMALIZADO)
                int ordenGrupo = ordenGruposDesdeBD.TryGetValue(grupoNormalizado, out int ord)
                    ? ord
                    : 999;

                // ✅ 6. OBTENER NOMBRE VISIBLE DESDE LA BD SI EXISTE
                string nombreVisible = ObtenerNombreVisible(grupoNormalizado, ordenGruposDesdeBD);

                // ✅ 7. CREAR RESULTADO CON LA INFORMACIÓN CORRECTA DEL NIVEL
                resultados.Add(new ResultadoGrupo
                {
                    UserId = userId,
                    Grupo = clasificacion.Grupo,
                    NombreVisible = nombreVisible,
                    CodCuenta = codCuenta,
                    Cuenta = primerMovimiento.Cuenta,
                    Nivel = clasificacion.Nivel,
                    Mes = primerMovimiento.Mes,
                    Ano = primerMovimiento.Ano,
                    Total = saldo,
                    Naturaleza = clasificacion.NaturalezaContable,
                    OrdenGrupo = ordenGrupo,
                    OrdenNivel = clasificacion.OrdenNivel // ← Usar el orden de la clasificación
                });
            }
        }

        // ✅ 8. ORDENAR RESULTADOS SEGÚN ORDEN DE LA BD
        return resultados
            .OrderBy(r => r.OrdenGrupo)
            .ThenBy(r => r.OrdenNivel) // ← Ahora esto funcionará correctamente
            .ThenBy(r => r.CodCuenta)
            .ThenBy(r => r.Mes)
            .ThenBy(r => r.Ano)
            .ToList();
    }





    // ✅ MÉTODO PARA OBTENER NOMBRE VISIBLE DESDE BD
    private string ObtenerNombreVisible(string grupoNormalizado, Dictionary<string, int> ordenGrupos)
    {
        // Aquí podrías implementar lógica más compleja si necesitas
        // Por ahora, devolvemos el mismo nombre normalizado
        return grupoNormalizado;
    }


    //// ✅ MÉTODO AUXILIAR PARA ORDENAR NIVELES
    //private int ObtenerOrdenNivel(string nivel)
    //{
    //    if (string.IsNullOrEmpty(nivel)) return 999;

    //    var ordenNiveles = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    //{
    //    {"GRUPO", 1},
    //    {"NIVEL1", 2},
    //    {"NIVEL2", 3},
    //    {"NIVEL3", 4},
    //    {"NIVEL4", 5},
    //    {"CUENTA", 6}
    //};

    //    return ordenNiveles.TryGetValue(nivel, out int orden) ? orden : 999;
    //}


    private bool MovimientoCoincideConPrefijo(string codigoCuenta, string prefijo)
    {
        return codigoCuenta.StartsWith(prefijo);
    }

    public async Task<ReporteEstadoResultados> FormatearReporte(List<ResultadoGrupo> resultados, int ano, int mes)
    {
        var reporte = new ReporteEstadoResultados
        {
            Ano = ano,
            Mes = mes,
            Lineas = new List<LineaReporte>()
        };

        try
        {
            var ordenGrupos = await _grupoRepo.ObtenerOrdenGruposAsync();
            var resultadosFiltrados = resultados.Where(r => r.Ano == ano && r.Mes == mes).ToList();

            var grupos = resultadosFiltrados
                .GroupBy(r => r.Grupo)
                .OrderBy(g => ordenGrupos.TryGetValue(g.Key, out int order) ? order : 99)
                .ToList();

            int orden = 1;
            foreach (var grupo in grupos)
            {
                reporte.Lineas.Add(new LineaReporte
                {
                    Tipo = "GRUPO",
                    Codigo = grupo.Key,
                    Descripcion = grupo.First().NombreVisible,
                    Total = grupo.Sum(x => x.Total),
                    Orden = orden++,
                    EsTotal = false
                });

                foreach (var cuenta in grupo.OrderBy(x => x.CodCuenta))
                {
                    reporte.Lineas.Add(new LineaReporte
                    {
                        Tipo = "CUENTA",
                        Codigo = cuenta.CodCuenta,
                        Descripcion = cuenta.Cuenta,
                        Nivel = cuenta.Nivel,
                        Total = cuenta.Total,
                        Orden = orden++,
                        EsTotal = false
                    });
                }

                reporte.Lineas.Add(new LineaReporte
                {
                    Tipo = "SEPARADOR",
                    Descripcion = "",
                    Total = 0,
                    Orden = orden++,
                    EsTotal = false
                });
            }

            reporte.TotalIngresos = resultadosFiltrados
                .Where(r => r.Naturaleza == "CREDITO")
                .Sum(r => r.Total);

            reporte.TotalGastos = resultadosFiltrados
                .Where(r => r.Naturaleza == "DEBITO")
                .Sum(r => r.Total);

            reporte.ResultadoNeto = reporte.TotalIngresos - reporte.TotalGastos;

            reporte.Lineas.Add(new LineaReporte
            {
                Tipo = "TOTAL",
                Descripcion = "UTILIDAD ANTES DE IMPUESTOS",
                Total = reporte.ResultadoNeto,
                Orden = orden++,
                EsTotal = true
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error formateando el reporte");
            throw;
        }

        return reporte;
    }


    public async Task<EstadoResultados> GenerarEstadoResultados(int año, int mes, string tipo, string userId)
    {
        try
        {
            if (string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("UserId es requerido");
            }

            var estadoResultados = new EstadoResultados();

            // ✅ USAR EL SERVICIO DE DATOS CON USERID
            estadoResultados.TotalesPorGrupo = await _excelDataService.CalcularTotalesPorGrupoAsync(año, mes, userId);
            estadoResultados.KPIs = await CalcularKPIs(estadoResultados.TotalesPorGrupo, userId);

            estadoResultados.Periodo = $"{tipo} - {año}";
            estadoResultados.Detalles = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, mes, userId);
            estadoResultados.UserId = userId; // ← Agregar userId al objeto de respuesta

            _logger.LogInformation($"Estado de resultados generado para usuario: {userId}, período: {estadoResultados.Periodo}");

            return estadoResultados;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado de resultados para usuario: {userId}", userId);
            throw;
        }
    }


    public async Task<Dictionary<string, decimal>> CalcularKPIsFinancieros(int año)
    {
        var kpis = new Dictionary<string, decimal>();

        // Usar el nuevo servicio
        var totales = await _excelDataService.CalcularTotalesPorGrupoAsync(año);

        // Lógica de cálculo de KPIs (ejemplo)
        if (totales.ContainsKey("VENTAS") && totales.ContainsKey("COSTO_MERCANCIA_VENDIDA"))
        {
            kpis.Add("MARGEN_BRUTO", totales["VENTAS"] - totales["COSTO_MERCANCIA_VENDIDA"]);
            kpis.Add("MARGEN_BRUTO_PORCENTAJE", totales["VENTAS"] > 0 ?
                (totales["VENTAS"] - totales["COSTO_MERCANCIA_VENDIDA"]) / totales["VENTAS"] * 100 : 0);
        }

        return kpis;
    }



    private async Task<Dictionary<string, decimal>> CalcularKPIs(Dictionary<string, decimal> totales, string userId = null)
    {
        var kpis = new Dictionary<string, decimal>();

        // Lógica para calcular KPIs basados en los totales
        if (totales.ContainsKey("VENTAS") && totales.ContainsKey("COSTO MERCANCIA VENDIDA"))
        {
            kpis.Add("MARGEN_BRUTO", totales["VENTAS"] - totales["COSTO MERCANCIA VENDIDA"]);

            if (totales["VENTAS"] > 0)
            {
                kpis.Add("MARGEN_BRUTO_%", (totales["VENTAS"] - totales["COSTO MERCANCIA VENDIDA"]) / totales["VENTAS"] * 100);
            }
            else
            {
                kpis.Add("MARGEN_BRUTO_%", 0);
            }
        }

        return kpis;
    }

    public async Task<object> GenerarEstadoPorPeriodo(int año, int mes, string tipoPeriodo, string userId)
    {
        try
        {
            if (string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("UserId es requerido");
            }

            // ✅ USAR EL SERVICIO DE DATOS PARA VERIFICAR SI HAY DATOS CON USERID
            var existenDatos = await _excelDataService.ExistenDatosParaPeriodoAsync(año, mes, userId);

            if (!existenDatos)
            {
                throw new Exception($"No hay datos disponibles para el período solicitado para el usuario: {userId}");
            }

            return tipoPeriodo.ToLower() switch
            {
                "mensual" => await GenerarEstadoMensual(año, mes, userId),
                "trimestral" => await GenerarEstadoTrimestral(año, mes, userId),
                _ => await GenerarEstadoAnual(año, userId)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado por período para usuario: {userId}", userId);
            throw;
        }
    }






    //public async Task<object> GenerarEstadoAnual(int año, string userId)
    //{
    //    try
    //    {
    //        // 1. Obtener todos los datos del año
    //        var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, 0, userId);

    //        // 2. Agrupar por Grupo, Nivel y Cuenta usando el OrdenGrupo que ya viene en los datos
    //        var gruposConDetalles = datos
    //            .GroupBy(r => r.Grupo)
    //            .OrderBy(g => g.First().OrdenGrupo)
    //            .Select(grupo => new
    //            {
    //                Grupo = grupo.Key,
    //                NombreGrupo = grupo.First().NombreVisible,
    //                OrdenGrupo = grupo.First().OrdenGrupo,

    //                // Detalles por nivel dentro del grupo - MANTENER ESTRUCTURA ORIGINAL
    //                Niveles = grupo.GroupBy(r => r.Nivel)
    //                    .OrderBy(n => n.First().OrdenNivel) // ← CORRECCIÓN: Ordenar por OrdenNivel
    //                    .Select(nivel => new
    //                    {
    //                        Nivel = nivel.Key,
    //                        OrdenNivel = nivel.First().OrdenNivel, // ← Agregar para referencia

    //                        // Detalles por cuenta dentro del nivel
    //                        Cuentas = nivel.GroupBy(c => new { c.CodCuenta, c.Cuenta })
    //                            .OrderBy(c => c.Key.CodCuenta)
    //                            .Select(cuenta => new
    //                            {
    //                                CodCuenta = cuenta.Key.CodCuenta,
    //                                NombreCuenta = cuenta.Key.Cuenta,

    //                                // Totales por mes
    //                                TotalesPorMes = cuenta.GroupBy(x => x.Mes)
    //                                    .ToDictionary(m => m.Key, m => m.Sum(x => x.Total)),

    //                                TotalAnual = cuenta.Sum(x => x.Total)
    //                            }).ToList(),

    //                        TotalAnualNivel = nivel.Sum(x => x.Total)
    //                    }).ToList(),

    //                // Totales por mes para el grupo completo
    //                TotalesPorMes = grupo.GroupBy(x => x.Mes)
    //                    .ToDictionary(m => m.Key, m => m.Sum(x => x.Total)),

    //                TotalAnualGrupo = grupo.Sum(x => x.Total)
    //            }).ToList();

    //        // 3. Calcular totales por mes para toda la empresa
    //        var totalesPorMes = new Dictionary<int, decimal>();
    //        for (int mes = 1; mes <= 12; mes++)
    //        {
    //            totalesPorMes[mes] = datos.Where(d => d.Mes == mes).Sum(d => d.Total);
    //        }

    //        // 4. Calcular KPIs anuales
    //        var kpisAnuales = await CalcularKPIsAnuales(datos);

    //        return new
    //        {
    //            Ano = año,
    //            Tipo = "ANUAL",
    //            Estructura = gruposConDetalles,
    //            TotalesPorMes = totalesPorMes,
    //            TotalAnual = datos.Sum(d => d.Total),
    //            KPIs = kpisAnuales,
    //            Meses = Enumerable.Range(1, 12).Select(m => new
    //            {
    //                Numero = m,
    //                Nombre = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(m)
    //            }).ToList()
    //        };
    //    }
    //    catch (Exception ex)
    //    {
    //        _logger.LogError(ex, "Error generando estado anual para usuario: {userId}", userId);
    //        throw;
    //    }
    //}


    public async Task<object> GenerarEstadoAnual(int año, string userId)
    {
        try
        {
            // 1. Obtener todos los datos del año
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, 0, userId);

            // 2. Agrupar por Grupo, Nivel y Cuenta usando el OrdenGrupo que ya viene en los datos
            var gruposConDetalles = datos
                .GroupBy(r => r.Grupo)
                .OrderBy(g => g.First().OrdenGrupo)
                .Select(grupo => new
                {
                    Grupo = grupo.Key,
                    NombreGrupo = grupo.First().NombreVisible,
                    OrdenGrupo = grupo.First().OrdenGrupo,

                    // Detalles por nivel dentro del grupo
                    Niveles = grupo.GroupBy(r => r.Nivel)
                        .OrderBy(n => n.First().OrdenNivel)
                        .Select(nivel => new
                        {
                            Nivel = nivel.Key,
                            OrdenNivel = nivel.First().OrdenNivel,

                            // Detalles por cuenta dentro del nivel
                            Cuentas = nivel.GroupBy(c => new { c.CodCuenta, c.Cuenta })
                                .OrderBy(c => c.Key.CodCuenta)
                                .Select(cuenta => new
                                {
                                    CodCuenta = cuenta.Key.CodCuenta,
                                    NombreCuenta = cuenta.Key.Cuenta,

                                    // Totales por mes
                                    TotalesPorMes = cuenta.GroupBy(x => x.Mes)
                                        .ToDictionary(m => m.Key, m => m.Sum(x => x.Total)),

                                    TotalAnual = cuenta.Sum(x => x.Total)
                                }).ToList(),

                            // ✅ CORRECCIÓN: Calcular el total del nivel SUMANDO LAS CUENTAS, no los registros originales
                            TotalAnualNivel = nivel.GroupBy(c => new { c.CodCuenta, c.Cuenta })
                                                .Sum(cuenta => cuenta.Sum(x => x.Total)),

                            // ✅ También corregir los totales por mes del nivel
                            TotalesPorMes = nivel.GroupBy(x => x.Mes)
                                              .ToDictionary(m => m.Key,
                                                           m => m.GroupBy(c => new { c.CodCuenta, c.Cuenta })
                                                                 .Sum(cuenta => cuenta.Sum(x => x.Total)))
                        }).ToList(),

                    // Totales por mes para el grupo completo
                    TotalesPorMes = grupo.GroupBy(x => x.Mes)
                        .ToDictionary(m => m.Key, m => m.Sum(x => x.Total)),

                    TotalAnualGrupo = grupo.Sum(x => x.Total)
                }).ToList();

            // 3. Calcular totales por mes para toda la empresa
            var totalesPorMes = new Dictionary<int, decimal>();
            for (int mes = 1; mes <= 12; mes++)
            {
                totalesPorMes[mes] = datos.Where(d => d.Mes == mes).Sum(d => d.Total);
            }

            // 4. Calcular KPIs anuales
            var kpisAnuales = await CalcularKPIsAnuales(datos);

            return new
            {
                Ano = año,
                Tipo = "ANUAL",
                Estructura = gruposConDetalles,
                TotalesPorMes = totalesPorMes,
                TotalAnual = datos.Sum(d => d.Total),
                KPIs = kpisAnuales,
                Meses = Enumerable.Range(1, 12).Select(m => new
                {
                    Numero = m,
                    Nombre = CultureInfo.CurrentCulture.DateTimeFormat.GetMonthName(m)
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado anual para usuario: {userId}", userId);
            throw;
        }
    }
    // Método auxiliar para calcular KPIs anuales
    private async Task<Dictionary<string, decimal>> CalcularKPIsAnuales(List<ResultadoGrupo> datosAnuales)
    {
        var kpis = new Dictionary<string, decimal>();

        // Agrupar por Grupo y sumar todos los meses del año
        var totalesPorGrupo = datosAnuales
            .GroupBy(r => r.Grupo)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Total));

        // Cálculo de KPIs basados en los grupos
        if (totalesPorGrupo.ContainsKey("VENTAS") && totalesPorGrupo.ContainsKey("COSTO MERCANCIA VENDIDA"))
        {
            decimal ventas = totalesPorGrupo["VENTAS"];
            decimal costoVentas = totalesPorGrupo["COSTO MERCANCIA VENDIDA"];
            decimal margenBruto = ventas - costoVentas;

            kpis.Add("MARGEN_BRUTO", margenBruto);
            kpis.Add("MARGEN_BRUTO_%", ventas != 0 ? (margenBruto / ventas) * 100 : 0);
        }

        // Agregar más KPIs según sea necesario
        if (totalesPorGrupo.ContainsKey("GASTOS OPERACIONALES"))
        {
            kpis.Add("TOTAL_GASTOS_OPERACIONALES", totalesPorGrupo["GASTOS OPERACIONALES"]);
        }

        if (totalesPorGrupo.ContainsKey("INGRESOS NO OPERACIONALES"))
        {
            kpis.Add("TOTAL_INGRESOS_NO_OPERACIONALES", totalesPorGrupo["INGRESOS NO OPERACIONALES"]);
        }

        return kpis;
    }



    public async Task<object> GenerarEstadoMensual(int año, int mes, string userId)
    {
        try
        {
            // ✅ USAR EL SERVICIO DE DATOS CON USERID
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, mes, userId);

            var datosMensuales = datos
                .GroupBy(r => r.Grupo)
                .Select(g => new
                {
                    Grupo = g.Key,
                    Total = g.Sum(r => r.Total)
                })
                .OrderBy(d => d.Grupo)
                .ToList();

            return new
            {
                Periodo = $"Mensual {mes}/{año}",
                Tipo = "mensual",
                Ano = año,
                Mes = mes,
                Datos = datosMensuales,
                TotalGeneral = datosMensuales.Sum(d => d.Total),
                UserId = userId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado mensual para usuario: {userId}", userId);
            throw;
        }
    }


    public async Task<object> GenerarEstadoTrimestral(int año, int mes, string userId)
    {
        try
        {
            // ✅ USAR EL SERVICIO DE DATOS CON USERID
            int trimestre = (mes - 1) / 3 + 1;
            int mesInicio = (trimestre - 1) * 3 + 1;
            int mesFin = trimestre * 3;

            // Obtener datos para todo el rango del trimestre CON USERID
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, 0, userId);

            var datosTrimestrales = datos
                .Where(r => r.Mes >= mesInicio && r.Mes <= mesFin)
                .GroupBy(r => r.Grupo)
                .Select(g => new
                {
                    Grupo = g.Key,
                    Total = g.Sum(r => r.Total)
                })
                .OrderBy(d => d.Grupo)
                .ToList();

            return new
            {
                Periodo = $"Trimestral Q{trimestre}/{año}",
                Tipo = "trimestral",
                Ano = año,
                Trimestre = trimestre,
                MesInicio = mesInicio,
                MesFin = mesFin,
                Datos = datosTrimestrales,
                TotalGeneral = datosTrimestrales.Sum(d => d.Total),
                UserId = userId
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado trimestral para usuario: {userId}", userId);
            throw;
        }
    }

    public async Task<List<int>> ObtenerAniosDisponiblesAsync(string userId)
    {
        try
        {
            // ✅ PASAR USERID AL SERVICIO DE DATOS
            return await _excelDataService.ObtenerAniosDisponiblesAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo años disponibles");
            throw;
        }
    }

    public async Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados)
    {
        try
        {
            await _excelDataService.GuardarDatosProcesadosAsync(resultados);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.GuardarDatosProcesadosAsync");
            throw; // Relanza la excepción para manejo superior
        }
    }


    public async Task<object> ObtenerDatosProcesados(string userId)
    {
        try
        {
            if (string.IsNullOrEmpty(userId))
            {
                throw new ArgumentException("UserId es requerido");
            }

            // ✅ Implementación con userId
            var totalMovimientos = await _excelDataService.ObtenerCantidadMovimientosAsync(userId);
            var totalResultados = await _excelDataService.ObtenerCantidadResultadosAsync(userId);
            var aniosDisponibles = await _excelDataService.ObtenerAniosDisponiblesAsync(userId);

            return new
            {
                TotalMovimientos = totalMovimientos,
                TotalResultados = totalResultados,
                AniosDisponibles = aniosDisponibles,
                UltimaActualizacion = DateTime.Now,
                UserId = userId // ← Agregar userId a la respuesta
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos procesados para usuario: {userId}", userId);
            throw;
        }
    }

    public async Task<int> ObtenerCantidadMovimientosAsync(string userId)
    {
        try
        {
            return await _excelDataService.ObtenerCantidadMovimientosAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerCantidadMovimientosAsync para usuario: {userId}", userId);
            throw;
        }
    }




    public async Task<int> ObtenerCantidadResultadosAsync(string userId)
    {
        try
        {
            return await _excelDataService.ObtenerCantidadResultadosAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerCantidadResultadosAsync para usuario: {userId}", userId);
            throw;
        }
    }

    public async Task<List<object>> ObtenerMovimientosMuestraAsync(string userId)
    {
        try
        {
            return await _excelDataService.ObtenerMovimientosMuestraAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerMovimientosMuestraAsync para usuario: {userId}", userId);
            throw;
        }
    }
    public async Task<List<object>> ObtenerResultadosMuestraAsync(string userId)
    {
        try
        {
            return await _excelDataService.ObtenerResultadosMuestraAsync(userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerResultadosMuestraAsync para usuario: {userId}", userId);
            throw;
        }
    }
}

// Clases para los resultados del procesamiento
public class ProcesamientoExcelResult
{
    public bool Exito { get; set; }
    public string Mensaje { get; set; }
    public int TotalClasificaciones { get; set; }
    public int TotalMovimientos { get; set; }
    public List<ResultadoGrupo> Resultados { get; set; } = new List<ResultadoGrupo>();
}

