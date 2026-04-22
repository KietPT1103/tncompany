using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace CashierMonitor;

public sealed record ActiveWindowInfo(
    int ProcessId,
    string ProcessName,
    string Title);

public static class WindowInfo
{
    public static ActiveWindowInfo? GetActiveWindow()
    {
        var handle = GetForegroundWindow();
        if (handle == IntPtr.Zero) return null;

        var title = GetWindowTitle(handle);
        if (string.IsNullOrWhiteSpace(title)) return null;

        _ = GetWindowThreadProcessId(handle, out var processId);
        if (processId == 0) return null;

        try
        {
            using var process = Process.GetProcessById((int) processId);
            return new ActiveWindowInfo((int) processId, process.ProcessName, title);
        }
        catch
        {
            return null;
        }
    }

    private static string GetWindowTitle(IntPtr handle)
    {
        var length = GetWindowTextLength(handle);
        if (length <= 0) return "";

        var builder = new StringBuilder(length + 1);
        _ = GetWindowText(handle, builder, builder.Capacity);
        return builder.ToString().Trim();
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", EntryPoint = "GetWindowTextW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", EntryPoint = "GetWindowTextLengthW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
