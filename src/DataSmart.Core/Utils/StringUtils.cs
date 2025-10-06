// DataSmart.Core/Utils/StringUtils.cs
namespace DataSmart.Core.Utils;

public static class StringUtils
{
    public static string NormalizarNombreGrupo(string nombreGrupo)
    {
        if (string.IsNullOrEmpty(nombreGrupo))
            return nombreGrupo;

        // ✅ CONVERTIR A MAYÚSCULAS Y REMOVER CARACTERES ESPECIALES
        return nombreGrupo.ToUpper()
            .Replace("_", " ")
            .Replace("-", " ")
            .Replace(".", " ")
            .Trim();
    }

}