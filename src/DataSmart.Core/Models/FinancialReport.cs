using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DataSmart.Core.Models;

// Esta notación es MUY IMPORTANTE: especifica el esquema de la tabla
[Table("financial_reports", Schema = "finance")]
public class FinancialReport
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [Column("user_id")]
    public Guid UserId { get; set; } // Esta será la llave foránea

    [Required]
    [Column("original_filename")]
    public string OriginalFilename { get; set; } = string.Empty;

    [Column("file_size_kb")]
    public int? FileSizeKb { get; set; }

    [Required]
    [Column("report_type")]
    public string ReportType { get; set; } = string.Empty; // "income_statement", "balance_sheet"

    [Column("period")]
    public string? Period { get; set; }

    [Column("status")]
    public string Status { get; set; } = "processing"; // processing, completed, failed

    [Column("output_pdf_url")]
    public string? OutputPdfUrl { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Propiedad de navegación (para relacionarlo con el usuario)
    // La agregaremos después de configurar las relaciones
    // public User? User { get; set; }
}