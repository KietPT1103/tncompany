using System.Diagnostics;
using System.Security.Principal;

namespace InventoryPrintHelper;

public static class AppInstaller
{
    public static bool IsInstalled => string.Equals(
        Path.GetFullPath(Environment.ProcessPath ?? ""),
        Path.GetFullPath(AppPaths.InstalledExecutable),
        StringComparison.OrdinalIgnoreCase);

    public static bool IsAdministrator() =>
        new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);

    public static void RelaunchElevatedSetup(string sourceExecutable)
    {
        Process.Start(new ProcessStartInfo(sourceExecutable)
        {
            UseShellExecute = true,
            Verb = "runas",
            Arguments = $"--setup-elevated \"{sourceExecutable}\"",
        });
    }

    public static void Install(string sourceExecutable)
    {
        if (!IsAdministrator()) throw new UnauthorizedAccessException("Cần quyền quản trị để cài ứng dụng.");
        Directory.CreateDirectory(AppPaths.InstallDirectory);
        if (!string.Equals(Path.GetFullPath(sourceExecutable), Path.GetFullPath(AppPaths.InstalledExecutable), StringComparison.OrdinalIgnoreCase))
            File.Copy(sourceExecutable, AppPaths.InstalledExecutable, true);
        Directory.CreateDirectory(AppPaths.DataDirectory);
        GrantDataDirectoryAccess();
        StartupRegistrar.InstallForInteractiveLogon(AppPaths.InstalledExecutable);
    }

    public static void StartInstalled()
    {
        Process.Start(new ProcessStartInfo(AppPaths.InstalledExecutable, "--background") { UseShellExecute = true });
    }

    private static void GrantDataDirectoryAccess()
    {
        var sid = WindowsIdentity.GetCurrent().User?.Value ?? throw new InvalidOperationException("Không xác định được tài khoản Windows.");
        using var process = new Process { StartInfo = new ProcessStartInfo("icacls.exe") { UseShellExecute = false, CreateNoWindow = true } };
        process.StartInfo.ArgumentList.Add(AppPaths.DataDirectory);
        process.StartInfo.ArgumentList.Add("/inheritance:r");
        process.StartInfo.ArgumentList.Add("/grant:r");
        process.StartInfo.ArgumentList.Add($"*{sid}:(OI)(CI)M");
        process.StartInfo.ArgumentList.Add("*S-1-5-18:(OI)(CI)F");
        process.StartInfo.ArgumentList.Add("*S-1-5-32-544:(OI)(CI)F");
        process.Start();
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException("Không thể cấp quyền thư mục dữ liệu.");
    }
}
