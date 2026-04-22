using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

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
        var handle = GetForegroundWindow();
        if (handle == IntPtr.Zero) return;

        var title = GetWindowTitle(handle);
        if (string.IsNullOrWhiteSpace(title)) return;

        _ = GetWindowThreadProcessId(handle, out var processId);
        if (processId == 0) return;

        using var process = Process.GetProcessById((int) processId);
        var processName = process.ProcessName;
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
            ProcessId = (int) processId,
            Target = tabTitle,
            Details = new Dictionary<string, string?>
            {
                ["windowTitle"] = title,
                ["browser"] = processName,
            },
        });
    }

    private static string GetWindowTitle(IntPtr handle)
    {
        var length = GetWindowTextLength(handle);
        if (length <= 0) return "";

        var builder = new StringBuilder(length + 1);
        _ = GetWindowText(handle, builder, builder.Capacity);
        return builder.ToString().Trim();
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

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
