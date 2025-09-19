using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models;

public class ResultadoGrupo
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; } // ← AGREGAR ESTA PROPIEDAD

    public string Grupo { get; set; } = string.Empty;
    public string NombreVisible { get; set; } = string.Empty;
    public string CodCuenta { get; set; } = string.Empty;
    public string Cuenta { get; set; } = string.Empty;
    public string Nivel { get; set; } = string.Empty;
    public int Mes { get; set; }
    public int Ano { get; set; }
    public decimal Total { get; set; }
    public string Naturaleza { get; set; } = string.Empty;
}