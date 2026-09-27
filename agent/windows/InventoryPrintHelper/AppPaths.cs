namespace InventoryPrintHelper;

public static class AppPaths
{
    public const string TaskName = "TNCompany-InventoryPrintHelper";
    public static string InstallDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "TNCompany", "InventoryPrintHelper");
    public static string InstalledExecutable => Path.Combine(InstallDirectory, "InventoryPrintHelper.exe");
    public static string DataDirectory => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "TNCompany", "InventoryPrintHelper");
    public static string SettingsFile => Path.Combine(DataDirectory, "settings.json");
    public static string LogFile => Path.Combine(DataDirectory, "logs", "inventory-print-helper.log");
}
