using System.Diagnostics;
using System.Security;
using System.Security.Principal;
using System.Text;

namespace InventoryPrintHelper;

public static class StartupRegistrar
{
    public static string BuildTaskXml(string executablePath, string userSid)
    {
        var executable = SecurityElement.Escape(executablePath);
        var sid = SecurityElement.Escape(userSid);
        return $"""
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>{sid}</UserId></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>{sid}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure></Settings>
  <Actions Context="Author"><Exec><Command>{executable}</Command><Arguments>--background</Arguments><WorkingDirectory>{SecurityElement.Escape(Path.GetDirectoryName(executablePath) ?? "")}</WorkingDirectory></Exec></Actions>
</Task>
""";
    }

    public static void InstallForInteractiveLogon(string executablePath)
    {
        var sid = WindowsIdentity.GetCurrent().User?.Value ?? throw new InvalidOperationException("Không xác định được tài khoản Windows.");
        var temp = Path.Combine(Path.GetTempPath(), "tn-inventory-print-helper-" + Guid.NewGuid().ToString("N") + ".xml");
        try
        {
            File.WriteAllText(temp, BuildTaskXml(executablePath, sid), Encoding.Unicode);
            RunSchtasks($"/Create /TN \"{AppPaths.TaskName}\" /XML \"{temp}\" /F");
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    public static void Uninstall() => RunSchtasks($"/Delete /TN \"{AppPaths.TaskName}\" /F", allowMissing: true);

    private static void RunSchtasks(string arguments, bool allowMissing = false)
    {
        using var process = Process.Start(new ProcessStartInfo("schtasks.exe", arguments) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true })
            ?? throw new InvalidOperationException("Không chạy được Task Scheduler.");
        process.WaitForExit();
        if (process.ExitCode != 0 && !allowMissing) throw new InvalidOperationException(process.StandardError.ReadToEnd().Trim());
    }
}
