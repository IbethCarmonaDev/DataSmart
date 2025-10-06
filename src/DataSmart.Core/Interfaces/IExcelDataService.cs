using DataSmart.Core.Models;

namespace DataSmart.Core.Interfaces
{
    public interface IExcelDataService
    {
        // ✅ SOLO métodos de ACCESO A DATOS
        Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados);
        Task<List<ResultadoGrupo>> ObtenerDatosPorPeriodoAsync(int año, int mes = 0, string userId = null);
        Task<Dictionary<string, decimal>> CalcularTotalesPorGrupoAsync(int año, int mes = 0, string userId = null);
        Task<List<int>> ObtenerAniosDisponiblesAsync(string userId);
        Task<bool> ExistenDatosParaPeriodoAsync(int año, int mes = 0, string userId = null);

        // ✅ Métodos de DEBUG (acceso a datos)
        Task<int> ObtenerCantidadMovimientosAsync(string userId);
        Task<int> ObtenerCantidadResultadosAsync(string userId);
        Task<List<object>> ObtenerMovimientosMuestraAsync(string userId);
        Task<List<object>> ObtenerResultadosMuestraAsync(string userId);
        Task GuardarMovimientosContablesAsync(List<MovimientoContable> movimientos);
        Task<bool> LimpiarDatosUsuarioAsync(string userId);
        Task<Dictionary<string, int>> ObtenerOrdenGruposDesdeBDAsync(); 

    }
}