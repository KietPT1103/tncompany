using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace CashierMonitor;

public sealed class MouseWatcher : IDisposable
{
    private readonly AgentConfig _config;
    private readonly EventQueue _queue;
    private IntPtr _hookId = IntPtr.Zero;
    private readonly LowLevelMouseProc _proc;

    public MouseWatcher(AgentConfig config, EventQueue queue)
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

    private IntPtr SetHook(LowLevelMouseProc proc)
    {
        using var currentProcess = Process.GetCurrentProcess();
        using var currentModule = currentProcess.MainModule;
        var moduleName = currentModule?.ModuleName;
        var moduleHandle = string.IsNullOrWhiteSpace(moduleName) ? IntPtr.Zero : GetModuleHandle(moduleName);
        var hookId = SetWindowsHookEx(WH_MOUSE_LL, proc, moduleHandle, 0);
        if (hookId == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Failed to install mouse hook.");
        }

        return hookId;
    }

    private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            var mouseStruct = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT))!;
            string action = "";
            if (wParam == (IntPtr)WM_LBUTTONDOWN) action = "left_click";
            else if (wParam == (IntPtr)WM_RBUTTONDOWN) action = "right_click";
            else if (wParam == (IntPtr)WM_MBUTTONDOWN) action = "middle_click";
            if (!string.IsNullOrEmpty(action))
            {
                _queue.Enqueue(new ActivityEvent
                {
                    EventType = "mouse",
                    Action = action,
                    Target = $"{mouseStruct.pt.x},{mouseStruct.pt.y}",
                    Details = new Dictionary<string, string?>
                    {
                        ["x"] = mouseStruct.pt.x.ToString(),
                        ["y"] = mouseStruct.pt.y.ToString(),
                    },
                });
            }
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    private const int WH_MOUSE_LL = 14;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MBUTTONDOWN = 0x0207;

    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct POINT
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSLLHOOKSTRUCT
    {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);
}
