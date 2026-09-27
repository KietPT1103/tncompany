using InventoryPrintHelper;

var tests = new (string Name, Func<Task> Run)[]
{
    ("paused worker does not claim", PausedWorkerDoesNotClaim),
    ("successful spool is acknowledged", SuccessfulSpoolIsAcknowledged),
    ("printer failure is reported", PrinterFailureIsReported),
    ("callback failure after spool becomes uncertain", CallbackFailureBecomesUncertain),
    ("missing printer pauses worker", MissingPrinterPausesWorker),
    ("reconnect backoff is bounded", ReconnectBackoffIsBounded),
    ("A4 pagination is deterministic", A4PaginationIsDeterministic),
};

var failures = 0;
foreach (var test in tests)
{
    try
    {
        await test.Run();
        Console.WriteLine($"PASS {test.Name}");
    }
    catch (Exception exception)
    {
        failures++;
        Console.Error.WriteLine($"FAIL {test.Name}: {exception.Message}");
    }
}
return failures;

static PrintJob Job() => new(
    "job-1", "issue-1", "cafe", 1, PrintJobStatus.Processing, 0, null, null, "", "", "",
    new PrintDocumentData("XK-001", "2026-09-27", "Quầy", "Thu ngân", "", "2026-09-27 10:00:00",
        [new("NL01", "Cà phê", "kg", 2, "")]));

static async Task PausedWorkerDoesNotClaim()
{
    var api = new FakeApi(Job());
    var worker = new PrintJobWorker(api, new FakePrinter(PrintResult.Printed()), () => "A4 Printer", _ => true);
    worker.Pause();
    var snapshot = await worker.ProcessOnceAsync(CancellationToken.None);
    Equal(0, api.ClaimCalls, "paused worker claimed a job");
    Equal(WorkerState.Paused, snapshot.State, "paused state");
}

static async Task SuccessfulSpoolIsAcknowledged()
{
    var api = new FakeApi(Job());
    var worker = new PrintJobWorker(api, new FakePrinter(PrintResult.Printed()), () => "A4 Printer", _ => true);
    var snapshot = await worker.ProcessOnceAsync(CancellationToken.None);
    Equal(1, api.PrintedCalls, "printed callback count");
    Equal(WorkerState.Idle, snapshot.State, "worker returns idle");
}

static async Task PrinterFailureIsReported()
{
    var api = new FakeApi(Job());
    var worker = new PrintJobWorker(api, new FakePrinter(PrintResult.Failed("out of paper")), () => "A4 Printer", _ => true);
    await worker.ProcessOnceAsync(CancellationToken.None);
    Equal(1, api.FailedCalls, "failed callback count");
    Equal("out of paper", api.LastError, "reported printer error");
}

static async Task CallbackFailureBecomesUncertain()
{
    var api = new FakeApi(Job()) { ThrowOnPrinted = true };
    var worker = new PrintJobWorker(api, new FakePrinter(PrintResult.Printed()), () => "A4 Printer", _ => true);
    var snapshot = await worker.ProcessOnceAsync(CancellationToken.None);
    Equal(1, api.UncertainCalls, "uncertain callback count");
    Equal(WorkerState.Warning, snapshot.State, "uncertain worker state");
}

static async Task MissingPrinterPausesWorker()
{
    var api = new FakeApi(Job());
    var worker = new PrintJobWorker(api, new FakePrinter(PrintResult.Printed()), () => "Removed Printer", _ => false);
    var snapshot = await worker.ProcessOnceAsync(CancellationToken.None);
    Equal(0, api.ClaimCalls, "missing printer must block claims");
    Equal(WorkerState.PrinterUnavailable, snapshot.State, "missing printer state");
    Equal(true, worker.IsPaused, "worker pauses itself");
}

static Task ReconnectBackoffIsBounded()
{
    Equal(TimeSpan.FromSeconds(1), PrintJobWorker.ReconnectDelay(0), "first delay");
    Equal(TimeSpan.FromSeconds(16), PrintJobWorker.ReconnectDelay(4), "exponential delay");
    Equal(TimeSpan.FromSeconds(30), PrintJobWorker.ReconnectDelay(20), "bounded delay");
    return Task.CompletedTask;
}

static Task A4PaginationIsDeterministic()
{
    var items = Enumerable.Range(1, 7).Select(index => new PrintDocumentItem($"NL{index}", $"Item {index}", "kg", index, "")).ToArray();
    var pages = PrintLayout.Paginate(items, 3);
    Equal(3, pages.Count, "page count");
    Equal("NL1", pages[0][0].IngredientCode, "first row");
    Equal("NL7", pages[2][0].IngredientCode, "last page row");
    return Task.CompletedTask;
}

static void Equal<T>(T expected, T actual, string message)
{
    if (!EqualityComparer<T>.Default.Equals(expected, actual))
        throw new InvalidOperationException($"{message}: expected {expected}, actual {actual}");
}

sealed class FakePrinter(PrintResult result) : IInventoryIssuePrinter
{
    public PrintResult Print(PrintJob job, string printerName) => result;
}

sealed class FakeApi(PrintJob job) : IPrintJobApi
{
    private PrintJob? _next = job;
    public int ClaimCalls { get; private set; }
    public int PrintedCalls { get; private set; }
    public int FailedCalls { get; private set; }
    public int UncertainCalls { get; private set; }
    public string LastError { get; private set; } = "";
    public bool ThrowOnPrinted { get; init; }

    public Task<ClaimedPrintJob?> ClaimAsync(CancellationToken cancellationToken)
    {
        ClaimCalls++;
        var claimed = _next is null ? null : new ClaimedPrintJob(_next, "claim-token");
        _next = null;
        return Task.FromResult(claimed);
    }
    public Task MarkPrintedAsync(string id, string claimToken, CancellationToken cancellationToken)
    {
        PrintedCalls++;
        if (ThrowOnPrinted) throw new HttpRequestException("offline after spool");
        return Task.CompletedTask;
    }
    public Task MarkFailedAsync(string id, string claimToken, string error, CancellationToken cancellationToken)
    {
        FailedCalls++;
        LastError = error;
        return Task.CompletedTask;
    }
    public Task MarkUncertainAsync(string id, string claimToken, string error, CancellationToken cancellationToken)
    {
        UncertainCalls++;
        LastError = error;
        return Task.CompletedTask;
    }
    public Task<IReadOnlyList<PrintJob>> ListAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<PrintJob>>([]);
    public Task RetryAsync(string id, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task CancelAsync(string id, CancellationToken cancellationToken) => Task.CompletedTask;
    public Task<int> CancelAllAsync(CancellationToken cancellationToken) => Task.FromResult(0);
}
