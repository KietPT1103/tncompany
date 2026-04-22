namespace CashierMonitor;

public static class Paths
{
    public static string DataDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "TNCompany",
            "CashierMonitor");

    public static string ConfigPath => Path.Combine(DataDirectory, "config.json");
    public static string QueuePath => Path.Combine(DataDirectory, "queue.jsonl");
    public static string LogPath => Path.Combine(DataDirectory, "agent.log");

    public static void EnsureDataDirectory()
    {
        Directory.CreateDirectory(DataDirectory);
    }

    public static string ExpandPath(string path)
    {
        return Environment.ExpandEnvironmentVariables(path);
    }
}
