using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using WinFormsKeys = System.Windows.Forms.Keys;

namespace CashierMonitor;

public sealed class KeyboardWatcher : IDisposable
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private IntPtr _hookId = IntPtr.Zero;
    private readonly LowLevelKeyboardProc _proc;

    public KeyboardWatcher(AgentConfig config, EventQueue queue)
    {
        _config = config;
        _queue = queue;
        _proc = HookCallback;
    }

    public void Start()
    {
        _hookId = SetHook(_proc);
    }

    public void Dispose()
    {
        if (_hookId != IntPtr.Zero)
        {
            UnhookWindowsHookEx(_hookId);
            _hookId = IntPtr.Zero;
        }
    }

    private IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        using var currentProcess = Process.GetCurrentProcess();
        using var currentModule = currentProcess.MainModule;
        var moduleName = currentModule?.ModuleName;
        var moduleHandle = string.IsNullOrWhiteSpace(moduleName) ? IntPtr.Zero : GetModuleHandle(moduleName);
        var hookId = SetWindowsHookEx(WH_KEYBOARD_LL, proc, moduleHandle, 0);
        if (hookId == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Failed to install keyboard hook.");
        }

        return hookId;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && wParam == (IntPtr)WM_KEYDOWN)
        {
            var vkCode = Marshal.ReadInt32(lParam);
            var winFormsKey = (WinFormsKeys)vkCode;
            var key = FormatKey(winFormsKey, vkCode);
            var details = new Dictionary<string, string?>
            {
                ["keyCode"] = vkCode.ToString(),
            };

            if (winFormsKey == WinFormsKeys.Enter)
            {
                details = ScreenshotCapture.WithScreenshot(details);
            }

            _queue.Enqueue(new ActivityEvent
            {
                EventType = "keyboard",
                Action = "keydown",
                Target = key,
                Details = details,
            });
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private static string FormatKey(WinFormsKeys key, int vkCode)
    {
        if (key >= WinFormsKeys.A && key <= WinFormsKeys.Z)
        {
            return ((char)vkCode).ToString();
        }

        if (key >= WinFormsKeys.D0 && key <= WinFormsKeys.D9)
        {
            return ((char)('0' + (vkCode - (int)WinFormsKeys.D0))).ToString();
        }

        if (key >= WinFormsKeys.NumPad0 && key <= WinFormsKeys.NumPad9)
        {
            return $"NumPad{vkCode - (int)WinFormsKeys.NumPad0}";
        }

        return key switch
        {
            WinFormsKeys.Space => "Space",
            WinFormsKeys.Enter => "Enter",
            WinFormsKeys.Tab => "Tab",
            WinFormsKeys.Back => "Backspace",
            WinFormsKeys.Escape => "Escape",
            WinFormsKeys.Delete => "Delete",
            WinFormsKeys.Left => "Left",
            WinFormsKeys.Right => "Right",
            WinFormsKeys.Up => "Up",
            WinFormsKeys.Down => "Down",
            _ => key.ToString(),
        };
    }

    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

}
