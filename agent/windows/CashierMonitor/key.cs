class KeyL
{
    private static IntPtr _hookID = IntPtr.Zero;

    public static void Start()
    {
        _hookID = SetHook(HookCallback);
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        return SetWindowsHookEx(13, proc, IntPtr.Zero, 0); // 13 = WH_KEYBOARD_LL
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        // xử lý phím tại đây
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    [DllImport("user32.dll")]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);
}