using System.Diagnostics;

namespace CashierMonitor;

public sealed class ProcessWatcher
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly Dictionary<int, string> _known = new();
    private readonly HashSet<string> _ignoreNames;

    public ProcessWatcher(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
        _ignoreNames = config.IgnoreProcessNames
            .Select(name => name.Trim().ToLowerInvariant())
            .Where(name => name.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        Snapshot(initial: true);

        while (!cancellationToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromSeconds(_config.ProcessPollSeconds), cancellationToken);
            Snapshot(initial: false);
        }
    }

    private void Snapshot(bool initial)
    {
        try
        {
            var current = new Dictionary<int, string>();
            foreach (var process in Process.GetProcesses())
            {
                using (process)
                {
                    var name = SafeProcessName(process);
                    if (string.IsNullOrWhiteSpace(name)) continue;
                    if (_ignoreNames.Contains(name.ToLowerInvariant())) continue;

                    current[process.Id] = name;

                    if (!initial && !_known.ContainsKey(process.Id))
                    {
                        _queue.Enqueue(new ActivityEvent
                        {
                            EventType = "app_opened",
                            Action = "opened",
                            AppName = name,
                            ProcessId = process.Id,
                            Target = name,
                            Details = ScreenshotCapture.WithScreenshot(),
                        });
                    }
                }
            }

            if (!initial)
            {
                foreach (var previous in _known)
                {
                    if (!current.ContainsKey(previous.Key))
                    {
                        _queue.Enqueue(new ActivityEvent
                        {
                            EventType = "app_closed",
                            Action = "closed",
                            AppName = previous.Value,
                            ProcessId = previous.Key,
                            Target = previous.Value,
                        });
                    }
                }
            }

            _known.Clear();
            foreach (var item in current)
            {
                _known[item.Key] = item.Value;
            }
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Process snapshot failed");
        }
    }

    private static string SafeProcessName(Process process)
    {
        try
        {
            return process.ProcessName;
        }
        catch
        {
            return "";
        }
    }
}
