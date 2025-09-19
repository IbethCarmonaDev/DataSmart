using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using DataSmart.Core.Services;
using DataSmart.Infrastructure.Services;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace DataSmart.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableCors("AllowReactApp")]
public class FinanceController : ControllerBase
{
    private readonly ILogger<FinanceController> _logger;
    private readonly IExcelService _excelService;

    public FinanceController(ILogger<FinanceController> logger, IExcelService excelService)
    {
        _logger = logger;
        _excelService = excelService;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadExcel([FromForm] UploadExcelRequest request)
    {
        string tempFilePath = null;
        try
        {
            if (request.ArchivoExcel == null || request.ArchivoExcel.Length == 0)
                return BadRequest(new { Error = "No se envió ningún archivo." });

            // Validar que sea un archivo de Excel
            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(request.ArchivoExcel.FileName).ToLower();

            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new { Error = "Solo se permiten archivos de Excel (.xlsx, .xls)" });

            // Guardar el archivo temporal
            tempFilePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".xlsx");

            using (var stream = new FileStream(tempFilePath, FileMode.Create))
            {
                await request.ArchivoExcel.CopyToAsync(stream);
            }

            _logger.LogInformation($"Archivo recibido y guardado como: {tempFilePath}");

            // Procesar el Excel
            var resultado = await _excelService.ProcesarArchivoAsync(tempFilePath);

            // ✅ DEBUG: Verificar qué se procesó
            _logger.LogInformation($"Resultado: {resultado.Exito}, Mensaje: {resultado.Mensaje}");
            _logger.LogInformation($"Movimientos: {resultado.TotalMovimientos}, Clasificaciones: {resultado.TotalClasificaciones}");

            if (resultado.Exito && resultado.Resultados != null)
            {
                _logger.LogInformation($"Se generaron {resultado.Resultados.Count} resultados de grupo");

                // ✅ DEBUG: Verificar que los datos se procesaron (PERO SIN _context)
                try
                {
                    // Usar métodos de debug del servicio en lugar de _context
                    var countResultados = await _excelService.ObtenerCantidadResultadosAsync();
                    var countMovimientos = await _excelService.ObtenerCantidadMovimientosAsync();

                    _logger.LogInformation($"Registros en ResultadoGrupo: {countResultados}");
                    _logger.LogInformation($"Registros en MovimientoContable: {countMovimientos}");
                }
                catch (Exception dbEx)
                {
                    _logger.LogError(dbEx, "Error verificando datos en base de datos");
                }
            }

            // Limpiar archivo temporal
            if (System.IO.File.Exists(tempFilePath))
                System.IO.File.Delete(tempFilePath);

            if (!resultado.Exito)
                return BadRequest(new { Error = resultado.Mensaje });

            var ultimoAno = resultado.Resultados.Max(r => r.Ano);
            var ultimoMes = resultado.Resultados.Where(r => r.Ano == ultimoAno).Max(r => r.Mes);

            var reporteFormateado = await _excelService.FormatearReporte(resultado.Resultados, ultimoAno, ultimoMes);

            return Ok(new
            {
                Message = resultado.Mensaje,
                FileName = request.ArchivoExcel.FileName,
                TotalClasificaciones = resultado.TotalClasificaciones,
                TotalMovimientos = resultado.TotalMovimientos,
                Resultados = resultado.Resultados,
                Reporte = reporteFormateado
            });
        }
        catch (Exception ex)
        {
            if (tempFilePath != null && System.IO.File.Exists(tempFilePath))
                System.IO.File.Delete(tempFilePath);

            _logger.LogError(ex, "Error procesando el archivo Excel.");
            return StatusCode(500, new { Error = "Error interno procesando el archivo.", Details = ex.Message });
        }
    }

    [HttpGet("anios-disponibles")]
    public async Task<IActionResult> GetAniosDisponibles()
    {
        try
        {
            // ✅ USAR EL SERVICIO EN LUGAR DE ACCEDER DIRECTAMENTE AL CONTEXT
            var anios = await _excelService.ObtenerAniosDisponiblesAsync();
            return Ok(anios);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo años disponibles");
            return StatusCode(500, $"Error obteniendo años: {ex.Message}");
        }
    }



    [HttpGet("estado-resultados")]
    public async Task<IActionResult> GetEstadoResultados(
        [FromQuery] int año = 0,
        [FromQuery] int mes = 0,
        [FromQuery] string tipo = "anual")
    {
        try
        {
            _logger.LogInformation($"Solicitud recibida: año={año}, mes={mes}, tipo={tipo}");
            
            var userId = "demo-user"; // ← Esto será reemplazado luego

            // Debug: Log de los parámetros recibidos
            if (año == 0)
            {
                _logger.LogInformation("Año no especificado, buscando más reciente...");
                var anios = await _excelService.ObtenerAniosDisponiblesAsync();
                _logger.LogInformation($"Años disponibles: {string.Join(", ", anios)}");

                año = anios.Any() ? anios.Max() : DateTime.Now.Year;
                _logger.LogInformation($"Año seleccionado: {año}");
            }

            _logger.LogInformation($"Generando estado para año={año}, tipo={tipo}");

            var resultado = await _excelService.GenerarEstadoPorPeriodo(año, mes, tipo);

            _logger.LogInformation($"Estado generado exitosamente");
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado de resultados");
            return StatusCode(500, $"Error generando estado de resultados: {ex.Message}");
        }
    }

    // NUEVO ENDPOINT: KPIs Financieros
    [HttpGet("kpis-financieros")]
    public async Task<IActionResult> GetKPIsFinancieros([FromQuery] int año = 0)
    {
        try
        {
            var kpis = await _excelService.CalcularKPIsFinancieros(año);
            return Ok(kpis);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculando KPIs financieros");
            return StatusCode(500, new { Error = "Error calculando KPIs financieros", Details = ex.Message });
        }
    }

    // NUEVO ENDPOINT: Datos procesados (para debugging)
    [HttpGet("datos-procesados")]
    public async Task<IActionResult> GetDatosProcesados()
    {
        try
        {
            var datos = await _excelService.ObtenerDatosProcesados();
            return Ok(datos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos procesados");
            return StatusCode(500, new { Error = "Error obteniendo datos procesados", Details = ex.Message });
        }
    }

    [HttpGet("estado-resultados-anual")]
    public async Task<IActionResult> GetEstadoResultadosAnual([FromQuery] int año = 0)
    {
        try
        {
            if (año == 0)
            {
                // Obtener el año más reciente si no se especifica
                var anios = await _excelService.ObtenerAniosDisponiblesAsync();
                año = anios.Any() ? anios.Max() : DateTime.Now.Year;
            }

            _logger.LogInformation($"Generando estado anual para el año: {año}");

            var resultado = await _excelService.GenerarEstadoAnual(año);
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado de resultados anual");
            return StatusCode(500, $"Error generando estado anual: {ex.Message}");
        }
    }

    [HttpGet("debug-datos")]
    public async Task<IActionResult> DebugDatos()
    {
        try
        {
            // ✅ USAR IExcelService EN LUGAR DE IExcelDataService
            var movimientosCount = await _excelService.ObtenerCantidadMovimientosAsync();
            var resultadosCount = await _excelService.ObtenerCantidadResultadosAsync();
            var algunosMovimientos = await _excelService.ObtenerMovimientosMuestraAsync();
            var algunosResultados = await _excelService.ObtenerResultadosMuestraAsync();

            return Ok(new
            {
                MovimientosCount = movimientosCount,
                ResultadosCount = resultadosCount,
                AlgunosMovimientos = algunosMovimientos,
                AlgunosResultados = algunosResultados,
                Mensaje = "Debug completado usando IExcelService"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en debug-datos");
            return StatusCode(500, $"Error debuggeando datos: {ex.Message}");
        }
    }

}

public class UploadExcelRequest
{
    public IFormFile ArchivoExcel { get; set; }
}

