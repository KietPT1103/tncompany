namespace InventoryPrintHelper;

public sealed class MainForm : Form
{
    private readonly IPrintJobApi _api;
    private readonly PrintJobWorker _worker;
    private readonly IInventoryIssuePrinter _printService;
    private readonly Func<AppSettings> _settings;
    private readonly Action _openSettings;
    private readonly DataGridView _queue = new() { Dock = DockStyle.Fill, ReadOnly = true, AutoGenerateColumns = false, SelectionMode = DataGridViewSelectionMode.FullRowSelect, MultiSelect = false };
    private readonly Label _state = new() { AutoSize = true, Font = new Font(SystemFonts.DefaultFont, FontStyle.Bold) };
    private readonly Label _printer = new() { AutoSize = true };
    private readonly Button _pause = new() { Text = "Tạm dừng", AutoSize = true };
    private readonly System.Windows.Forms.Timer _refreshTimer = new() { Interval = 5000 };
    private bool _explicitExit;

    public MainForm(IPrintJobApi api, PrintJobWorker worker, IInventoryIssuePrinter printService, Func<AppSettings> settings, Action openSettings)
    {
        _api = api;
        _worker = worker;
        _printService = printService;
        _settings = settings;
        _openSettings = openSettings;
        Text = "TN Company - Máy in phiếu xuất kho";
        Width = 1040;
        Height = 620;
        StartPosition = FormStartPosition.CenterScreen;

        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Mã phiếu", DataPropertyName = "IssueCode", Width = 125 });
        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Trạng thái", DataPropertyName = "StatusText", Width = 110 });
        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Lần in", DataPropertyName = "Attempt", Width = 60 });
        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Thời gian", DataPropertyName = "UpdatedAt", Width = 150 });
        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Máy xử lý", DataPropertyName = "Terminal", Width = 130 });
        _queue.Columns.Add(new DataGridViewTextBoxColumn { HeaderText = "Thông báo", DataPropertyName = "Error", AutoSizeMode = DataGridViewAutoSizeColumnMode.Fill });

        var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(10), WrapContents = true };
        var resume = new Button { Text = "In tiếp", AutoSize = true };
        var retry = new Button { Text = "In lại phiếu", AutoSize = true };
        var cancel = new Button { Text = "Hủy phiếu", AutoSize = true };
        var cancelAll = new Button { Text = "Hủy toàn bộ đang chờ/lỗi", AutoSize = true };
        var test = new Button { Text = "In thử", AutoSize = true };
        var settingsButton = new Button { Text = "Đổi máy in / Cấu hình", AutoSize = true };
        top.Controls.AddRange([_state, _printer, _pause, resume, retry, cancel, cancelAll, test, settingsButton]);
        Controls.Add(_queue);
        Controls.Add(top);

        _pause.Click += (_, _) => { _worker.Pause(); UpdateState(new(WorkerState.Paused, "Đang tạm dừng.", DateTimeOffset.Now)); };
        resume.Click += (_, _) => { _worker.Resume(); UpdateState(new(WorkerState.Idle, "Đã tiếp tục nhận phiếu.", DateTimeOffset.Now)); };
        retry.Click += async (_, _) => await RunMutationAsync(retry, () => WithSelectedJob(job => _api.RetryAsync(job.Id, CancellationToken.None)));
        cancel.Click += async (_, _) => await RunMutationAsync(cancel, () => WithSelectedJob(job => _api.CancelAsync(job.Id, CancellationToken.None)));
        cancelAll.Click += async (_, _) => await RunMutationAsync(cancelAll, CancelAllAsync);
        test.Click += (_, _) => PrintTest();
        settingsButton.Click += (_, _) => _openSettings();
        _worker.SnapshotChanged += OnSnapshotChanged;
        _refreshTimer.Tick += async (_, _) => await RefreshQueueAsync();
        Shown += async (_, _) => { _refreshTimer.Start(); await RefreshQueueAsync(); };
        FormClosing += OnFormClosing;
        UpdatePrinter();
    }

    public void ShowFromTray()
    {
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
    }

    public void RequestExit()
    {
        _explicitExit = true;
        Close();
    }

    private async Task RefreshQueueAsync()
    {
        try
        {
            var jobs = await _api.ListAsync(CancellationToken.None);
            _queue.DataSource = jobs.Select(job => new QueueRow(job)).ToList();
            UpdatePrinter();
        }
        catch (Exception exception) { _state.Text = "API: " + exception.Message; }
    }

    private async Task WithSelectedJob(Func<PrintJob, Task> action)
    {
        if (_queue.CurrentRow?.DataBoundItem is not QueueRow row) return;
        try { await action(row.Job); await RefreshQueueAsync(); }
        catch (Exception exception) { MessageBox.Show(this, exception.Message, "Không thực hiện được", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    private static async Task RunMutationAsync(Button button, Func<Task> action)
    {
        button.Enabled = false;
        try { await action(); }
        finally { button.Enabled = true; }
    }

    private async Task CancelAllAsync()
    {
        var count = (_queue.DataSource as IEnumerable<QueueRow>)?.Count(row => row.Job.Status is PrintJobStatus.Pending or PrintJobStatus.Failed) ?? 0;
        if (!QueueUiRules.RequiresCancelAllConfirmation(count)) return;
        if (MessageBox.Show(this, $"Hủy {count} phiếu đang chờ hoặc bị lỗi?", "Xác nhận", MessageBoxButtons.YesNo, MessageBoxIcon.Warning) != DialogResult.Yes) return;
        try { await _api.CancelAllAsync(CancellationToken.None); await RefreshQueueAsync(); }
        catch (Exception exception) { MessageBox.Show(this, exception.Message, "Không hủy được", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    public void PrintTest()
    {
        var document = new PrintDocumentData("IN-THU", DateTime.Today.ToString("yyyy-MM-dd"), "Quầy pha chế", Environment.UserName, "Trang kiểm tra máy in", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), [new("TEST", "Dòng kiểm tra", "đơn vị", 1, "Nếu đọc được dòng này, máy in hoạt động bình thường")]);
        var job = new PrintJob("test", "test", _settings().StoreId, 1, PrintJobStatus.Processing, 0, _settings().TerminalName, null, "", "", "", document);
        var result = _printService.Print(job, _settings().PrinterName);
        MessageBox.Show(this, result.Accepted ? "Đã gửi trang in thử." : result.Error, "In thử", MessageBoxButtons.OK, result.Accepted ? MessageBoxIcon.Information : MessageBoxIcon.Error);
    }

    private void UpdateState(WorkerSnapshot snapshot) => _state.Text = snapshot.Message + "   ";
    private void OnSnapshotChanged(WorkerSnapshot snapshot)
    {
        if (IsDisposed || Disposing) return;
        if (!InvokeRequired) UpdateState(snapshot);
        else if (IsHandleCreated) BeginInvoke(() => UpdateState(snapshot));
    }
    private void UpdatePrinter() => _printer.Text = $"Máy in: {_settings().PrinterName} | Khổ giấy: {_settings().PaperSize}   ";

    private void OnFormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        if (!WindowCloseBehavior.ShouldExit(_explicitExit) && eventArgs.CloseReason == CloseReason.UserClosing)
        {
            eventArgs.Cancel = true;
            Hide();
        }
    }

    private sealed class QueueRow(PrintJob job)
    {
        public PrintJob Job { get; } = job;
        public string IssueCode => Job.Document?.IssueCode ?? Job.IssueId;
        public string StatusText => Job.Status switch { PrintJobStatus.Pending => "Đang chờ", PrintJobStatus.Processing => "Đang in", PrintJobStatus.Printed => "Đã in", PrintJobStatus.Failed => "Bị lỗi", PrintJobStatus.Cancelled => "Đã hủy", PrintJobStatus.Uncertain => "Cần kiểm tra", _ => Job.Status.ToString() };
        public int Attempt => Job.AttemptNumber;
        public string UpdatedAt => Job.UpdatedAt;
        public string Terminal => Job.TerminalName ?? "";
        public string Error => Job.LastError;
    }
}
