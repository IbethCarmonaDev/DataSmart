using DataSmart.Core.Models;

namespace DataSmart.Core.Interfaces
{
    public interface IExcelDataService
    {
        // ✅ SOLO métodos de ACCESO A DATOS
        Task GuardarDatosProcesadosAsync(List<ResultadoGrupo> resultados);
        Task<List<ResultadoGrupo>> ObtenerDatosPorPeriodoAsync(int año, int mes = 0);
        Task<Dictionary<string, decimal>> CalcularTotalesPorGrupoAsync(int año, int mes = 0);
        Task<List<int>> ObtenerAniosDisponiblesAsync();
        Task<bool> ExistenDatosParaPeriodoAsync(int año, int mes = 0);

        // ✅ Métodos de DEBUG (acceso a datos)
        Task<int> ObtenerCantidadMovimientosAsync();
        Task<int> ObtenerCantidadResultadosAsync();
        Task<List<object>> ObtenerMovimientosMuestraAsync();
        Task<List<object>> ObtenerResultadosMuestraAsync();
        Task GuardarMovimientosContablesAsync(List<MovimientoContable> movimientos);

    }
}