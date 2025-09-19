using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models;

[Table("plans")]
public class Plan
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [Column("name")]
    public string Name { get; set; } = string.Empty; // 'Básico', 'Pro'

    [Column("description")]
    public string? Description { get; set; }

    [Required]
    [Column("monthly_coin_allowance")]
    public int MonthlyCoinAllowance { get; set; } // Cantidad de DSC

    [Required]
    [Column("price_usd")]
    public decimal PriceUSD { get; set; }

    [Column("is_active")]
    public bool IsActive { get; set; } = true;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}