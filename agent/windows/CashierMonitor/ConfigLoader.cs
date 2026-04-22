using System.Text.Json;

namespace CashierMonitor;

public static class ConfigLoader
{
    public static AgentConfig Load(string[] args)
    {
        var configPath = GetValue(args, "--config") ?? Paths.ConfigPath;
        if (!File.Exists(configPath))
        {
            throw new InvalidOperationException($"Missing config file: {configPath}");
        }

        var json = File.ReadAllText(configPath);
        var config = JsonSerializer.Deserialize(json, AgentJsonContext.Default.AgentConfig)
            ?? throw new InvalidOperationException($"Invalid config file: {configPath}");

        if (string.IsNullOrWhiteSpace(config.MachineId))
        {
            config.MachineId = Environment.MachineName;
        }

        if (string.IsNullOrWhiteSpace(config.ServerUrl))
        {
            throw new InvalidOperationException("Config ServerUrl is required.");
        }

        if (string.IsNullOrWhiteSpace(config.ApiKey))
        {
            throw new InvalidOperationException("Config ApiKey is required.");
        }

        config.SyncIntervalSeconds = Math.Max(10, config.SyncIntervalSeconds);
        config.ProcessPollSeconds = Math.Max(1, config.ProcessPollSeconds);
        config.DnsPollSeconds = Math.Max(10, config.DnsPollSeconds);
        config.MaxBatchSize = Math.Clamp(config.MaxBatchSize, 1, 500);
        config.WatchPaths = config.WatchPaths
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return config;
    }

    public static string? GetValue(string[] args, string name)
    {
        for (var index = 0; index < args.Length; index += 1)
        {
            if (!string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase)) continue;
            if (index + 1 >= args.Length) return null;
            return args[index + 1];
        }

        return null;
    }

    public static bool HasFlag(string[] args, string name)
    {
        return args.Any(arg => string.Equals(arg, name, StringComparison.OrdinalIgnoreCase));
    }
}
