using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class CuentaJerarquica
{
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty; // "CUENTA"
    public Dictionary<int, decimal> ValoresPorMes { get; set; } = new Dictionary<int, decimal>();
    public decimal Total { get; set; }
}