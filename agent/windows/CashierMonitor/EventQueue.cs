using System.Text.Json;

namespace CashierMonitor;

public sealed class EventQueue
{
    private readonly object _gate = new();

    public void Enqueue(ActivityEvent activityEvent)
    {
        var json = JsonSerializer.Serialize(activityEvent, AgentJsonContext.Default.ActivityEvent);
        lock (_gate)
        {
            Paths.EnsureDataDirectory();
            File.AppendAllText(Paths.QueuePath, json + Environment.NewLine);
        }
    }

    public List<ActivityEvent> PeekBatch(int maxCount)
    {
        lock (_gate)
        {
            if (!File.Exists(Paths.QueuePath)) return [];

            var batch = new List<ActivityEvent>();
            foreach (var line in File.ReadLines(Paths.QueuePath))
            {
                if (batch.Count >= maxCount) break;
                if (string.IsNullOrWhiteSpace(line)) continue;

                try
                {
                    var item = JsonSerializer.Deserialize(line, AgentJsonContext.Default.ActivityEvent);
                    if (item != null)
                    {
                        batch.Add(item);
                    }
                }
                catch (JsonException)
                {
                    // Skip corrupt lines when rewriting the queue after a successful send.
                }
            }

            return batch;
        }
    }

    public void RemoveSent(int sentCount)
    {
        if (sentCount <= 0) return;

        lock (_gate)
        {
            if (!File.Exists(Paths.QueuePath)) return;

            var lines = File.ReadAllLines(Paths.QueuePath);
            var remaining = lines
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .Skip(sentCount)
                .ToArray();

            if (remaining.Length == 0)
            {
                File.Delete(Paths.QueuePath);
                return;
            }

            File.WriteAllLines(Paths.QueuePath, remaining);
        }
    }
}
