using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace DataSmart.Core.Models;

public class UploadExcelRequest
{
    [Required]
    public IFormFile ArchivoExcel { get; set; }

    // Podemos agregar más parámetros después, como el año a analizar
    // public int? Ano { get; set; }
}