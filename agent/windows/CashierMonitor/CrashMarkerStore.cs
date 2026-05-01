using System.Text.Json;

namespace CashierMonitor;

public static class CrashMarkerStore
{
    private const int MaxDetailLength = 4000;

    public static void Record(string context, Exception exception)
    {
        try
        {
            Paths.EnsureDataDirectory();
            var marker = new CrashMarker
            {
                Context = Trim(context),
                RecordedAt = DateTimeOffset.Now.ToString("O"),
                MachineName = Environment.MachineName,
                OsVersion = Environment.OSVersion.VersionString,
                ExceptionType = Trim(exception.GetType().FullName ?? exception.GetType().Name),
                Message = Trim(exception.Message),
                StackTrace = TrimNullable(exception.ToString()),
            };

            var json = JsonSerializer.Serialize(marker, AgentJsonContext.Default.CrashMarker);
            File.WriteAllText(Paths.CrashMarkerPath, json);
        }
        catch
        {
            // The agent must never stop because local diagnostics failed.
        }
    }

    public static void ReplayIfPresent(EventQueue queue, string machineId)
    {
        try
        {
            if (!File.Exists(Paths.CrashMarkerPath))
            {
                return;
            }

            var json = File.ReadAllText(Paths.CrashMarkerPath);
            var marker = JsonSerializer.Deserialize(json, AgentJsonContext.Default.CrashMarker);
            if (marker == null)
            {
                File.Delete(Paths.CrashMarkerPath);
                return;
            }

            queue.Enqueue(new ActivityEvent
            {
                EventType = "agent_crashed",
                Action = marker.Context,
                Target = machineId,
                Details = new Dictionary<string, string?>
                {
                    ["recordedAt"] = marker.RecordedAt,
                    ["machineName"] = marker.MachineName,
                    ["osVersion"] = marker.OsVersion,
                    ["exceptionType"] = marker.ExceptionType,
                    ["message"] = marker.Message,
                    ["stackTrace"] = marker.StackTrace,
                },
            });

            File.Delete(Paths.CrashMarkerPath);
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Failed to replay crash marker");
        }
    }

    private static string Trim(string value)
    {
        var normalized = value.Trim();
        if (normalized.Length <= MaxDetailLength)
        {
            return normalized;
        }

        return normalized[..MaxDetailLength];
    }

    private static string? TrimNullable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Trim(value);
    }
}
