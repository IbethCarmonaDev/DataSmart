using DataSmart.Core.Models;
using DataSmart.Core.Services;
using Microsoft.AspNetCore.Http;

namespace DataSmart.Core.Interfaces
{
    public interface IExcelService
    {
        // ✅ SOLO métodos de LÓGICA DE NEGOCIO
        Task<ProcesamientoExcelResult> ProcesarArchivoAsync(string filePath, string userId);
        Task<ReporteEstadoResultados> FormatearReporte(List<ResultadoGrupo> resultados, int ano, int mes);

        // ✅ Métodos de GENERACIÓN DE REPORTES
        Task<EstadoResultados> GenerarEstadoResultados(int año, int mes, string tipo, string userId);

        Task<Dictionary<string, decimal>> CalcularKPIsFinancieros(int año);
        Task<object> GenerarEstadoAnual(int año, string userId);
        Task<List<int>> ObtenerAniosDisponiblesAsync(string userId);
        Task<int> ObtenerCantidadMovimientosAsync(string userId);
        Task<int> ObtenerCantidadResultadosAsync(string userId);
        Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados);
        Task<object> ObtenerDatosProcesados(string userId);
        Task<List<object>> ObtenerMovimientosMuestraAsync(string userId);
        Task<List<object>> ObtenerResultadosMuestraAsync(string userId);

        // ... otros métodos ...
        Task<object> GenerarEstadoPorPeriodo(int año, int mes, string tipoPeriodo, string userId);
        Task<object> GenerarEstadoMensual(int año, int mes, string userId);
        Task<object> GenerarEstadoTrimestral(int año, int mes, string userId);

    }

 

    public class EstadoResultados
    {
        public Dictionary<string, decimal> TotalesPorGrupo { get; set; } = new Dictionary<string, decimal>();
        public Dictionary<string, decimal> KPIs { get; set; } = new Dictionary<string, decimal>();
        public string Periodo { get; set; } = string.Empty;
        public List<ResultadoGrupo> Detalles { get; set; } = new List<ResultadoGrupo>();
        public string UserId { get; set; } = string.Empty; // ← NUEVA PROPIEDAD
    }

    public class ExcelProcessingResult
    {
        public int RegistrosProcesados { get; set; }
        public int CentrosCostos { get; set; }
        public List<string> Errores { get; set; } = new List<string>();
    }
}