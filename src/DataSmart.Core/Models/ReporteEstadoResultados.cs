namespace DataSmart.Core.Models;

public class ReporteEstadoResultados
{
    public int Ano { get; set; }
    public int Mes { get; set; }
    public string Titulo => $"Estado de Resultados - {Mes}/{Ano}";
    public List<LineaReporte> Lineas { get; set; } = new List<LineaReporte>();
    public decimal TotalIngresos { get; set; }
    public decimal TotalGastos { get; set; }
    public decimal ResultadoNeto { get; set; }
}

public class LineaReporte
{
    public string Tipo { get; set; } // "GRUPO", "CUENTA", "SUBTOTAL"
    public string Codigo { get; set; } // Código de cuenta o grupo
    public string Descripcion { get; set; }
    public string Nivel { get; set; }
    public decimal Total { get; set; }
    public bool EsTotal { get; set; }
    public int Orden { get; set; } // Para ordenar las líneas del reporte
}