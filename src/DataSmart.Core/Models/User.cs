using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models;

[Table("users")] // Esto mapea la clase a la tabla "users" en PostgreSQL
public class User
{
    [Key] // Esto indica que esta propiedad es la llave primaria
    public Guid Id { get; set; }

    [Required]
    [EmailAddress]
    [Column("email")] // Mapea a la columna "email"
    public string Email { get; set; } = string.Empty;

    [Column("full_name")]
    public string? FullName { get; set; }

    [Column("company_name")]
    public string? CompanyName { get; set; }

    [Column("locale")]
    public string Locale { get; set; } = "es-CO";

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}