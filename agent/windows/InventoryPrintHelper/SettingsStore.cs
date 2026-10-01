using System.Text.Json;

namespace InventoryPrintHelper;

public sealed record AppSettings(string ApiBaseUrl, string StoreId, string TerminalName, string PrinterName, bool StartPaused, string PaperSize = "A5");
public sealed record LoadedSettings(AppSettings Settings, string Credential);

public static class SettingsStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public static void Save(string path, AppSettings settings, string credential)
    {
        var directory = Path.GetDirectoryName(path) ?? throw new InvalidOperationException("Invalid settings path.");
        Directory.CreateDirectory(directory);
        var payload = new StoredSettings(settings, CredentialStore.Protect(credential));
        File.WriteAllText(path, JsonSerializer.Serialize(payload, JsonOptions));
    }

    public static LoadedSettings Load(string path)
    {
        var payload = JsonSerializer.Deserialize<StoredSettings>(File.ReadAllText(path), JsonOptions)
            ?? throw new InvalidDataException("Không đọc được cấu hình Print Helper.");
        return new LoadedSettings(payload.Settings, CredentialStore.Unprotect(payload.ProtectedCredential));
    }

    public static bool Exists(string path) => File.Exists(path);
    private sealed record StoredSettings(AppSettings Settings, string ProtectedCredential);
}
