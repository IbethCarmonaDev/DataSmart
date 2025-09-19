// DataSmart.Core/Models/GrupoMaestro.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models;

[Table("grupo_maestro")]
public class GrupoMaestro
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("nombre_interno")]
    public string NombreInterno { get; set; }

    [Column("nombre_visible")]
    public string NombreVisible { get; set; }

    [Column("descripcion")]
    public string Descripcion { get; set; }

    [Column("orden")]
    public int Orden { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
}