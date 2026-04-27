namespace CashierMonitor;

public sealed class BrowserWindowWatcher
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private readonly HashSet<string> _browserProcessNames;
    private string _lastWindowKey = "";

    public BrowserWindowWatcher(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
        _browserProcessNames = config.BrowserProcessNames
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
                CaptureActiveBrowserTab();
            }
            catch (Exception exception)
            {
                AgentLog.Error(exception, "Browser window watcher failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.BrowserPollSeconds), cancellationToken);
        }
    }

    private void CaptureActiveBrowserTab()
    {
        var activeWindow = WindowInfo.GetActiveWindow();
        if (activeWindow == null) return;

        var title = activeWindow.Title;
        var processId = activeWindow.ProcessId;
        var processName = activeWindow.ProcessName;
        if (!_browserProcessNames.Contains(processName.ToLowerInvariant())) return;

        var tabTitle = NormalizeTabTitle(title, processName);
        if (string.IsNullOrWhiteSpace(tabTitle)) return;

        var windowKey = $"{processId}|{processName}|{tabTitle}";
        if (string.Equals(windowKey, _lastWindowKey, StringComparison.Ordinal)) return;

        _lastWindowKey = windowKey;
        _queue.Enqueue(new ActivityEvent
        {
            EventType = "browser_tab_active",
            Action = "active_tab",
            AppName = processName,
            ProcessId = processId,
            Target = tabTitle,
            Details = ScreenshotCapture.WithScreenshot(new Dictionary<string, string?>
            {
                ["windowTitle"] = title,
                ["browser"] = processName,
            }),
        });
    }

    private static string NormalizeTabTitle(string title, string processName)
    {
        var normalized = title.Trim();
        var suffixes = BrowserSuffixes(processName);

        foreach (var suffix in suffixes)
        {
            if (normalized.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized[..^suffix.Length].Trim();
                break;
            }
        }

        return normalized;
    }

    private static IEnumerable<string> BrowserSuffixes(string processName)
    {
        yield return " - Google Chrome";
        yield return " - Microsoft Edge";
        yield return " - Mozilla Firefox";
        yield return " - Brave";
        yield return " - Opera";
        yield return " - Vivaldi";
        yield return $" - {processName}";
    }
}
