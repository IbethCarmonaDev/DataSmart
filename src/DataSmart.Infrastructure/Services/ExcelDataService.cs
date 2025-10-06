using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using DataSmart.Core.Utils;
using DataSmart.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Logging;


namespace DataSmart.Infrastructure.Services
{
    public class ExcelDataService : IExcelDataService
    {
        private readonly DataSmartDbContext _context;
        private readonly ILogger<ExcelDataService> _logger;

        public ExcelDataService(DataSmartDbContext context, ILogger<ExcelDataService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados)
        {
            try
            {
                // Guardar resultados en la base de datos
                await _context.ResultadosGrupos.AddRangeAsync(resultados);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Datos guardados exitosamente: {resultados.Count} registros");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando datos procesados");
                throw;
            }
        }


        public async Task<List<ResultadoGrupo>> ObtenerDatosPorPeriodoAsync(int año, int mes = 0, string userId = null)
        {
            var query = _context.ResultadoGrupo.AsQueryable();

            // Filtrar por usuario
            if (!string.IsNullOrEmpty(userId))
            {
                query = query.Where(r => r.UserId == userId);
            }

            // Filtrar por año
            query = query.Where(r => r.Ano == año);

            // Filtrar por mes si se especifica
            if (mes > 0)
            {
                query = query.Where(r => r.Mes == mes);
            }

            return await query.ToListAsync();
        }





        public async Task<Dictionary<string, decimal>> CalcularTotalesPorGrupoAsync(int año, int mes = 0, string userId = null)
        {
            try
            {
                if (string.IsNullOrEmpty(userId))
                {
                    throw new ArgumentException("UserId es requerido");
                }

                _logger.LogInformation($"Calculando totales por grupo para año: {año}, mes: {mes}, usuario: {userId}");

                // Obtener datos filtrados por usuario
                var datos = await ObtenerDatosPorPeriodoAsync(año, mes, userId);

                // Calcular totales por grupo
                var totalesPorGrupo = datos
                    .GroupBy(r => r.Grupo)
                    .ToDictionary(g => g.Key, g => g.Sum(r => r.Total));

                _logger.LogInformation($"Calculados {totalesPorGrupo.Count} totales de grupo para usuario: {userId}");

                return totalesPorGrupo;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculando totales por grupo para usuario: {userId}", userId);
                throw;
            }
        }


        public async Task<bool> ExistenDatosParaPeriodoAsync(int año, int mes = 0, string userId = null)
        {
            try
            {
                if (string.IsNullOrEmpty(userId))
                {
                    throw new ArgumentException("UserId es requerido");
                }

                var query = _context.ResultadoGrupo
                    .Where(r => r.UserId == userId && r.Ano == año);

                if (mes > 0)
                {
                    query = query.Where(r => r.Mes == mes);
                }

                return await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verificando datos para período: año={año}, mes={mes}, usuario={userId}", año, mes, userId);
                throw;
            }
        }
        public async Task<int> ObtenerCantidadMovimientosAsync(string userId)
        {
            return await _context.MovimientoContable
                .Where(m => m.UserId == userId)
                .CountAsync();
        }


        public async Task<int> ObtenerCantidadResultadosAsync(string userId)
        {
            return await _context.ResultadoGrupo
                .Where(r => r.UserId == userId)
                .CountAsync();
        }

        public async Task<List<object>> ObtenerMovimientosMuestraAsync(string userId)
        {
            return await _context.MovimientoContable
                .Where(m => m.UserId == userId)
                .OrderByDescending(m => m.Id)
                .Take(10)
                .Select(m => new {
                    m.Id,
                    m.UserId,
                    m.Ano,
                    m.Mes,
                    m.CodCuenta,
                    m.Cuenta,
                    m.Debito,
                    m.Credito
                })
                .ToListAsync<object>();
        }

        public async Task<List<object>> ObtenerResultadosMuestraAsync(string userId)
        {
            return await _context.ResultadoGrupo
                .Where(r => r.UserId == userId)
                .OrderByDescending(r => r.Id)
                .Take(10)
                .Select(r => new {
                    r.Id,
                    r.UserId,
                    r.Grupo,
                    r.NombreVisible,
                    r.CodCuenta,
                    r.Cuenta,
                    r.Nivel,
                    r.Mes,
                    r.Ano,
                    r.Total,
                    r.Naturaleza
                })
                .ToListAsync<object>();
        }


        public async Task<List<int>> ObtenerAniosDisponiblesAsync(string userId)
        {
            try
            {
                // ✅ BUSCAR EN AMBAS TABLAS FILTRANDO POR USERID
                var aniosMovimientos = await _context.MovimientoContable
                    .Where(m => m.UserId == userId) // ← FILTRO POR USERID
                    .Select(m => m.Ano)
                    .Distinct()
                    .ToListAsync();

                var aniosResultados = await _context.ResultadoGrupo
                    .Where(r => r.UserId == userId) // ← FILTRO POR USERID
                    .Select(r => r.Ano)
                    .Distinct()
                    .ToListAsync();

                // Combinar y ordenar
                var todosAnios = aniosMovimientos.Union(aniosResultados)
                    .Distinct()
                    .OrderByDescending(a => a)
                    .ToList();

                _logger.LogInformation($"Encontrados {todosAnios.Count} años disponibles para usuario: {userId}");
                return todosAnios;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo años disponibles para usuario: {userId}", userId);
                throw;
            }
        }

        //public async Task GuardarMovimientosContablesAsync(List<MovimientoContable> movimientos)
        //{
        //    if (movimientos == null || !movimientos.Any())
        //        return;

        //    var userId = movimientos.First().UserId;

        //    // ✅ CONFIGURAR TIMEOUT MAYOR PARA OPERACIONES MASIVAS
        //    var timeoutSeconds = Math.Max(300, movimientos.Count / 500); // 5 min mínimo o más según volumen

        //    using var transaction = await _context.Database.BeginTransactionAsync();

        //    try
        //    {
        //        _logger.LogInformation($"Guardando {movimientos.Count} movimientos para usuario {userId} (timeout: {timeoutSeconds}s)");

        //        // ✅ 1. ELIMINAR CON TIMEOUT CONFIGURADO
        //        _context.Database.SetCommandTimeout(timeoutSeconds);

        //        var eliminados = await _context.MovimientoContable
        //            .Where(m => m.UserId == userId)
        //            .ExecuteDeleteAsync();

        //        _logger.LogInformation($"Eliminados {eliminados} registros anteriores del usuario");

        //        // ✅ 2. GUARDAR EN LOTES CON PROGRESO
        //        const int batchSize = 1000;
        //        int totalProcessed = 0;
        //        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        //        // Obtener las opciones del contexto actual de forma correcta
        //        var options = _context.GetService<DbContextOptions<DataSmartDbContext>>();

        //        for (int i = 0; i < movimientos.Count; i += batchSize)
        //        {
        //            var batch = movimientos.Skip(i).Take(batchSize).ToList();

        //            using var batchContext = new DataSmartDbContext(options);
        //            await batchContext.MovimientoContable.AddRangeAsync(batch);
        //            await batchContext.SaveChangesAsync();
        //            await batchContext.DisposeAsync(); // ✅ Cambiado a DisposeAsync

        //            totalProcessed += batch.Count;

        //            // ✅ LOG DE PROGRESO CADA 5 LOTES O 5000 REGISTROS
        //            if (i % 5000 == 0 || i + batchSize >= movimientos.Count)
        //            {
        //                var elapsed = stopwatch.Elapsed;
        //                var recordsPerSecond = totalProcessed / elapsed.TotalSeconds;
        //                _logger.LogInformation(
        //                    $"Progreso: {totalProcessed}/{movimientos.Count} " +
        //                    $"({(totalProcessed * 100.0 / movimientos.Count):F1}%) " +
        //                    $"- {recordsPerSecond:F0} reg/seg");
        //            }
        //        }

        //        await transaction.CommitAsync();

        //        _logger.LogInformation(
        //            $"✅ Guardado completado en {stopwatch.Elapsed.TotalSeconds:F0}s " +
        //            $"- {movimientos.Count} movimientos para usuario {userId}");
        //    }
        //    catch (Exception ex)
        //    {
        //        await transaction.RollbackAsync();
        //        _logger.LogError(ex, "❌ Error en GuardarMovimientosContablesAsync para usuario {UserId}", userId);
        //        throw;
        //    }
        //    finally
        //    {
        //        // ✅ RESTAURAR TIMEOUT POR DEFECTO
        //        _context.Database.SetCommandTimeout(30);
        //    }
        //}


        public async Task GuardarMovimientosContablesAsync(List<MovimientoContable> movimientos)
        {
            if (movimientos == null || !movimientos.Any())
                return;

            var userId = movimientos.First().UserId;

            // ✅ CONFIGURAR TIMEOUT MAYOR PARA OPERACIONES MASIVAS
            var timeoutSeconds = Math.Max(300, movimientos.Count / 500); // 5 min mínimo o más según volumen

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                _logger.LogInformation($"Guardando {movimientos.Count} movimientos para usuario {userId} (timeout: {timeoutSeconds}s)");

                // ✅ 1. ELIMINAR REGISTROS EXISTENTES CON TIMEOUT CONFIGURADO
                _context.Database.SetCommandTimeout(timeoutSeconds);

                // ✅ ELIMINAR MOVIMIENTOS CONTABLES DEL USUARIO
                var movimientosEliminados = await _context.MovimientoContable
                    .Where(m => m.UserId == userId)
                    .ExecuteDeleteAsync();

                _logger.LogInformation($"Eliminados {movimientosEliminados} movimientos contables anteriores del usuario");

                // ✅ ELIMINAR RESULTADOS GRUPO DEL USUARIO
                var resultadosEliminados = await _context.ResultadoGrupo
                    .Where(r => r.UserId == userId)
                    .ExecuteDeleteAsync();

                _logger.LogInformation($"Eliminados {resultadosEliminados} resultados de grupo anteriores del usuario");

                // ✅ 2. GUARDAR EN LOTES CON PROGRESO
                const int batchSize = 1000;
                int totalProcessed = 0;
                var stopwatch = System.Diagnostics.Stopwatch.StartNew();

                // Obtener las opciones del contexto actual de forma correcta
                var options = _context.GetService<DbContextOptions<DataSmartDbContext>>();

                for (int i = 0; i < movimientos.Count; i += batchSize)
                {
                    var batch = movimientos.Skip(i).Take(batchSize).ToList();

                    using var batchContext = new DataSmartDbContext(options);
                    await batchContext.MovimientoContable.AddRangeAsync(batch);
                    await batchContext.SaveChangesAsync();
                    await batchContext.DisposeAsync();

                    totalProcessed += batch.Count;

                    // ✅ LOG DE PROGRESO CADA 5 LOTES O 5000 REGISTROS
                    if (i % 5000 == 0 || i + batchSize >= movimientos.Count)
                    {
                        var elapsed = stopwatch.Elapsed;
                        var recordsPerSecond = totalProcessed / elapsed.TotalSeconds;
                        _logger.LogInformation(
                            $"Progreso: {totalProcessed}/{movimientos.Count} " +
                            $"({(totalProcessed * 100.0 / movimientos.Count):F1}%) " +
                            $"- {recordsPerSecond:F0} reg/seg");
                    }
                }

                await transaction.CommitAsync();

                _logger.LogInformation(
                    $"✅ Guardado completado en {stopwatch.Elapsed.TotalSeconds:F0}s " +
                    $"- {movimientos.Count} movimientos para usuario {userId}");
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "❌ Error en GuardarMovimientosContablesAsync para usuario {UserId}", userId);
                throw;
            }
            finally
            {
                // ✅ RESTAURAR TIMEOUT POR DEFECTO
                _context.Database.SetCommandTimeout(30);
            }
        }


        public async Task<bool> LimpiarDatosUsuarioAsync(string userId)
        {
            try
            {
                _logger.LogInformation($"Iniciando limpieza de datos para usuario: {userId}");

                // ✅ MÉTODO 1: ExecuteDelete (EF Core 7+ - más eficiente)
                try
                {
                    var movimientosEliminados = await _context.MovimientoContable
                        .Where(m => m.UserId == userId)
                        .ExecuteDeleteAsync();

                    var resultadosEliminados = await _context.ResultadoGrupo
                        .Where(r => r.UserId == userId)
                        .ExecuteDeleteAsync();

                    _logger.LogInformation($"Eliminados {movimientosEliminados} movimientos y {resultadosEliminados} resultados");
                    return true;
                }
                catch
                {
                    // ✅ MÉTODO 2: Fallback para EF Core antiguo
                    var movimientos = await _context.MovimientoContable
                        .Where(m => m.UserId == userId)
                        .ToListAsync();

                    var resultados = await _context.ResultadoGrupo
                        .Where(r => r.UserId == userId)
                        .ToListAsync();

                    _context.MovimientoContable.RemoveRange(movimientos);
                    _context.ResultadoGrupo.RemoveRange(resultados);

                    await _context.SaveChangesAsync();

                    _logger.LogInformation($"Eliminados {movimientos.Count} movimientos y {resultados.Count} resultados (fallback)");
                    return true;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error limpiando datos para usuario: {userId}", userId);
                return false;
            }
        }



        public async Task<Dictionary<string, int>> ObtenerOrdenGruposDesdeBDAsync()
        {
            try
            {
                // ✅ OBTENER TODOS LOS GRUPOS DE LA TABLA MAESTRA
                var gruposDesdeBD = await _context.GrupoMaestro
                    .Where(g => g.Orden > 0) // Solo grupos con orden válido
                    .OrderBy(g => g.Orden)
                    .ToListAsync();

                if (!gruposDesdeBD.Any())
                {
                    _logger.LogWarning("Tabla grupo_maestro vacía o sin órdenes definidos");
                    return await CrearOrdenDesdeClasificacionesAsync();
                }

                var ordenGrupos = new Dictionary<string, int>();

                foreach (var grupo in gruposDesdeBD)
                {
                    // ✅ NORMALIZAR AMBOS NOMBRES Y AGREGAR AL DICCIONARIO
                    var nombreInternoNormalizado = StringUtils.NormalizarNombreGrupo(grupo.NombreInterno);
                    var nombreVisibleNormalizado = StringUtils.NormalizarNombreGrupo(grupo.NombreVisible);

                    if (!string.IsNullOrEmpty(nombreInternoNormalizado))
                    {
                        ordenGrupos[nombreInternoNormalizado] = grupo.Orden;
                    }

                    if (!string.IsNullOrEmpty(nombreVisibleNormalizado) &&
                        nombreVisibleNormalizado != nombreInternoNormalizado)
                    {
                        ordenGrupos[nombreVisibleNormalizado] = grupo.Orden;
                    }
                }

                _logger.LogInformation($"Órdenes de grupos cargados desde BD: {ordenGrupos.Count} grupos");
                return ordenGrupos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo orden de grupos desde BD");
                return await CrearOrdenDesdeClasificacionesAsync();
            }
        }


        private async Task<Dictionary<string, int>> CrearOrdenDesdeClasificacionesAsync()
        {
            try
            {
                _logger.LogWarning("Creando orden de grupos desde clasificaciones existentes");

                // ✅ OBTENER GRUPOS ÚNICOS DE LAS CLASIFICACIONES
                var grupos = await _context.ClasificacionCuenta
                    .Where(c => !string.IsNullOrEmpty(c.Grupo))
                    .Select(c => StringUtils.NormalizarNombreGrupo(c.Grupo))
                    .Distinct()
                    .ToListAsync();

                if (!grupos.Any())
                {
                    _logger.LogError("No se encontraron grupos en las clasificaciones");
                    return new Dictionary<string, int>();
                }

                // ✅ ORDENAR ALFABÉTICAMENTE COMO ÚLTIMO RECURSO
                var gruposOrdenados = grupos.OrderBy(g => g).ToList();

                var ordenGrupos = new Dictionary<string, int>();
                for (int i = 0; i < gruposOrdenados.Count; i++)
                {
                    ordenGrupos[gruposOrdenados[i]] = i + 1;
                }

                _logger.LogInformation($"Orden alfabético creado para {ordenGrupos.Count} grupos");
                return ordenGrupos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creando orden desde clasificaciones");

                // ✅ FALLBACK DE EMERGENCIA MÍNIMO
                return new Dictionary<string, int>
                {
                    {"VENTAS", 1},
                    {"COSTOS", 2},
                    {"GASTOS", 3}
                };
            }
        }

    }
}