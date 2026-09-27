namespace InventoryPrintHelper;

public enum PrintJobStatus { Pending, Processing, Printed, Failed, Cancelled, Uncertain }
public enum WorkerState { Idle, Printing, Paused, PrinterUnavailable, Warning }

public sealed record PrintDocumentItem(string IngredientCode, string IngredientName, string Unit, decimal Quantity, string Note);
public sealed record PrintDocumentData(string IssueCode, string IssueDate, string Destination, string IssuedBy, string Note, string CompletedAt, IReadOnlyList<PrintDocumentItem> Items);
public sealed record PrintJob(string Id, string IssueId, string StoreId, int AttemptNumber, PrintJobStatus Status, int RetryCount, string? TerminalName, string? PrintedAt, string LastError, string CreatedAt, string UpdatedAt, PrintDocumentData? Document);
public sealed record ClaimedPrintJob(PrintJob Job, string ClaimToken);
public sealed record WorkerSnapshot(WorkerState State, string Message, DateTimeOffset UpdatedAt, PrintJob? Job = null);
public sealed record PrinterInfo(string Name, bool IsDefault, bool IsAvailable);
public sealed record PrintResult(bool Accepted, string Error)
{
    public static PrintResult Printed() => new(true, "");
    public static PrintResult Failed(string error) => new(false, error);
}

public interface IPrintJobApi
{
    Task<ClaimedPrintJob?> ClaimAsync(CancellationToken cancellationToken);
    Task MarkPrintedAsync(string id, string claimToken, CancellationToken cancellationToken);
    Task MarkFailedAsync(string id, string claimToken, string error, CancellationToken cancellationToken);
    Task MarkUncertainAsync(string id, string claimToken, string error, CancellationToken cancellationToken);
    Task<IReadOnlyList<PrintJob>> ListAsync(CancellationToken cancellationToken);
    Task RetryAsync(string id, CancellationToken cancellationToken);
    Task CancelAsync(string id, CancellationToken cancellationToken);
    Task<int> CancelAllAsync(CancellationToken cancellationToken);
}

public interface IInventoryIssuePrinter
{
    PrintResult Print(PrintJob job, string printerName);
}
