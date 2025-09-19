// DataSmart.Infrastructure/Repositories/GrupoMaestroRepository.cs
using DataSmart.Core.Interfaces;
using DataSmart.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace DataSmart.Infrastructure.Repositories;

public class GrupoMaestroRepository : IGrupoMaestroRepository
{
    private readonly DataSmartDbContext _context;

    public GrupoMaestroRepository(DataSmartDbContext context)
    {
        _context = context;
    }

    public async Task<Dictionary<string, int>> ObtenerOrdenGruposAsync()
    {
        try
        {
            // Eliminar el filtro por 'Activo' ya que la columna no existe
            var grupos = await _context.GrupoMaestro
                .OrderBy(g => g.Orden)
                .ToListAsync();

            return grupos.ToDictionary(g => g.NombreInterno, g => g.Orden);
        }
        catch (Exception ex)
        {
            // Log del error para debug
            Console.WriteLine($"Error en ObtenerOrdenGruposAsync: {ex.Message}");
            throw;
        }
    }

}