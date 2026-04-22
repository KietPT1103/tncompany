using System.Text.Json.Serialization;

namespace CashierMonitor;

public sealed class AgentConfig
{
    public string MachineId { get; set; } = Environment.MachineName;
    public string ServerUrl { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public int SyncIntervalSeconds { get; set; } = 30;
    public int ProcessPollSeconds { get; set; } = 2;
    public int DnsPollSeconds { get; set; } = 20;
    public int MaxBatchSize { get; set; } = 100;
    public List<string> WatchPaths { get; set; } = DefaultWatchPaths();
    public List<string> IgnoreProcessNames { get; set; } = ["cashiermonitor"];

    public static List<string> DefaultWatchPaths() =>
    [
        @"%USERPROFILE%\Desktop",
        @"%USERPROFILE%\Downloads",
        @"%USERPROFILE%\Documents",
        @"C:\Users\Public\Desktop"
    ];
}

public sealed class ActivityEvent
{
    public string EventId { get; set; } = Guid.NewGuid().ToString("N");
    public string EventTime { get; set; } = DateTimeOffset.Now.ToString("O");
    public string EventType { get; set; } = "";
    public string? Action { get; set; }
    public string? AppName { get; set; }
    public int? ProcessId { get; set; }
    public string? Target { get; set; }
    public Dictionary<string, object?>? Details { get; set; }
}

public sealed class LogBatch
{
    public string MachineId { get; set; } = "";
    public List<ActivityEvent> Events { get; set; } = [];
}

[JsonSerializable(typeof(AgentConfig))]
[JsonSerializable(typeof(ActivityEvent))]
[JsonSerializable(typeof(LogBatch))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    WriteIndented = false,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
internal sealed partial class AgentJsonContext : JsonSerializerContext
{
}
