namespace InventoryPrintHelper;

public sealed class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _tray;
    private readonly MainForm _window;
    private readonly CancellationTokenSource _stop = new();
    private readonly IDisposable? _apiDisposable;

    public TrayApplicationContext(LoadedSettings loaded, bool dryRun)
    {
        var settings = loaded.Settings;
        IPrintJobApi api;
        IInventoryIssuePrinter printer;
        if (dryRun)
        {
            api = new DryRunApi();
            printer = new DryRunPrinter();
        }
        else
        {
            var client = new ApiClient(settings.ApiBaseUrl, loaded.Credential, settings.StoreId, settings.TerminalName);
            api = client;
            _apiDisposable = client;
            printer = new InventoryIssuePrinter(() => settings.PaperSize);
        }

        var worker = new PrintJobWorker(api, printer, () => settings.PrinterName, PrinterCatalog.IsInstalled);
        if (settings.StartPaused) worker.Pause();
        _window = new MainForm(api, worker, printer, () => settings, OpenSettings);
        var menu = new ContextMenuStrip();
        menu.Items.Add("Mở quản lý", null, (_, _) => _window.ShowFromTray());
        menu.Items.Add("Tạm dừng", null, (_, _) => worker.Pause());
        menu.Items.Add("In tiếp", null, (_, _) => worker.Resume());
        menu.Items.Add("In thử", null, (_, _) => _window.PrintTest());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Thoát", null, (_, _) => Exit());
        _tray = new NotifyIcon { Icon = SystemIcons.Application, Text = "TN - In phiếu xuất kho", ContextMenuStrip = menu, Visible = true };
        _tray.DoubleClick += (_, _) => _window.ShowFromTray();
        _ = RunWorkerAsync(worker);
        if (!Environment.GetCommandLineArgs().Contains("--background", StringComparer.OrdinalIgnoreCase)) _window.ShowFromTray();
    }

    private async Task RunWorkerAsync(PrintJobWorker worker)
    {
        try { await worker.RunAsync(TimeSpan.FromSeconds(3), _stop.Token); }
        catch (OperationCanceledException) { }
        catch (Exception exception) { AppLog.Error("Worker stopped", exception); }
    }

    private void OpenSettings()
    {
        if (!SettingsStore.Exists(AppPaths.SettingsFile)) return;
        var current = SettingsStore.Load(AppPaths.SettingsFile);
        using var wizard = new SetupWizard(current);
        if (wizard.ShowDialog(_window) != DialogResult.OK || wizard.Result is null) return;
        SettingsStore.Save(AppPaths.SettingsFile, wizard.Result.Settings, wizard.Result.Credential);
        MessageBox.Show(_window, "Đã lưu cấu hình. Ứng dụng sẽ khởi động lại.", "Hoàn tất", MessageBoxButtons.OK, MessageBoxIcon.Information);
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Environment.ProcessPath!, $"--background --wait-for-exit {Environment.ProcessId}") { UseShellExecute = true });
        Exit();
    }

    private void Exit()
    {
        _stop.Cancel();
        _tray.Visible = false;
        _window.RequestExit();
        _apiDisposable?.Dispose();
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { _stop.Dispose(); _tray.Dispose(); _window.Dispose(); _apiDisposable?.Dispose(); }
        base.Dispose(disposing);
    }
}
