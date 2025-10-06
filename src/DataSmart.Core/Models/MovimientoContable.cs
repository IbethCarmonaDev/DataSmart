using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models
{
    [Table("MovimientoContable")]
    [Index(nameof(UserId))]
    public class MovimientoContable
    {
        [Key] // ← ESTA ANOTACIÓN ES CRÍTICA
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; } 
        public string UserId { get; set; } 
        public int Ano { get; set; }
        public int Mes { get; set; }
        public string CodCuenta { get; set; } = string.Empty;
        public string Cuenta { get; set; } = string.Empty;
        public string CodCC { get; set; } = string.Empty;
        public string CentroCostos { get; set; } = string.Empty;
        public decimal Debito { get; set; }
        public decimal Credito { get; set; }
    }
}