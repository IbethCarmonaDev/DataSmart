using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class GrupoJerarquico
{
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty; // "GRUPO"
    public int Orden { get; set; }
    public Dictionary<int, decimal> ValoresPorMes { get; set; } = new Dictionary<int, decimal>();
    public decimal Total { get; set; }
    public List<NivelJerarquico> Detalles { get; set; } = new List<NivelJerarquico>();
}