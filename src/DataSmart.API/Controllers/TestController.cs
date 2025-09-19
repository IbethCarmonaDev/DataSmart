using DataSmart.Core.Models;
using DataSmart.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DataSmart.API.Controllers;

// La ruta base para todos los endpoints de este controlador será "api/test"
[Route("api/[controller]")]
[ApiController]
public class TestController : ControllerBase
{
    // Inyectamos el contexto de la base de datos via constructor
    private readonly DataSmartDbContext _context;

    public TestController(DataSmartDbContext context)
    {
        _context = context;
    }

    // GET: api/test/connection
    // Este endpoint prueba que la conexión a la base de datos funciona
    [HttpGet("connection")]
    public async Task<IActionResult> TestDatabaseConnection()
    {
        try
        {
            // Intenta abrir una conexión y hacer una consulta simple
            var canConnect = await _context.Database.CanConnectAsync();
            return Ok(new { Message = "¡Conexión a la base de datos exitosa!", Database = canConnect });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Error conectando a la base de datos", Details = ex.Message });
        }
    }

    // GET: api/test
    // Endpoint simple de "Hola Mundo"
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new { Message = "¡Hola DataSmart! El API está funcionando." });
    }

    // POST: api/test/upload
    // Este endpoint simula la subida de un archivo (lo guarda en una carpeta temporal)
    [HttpPost("upload")]
    public async Task<IActionResult> TestUpload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { Error = "No se envió ningún archivo." });

        // Validar que sea un archivo de Excel
        var allowedExtensions = new[] { ".xlsx", ".xls" };
        var fileExtension = Path.GetExtension(file.FileName).ToLower();

        if (!allowedExtensions.Contains(fileExtension))
            return BadRequest(new { Error = "Solo se permiten archivos de Excel (.xlsx, .xls)" });

        try
        {
            // Crear una carpeta 'temp' si no existe para guardar el archivo de prueba
            var tempFolderPath = Path.Combine(Directory.GetCurrentDirectory(), "temp");
            if (!Directory.Exists(tempFolderPath))
                Directory.CreateDirectory(tempFolderPath);

            // Guardar el archivo en una ruta temporal
            var filePath = Path.Combine(tempFolderPath, file.FileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Aquí simularíamos el procesamiento con Pandas en Python
            // Por ahora, solo confirmamos que se guardó

            return Ok(new
            {
                Message = "¡Archivo recibido y guardado correctamente!",
                FileName = file.FileName,
                FileSize = file.Length,
                SavedPath = filePath
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Error = "Error procesando el archivo", Details = ex.Message });
        }
    }
}