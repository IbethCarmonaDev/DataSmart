using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace DataSmart.API.Filters
{
    public class SwaggerDefaultValues : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            // Solo asegura que Swagger genere la documentación sin errores
            // Sin lógica compleja que pueda causar errores de versión
        }
    }
}