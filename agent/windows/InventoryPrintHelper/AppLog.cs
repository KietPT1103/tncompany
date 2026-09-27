namespace InventoryPrintHelper;

public static class AppLog
{
    private static readonly object Sync = new();
    public static string LogPath { get; set; } = Path.Combine(Path.GetTempPath(), "tn-inventory-print-helper.log");

    public static void Info(string message) => Write("INFO", message);
    public static void Error(string message, Exception exception) => Write("ERROR", $"{message}: {exception.GetType().Name}: {exception.Message}");

    private static void Write(string level, string message)
    {
        lock (Sync)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
            File.AppendAllText(LogPath, $"{DateTimeOffset.Now:O} [{level}] {message}{Environment.NewLine}");
        }
    }
}
