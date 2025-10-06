using Microsoft.AspNetCore.Http;

namespace DataSmart.API.Models
{
    public class UploadExcelRequest
    {
        public IFormFile ArchivoExcel { get; set; }
    }
}