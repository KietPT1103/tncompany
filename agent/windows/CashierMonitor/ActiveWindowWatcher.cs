namespace CashierMonitor;

public sealed class ActiveWindowWatcher
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly HashSet<string> _ignoreNames;
    private string _lastWindowKey = "";

    public ActiveWindowWatcher(AgentConfig config, EventQueue queue)
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
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                CaptureActiveWindow();
            }
            catch (Exception exception)
            {
                AgentLog.Error(exception, "Active window watcher failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.BrowserPollSeconds), cancellationToken);
        }
    }

    private void CaptureActiveWindow()
    {
        var activeWindow = WindowInfo.GetActiveWindow();
        if (activeWindow == null) return;
        if (_ignoreNames.Contains(activeWindow.ProcessName.ToLowerInvariant())) return;

        var windowKey = $"{activeWindow.ProcessId}|{activeWindow.ProcessName}|{activeWindow.Title}";
        if (string.Equals(windowKey, _lastWindowKey, StringComparison.Ordinal)) return;

        _lastWindowKey = windowKey;
        _queue.Enqueue(new ActivityEvent
        {
            EventType = "app_active",
            Action = "active_window",
            AppName = activeWindow.ProcessName,
            ProcessId = activeWindow.ProcessId,
            Target = activeWindow.Title,
            Details = new Dictionary<string, string?>
            {
                ["windowTitle"] = activeWindow.Title,
            },
        });
    }
}
