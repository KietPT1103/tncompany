using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using WinFormsKeys = System.Windows.Forms.Keys;

namespace CashierMonitor;

public sealed class KeyboardWatcher : IDisposable
{
    private const int BufferedKeyIdleMilliseconds = 5_000;
    private readonly EventQueue _queue;
    private readonly object _bufferGate = new();
    private readonly StringBuilder _buffer = new();
    private readonly System.Threading.Timer _bufferTimer;
    private IntPtr _hookId = IntPtr.Zero;
    private readonly LowLevelKeyboardProc _proc;

    public KeyboardWatcher(AgentConfig config, EventQueue queue)
    {
        _queue = queue;
        _proc = HookCallback;
        _bufferTimer = new System.Threading.Timer(
            _ => FlushBufferedKeys("idle"),
            null,
            Timeout.Infinite,
            Timeout.Infinite);
    }

    public void Start()
    {
        _hookId = SetHook(_proc);
    }

    public void Dispose()
    {
        FlushBufferedKeys("dispose");
        _bufferTimer.Dispose();

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

            if (TryBufferKey(winFormsKey, vkCode))
            {
                return CallNextHookEx(_hookId, nCode, wParam, lParam);
            }

            if (winFormsKey == WinFormsKeys.Enter && FlushBufferedKeys("enter", includeScreenshot: true))
            {
                return CallNextHookEx(_hookId, nCode, wParam, lParam);
            }

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

    private bool TryBufferKey(WinFormsKeys key, int vkCode)
    {
        if (key >= WinFormsKeys.A && key <= WinFormsKeys.Z)
        {
            AppendToBuffer(char.ToLowerInvariant((char)vkCode).ToString());
            return true;
        }

        if (key >= WinFormsKeys.D0 && key <= WinFormsKeys.D9)
        {
            AppendToBuffer(((char)('0' + (vkCode - (int)WinFormsKeys.D0))).ToString());
            return true;
        }

        if (key == WinFormsKeys.Space && HasBufferedKeys())
        {
            AppendToBuffer(" ");
            return true;
        }

        if (key == WinFormsKeys.Back)
        {
            return RemoveLastBufferedCharacter();
        }

        return false;
    }

    private void AppendToBuffer(string value)
    {
        lock (_bufferGate)
        {
            _buffer.Append(value);
            _bufferTimer.Change(BufferedKeyIdleMilliseconds, Timeout.Infinite);
        }
    }

    private bool RemoveLastBufferedCharacter()
    {
        lock (_bufferGate)
        {
            if (_buffer.Length == 0)
            {
                return false;
            }

            _buffer.Length -= 1;
            if (_buffer.Length == 0)
            {
                _bufferTimer.Change(Timeout.Infinite, Timeout.Infinite);
            }
            else
            {
                _bufferTimer.Change(BufferedKeyIdleMilliseconds, Timeout.Infinite);
            }

            return true;
        }
    }

    private bool HasBufferedKeys()
    {
        lock (_bufferGate)
        {
            return _buffer.Length > 0;
        }
    }

    private bool FlushBufferedKeys(string reason, bool includeScreenshot = false)
    {
        ActivityEvent? bufferedEvent = null;

        lock (_bufferGate)
        {
            if (_buffer.Length == 0)
            {
                _bufferTimer.Change(Timeout.Infinite, Timeout.Infinite);
                return false;
            }

            var target = _buffer.ToString();
            _buffer.Clear();
            _bufferTimer.Change(Timeout.Infinite, Timeout.Infinite);

            var details = new Dictionary<string, string?>
            {
                ["flushReason"] = reason,
                ["length"] = target.Length.ToString(),
            };

            if (includeScreenshot)
            {
                details = ScreenshotCapture.WithScreenshot(details);
            }

            bufferedEvent = new ActivityEvent
            {
                EventType = "keyboard",
                Action = "keydown",
                Target = target,
                Details = details,
            };
        }

        _queue.Enqueue(bufferedEvent);
        return true;
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
