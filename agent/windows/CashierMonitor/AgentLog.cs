namespace CashierMonitor;

public static class AgentLog
{
    private static readonly object Gate = new();

    public static void Info(string message)
    {
        Write("INFO", message);
    }

    public static void Error(Exception exception, string message)
    {
        Write("ERROR", $"{message}: {exception}");
    }

    private static void Write(string level, string message)
    {
        try
        {
            Paths.EnsureDataDirectory();
            var line = $"{DateTimeOffset.Now:O} [{level}] {message}{Environment.NewLine}";
            lock (Gate)
            {
                File.AppendAllText(Paths.LogPath, line);
            }
        }
        catch
        {
            // The agent must never stop because local diagnostics failed.
        }
    }
}
