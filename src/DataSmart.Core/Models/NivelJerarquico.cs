using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class NivelJerarquico
{
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty; // "NIVEL"
    public Dictionary<int, decimal> ValoresPorMes { get; set; } = new Dictionary<int, decimal>();
    public decimal Total { get; set; }
    public List<CuentaJerarquica> Detalles { get; set; } = new List<CuentaJerarquica>();
}