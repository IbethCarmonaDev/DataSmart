using DataSmart.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace DataSmart.Infrastructure;

public class DataSmartDbContext : DbContext
{
    // Este constructor es necesario para la configuración
    public DataSmartDbContext(DbContextOptions<DataSmartDbContext> options) : base(options)
    {

    }

    // Define aquí las DbSet (Tablas) para CADA modelo del esquema 'public'
    public DbSet<User> Users { get; set; }
    public DbSet<Plan> Plans { get; set; }
    public DbSet<GrupoMaestro> GrupoMaestro { get; set; }
    public DbSet<ResultadoGrupo> ResultadosGrupos { get; set; }
    public DbSet<ResultadoGrupo> ResultadoGrupo { get; set; }
    public DbSet<MovimientoContable> MovimientoContable { get; set; }
    public DbSet<ClasificacionCuenta> ClasificacionCuenta { get; set; }    
    public DbSet<FinancialReport> FinancialReports { get; set; }



    // Este método se usa para configurar el modelo de la base de datos


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        //modelBuilder.HasDefaultSchema("public");

        //modelBuilder.Entity<MovimientoContable>().ToTable("\"MovimientoContable\"");
        //modelBuilder.Entity<ClasificacionCuenta>().ToTable("\"ClasificacionCuenta\"");
        //modelBuilder.Entity<ResultadoGrupo>().ToTable("\"ResultadoGrupo\"");
        //modelBuilder.Entity<GrupoMaestro>().ToTable("\"GrupoMaestro\"");



        // Configuración para GrupoMaestro
        modelBuilder.Entity<GrupoMaestro>(entity =>
        {
            entity.ToTable("grupo_maestro"); // Nombre de la tabla
            entity.Property(g => g.NombreInterno).IsRequired().HasMaxLength(100);
            entity.Property(g => g.NombreVisible).IsRequired().HasMaxLength(100);
            entity.Property(g => g.Orden).IsRequired();
        });

        modelBuilder.Entity<ResultadoGrupo>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Grupo).HasMaxLength(100);
            entity.Property(r => r.NombreVisible).HasMaxLength(200);
            entity.Property(r => r.CodCuenta).HasMaxLength(50);
            entity.Property(r => r.Cuenta).HasMaxLength(200);
            entity.Property(r => r.Nivel).HasMaxLength(50);
            entity.Property(r => r.Naturaleza).HasMaxLength(10);
        });

        modelBuilder.Entity<ClasificacionCuenta>(entity =>
        {
            entity.HasKey(c => c.Id); // O la propiedad que sea tu PK
            entity.Property(c => c.Prefijo).HasMaxLength(50);
            entity.Property(c => c.Grupo).HasMaxLength(100);
            entity.Property(c => c.NaturalezaContable).HasMaxLength(10);
            entity.Property(c => c.Nivel).HasMaxLength(50);
        });


        modelBuilder.Entity<MovimientoContable>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.CodCuenta).HasMaxLength(50);
            entity.Property(m => m.Cuenta).HasMaxLength(200);
            entity.Property(m => m.CodCC).HasMaxLength(50);
            entity.Property(m => m.CentroCostos).HasMaxLength(200);
        });

    }



}