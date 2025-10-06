using DataSmart.API.Models;
using DataSmart.Core.Interfaces;
using DataSmart.Core.Models;
using DataSmart.Core.Services;
using DataSmart.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
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


    //[HttpPost("upload")]
    //[Consumes("multipart/form-data")]
    //public async Task<IActionResult> UploadExcel([FromForm] UploadExcelRequest request, [FromQuery] string userId)
    //{
    //    string tempFilePath = null;
    //    try
    //    {
    //        var userIdFinal = !string.IsNullOrEmpty(userId) ? userId : request.UserId;

    //        if (string.IsNullOrEmpty(userIdFinal))
    //            return BadRequest(new { Error = "UserId es requerido." });

    //        _logger.LogInformation($"Solicitud de upload recibida para usuario: {userIdFinal}");

    //        if (request.ArchivoExcel == null || request.ArchivoExcel.Length == 0)
    //            return BadRequest(new { Error = "No se envió ningún archivo." });

    //        var allowedExtensions = new[] { ".xlsx", ".xls" };
    //        var fileExtension = Path.GetExtension(request.ArchivoExcel.FileName).ToLower();

    //        if (!allowedExtensions.Contains(fileExtension))
    //            return BadRequest(new { Error = "Solo se permiten archivos de Excel (.xlsx, .xls)" });

    //        tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{fileExtension}");

    //        using (var stream = new FileStream(tempFilePath, FileMode.Create))
    //        {
    //            await request.ArchivoExcel.CopyToAsync(stream);
    //        }

    //        // Procesar archivo
    //        var resultado = await _excelService.ProcesarArchivoAsync(tempFilePath, userIdFinal);

    //        // Limpiar archivo temporal
    //        if (System.IO.File.Exists(tempFilePath))
    //            System.IO.File.Delete(tempFilePath);

    //        if (!resultado.Exito)
    //            return BadRequest(new { Error = resultado.Mensaje });

    //        // ✅ ESTRUCTURA QUE EL FRONTEND ESPERA
    //        return Ok(new
    //        {
    //            message = resultado.Mensaje,
    //            fileName = request.ArchivoExcel.FileName,
    //            totalMovimientos = resultado.TotalMovimientos,
    //            totalClasificaciones = resultado.TotalClasificaciones,

    //            // ✅ PROPIDADES CRÍTICAS QUE EL FRONTEND BUSCA
    //            datosProcesados = new
    //            {
    //                registros = resultado.TotalMovimientos, // Mismo valor que totalMovimientos
    //                centrosCostos = resultado.TotalClasificaciones // Mismo valor que totalClasificaciones
    //            },

    //            resultados = resultado.Resultados,
    //            userId = userIdFinal
    //        });
    //    }
    //    catch (Exception ex)
    //    {
    //        if (tempFilePath != null && System.IO.File.Exists(tempFilePath))
    //            System.IO.File.Delete(tempFilePath);

    //        _logger.LogError(ex, "Error procesando el archivo Excel para usuario: {userId}", userId);
    //        return StatusCode(500, new { Error = "Error interno procesando el archivo.", Details = ex.Message });
    //    }
    //}


    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadExcel(
        [FromForm] UploadExcelRequest request,
        [FromQuery] string userId) // Solo por query string
    {
        string tempFilePath = null;
        try
        {
            // Validación más robusta del userId
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest(new { Error = "UserId es requerido en el query string." });

            _logger.LogInformation($"Solicitud de upload recibida para usuario: {userId}");

            if (request.ArchivoExcel == null || request.ArchivoExcel.Length == 0)
                return BadRequest(new { Error = "No se envió ningún archivo." });

            var allowedExtensions = new[] { ".xlsx", ".xls" };
            var fileExtension = Path.GetExtension(request.ArchivoExcel.FileName).ToLower();

            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest(new { Error = "Solo se permiten archivos de Excel (.xlsx, .xls)" });

            tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}{fileExtension}");

            using (var stream = new FileStream(tempFilePath, FileMode.Create))
            {
                await request.ArchivoExcel.CopyToAsync(stream);
            }

            // Procesar archivo
            var resultado = await _excelService.ProcesarArchivoAsync(tempFilePath, userId);

            // Limpiar archivo temporal
            if (System.IO.File.Exists(tempFilePath))
                System.IO.File.Delete(tempFilePath);

            if (!resultado.Exito)
                return BadRequest(new { Error = resultado.Mensaje });

            return Ok(new
            {
                message = resultado.Mensaje,
                fileName = request.ArchivoExcel.FileName,
                totalMovimientos = resultado.TotalMovimientos,
                totalClasificaciones = resultado.TotalClasificaciones,
                datosProcesados = new
                {
                    registros = resultado.TotalMovimientos,
                    centrosCostos = resultado.TotalClasificaciones
                },
                resultados = resultado.Resultados,
                userId = userId
            });
        }
        catch (Exception ex)
        {
            if (tempFilePath != null && System.IO.File.Exists(tempFilePath))
                System.IO.File.Delete(tempFilePath);

            _logger.LogError(ex, "Error procesando el archivo Excel para usuario: {userId}", userId);
            return StatusCode(500, new { Error = "Error interno procesando el archivo.", Details = ex.Message });
        }
    }


    [HttpGet("anios-disponibles")]
    public async Task<IActionResult> GetAniosDisponibles([FromQuery] string userId)
    {
        try
        {
            if (string.IsNullOrEmpty(userId))
                return BadRequest("UserId es requerido");

            var anios = await _excelService.ObtenerAniosDisponiblesAsync(userId);
            return Ok(anios);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo años disponibles");
            return StatusCode(500, $"Error obteniendo años: {ex.Message}");
        }
    }


    [HttpGet("estado-resultados-anual")]
    public async Task<IActionResult> GetEstadoResultadosAnual(
        [FromQuery] int año = 0,
        [FromQuery] string userId = null)
    {
        try
        {
            if (string.IsNullOrEmpty(userId))
                return BadRequest("UserId es requerido");

            if (año == 0)
            {
                var anios = await _excelService.ObtenerAniosDisponiblesAsync(userId);
                año = anios.Any() ? anios.Max() : DateTime.Now.Year;
            }

            _logger.LogInformation($"Generando estado anual para año: {año}, Usuario: {userId}");

            // ✅ LLAMAR AL MÉTODO CORRECTO
            var resultado = await _excelService.GenerarEstadoPorPeriodo(año, 0, "anual", userId);

            return Ok(new
            {
                Ano = año,
                Mes = 0,
                Tipo = "anual",
                Resultados = resultado,
                UserId = userId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado de resultados anual");
            return StatusCode(500, $"Error generando estado anual: {ex.Message}");
        }
    }

    [HttpGet("estado-resultados")]
    public async Task<IActionResult> GetEstadoResultados(
        [FromQuery] int año = 0,
        [FromQuery] int mes = 0,
        [FromQuery] string tipo = "anual",
        [FromQuery] string userId = null) // ← AÑADIR USERID COMO PARÁMETRO
    {
        try
        {
            // ✅ VALIDAR USERID
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest("UserId es requerido");
            }

            _logger.LogInformation($"Solicitud recibida: año={año}, mes={mes}, tipo={tipo}, usuario={userId}");

            // Debug: Log de los parámetros recibidos
            if (año == 0)
            {
                _logger.LogInformation("Año no especificado, buscando más reciente...");
                var anios = await _excelService.ObtenerAniosDisponiblesAsync(userId);
                _logger.LogInformation($"Años disponibles: {string.Join(", ", anios)}");

                año = anios.Any() ? anios.Max() : DateTime.Now.Year;
                _logger.LogInformation($"Año seleccionado: {año}");
            }

            _logger.LogInformation($"Generando estado para año={año}, tipo={tipo}, usuario={userId}");

            // ✅ PASAR USERID AL MÉTODO
            var resultado = await _excelService.GenerarEstadoPorPeriodo(año, mes, tipo, userId);

            _logger.LogInformation($"Estado generado exitosamente para usuario: {userId}");
            return Ok(resultado);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generando estado de resultados para usuario: {userId}", userId);
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


    [HttpGet("datos-procesados")]
    public async Task<IActionResult> GetDatosProcesados([FromQuery] string userId)
    {
        try
        {
            // ✅ VALIDAR USERID
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest(new { Error = "UserId es requerido como query parameter. Ej: /api/Finance/datos-procesados?userId=tu-user-id" });
            }

            var datos = await _excelService.ObtenerDatosProcesados(userId);
            return Ok(datos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo datos procesados para usuario: {userId}", userId);
            return StatusCode(500, new { Error = "Error obteniendo datos procesados", Details = ex.Message });
        }
    }

    [HttpGet("debug-datos")]
    public async Task<IActionResult> DebugDatos([FromQuery] string userId)
    {
        try
        {
            // ✅ VALIDAR USERID
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest(new { Error = "UserId es requerido" });
            }

            // ✅ USAR IExcelService CON USERID
            var movimientosCount = await _excelService.ObtenerCantidadMovimientosAsync(userId);
            var resultadosCount = await _excelService.ObtenerCantidadResultadosAsync(userId);
            var algunosMovimientos = await _excelService.ObtenerMovimientosMuestraAsync(userId);
            var algunosResultados = await _excelService.ObtenerResultadosMuestraAsync(userId);

            return Ok(new
            {
                MovimientosCount = movimientosCount,
                ResultadosCount = resultadosCount,
                AlgunosMovimientos = algunosMovimientos,
                AlgunosResultados = algunosResultados,
                UserId = userId,
                Mensaje = "Debug completado usando IExcelService"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en debug-datos para usuario: {userId}", userId);
            return StatusCode(500, $"Error debuggeando datos: {ex.Message}");
        }
    }
}

