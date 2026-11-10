using Microsoft.Win32;
using System.Diagnostics;
using System.Security.Cryptography;

namespace TakeawayPrintHelper;
public static class AppInstaller
{
    public const string StartupName="TNCompany-TakeawayPrintHelper";
    public static string InstallDirectory=>Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"Programs","TNCompany","TakeawayPrintHelper");
    public static string InstalledExecutable=>Path.Combine(InstallDirectory,"TakeawayPrintHelper.exe");
    public static bool IsInstalled=>string.Equals(Path.GetFullPath(Environment.ProcessPath!),Path.GetFullPath(InstalledExecutable),StringComparison.OrdinalIgnoreCase);
    public static bool NeedsInstall(string source,string target) {
        if(!File.Exists(target))return true;
        using var original=File.OpenRead(source);using var installed=File.OpenRead(target);
        return original.Length!=installed.Length || !SHA256.HashData(original).SequenceEqual(SHA256.HashData(installed));
    }
    public static void Install(string source) {
        Directory.CreateDirectory(InstallDirectory);
        try {File.Copy(source,InstalledExecutable,true);}
        catch(IOException e){throw new IOException("Đóng helper takeaway đang chạy (chọn Thoát hoàn toàn ở khay hệ thống), rồi mở lại bộ cài.",e);}
        using var run=Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");
        run.SetValue(StartupName,$"\"{InstalledExecutable}\" --background");
        var shortcutType=Type.GetTypeFromProgID("WScript.Shell")??throw new InvalidOperationException("Windows không hỗ trợ tạo lối tắt.");
        dynamic shell=Activator.CreateInstance(shortcutType)!;
        dynamic shortcut=shell.CreateShortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"TN - In bill và tem.lnk"));
        shortcut.TargetPath=InstalledExecutable;shortcut.WorkingDirectory=InstallDirectory;shortcut.Description="In hóa đơn và tem takeaway";shortcut.Save();
    }
    public static void Start()=>Process.Start(new ProcessStartInfo(InstalledExecutable){UseShellExecute=true});
    public static void RemoveStartup(){using var run=Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run",true);run?.DeleteValue(StartupName,false);}
}
