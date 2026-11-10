using System.Drawing.Printing;

namespace TakeawayPrintHelper;
public sealed class TicketPrinter(int receiptMm,int labelWidthMm,int labelHeightMm):IJobPrinter
{
    static int Units(int mm)=>(int)Math.Round(mm*100/25.4);
    public void Print(Job job,string printerName) {
        using var document=new PrintDocument();document.PrinterSettings.PrinterName=printerName;
        if(!document.PrinterSettings.IsValid)throw new InvalidOperationException("Máy in đã chọn không còn tồn tại.");
        document.PrintController=new StandardPrintController();document.DocumentName=$"{job.BillId} - {job.Kind}";
        var label=job.Kind=="label";
        int width=Units(label?labelWidthMm:receiptMm),height=Units(label?labelHeightMm:250);
        document.DefaultPageSettings.PaperSize=new PaperSize(label?"Tem":"Bill",width,height);
        document.DefaultPageSettings.Margins=new Margins(6,6,6,6);
        var rows=TicketLayout.Lines(job); int index=0;
        var printable=document.DefaultPageSettings.PrintableArea;
        var measureWidth=Math.Max(1,Math.Min(width-12,(int)Math.Floor(printable.Width)));
        // Measure at 100 DPI because Windows print coordinates use hundredths of an inch.
        using(var bitmap=new Bitmap(1,1)) {
            bitmap.SetResolution(100,100);using var measure=Graphics.FromImage(bitmap);
            var needed=rows.Sum(row=>TicketRenderer.RowHeight(measure,row,measureWidth))+16+(int)Math.Ceiling(printable.Y);
            if(label)TicketRenderer.DrawLabel(measure,new RectangleF(Math.Max(6,printable.Left),Math.Max(6,printable.Top),measureWidth,Math.Min(height-6,printable.Bottom)-Math.Max(6,printable.Top)),rows);
            if(!label)height=Math.Clamp((int)Math.Ceiling(needed),Units(40),Units(250));
        }
        document.DefaultPageSettings.PaperSize=new PaperSize(label?"Tem":"Bill",width,height);
        document.PrintPage+=(_,e)=>{
            var g=e.Graphics!;
            g.TranslateTransform(-e.PageSettings.HardMarginX,-e.PageSettings.HardMarginY);
            var area=e.PageSettings.PrintableArea;
            float left=Math.Max(6,area.Left),top=Math.Max(6,area.Top),y=top;
            float bottom=Math.Min(height-6,area.Bottom);
            int contentWidth=Math.Max(1,(int)Math.Floor(Math.Min(width-6,area.Right)-left));
            if(label){TicketRenderer.DrawLabel(g,new RectangleF(left,top,contentWidth,bottom-top),rows);e.HasMorePages=false;return;}
            while(index<rows.Count) {
                var row=rows[index];var h=TicketRenderer.RowHeight(g,row,contentWidth);
                if(y+h>bottom) {
                    if(label)throw new InvalidOperationException("Nội dung tem vượt khổ đã chọn. Tăng chiều cao tem; kiểm tra bản in trước khi thử lại.");
                    if(y==top)throw new InvalidOperationException("Một dòng quá dài so với khổ giấy.");
                    e.HasMorePages=true;return;
                }
                TicketRenderer.DrawRow(g,row,new RectangleF(left,y,contentWidth,h));y+=h;index++;
            }
            e.HasMorePages=false;
        };
        document.Print();
    }
}
