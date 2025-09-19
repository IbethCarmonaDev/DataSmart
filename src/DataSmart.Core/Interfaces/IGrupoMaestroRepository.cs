using System.Collections.Generic;
using System.Threading.Tasks;

namespace DataSmart.Core.Interfaces;

public interface IGrupoMaestroRepository
{
    Task<Dictionary<string, int>> ObtenerOrdenGruposAsync();
}