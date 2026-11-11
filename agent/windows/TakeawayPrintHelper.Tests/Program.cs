using TakeawayPrintHelper;
using System.Text.Json;

void Check(bool value,string reason) { if(!value) throw new Exception(reason); }
var fullRoll=new System.Drawing.RectangleF(0,0,315,980);
var safeReceipt=ReceiptPrintBounds.Calculate(315,980,80,fullRoll);
Check(safeReceipt.Width<=72*100f/25.4f && safeReceipt.Right<315,"80mm receipt fits 72mm print head even when driver reports full roll");
var narrowClip=new System.Drawing.RectangleF(10,8,260,950);
var clippedReceipt=ReceiptPrintBounds.Calculate(315,980,80,fullRoll,narrowClip);
Check(clippedReceipt.Left>=narrowClip.Left && clippedReceipt.Right<=narrowClip.Right,"receipt respects actual Windows graphics clip and offsets");
Check(ReceiptPrintBounds.Calculate(228,980,58,new System.Drawing.RectangleF(0,0,228,980)).Width<=48*100f/25.4f,"58mm receipt fits 48mm print head");
var job = new Job("j1","B1","label","printing",JsonDocument.Parse("{}").RootElement,"");
var api=new FakeApi(job); var printer=new FakePrinter(); var journal=new MemoryJournal();
var worker=new Worker(api,printer,journal);
await worker.OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});
Check(printer.Calls==1 && api.LastStatus=="printed" && journal.Current is null,"normal routing and ack");
Check(api.Kinds.SequenceEqual(new[]{"label"}),"only configured kind claimed");
journal.Current=new Completion("j1","claim","uncertain","Interrupted");
await worker.OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});
Check(printer.Calls==1 && api.LastStatus=="uncertain" && journal.Current is null,"recovery never reprints");
api.Job=job; api.FailFinish=true;
await worker.OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});
Check(printer.Calls==2 && journal.Current?.Status=="printed","persist successful spool before ack");
api.FailFinish=false;
await worker.OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});
Check(printer.Calls==2 && journal.Current is null,"ack retry never repeats spool");
printer.Throws=true; api.Job=job;
await worker.OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});
Check(api.LastStatus=="uncertain","print exception conservatively uncertain");
var lines=TicketLayout.Lines(new Job("j2","B2","label","pending",JsonDocument.Parse("""{"storeName":"Xe","bill":{"id":"B2"},"item":{"name":"Trà đào","note":"Ít đá"},"labelNumber":2,"labelTotal":3}""").RootElement,""));
Check(lines.Any(x=>x.Text.Contains("Ít đá")) && lines.Any(x=>x.RightText.Contains("2/3")),"Vietnamese note and unit count");
var receipt=TicketLayout.Lines(new Job("r","B3","receipt","pending",JsonDocument.Parse("""{"storeName":"Xe","bill":{"id":"B3","note":"Giao tại cổng","items":[],"total":10000}}""").RootElement,""));
Check(receipt.Any(x=>x.Text.Contains("Giao tại cổng")),"receipt preserves bill-level note");
var styledBill=TicketLayout.Lines(new Job("styled","CART001","receipt","pending",JsonDocument.Parse("""{"storeName":"Bầu ơi","address":"123 Đường mới","bill":{"id":"CART001","tableNumber":"Mang về","cashierName":"Thu ngân 1","items":[{"name":"Trà đào","quantity":2,"price":25000,"lineTotal":50000,"note":"Ít đá"}],"total":45000,"discountAmount":5000,"paymentMethod":"cash","cashReceived":50000,"changeAmount":5000}}""").RootElement,""));
Check(styledBill.Any(x=>x.Style==TicketStyle.Brand && x.Text=="BẦU ƠI"),"receipt uses current store brand");
Check(styledBill.Any(x=>x.Style==TicketStyle.TableHeader && x.Cells!.SequenceEqual(new[]{"Tên hàng","Đ.Giá","SL","Thành tiền"})),"cafe receipt table columns");
Check(styledBill.Any(x=>x.Style==TicketStyle.Item && x.Cells![2]=="2" && x.Cells[3]=="50.000"),"item table aligns amount and quantity");
Check(styledBill.Any(x=>x.Text=="Tổng tiền hàng:" && x.RightText=="50.000 đ"),"gross total is payable plus discount, not payable twice discounted");
Check(styledBill.Any(x=>x.Text=="Tổng cộng:" && x.RightText=="45.000 đ"),"net total preserved");
Check(!styledBill.Any(x=>x.Text.Contains("ongquanxincamon") || x.Text.Contains("0772")),"no cafe contact or wifi copied to another store");
Check(lines.Any(x=>x.Style==TicketStyle.LabelTitle && x.Text=="Trà đào"),"label emphasizes product name");
var failingJournal=new BrokenJournal();var before=printer.Calls;api.Job=job;
try {await new Worker(api,printer,failingJournal).OnceAsync(new Dictionary<string,string>{{"label","LABEL"}});} catch(IOException) {}
Check(printer.Calls==before,"journal failure must never send anything to printer");
Console.WriteLine("Takeaway helper tests passed");
var encrypted=HelperSettingsStore.Protect("test-token-only");
Check(encrypted!="test-token-only" && HelperSettingsStore.Unprotect(encrypted)=="test-token-only","remembered token is protected for current Windows user");
Check(AppInstaller.StartupName!="TNCompany-InventoryPrintHelper" && AppInstaller.InstalledExecutable.Contains("TakeawayPrintHelper"),"setup and startup isolated from cafe and inventory helpers");
var installTest=Path.Combine(Path.GetTempPath(),"tn-takeaway-setup-"+Guid.NewGuid());Directory.CreateDirectory(installTest);
var installSource=Path.Combine(installTest,"source.exe");var installTarget=Path.Combine(installTest,"installed.exe");File.WriteAllText(installSource,"version1");
Check(AppInstaller.NeedsInstall(installSource,installTarget),"first run needs install");File.Copy(installSource,installTarget);
Check(!AppInstaller.NeedsInstall(installSource,installTarget),"same installer opens installed app without setup again");File.WriteAllText(installSource,"version2");
Check(AppInstaller.NeedsInstall(installSource,installTarget),"updated installer can upgrade app");
var settingsPath=Path.Combine(installTest,"settings.json");
HelperSettingsStore.Save(settingsPath,new HelperSettings("https://example.invalid/api","cashier","BP-T3","365B","80",50,30,"cart","Xe",encrypted,true));
var remembered=HelperSettingsStore.Load(settingsPath)!;
Check(remembered.AutoStart && remembered.StoreId=="cart" && remembered.Receipt=="BP-T3" && HelperSettingsStore.Unprotect(remembered.ProtectedToken)=="test-token-only","startup restores store, printers and protected session");
Check(!File.ReadAllText(settingsPath).Contains("test-token-only"),"settings never store plaintext token");
if(args.Length==2 && args[0]=="--preview") {
    Directory.CreateDirectory(args[1]);
    using var probe=new System.Drawing.Bitmap(2,2);probe.SetResolution(100,100);using var metrics=System.Drawing.Graphics.FromImage(probe);
    var width=80*100f/25.4f;var content=width-24;
    var heights=styledBill.Select(row=>TicketRenderer.RowHeight(metrics,row,content)).ToArray();
    using var image=new System.Drawing.Bitmap((int)Math.Ceiling(width*3),(int)Math.Ceiling((heights.Sum()+40)*3));image.SetResolution(100,100);
    using(var graphics=System.Drawing.Graphics.FromImage(image)) {graphics.Clear(System.Drawing.Color.White);graphics.ScaleTransform(3,3);float y=12;for(var i=0;i<styledBill.Count;i++){TicketRenderer.DrawRow(graphics,styledBill[i],new System.Drawing.RectangleF(12,y,content,heights[i]));y+=heights[i];}}
    image.SetResolution(300,300);image.Save(Path.Combine(args[1],"bill-80mm.png"));
    using var labelImage=new System.Drawing.Bitmap((int)Math.Ceiling(50*300f/25.4f),(int)Math.Ceiling(30*300f/25.4f));labelImage.SetResolution(100,100);
    using(var graphics=System.Drawing.Graphics.FromImage(labelImage)){graphics.Clear(System.Drawing.Color.White);graphics.ScaleTransform(3,3);TicketRenderer.DrawLabel(graphics,new System.Drawing.RectangleF(5,5,50*100f/25.4f-10,30*100f/25.4f-10),lines);}
    labelImage.SetResolution(300,300);labelImage.Save(Path.Combine(args[1],"tem-50x30mm.png"));
    Console.WriteLine("Rendered bill and label preview");
}

sealed class FakeApi(Job job):IJobApi {
 public Job? Job=job; public string LastStatus=""; public bool FailFinish; public string[] Kinds=[];
 public Task<Claim?> ClaimAsync(string[] kinds) {Kinds=kinds;var j=Job;Job=null;return Task.FromResult(j is null?null:new Claim(j,"claim"));}
 public Task FinishAsync(Completion c) {if(FailFinish)throw new Exception("offline");LastStatus=c.Status;return Task.CompletedTask;}
}
sealed class FakePrinter:IJobPrinter {public int Calls; public bool Throws; public void Print(Job job,string name) {Calls++;if(Throws)throw new Exception("spool uncertain");}}
sealed class MemoryJournal:IJournal {public Completion? Current; public Completion? Read()=>Current; public void Write(Completion c)=>Current=c;public void Clear()=>Current=null;}
sealed class BrokenJournal:IJournal {public Completion? Read()=>null;public void Write(Completion c)=>throw new IOException("disk full");public void Clear(){}}
