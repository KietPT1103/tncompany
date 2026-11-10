using System.Drawing.Printing;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace TakeawayPrintHelper;
public sealed class MainForm:Form
{
    readonly TextBox url=new(){Width=360,Text="https://tnservice.vn/api"},login=new(){Width=200},password=new(){Width=200,UseSystemPasswordChar=true};
    readonly ComboBox stores=Select(),receipts=Select(),labels=Select(),receiptSize=Select();
    readonly NumericUpDown labelWidth=new(){Minimum=25,Maximum=100,Value=50},labelHeight=new(){Minimum=20,Maximum=200,Value=30};
    readonly Button connect=new(){Text="Đăng nhập / tải quầy",AutoSize=true},start=new(){Text="Bắt đầu in",AutoSize=true},refresh=new(){Text="Tải hàng đợi",AutoSize=true},retry=new(){Text="Thử lại lệnh đã chọn",AutoSize=true};
    readonly Label status=new(){AutoSize=true,MaximumSize=new Size(730,0)};
    readonly Button older=new(){Text="Trang sau",AutoSize=true},newer=new(){Text="Trang trước",AutoSize=true};
    readonly ListBox queue=new(){Width=730,Height=180};
    readonly FlowLayoutPanel settings=new(){AutoSize=true,FlowDirection=FlowDirection.TopDown,WrapContents=false};
    readonly System.Windows.Forms.Timer timer=new(){Interval=1000};
    readonly NotifyIcon tray=new(){Icon=SystemIcons.Application,Visible=true,Text="TN - In bill và tem takeaway"};
    bool exitRequested;HelperSettings? savedSettings;
    ApiClient? api;Worker? worker;FileJournal? journal;bool running,busy;string token="",connectedUrl="";
    Job[] jobs=[];int offset;FileStream? journalLock;
    readonly string directory=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"TNCompany","TakeawayPrintHelper");
    new static ComboBox Select()=>new(){DropDownStyle=ComboBoxStyle.DropDownList,Width=360};
    public MainForm(bool background=false) {
        Text="TN Company - In bill và tem takeaway";ClientSize=new Size(790,850);AutoScroll=true;
        Directory.CreateDirectory(directory);
        var root=new FlowLayoutPanel{Dock=DockStyle.Fill,FlowDirection=FlowDirection.TopDown,WrapContents=false,AutoScroll=true,Padding=new Padding(16)};Controls.Add(root);
        root.Controls.Add(new Label{Text="Cài một lần · Tự nhận bill và tem khi đăng nhập Windows · Đóng cửa sổ để chạy ở khay hệ thống.",AutoSize=true});
        root.Controls.Add(settings);
        Add("Địa chỉ API (https://tên-miền/api)",url);Add("Tài khoản",login);Add("Mật khẩu (không lưu)",password);settings.Controls.Add(connect);
        Add("Quầy takeaway",stores);Add("Máy in hóa đơn",receipts);Add("Khổ bill (mm)",receiptSize);Add("Máy in tem",labels);Add("Rộng tem (mm)",labelWidth);Add("Cao tem (mm)",labelHeight);
        receiptSize.Items.AddRange(["58","80"]);receiptSize.SelectedIndex=1;
        ReloadPrinters();
        LoadSettings();
        var reloadPrinters=new Button{Text="Tải lại danh sách máy in",AutoSize=true};reloadPrinters.Click+=(_,_)=>ReloadPrinters();settings.Controls.Add(reloadPrinters);
        var buttons=new FlowLayoutPanel{AutoSize=true};buttons.Controls.AddRange([start,refresh,retry,newer,older]);root.Controls.Add(buttons);root.Controls.Add(status);root.Controls.Add(queue);
        root.Controls.Add(new Label{Text="Đã gửi máy in = Windows đã nhận lệnh, chưa xác nhận giấy đã ra.\nLệnh chưa xác nhận cần kiểm tra giấy trước khi thử lại.\nMáy tem phải cấu hình đúng khổ giấy, cảm biến khe tem trong driver Windows.",AutoSize=true});
        connect.Click+=async(_,_)=>await ConnectAsync();start.Click+=(_,_)=>Toggle();refresh.Click+=async(_,_)=>await RefreshAsync();retry.Click+=async(_,_)=>await RetryAsync();
        older.Click+=async(_,_)=>{if(busy||jobs.Length<200)return;offset+=200;await RefreshAsync();};
        newer.Click+=async(_,_)=>{if(busy)return;offset=Math.Max(0,offset-200);await RefreshAsync();};
        timer.Tick+=async(_,_)=>await TickAsync();
        var trayMenu=new ContextMenuStrip();trayMenu.Items.Add("Mở cấu hình",null,(_,_)=>ShowFromTray());
        trayMenu.Items.Add("Thoát hoàn toàn",null,(_,_)=>{if(busy){ShowFromTray();status.Text="Đang xử lý lệnh, chờ hoàn tất rồi thoát.";return;}exitRequested=true;Close();});
        tray.ContextMenuStrip=trayMenu;tray.DoubleClick+=(_,_)=>ShowFromTray();
        FormClosing+=(_,e)=>{if(e.CloseReason==CloseReason.UserClosing && !exitRequested){e.Cancel=true;Hide();return;}if(busy && e.CloseReason==CloseReason.UserClosing){e.Cancel=true;exitRequested=false;status.Text="Chờ hoàn tất thao tác in trước khi đóng.";}};
        FormClosed+=(_,_)=>{tray.Dispose();timer.Dispose();api?.Dispose();journalLock?.Dispose();};
        Shown+=(_,_)=>{if(savedSettings?.AutoStart==true && token!="" && stores.SelectedItem is StoreChoice){Toggle();if(background && running)Hide();}};
    }
    void ShowFromTray(){Show();WindowState=FormWindowState.Normal;Activate();}
    void ReloadPrinters(){foreach(var box in new[]{receipts,labels}){var previous=box.Text;box.Items.Clear();box.Items.Add("Không dùng / chưa sẵn sàng");foreach(string p in PrinterSettings.InstalledPrinters)box.Items.Add(p);if(previous!="" && previous!="Không dùng / chưa sẵn sàng"){if(!box.Items.Contains(previous))box.Items.Add(previous);box.SelectedItem=previous;}else box.SelectedIndex=0;}}
    void Add(string title,Control control){settings.Controls.Add(new Label{Text=title,AutoSize=true});settings.Controls.Add(control);}
    async Task ConnectAsync() {
        if(busy||running)return;connect.Enabled=false;token="";stores.Items.Clear();
        try {
            var uri=new Uri(url.Text.Trim());
            if(uri.Scheme!="https" && !(uri.IsLoopback&&uri.Scheme=="http"))throw new Exception("Dùng HTTPS; HTTP chỉ được dùng trên localhost.");
            connectedUrl=uri.AbsoluteUri.TrimEnd('/');
            url.Text=connectedUrl;
            token=await ApiClient.LoginAsync(connectedUrl,login.Text.Trim(),password.Text);password.Clear();
            var found=await ApiClient.StoresAsync(connectedUrl,token);stores.Items.Clear();
            foreach(var item in found)stores.Items.Add(new StoreChoice(item.Id,item.Name));
            if(stores.Items.Count>0)stores.SelectedIndex=0;
            status.Text=found.Length==0?"Tài khoản chưa có quầy takeaway.":"Đã đăng nhập. Chọn quầy và hai máy in rồi Bắt đầu in.";
        } catch(Exception e){status.Text=e.Message;}finally{connect.Enabled=true;}
    }
    void Toggle() {
        if(busy)return;
        if(running){running=false;timer.Stop();journalLock?.Dispose();journalLock=null;settings.Enabled=true;start.Text="Bắt đầu in";status.Text="Đã dừng nhận lệnh.";SaveSettings(false);return;}
        if(stores.SelectedItem is not StoreChoice store || token=="" || url.Text.Trim().TrimEnd('/')!=connectedUrl){status.Text="Đăng nhập và chọn quầy trước.";return;}
        if(receipts.SelectedIndex<=0 && labels.SelectedIndex<=0){status.Text="Chọn ít nhất một máy in.";return;}
        api?.Dispose();api=new ApiClient(connectedUrl,token,store.Id);
        var key=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(connectedUrl+"|"+store.Id)))[..24];
        try {journalLock=new FileStream(Path.Combine(directory,key+".lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None);}
        catch(IOException){status.Text="Quầy này đang được một phiên chương trình khác xử lý.";return;}
        journal=new FileJournal(Path.Combine(directory,key+".json"));
        worker=new Worker(api,new TicketPrinter(int.Parse(receiptSize.Text),(int)labelWidth.Value,(int)labelHeight.Value),journal);
        try {SaveSettings(true);}catch(Exception e){journalLock.Dispose();journalLock=null;status.Text="Không lưu được cấu hình: "+e.Message;return;}
        running=true;settings.Enabled=false;start.Text="Dừng nhận lệnh";timer.Start();status.Text="Đang nhận hóa đơn và tem. Đóng cửa sổ sẽ tiếp tục chạy ở khay hệ thống.";
    }
    Dictionary<string,string> AvailablePrinters() {
        var installed=PrinterSettings.InstalledPrinters.Cast<string>().ToHashSet();var result=new Dictionary<string,string>();
        if(receipts.SelectedIndex>0 && installed.Contains(receipts.Text))result["receipt"]=receipts.Text;
        if(labels.SelectedIndex>0 && installed.Contains(labels.Text))result["label"]=labels.Text;
        return result;
    }
    async Task TickAsync() {
        if(busy||!running||worker is null)return;busy=true;
        var printers=AvailablePrinters();
        try {await Task.Run(()=>worker.OnceAsync(printers));status.Text="Đang nhận lệnh · "+DateTime.Now.ToString("HH:mm:ss")+(printers.Count<2?" · Một loại máy in chưa sẵn sàng; lệnh tương ứng tiếp tục chờ.":"");}
        catch(HttpRequestException e) when(e.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden){running=false;timer.Stop();journalLock?.Dispose();journalLock=null;settings.Enabled=true;start.Text="Bắt đầu in";token="";status.Text="Phiên đăng nhập hết hạn hoặc không còn quyền. Đăng nhập lại để tiếp tục in.";tray.ShowBalloonTip(5000,"Cần đăng nhập lại",status.Text,ToolTipIcon.Warning);ShowFromTray();}
        catch(Exception e){status.Text="Chưa xử lý được: "+e.Message;}
        finally{busy=false;}
    }
    async Task RefreshAsync() {
        if(busy||api is null)return;busy=true;
        try {jobs=await api.ListAsync(offset);queue.Items.Clear();foreach(var job in jobs)queue.Items.Add($"{job.BillId} | {job.Kind} | {job.Status} | {job.Error}");status.Text=$"Hàng đợi · Trang {offset/200+1}";}
        catch(Exception e){status.Text=e.Message;}finally{busy=false;}
    }
    async Task RetryAsync() {
        if(busy||api is null||queue.SelectedIndex<0)return;
        var job=jobs[queue.SelectedIndex];
        if(job.Status is not ("failed" or "uncertain" or "printed")){status.Text="Lệnh đang chờ hoặc đang gửi, không được in lại.";return;}
        if(MessageBox.Show("Kiểm tra bản in đã ra trước khi tiếp tục. Chỉ in lại lệnh đã chọn?","Xác nhận",MessageBoxButtons.YesNo)!=DialogResult.Yes)return;
        busy=true;
        try {await api.PostAsync(new{action=job.Status=="printed"?"reprint":"retry",id=job.Id,storeId=((StoreChoice)stores.SelectedItem!).Id,requestId=Guid.NewGuid().ToString()});status.Text="Đã xếp hàng in lại.";}
        catch(Exception e){status.Text=e.Message;}finally{busy=false;}
        await RefreshAsync();
    }
    void SaveSettings(bool autoStart){var store=stores.SelectedItem as StoreChoice;HelperSettingsStore.Save(Path.Combine(directory,"settings.json"),new HelperSettings(url.Text,login.Text,receipts.Text,labels.Text,receiptSize.Text,(int)labelWidth.Value,(int)labelHeight.Value,store?.Id??"",store?.Name??"",HelperSettingsStore.Protect(token),autoStart));}
    void LoadSettings(){try {
        var path=Path.Combine(directory,"settings.json");if(!File.Exists(path))return;
        var s=HelperSettingsStore.Load(path)!;savedSettings=s;url.Text=s.Url;login.Text=s.Login;
        if(s.Receipt!="" && !receipts.Items.Contains(s.Receipt))receipts.Items.Add(s.Receipt);
        if(s.Label!="" && !labels.Items.Contains(s.Label))labels.Items.Add(s.Label);
        if(receipts.Items.Contains(s.Receipt))receipts.SelectedItem=s.Receipt;if(labels.Items.Contains(s.Label))labels.SelectedItem=s.Label;
        if(receiptSize.Items.Contains(s.Size))receiptSize.SelectedItem=s.Size;
        labelWidth.Value=Math.Clamp(s.Width,25,100);labelHeight.Value=Math.Clamp(s.Height,20,200);
        if(s.StoreId!=""){stores.Items.Add(new StoreChoice(s.StoreId,s.StoreName));stores.SelectedIndex=0;}
        token=HelperSettingsStore.Unprotect(s.ProtectedToken);connectedUrl=s.Url.TrimEnd('/');
    }catch(Exception){status.Text="Không đọc được cấu hình cũ, vui lòng cấu hình lại.";}}
    sealed record StoreChoice(string Id,string Name){public override string ToString()=>Name+" ("+Id+")";}
}
