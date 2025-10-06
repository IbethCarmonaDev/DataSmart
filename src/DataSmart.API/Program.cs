using DataSmart.API.Filters;
using DataSmart.Core.Interfaces;
using DataSmart.Core.Services;
using DataSmart.Infrastructure;
using DataSmart.Infrastructure.Repositories;
using DataSmart.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.SuppressModelStateInvalidFilter = true;
    });

// Configuración de CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        builder => builder
            .WithOrigins("http://localhost:3000", "https://localhost:44323")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

// Configuración de Base de Datos
builder.Services.AddDbContext<DataSmartDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DataSmartDb")));

// Registro de Servicios
builder.Services.AddScoped<IExcelService, ExcelService>();
builder.Services.AddScoped<IExcelDataService, ExcelDataService>();
builder.Services.AddScoped<IGrupoMaestroRepository, GrupoMaestroRepository>();

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "DataSmart API", Version = "v1" });
    c.OperationFilter<SwaggerFileOperationFilter>();
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowReactApp");
app.UseAuthorization(); // Mantenemos esto por si acaso, pero sin autenticación

// Servir archivos estáticos
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Run();