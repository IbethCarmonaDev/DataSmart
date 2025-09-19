using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DataSmart.Infrastructure.Data;



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

        public async Task<List<ResultadoGrupo>> ObtenerDatosPorPeriodoAsync(int año, int mes = 0)
        {
            var query = _context.ResultadosGrupos.Where(r => r.Ano == año);

            if (mes > 0)
            {
                query = query.Where(r => r.Mes == mes);
            }

            return await query.ToListAsync();
        }

        public async Task<Dictionary<string, decimal>> CalcularTotalesPorGrupoAsync(int año, int mes = 0)
        {
            var datos = await ObtenerDatosPorPeriodoAsync(año, mes);

            return datos
                .GroupBy(r => r.Grupo)
                .ToDictionary(g => g.Key, g => g.Sum(r => r.Total));
        }


        public async Task<bool> ExistenDatosParaPeriodoAsync(int año, int mes = 0)
        {
            try
            {
                var query = _context.ResultadoGrupo.Where(r => r.Ano == año);

                if (mes > 0)
                {
                    query = query.Where(r => r.Mes == mes);
                }

                return await query.AnyAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verificando existencia de datos");
                throw;
            }
        }

        public async Task<int> ObtenerCantidadMovimientosAsync()
        {
            return await _context.MovimientoContable.CountAsync();
        }

        public async Task<int> ObtenerCantidadResultadosAsync()
        {
            return await _context.ResultadoGrupo.CountAsync();
        }

        public async Task<List<object>> ObtenerMovimientosMuestraAsync()
        {
            return await _context.MovimientoContable
                .Take(5)
                .Select(m => new { m.Ano, m.Mes, m.CodCuenta, m.Cuenta, m.Debito, m.Credito })
                .Cast<object>()
                .ToListAsync();
        }

        public async Task<List<object>> ObtenerResultadosMuestraAsync()
        {
            return await _context.ResultadoGrupo
                .Take(5)
                .Select(r => new { r.Ano, r.Mes, r.Grupo, r.Total })
                .Cast<object>()
                .ToListAsync();
        }


        public async Task<List<int>> ObtenerAniosDisponiblesAsync()
        {
            try
            {
                // ✅ BUSCAR EN AMBAS TABLAS
                var aniosMovimientos = await _context.MovimientoContable
                    .Select(m => m.Ano)
                    .Distinct()
                    .ToListAsync();

                var aniosResultados = await _context.ResultadoGrupo
                    .Select(r => r.Ano)
                    .Distinct()
                    .ToListAsync();

                // Combinar y ordenar
                var todosAnios = aniosMovimientos.Union(aniosResultados)
                    .Distinct()
                    .OrderByDescending(a => a)
                    .ToList();

                _logger.LogInformation($"Encontrados {todosAnios.Count} años disponibles");
                return todosAnios;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error obteniendo años disponibles");
                throw;
            }
        }

        public async Task GuardarMovimientosContablesAsync(List<MovimientoContable> movimientos)
        {
            try
            {
                _logger.LogInformation($"Guardando {movimientos.Count} movimientos contables...");

                // ✅ LIMPIAR datos existentes primero
                var datosExistentes = await _context.MovimientoContable.ToListAsync();
                _context.MovimientoContable.RemoveRange(datosExistentes);

                // ✅ GUARDAR nuevos movimientos
                await _context.MovimientoContable.AddRangeAsync(movimientos);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Guardados {movimientos.Count} movimientos contables exitosamente");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error guardando movimientos contables");
                throw;
            }
        }

    }
}