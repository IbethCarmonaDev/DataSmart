using DataSmart.Core.Interfaces;
using DataSmart.Core.Services;
using DataSmart.Infrastructure;
using DataSmart.Infrastructure.Repositories;
using DataSmart.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Configuración de CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        builder => builder
            .WithOrigins("http://localhost:3000", "https://localhost:44323") // Agregar el puerto de la API
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

// Configuración de Base de Datos
builder.Services.AddDbContext<DataSmartDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DataSmartDb")));

// Configuración de Autenticación JWT (Supabase)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://your-project.supabase.co/auth/v1";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = "https://your-project.supabase.co/auth/v1",
            ValidateAudience = false,
            ValidateLifetime = true
        };
    });

// Registro de Servicios - ¡EVITA DUPLICADOS!
builder.Services.AddScoped<IExcelService, ExcelService>();
builder.Services.AddScoped<IExcelDataService, ExcelDataService>();
builder.Services.AddScoped<IGrupoMaestroRepository, GrupoMaestroRepository>();
// NOTA: ExcelService ya está registrado arriba, NO lo repitas

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// 🔥 ORDEN CRÍTICO: Middlewares en el orden correcto
app.UseCors("AllowReactApp");

// Servir archivos estáticos (HTML, CSS, JS) - PARA TU INTERFAZ WEB
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// 🔥 REDIRIGIR TODAS LAS RUTAS NO ENCONTRADAS A TU INTERFAZ WEB
app.MapFallbackToFile("/index.html");

app.Run();


