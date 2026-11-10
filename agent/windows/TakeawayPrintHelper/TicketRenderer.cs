using System.Drawing.Drawing2D;

namespace TakeawayPrintHelper;
public static class TicketRenderer
{
    public static Font FontFor(TicketLine row)=>new("Tahoma",row.Style switch {
        TicketStyle.Brand=>16,TicketStyle.Title=>15,TicketStyle.Total=>11,
        TicketStyle.Center or TicketStyle.Footer=>8,TicketStyle.TableHeader=>7,
        _=>8.5f},row.Bold?FontStyle.Bold:FontStyle.Regular);
    static StringFormat Format(StringAlignment align)=>new(){Alignment=align,LineAlignment=StringAlignment.Near,Trimming=StringTrimming.None};
    static readonly float[] Columns=[.44f,.20f,.10f,.26f];
    static float LeftRatio(TicketLine row)=>row.RightText.StartsWith("Thu ngân:")?.32f:.54f;
    static float TextHeight(Graphics g,string text,Font font,float width)=>Math.Max(font.GetHeight(g),g.MeasureString(text==""?" ":text,font,Math.Max(1,(int)Math.Floor(width))).Height);
    public static float RowHeight(Graphics g,TicketLine row,float width) {
        if(row.Style==TicketStyle.Rule)return 12;
        using var font=FontFor(row);
        float h;
        if(row.Cells is not null)h=row.Cells.Select((text,i)=>TextHeight(g,text,font,width*Columns[i]-4)).Max()+8;
        else if(row.RightText!="")h=Math.Max(TextHeight(g,row.Text,font,width*LeftRatio(row)-4),TextHeight(g,row.RightText,font,width*(1-LeftRatio(row))-4))+5;
        else h=TextHeight(g,row.Text,font,width)+5;
        if(row.Style is TicketStyle.Brand or TicketStyle.Title or TicketStyle.Total)h+=5;
        if(row.Style==TicketStyle.Footer)h+=5;
        return (float)Math.Ceiling(h);
    }
    public static void DrawRow(Graphics g,TicketLine row,RectangleF rect) {
        if(row.Style==TicketStyle.Rule){using var pen=new Pen(Color.Black,.65f){DashStyle=DashStyle.Dash};g.DrawLine(pen,rect.Left,rect.Top+6,rect.Right,rect.Top+6);return;}
        using var font=FontFor(row);
        if(row.Cells is not null) {
            var x=rect.Left;
            for(var i=0;i<row.Cells.Length;i++) {
                var w=rect.Width*Columns[i];
                using var fmt=Format(i==0?StringAlignment.Near:i==2?StringAlignment.Center:StringAlignment.Far);
                g.DrawString(row.Cells[i],font,Brushes.Black,new RectangleF(x+2,rect.Top+3,w-4,rect.Height-4),fmt);x+=w;
            }
            if(row.Style==TicketStyle.TableHeader){using var pen=new Pen(Color.Black,.6f);g.DrawLine(pen,rect.Left,rect.Bottom-1,rect.Right,rect.Bottom-1);}
            return;
        }
        if(row.RightText!="") {
            using var right=Format(StringAlignment.Far);
            var leftWidth=rect.Width*LeftRatio(row);
            g.DrawString(row.Text,font,Brushes.Black,new RectangleF(rect.Left,rect.Top+2,leftWidth-4,rect.Height));
            g.DrawString(row.RightText,font,Brushes.Black,new RectangleF(rect.Left+leftWidth,rect.Top+2,rect.Width-leftWidth,rect.Height),right);return;
        }
        using var format=Format(row.Style is TicketStyle.Brand or TicketStyle.Title or TicketStyle.Center or TicketStyle.Footer?StringAlignment.Center:StringAlignment.Near);
        g.DrawString(row.Text,font,Brushes.Black,rect,format);
    }
    static Font Fit(Graphics g,string text,RectangleF rect,float start,float min,bool bold) {
        for(var size=start;size>=min;size-=.25f) {
            var font=new Font("Tahoma",size,bold?FontStyle.Bold:FontStyle.Regular);
            if(TextHeight(g,text,font,rect.Width)<=rect.Height && g.MeasureString(text,font,int.MaxValue).Width<=rect.Width*Math.Max(1,Math.Floor(rect.Height/font.GetHeight(g))))return font;
            font.Dispose();
        }
        throw new InvalidOperationException("Tên món hoặc ghi chú dài hơn khổ tem. Rút gọn nội dung hoặc tăng khổ tem trước khi in lại.");
    }
    public static void DrawLabel(Graphics g,RectangleF bounds,IReadOnlyList<TicketLine> rows) {
        var brand=rows.First(x=>x.Style==TicketStyle.LabelBrand);
        var title=rows.First(x=>x.Style==TicketStyle.LabelTitle);
        var note=rows.FirstOrDefault(x=>x.Style==TicketStyle.LabelNote);
        var footer=rows.First(x=>x.Style==TicketStyle.LabelFooter);
        var badgeWidth=Math.Max(29,bounds.Width*.18f);
        var headerHeight=bounds.Height*.15f;
        var footerHeight=bounds.Height*.22f;
        var header=new RectangleF(bounds.Left,bounds.Top,bounds.Width-badgeWidth-5,headerHeight);
        var badge=new RectangleF(bounds.Right-badgeWidth,bounds.Top,badgeWidth,headerHeight);
        using var brandFont=Fit(g,brand.Text,header,7,5,true);
        using var badgeFont=Fit(g,brand.RightText,badge,7,5,true);
        var bodyTop=bounds.Top+headerHeight+7;
        var footerTop=bounds.Bottom-footerHeight;
        var titleHeight=(footerTop-bodyTop-4)*(note is null?1:.58f);
        var titleRect=new RectangleF(bounds.Left,bodyTop,bounds.Width,titleHeight);
        using var titleFont=Fit(g,title.Text,titleRect,12,8.5f,true);
        var noteRect=new RectangleF(bounds.Left,bodyTop+titleHeight+2,bounds.Width,Math.Max(1,footerTop-bodyTop-titleHeight-4));
        using var noteFont=note is null?null:Fit(g,note.Text,noteRect,8,6,false);
        var footerText=footer.Text+(footer.RightText==""?"":"\n"+footer.RightText);
        var footerRect=new RectangleF(bounds.Left,footerTop,bounds.Width,footerHeight);
        using var footerFont=Fit(g,footerText,footerRect,6.5f,5,false);
        using var center=Format(StringAlignment.Center);
        g.DrawString(brand.Text,brandFont,Brushes.Black,header);
        g.FillRectangle(Brushes.Black,badge);
        g.DrawString(brand.RightText,badgeFont,Brushes.White,badge,center);
        using(var pen=new Pen(Color.Black,.6f))g.DrawLine(pen,bounds.Left,bounds.Top+headerHeight+3,bounds.Right,bounds.Top+headerHeight+3);
        g.DrawString(title.Text,titleFont,Brushes.Black,titleRect);
        if(note is not null)g.DrawString(note.Text,noteFont!,Brushes.Black,noteRect);
        using(var pen=new Pen(Color.Black,.45f){DashStyle=DashStyle.Dot})g.DrawLine(pen,bounds.Left,footerTop-2,bounds.Right,footerTop-2);
        g.DrawString(footerText,footerFont,Brushes.Black,footerRect);
    }
}
