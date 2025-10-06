using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("ClasificacionCuenta")]
public class ClasificacionCuenta
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public string Prefijo { get; set; } = string.Empty;
    public string Grupo { get; set; } = string.Empty;
    public string NaturalezaContable { get; set; } = string.Empty;
    public int OrdenGrupo { get; set; }
    public int OrdenNivel { get; set; } // 
    public string Nivel { get; set; } = string.Empty;

}