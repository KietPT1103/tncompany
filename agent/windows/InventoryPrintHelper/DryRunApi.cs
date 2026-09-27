namespace InventoryPrintHelper;

public sealed class DryRunApi : IPrintJobApi
{
    public Task<ClaimedPrintJob?> ClaimAsync(CancellationToken cancellationToken) => Task.FromResult<ClaimedPrintJob?>(null);
    public Task MarkPrintedAsync(string id, string claimToken, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task MarkFailedAsync(string id, string claimToken, string error, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task MarkUncertainAsync(string id, string claimToken, string error, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<IReadOnlyList<PrintJob>> ListAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<PrintJob>>([]);
    public Task RetryAsync(string id, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task CancelAsync(string id, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<int> CancelAllAsync(CancellationToken cancellationToken) => Task.FromResult(0);
}

public sealed class DryRunPrinter : IInventoryIssuePrinter
{
    public PrintResult Print(PrintJob job, string printerName) => PrintResult.Printed();
}
