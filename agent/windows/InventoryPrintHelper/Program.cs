namespace InventoryPrintHelper;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        var waitIndex = Array.IndexOf(args, "--wait-for-exit");
        if (waitIndex >= 0 && waitIndex + 1 < args.Length && int.TryParse(args[waitIndex + 1], out var previousPid))
        {
            try
            {
                using var previous = System.Diagnostics.Process.GetProcessById(previousPid);
                if (!previous.WaitForExit(15000)) return;
            }
            catch (ArgumentException) { } // The previous instance has already exited.
        }
        ApplicationConfiguration.Initialize();
        var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);
        AppLog.LogPath = dryRun ? Path.Combine(Path.GetTempPath(), "tn-inventory-print-helper-dry-run.log") : AppPaths.LogFile;
        try
        {
            if (args.Contains("--uninstall", StringComparer.OrdinalIgnoreCase))
            {
                StartupRegistrar.Uninstall();
                MessageBox.Show("Đã tắt tự khởi động TN Inventory Print Helper.", "Hoàn tất");
                return;
            }

            var elevatedIndex = Array.FindIndex(args, value => value.Equals("--setup-elevated", StringComparison.OrdinalIgnoreCase));
            if (elevatedIndex >= 0)
            {
                var source = elevatedIndex + 1 < args.Length ? args[elevatedIndex + 1] : Environment.ProcessPath!;
                RunSetupAndInstall(source);
                return;
            }

            if (!dryRun && !AppInstaller.IsInstalled)
            {
                AppInstaller.RelaunchElevatedSetup(Environment.ProcessPath!);
                return;
            }

            LoadedSettings loaded;
            if (dryRun)
            {
                loaded = new LoadedSettings(new AppSettings("https://example.invalid/api", "dry-run", Environment.MachineName, PrinterCatalog.GetInstalled().FirstOrDefault()?.Name ?? "Máy in thử", true), "dry-run");
            }
            else
            {
                if (!SettingsStore.Exists(AppPaths.SettingsFile))
                {
                    using var wizard = new SetupWizard();
                    if (wizard.ShowDialog() != DialogResult.OK || wizard.Result is null) return;
                    SettingsStore.Save(AppPaths.SettingsFile, wizard.Result.Settings, wizard.Result.Credential);
                }
                loaded = SettingsStore.Load(AppPaths.SettingsFile);
            }

            using var single = new SingleInstance(loaded.Settings.StoreId, Environment.UserName);
            if (!single.IsOwner)
            {
                MessageBox.Show("Ứng dụng máy in đã chạy trên tài khoản Windows này.", "TN Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            Application.Run(new TrayApplicationContext(loaded, dryRun));
        }
        catch (Exception exception)
        {
            AppLog.Error("Fatal error", exception);
            MessageBox.Show(exception.Message, "TN Inventory Print Helper", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void RunSetupAndInstall(string sourceExecutable)
    {
        if (!AppInstaller.IsAdministrator()) throw new UnauthorizedAccessException("Cần quyền quản trị để cài ứng dụng.");
        using var wizard = new SetupWizard();
        if (wizard.ShowDialog() != DialogResult.OK || wizard.Result is null) return;
        AppInstaller.Install(sourceExecutable);
        SettingsStore.Save(AppPaths.SettingsFile, wizard.Result.Settings, wizard.Result.Credential);
        AppInstaller.StartInstalled();
        MessageBox.Show("Đã cài xong. Ứng dụng sẽ tự mở cùng Windows và nằm ở khay hệ thống.", "Cài đặt thành công", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }
}
