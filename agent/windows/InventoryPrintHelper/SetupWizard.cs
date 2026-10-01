namespace InventoryPrintHelper;

public sealed class SetupWizard : Form
{
    private readonly TextBox _api = new() { Dock = DockStyle.Fill };
    private readonly TextBox _store = new() { Dock = DockStyle.Fill };
    private readonly TextBox _terminal = new() { Dock = DockStyle.Fill };
    private readonly ComboBox _printer = new() { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly ComboBox _paper = new() { Dock = DockStyle.Fill, DropDownStyle = ComboBoxStyle.DropDownList };
    private readonly TextBox _login = new() { Dock = DockStyle.Fill };
    private readonly TextBox _password = new() { Dock = DockStyle.Fill, UseSystemPasswordChar = true };
    private readonly CheckBox _paused = new() { Text = "Khởi động ở trạng thái tạm dừng", AutoSize = true };
    private readonly Button _save = new() { Text = "Kiểm tra và lưu", AutoSize = true };
    private readonly Button _scan = new() { Text = "Quét lại máy in", AutoSize = true };
    private readonly Button _test = new() { Text = "In thử", AutoSize = true };
    private readonly Label _status = new() { AutoSize = true, ForeColor = Color.DarkSlateBlue };
    private readonly AppSettings? _initial;
    private readonly string? _existingCredential;

    public LoadedSettings? Result { get; private set; }

    public SetupWizard(LoadedSettings? current = null)
    {
        _initial = current?.Settings;
        _existingCredential = current?.Credential;
        Text = "Cài đặt máy in phiếu xuất kho";
        Width = 620;
        Height = 550;
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;

        var table = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(18), ColumnCount = 2, RowCount = 10 };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 170));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        AddRow(table, 0, "Địa chỉ API", _api);
        AddRow(table, 1, "Mã cửa hàng", _store);
        AddRow(table, 2, "Tên máy thu ngân", _terminal);
        var printerPanel = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.LeftToRight, AutoSize = true };
        _printer.Width = 280;
        printerPanel.Controls.AddRange([_printer, _scan, _test]);
        AddRow(table, 3, "Máy in", printerPanel);
        _paper.Items.AddRange(["A5", "A4"]);
        _paper.SelectedItem = _initial?.PaperSize == "A4" ? "A4" : "A5";
        AddRow(table, 4, "Khổ giấy", _paper);
        AddRow(table, 5, "Tài khoản", _login);
        AddRow(table, 6, "Mật khẩu", _password);
        table.Controls.Add(_paused, 1, 7);
        table.Controls.Add(_status, 1, 8);
        var buttons = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.RightToLeft, AutoSize = true };
        var cancel = new Button { Text = "Hủy", DialogResult = DialogResult.Cancel, AutoSize = true };
        buttons.Controls.AddRange([_save, cancel]);
        table.Controls.Add(buttons, 1, 9);
        Controls.Add(table);
        AcceptButton = _save;
        CancelButton = cancel;

        _api.Text = _initial?.ApiBaseUrl ?? "https://tnservice.vn/api";
        _store.Text = _initial?.StoreId ?? "cafe";
        _terminal.Text = _initial?.TerminalName ?? Environment.MachineName;
        _paused.Checked = _initial?.StartPaused ?? false;
        _scan.Click += (_, _) => LoadPrinters();
        _test.Click += (_, _) => PrintTest();
        _save.Click += SaveAsync;
        LoadPrinters();
    }

    private static void AddRow(TableLayoutPanel table, int row, string label, Control control)
    {
        table.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        table.Controls.Add(new Label { Text = label, AutoSize = true, Padding = new Padding(0, 7, 0, 0) }, 0, row);
        table.Controls.Add(control, 1, row);
    }

    private void LoadPrinters()
    {
        var printers = PrinterCatalog.GetInstalled();
        var selected = PrinterSelection.Resolve(_initial?.PrinterName ?? "", printers);
        _printer.Items.Clear();
        foreach (var printer in printers) _printer.Items.Add(printer.Name);
        if (selected.SuggestedPrinter.Length > 0) _printer.SelectedItem = selected.SuggestedPrinter;
        _status.Text = printers.Count == 0 ? "Windows chưa nhận được máy in nào." : $"Đã tìm thấy {printers.Count} máy in.";
    }

    private async void SaveAsync(object? sender, EventArgs eventArgs)
    {
        if (string.IsNullOrWhiteSpace(_api.Text) || string.IsNullOrWhiteSpace(_store.Text) || string.IsNullOrWhiteSpace(_terminal.Text) || _printer.SelectedItem is null)
        {
            MessageBox.Show(this, "Vui lòng nhập đủ API, cửa hàng, tên máy và chọn máy in.", "Thiếu thông tin", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrWhiteSpace(_login.Text) && string.IsNullOrWhiteSpace(_existingCredential))
        {
            MessageBox.Show(this, "Vui lòng nhập tài khoản và mật khẩu để kết nối.", "Thiếu tài khoản", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            _save.Enabled = false;
            _status.Text = "Đang kiểm tra kết nối...";
            var credential = _existingCredential ?? "";
            if (!string.IsNullOrWhiteSpace(_login.Text))
                credential = await ApiClient.LoginAsync(_api.Text.Trim(), _login.Text.Trim(), _password.Text, CancellationToken.None);
            var settings = new AppSettings(_api.Text.Trim(), _store.Text.Trim(), _terminal.Text.Trim(), _printer.SelectedItem.ToString()!, _paused.Checked, _paper.SelectedItem?.ToString() ?? "A5");
            Result = new LoadedSettings(settings, credential);
            DialogResult = DialogResult.OK;
            Close();
        }
        catch (Exception exception)
        {
            _status.Text = "Kết nối thất bại.";
            MessageBox.Show(this, exception.Message, "Không kết nối được", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally { _save.Enabled = true; }
    }

    private void PrintTest()
    {
        if (_printer.SelectedItem is null)
        {
            MessageBox.Show(this, "Vui lòng chọn máy in.", "Chưa chọn máy in", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        var document = new PrintDocumentData("IN-THU", DateTime.Today.ToString("yyyy-MM-dd"), "Quầy pha chế", Environment.UserName, "Trang kiểm tra máy in", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"), [new("TEST", "Dòng kiểm tra", "đơn vị", 1, "Máy in hoạt động bình thường")]);
        var job = new PrintJob("test", "test", _store.Text.Trim(), 1, PrintJobStatus.Processing, 0, _terminal.Text.Trim(), null, "", "", "", document);
        var result = new InventoryIssuePrinter(() => _paper.SelectedItem?.ToString() ?? "A5").Print(job, _printer.SelectedItem.ToString()!);
        MessageBox.Show(this, result.Accepted ? "Đã gửi trang in thử." : result.Error, "In thử", MessageBoxButtons.OK, result.Accepted ? MessageBoxIcon.Information : MessageBoxIcon.Error);
    }
}
