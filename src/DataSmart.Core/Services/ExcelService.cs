using ClosedXML.Excel;
using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using Microsoft.Extensions.Logging;
using System.Globalization;

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


    public async Task<ProcesamientoExcelResult> ProcesarArchivoAsync(string filePath)
    {
        try
        {
            _logger.LogInformation($"Iniciando procesamiento del archivo con ClosedXML: {filePath}");


            using (var workbook = new XLWorkbook(filePath))
            {
                // 1. Verificar que las hojas necesarias existan
                if (!workbook.Worksheets.Any(ws => ws.Name == "DATOS_FINANCIEROS"))
                    throw new Exception("El archivo no contiene la hoja 'DATOS_FINANCIEROS'");

                if (!workbook.Worksheets.Any(ws => ws.Name == "CLASIFICACION_CUENTAS"))
                    throw new Exception("El archivo no contiene la hoja 'CLASIFICACION_CUENTAS'");

                // 2. Leer hoja de CLASIFICACION_CUENTAS
                var clasificacionCuentas = LeerHojaClasificacionCuentas(workbook); // ← ESTA VARIABLE

                // 3. Leer hoja de DATOS_FINANCIEROS  
                var datosFinancieros = LeerHojaDatosFinancieros(workbook); // ← Y ESTA

                // 4. Clasificar movimientos y calcular totales
                var resultados = ClasificarYCalcularMovimientos(datosFinancieros, clasificacionCuentas); // ← DEBEN ESTAR ACCESIBLES AQUÍ

                // GUARDAR EN BASE DE DATOS usando el nuevo servicio
                await _excelDataService.GuardarDatosProcesadosAsync(resultados);

                _logger.LogInformation($"Procesamiento completo. Generados {resultados.Count} totales de grupo.");

                return new ProcesamientoExcelResult
                {
                    Exito = true,
                    Mensaje = "Archivo procesado exitosamente. Estado de Resultados calculado.",
                    TotalClasificaciones = clasificacionCuentas.Count, // ← AQUÍ DEBE ESTAR ACCESIBLE
                    TotalMovimientos = datosFinancieros.Count, // ← Y AQUÍ
                    Resultados = resultados
                };
            }

        }



        catch (Exception ex)
        {
            _logger.LogError(ex, "Error procesando el archivo Excel con ClosedXML");
            return new ProcesamientoExcelResult
            {
                Exito = false,
                Mensaje = $"Error: {ex.Message}"
            };
        }
    }


    private List<ClasificacionCuenta> LeerHojaClasificacionCuentas(XLWorkbook workbook)
    {
        var lista = new List<ClasificacionCuenta>();
        var worksheet = workbook.Worksheet("CLASIFICACION_CUENTAS");

        if (worksheet == null) return lista;

        var firstRowUsed = worksheet.FirstRowUsed();
        var row = firstRowUsed.RowBelow();

        while (!row.Cell(1).IsEmpty())
        {
            var clasificacion = new ClasificacionCuenta
            {
                Prefijo = row.Cell(1).GetString(),
                Grupo = row.Cell(2).GetString(),
                NaturalezaContable = row.Cell(3).GetString(),
                Nivel = row.Cell(4).GetString()
            };

            lista.Add(clasificacion);
            row = row.RowBelow();
        }

        return lista;
    }

    private List<MovimientoContable> LeerHojaDatosFinancieros(XLWorkbook workbook)
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

    private List<ResultadoGrupo> ClasificarYCalcularMovimientos(
        List<MovimientoContable> movimientos,
        List<ClasificacionCuenta> clasificaciones)
    {
        var resultados = new List<ResultadoGrupo>();

        foreach (var mov in movimientos)
        {
            var clasificacion = clasificaciones.FirstOrDefault(c =>
                MovimientoCoincideConPrefijo(mov.CodCuenta, c.Prefijo));

            if (clasificacion != null)
            {
                decimal saldo = 0;
                if (clasificacion.NaturalezaContable == "DEBITO")
                    saldo = mov.Debito - mov.Credito;
                else if (clasificacion.NaturalezaContable == "CREDITO")
                    saldo = mov.Credito - mov.Debito;

                var resultadoExistente = resultados.FirstOrDefault(r =>
                    r.Grupo == clasificacion.Grupo &&
                    r.Mes == mov.Mes &&
                    r.Ano == mov.Ano);

                if (resultadoExistente != null)
                {
                    resultadoExistente.Total += saldo;
                }
                else
                {
                    resultados.Add(new ResultadoGrupo
                    {
                        Grupo = clasificacion.Grupo,
                        NombreVisible = clasificacion.Grupo,
                        CodCuenta = mov.CodCuenta,
                        Cuenta = mov.Cuenta,
                        Nivel = clasificacion.Nivel,
                        Mes = mov.Mes,
                        Ano = mov.Ano,
                        Total = saldo,
                        Naturaleza = clasificacion.NaturalezaContable
                    });
                }
            }
        }

        return resultados;
    }

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



    public async Task<EstadoResultados> GenerarEstadoResultados(int año, int mes, string tipo)
    {
        var estadoResultados = new EstadoResultados();

        // Usar el nuevo servicio en lugar de _context
        estadoResultados.TotalesPorGrupo = await _excelDataService.CalcularTotalesPorGrupoAsync(año, mes);
        estadoResultados.KPIs = await CalcularKPIs(estadoResultados.TotalesPorGrupo);
        estadoResultados.Periodo = $"{tipo} - {año}";
        estadoResultados.Detalles = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, mes);

        return estadoResultados;
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



    private async Task<Dictionary<string, decimal>> CalcularKPIs(Dictionary<string, decimal> totales)
    {
        var kpis = new Dictionary<string, decimal>();

        // Lógica para calcular KPIs basados en los totales
        if (totales.ContainsKey("VENTAS") && totales.ContainsKey("COSTO_MERCANCIA_VENDIDA"))
        {
            kpis.Add("MARGEN_BRUTO", totales["VENTAS"] - totales["COSTO_MERCANCIA_VENDIDA"]);
        }

        return kpis;
    }


    public async Task<object> GenerarEstadoPorPeriodo(int año, int mes, string tipoPeriodo)
    {
        try
        {
            // ✅ USAR EL SERVICIO DE DATOS PARA VERIFICAR SI HAY DATOS
            var existenDatos = await _excelDataService.ExistenDatosParaPeriodoAsync(año, mes);

            if (!existenDatos)
            {
                throw new Exception($"No hay datos disponibles para el período solicitado");
            }

            return tipoPeriodo.ToLower() switch
            {
                "mensual" => await GenerarEstadoMensual(año, mes),
                "trimestral" => await GenerarEstadoTrimestral(año, mes),
                _ => await GenerarEstadoAnual(año)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado por período");
            throw;
        }
    }


    public async Task<object> GenerarEstadoAnual(int año)
    {
        try
        {
            // 1. Obtener todos los datos del año
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año);

            // 2. Obtener el orden de los grupos desde la base de datos
            var ordenGrupos = await _grupoRepo.ObtenerOrdenGruposAsync();

            // 3. Agrupar por Grupo, Nivel y Cuenta
            var gruposConDetalles = datos
                .GroupBy(r => r.Grupo)
                .OrderBy(g => ordenGrupos.TryGetValue(g.Key, out int orden) ? orden : 99)
                .Select(grupo => new
                {
                    Grupo = grupo.Key,
                    NombreGrupo = grupo.First().NombreVisible,
                    OrdenGrupo = ordenGrupos.TryGetValue(grupo.Key, out int ordenG) ? ordenG : 99,

                    // Detalles por nivel dentro del grupo
                    Niveles = grupo.GroupBy(r => r.Nivel)
                        .OrderBy(n => n.Key) // Ordenar por nivel
                        .Select(nivel => new
                        {
                            Nivel = nivel.Key,

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

                            TotalAnualNivel = nivel.Sum(x => x.Total)
                        }).ToList(),

                    // Totales por mes para el grupo completo
                    TotalesPorMes = grupo.GroupBy(x => x.Mes)
                        .ToDictionary(m => m.Key, m => m.Sum(x => x.Total)),

                    TotalAnualGrupo = grupo.Sum(x => x.Total)
                }).ToList();

            // 4. Calcular totales por mes para toda la empresa
            var totalesPorMes = new Dictionary<int, decimal>();
            for (int mes = 1; mes <= 12; mes++)
            {
                totalesPorMes[mes] = datos.Where(d => d.Mes == mes).Sum(d => d.Total);
            }

            // 5. Calcular KPIs anuales
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
            _logger.LogError(ex, "Error generando estado anual");
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



    public async Task<object> GenerarEstadoMensual(int año, int mes)
    {
        try
        {
            // ✅ USAR EL SERVICIO DE DATOS EN LUGAR DE _context DIRECTAMENTE
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, mes);

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
                TotalGeneral = datosMensuales.Sum(d => d.Total)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado mensual");
            throw;
        }
    }



    public async Task<object> GenerarEstadoTrimestral(int año, int mes)
    {
        try
        {
            // ✅ USAR EL SERVICIO DE DATOS
            int trimestre = (mes - 1) / 3 + 1;
            int mesInicio = (trimestre - 1) * 3 + 1;
            int mesFin = trimestre * 3;

            // Obtener datos para todo el rango del trimestre
            var datos = await _excelDataService.ObtenerDatosPorPeriodoAsync(año, 0); // 0 = todos los meses

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
                TotalGeneral = datosTrimestrales.Sum(d => d.Total)
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado trimestral");
            throw;
        }
    }

    public async Task<List<int>> ObtenerAniosDisponiblesAsync()
    {
        try
        {
            // Usar el servicio de datos que sí tiene acceso al contexto
            return await _excelDataService.ObtenerAniosDisponiblesAsync();
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

    public async Task<object> ObtenerDatosProcesados()
    {
        try
        {
            // ✅ Implementación simple para debugging
            var totalMovimientos = await _excelDataService.ObtenerCantidadMovimientosAsync();
            var totalResultados = await _excelDataService.ObtenerCantidadResultadosAsync();
            var aniosDisponibles = await _excelDataService.ObtenerAniosDisponiblesAsync();

            return new
            {
                TotalMovimientos = totalMovimientos,
                TotalResultados = totalResultados,
                AniosDisponibles = aniosDisponibles,
                UltimaActualizacion = DateTime.Now
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos procesados");
            throw;
        }
    }


    public async Task<int> ObtenerCantidadMovimientosAsync()
    {
        try
        {
            // ✅ DELEGAR AL SERVICIO DE DATOS (IExcelDataService)
            return await _excelDataService.ObtenerCantidadMovimientosAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerCantidadMovimientosAsync");
            throw;
        }
    }

    public async Task<int> ObtenerCantidadResultadosAsync()
    {
        try
        {
            // ✅ DELEGAR AL SERVICIO DE DATOS (IExcelDataService)
            return await _excelDataService.ObtenerCantidadResultadosAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerCantidadResultadosAsync");
            throw;
        }
    }

    public async Task<List<object>> ObtenerMovimientosMuestraAsync()
    {
        try
        {
            // ✅ DELEGAR AL SERVICIO DE DATOS
            return await _excelDataService.ObtenerMovimientosMuestraAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerMovimientosMuestraAsync");
            throw;
        }
    }

    public async Task<List<object>> ObtenerResultadosMuestraAsync()
    {
        try
        {
            // ✅ DELEGAR AL SERVICIO DE DATOS
            return await _excelDataService.ObtenerResultadosMuestraAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en ExcelService.ObtenerResultadosMuestraAsync");
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

