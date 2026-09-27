using System.Security.Cryptography;

namespace InventoryPrintHelper;

public static class CredentialStore
{
    public static string Protect(string value)
    {
        var plain = System.Text.Encoding.UTF8.GetBytes(value);
        return Convert.ToBase64String(ProtectedData.Protect(plain, null, DataProtectionScope.CurrentUser));
    }

    public static string Unprotect(string protectedValue)
    {
        if (string.IsNullOrWhiteSpace(protectedValue)) return "";
        var encrypted = Convert.FromBase64String(protectedValue);
        return System.Text.Encoding.UTF8.GetString(ProtectedData.Unprotect(encrypted, null, DataProtectionScope.CurrentUser));
    }
}
