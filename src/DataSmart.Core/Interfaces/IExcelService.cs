using DataSmart.Core.Models;
using DataSmart.Core.Services;
using Microsoft.AspNetCore.Http;

namespace DataSmart.Core.Interfaces
{
    public interface IExcelService
    {
        // ✅ SOLO métodos de LÓGICA DE NEGOCIO
        Task<ProcesamientoExcelResult> ProcesarArchivoAsync(string filePath);
        Task<ReporteEstadoResultados> FormatearReporte(List<ResultadoGrupo> resultados, int ano, int mes);

        // ✅ Métodos de GENERACIÓN DE REPORTES
        Task<EstadoResultados> GenerarEstadoResultados(int año, int mes, string tipo);
        Task<Dictionary<string, decimal>> CalcularKPIsFinancieros(int año);
        Task<object> GenerarEstadoPorPeriodo(int año, int mes, string tipoPeriodo);
        Task<object> GenerarEstadoAnual(int año);
        Task<object> GenerarEstadoMensual(int año, int mes);
        Task<object> GenerarEstadoTrimestral(int año, int mes);
        Task<List<int>> ObtenerAniosDisponiblesAsync();

        Task<int> ObtenerCantidadMovimientosAsync();
        Task<int> ObtenerCantidadResultadosAsync();
        Task<List<object>> ObtenerMovimientosMuestraAsync();
        Task<List<object>> ObtenerResultadosMuestraAsync();

        Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados);
        Task<object> ObtenerDatosProcesados();


    }

    public class EstadoResultados
    {
        public Dictionary<string, decimal> TotalesPorGrupo { get; set; } = new Dictionary<string, decimal>();
        public Dictionary<string, decimal> KPIs { get; set; } = new Dictionary<string, decimal>();
        public string Periodo { get; set; } = string.Empty;
        public List<ResultadoGrupo> Detalles { get; set; } = new List<ResultadoGrupo>();
    }

    public class ExcelProcessingResult
    {
        public int RegistrosProcesados { get; set; }
        public int CentrosCostos { get; set; }
        public List<string> Errores { get; set; } = new List<string>();
    }
}