namespace InventoryPrintHelper;

public sealed class PrintJobWorker
{
    private readonly IPrintJobApi _api;
    private readonly IInventoryIssuePrinter _printer;
    private readonly Func<string> _printerName;
    private readonly Func<string, bool> _printerExists;

    public PrintJobWorker(IPrintJobApi api, IInventoryIssuePrinter printer, Func<string> printerName, Func<string, bool> printerExists)
    {
        _api = api;
        _printer = printer;
        _printerName = printerName;
        _printerExists = printerExists;
    }

    public bool IsPaused { get; private set; }
    public event Action<WorkerSnapshot>? SnapshotChanged;
    public void Pause() => IsPaused = true;
    public void Resume() => IsPaused = false;

    public static TimeSpan ReconnectDelay(int failedAttempts) =>
        TimeSpan.FromSeconds(Math.Min(30, Math.Pow(2, Math.Clamp(failedAttempts, 0, 5))));

    public async Task<WorkerSnapshot> ProcessOnceAsync(CancellationToken cancellationToken)
    {
        if (IsPaused) return Publish(WorkerState.Paused, "Đang tạm dừng.");
        var printerName = _printerName().Trim();
        if (printerName.Length == 0 || !_printerExists(printerName))
        {
            IsPaused = true;
            return Publish(WorkerState.PrinterUnavailable, "Máy in đã chọn không còn tồn tại.");
        }

        ClaimedPrintJob? claimed;
        try
        {
            claimed = await _api.ClaimAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            return Publish(WorkerState.Warning, "Không kết nối được API: " + exception.Message);
        }
        if (claimed is null) return Publish(WorkerState.Idle, "Không có phiếu chờ in.");

        Publish(WorkerState.Printing, $"Đang in {claimed.Job.Document?.IssueCode ?? claimed.Job.IssueId}...", claimed.Job);
        var result = _printer.Print(claimed.Job, printerName);
        if (!result.Accepted)
        {
            await _api.MarkFailedAsync(claimed.Job.Id, claimed.ClaimToken, result.Error, cancellationToken);
            return Publish(WorkerState.Warning, result.Error, claimed.Job);
        }

        try
        {
            await _api.MarkPrintedAsync(claimed.Job.Id, claimed.ClaimToken, cancellationToken);
            return Publish(WorkerState.Idle, "Đã gửi phiếu tới máy in.", claimed.Job);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            await _api.MarkUncertainAsync(claimed.Job.Id, claimed.ClaimToken, "Windows đã nhận lệnh nhưng API chưa xác nhận: " + exception.Message, cancellationToken);
            return Publish(WorkerState.Warning, "Cần kiểm tra phiếu vừa in trước khi in lại.", claimed.Job);
        }
    }

    public async Task RunAsync(TimeSpan pollInterval, CancellationToken cancellationToken)
    {
        var failures = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            var snapshot = await ProcessOnceAsync(cancellationToken);
            failures = snapshot.State == WorkerState.Warning ? failures + 1 : 0;
            var delay = snapshot.State == WorkerState.Warning ? ReconnectDelay(failures - 1) : pollInterval;
            await Task.Delay(delay, cancellationToken);
        }
    }

    private WorkerSnapshot Publish(WorkerState state, string message, PrintJob? job = null)
    {
        var snapshot = new WorkerSnapshot(state, message, DateTimeOffset.Now, job);
        SnapshotChanged?.Invoke(snapshot);
        return snapshot;
    }
}
