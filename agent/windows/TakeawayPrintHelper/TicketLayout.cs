using System.Globalization;
using System.Text.Json;

namespace TakeawayPrintHelper;
public enum TicketStyle { Body,Brand,Title,Center,Pair,TableHeader,Item,Note,Rule,Total,Footer,LabelBrand,LabelTitle,LabelNote,LabelFooter }
public sealed record TicketLine(string Text,bool Bold=false,TicketStyle Style=TicketStyle.Body,string RightText="",string[]? Cells=null);
public static class TicketLayout
{
    public static string Text(JsonElement d,string key)=>d.TryGetProperty(key,out var v)&&v.ValueKind!=JsonValueKind.Null?v.ToString():"";
    static readonly CultureInfo Vi=CultureInfo.GetCultureInfo("vi-VN");
    static decimal Number(JsonElement d,string key)=>d.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.Number&&v.TryGetDecimal(out var n)?n:0;
    static string Money(decimal n)=>n.ToString("N0",Vi)+" đ";
    static string Amount(JsonElement d,string key)=>Number(d,key).ToString("N0",Vi);
    static string Created(JsonElement bill) {
        if(bill.TryGetProperty("createdAt",out var c)&&c.ValueKind==JsonValueKind.Object&&c.TryGetProperty("seconds",out var s)&&s.TryGetInt64(out var seconds))
            return DateTimeOffset.FromUnixTimeSeconds(seconds).ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm",Vi);
        return "";
    }
    public static List<TicketLine> Lines(Job job) {
        var d=job.Document;var b=d.GetProperty("bill");var brand=Text(d,"storeName").ToUpper(Vi);
        var reprint=Text(d,"reprint").Equals("true",StringComparison.OrdinalIgnoreCase);
        var lines=new List<TicketLine>();
        if(job.Kind=="label") {
            var item=d.GetProperty("item");
            lines.Add(new(brand,true,TicketStyle.LabelBrand,$"{Text(d,"labelNumber")}/{Text(d,"labelTotal")}"));
            lines.Add(new(Text(item,"name"),true,TicketStyle.LabelTitle));
            if(Text(item,"note")!="")lines.Add(new(Text(item,"note"),true,TicketStyle.LabelNote));
            lines.Add(new((reprint?"IN LẠI · ":"")+"#"+Text(b,"id"),false,TicketStyle.LabelFooter,Created(b)));
            return lines;
        }
        lines.Add(new(brand,true,TicketStyle.Brand));
        if(Text(d,"address")!="")lines.Add(new("ĐC: "+Text(d,"address"),false,TicketStyle.Center));
        if(Text(d,"phone")!="")lines.Add(new("ĐT: "+Text(d,"phone"),true,TicketStyle.Center));
        lines.Add(new("PHIẾU TÍNH TIỀN",true,TicketStyle.Title));
        lines.Add(new(Text(b,"id"),false,TicketStyle.Center));
        if(reprint)lines.Add(new("BẢN IN LẠI",true,TicketStyle.Center));
        var table=Text(b,"tableNumber");
        lines.Add(new(table=="" || table.StartsWith("__takeaway")?"Mang về":table,true,TicketStyle.Pair,"Thu ngân: "+Text(b,"cashierName")));
        if(Created(b)!="")lines.Add(new("Giờ vào: "+Created(b)));
        lines.Add(new("Giờ in: "+DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).ToString("dd/MM/yyyy HH:mm",Vi)));
        if(Text(b,"note")!="")lines.Add(new("Ghi chú đơn: "+Text(b,"note"),false,TicketStyle.Note));
        lines.Add(new("",false,TicketStyle.Rule));
        lines.Add(new("",true,TicketStyle.TableHeader,Cells:["Tên hàng","Đ.Giá","SL","Thành tiền"]));
        foreach(var item in b.GetProperty("items").EnumerateArray()) {
            lines.Add(new(Text(item,"name"),false,TicketStyle.Item,Cells:[Text(item,"name"),Amount(item,"price"),Number(item,"quantity").ToString("0.###",Vi),Amount(item,"lineTotal")]));
            if(Text(item,"note")!="")lines.Add(new("- "+Text(item,"note"),true,TicketStyle.Note));
        }
        lines.Add(new("",false,TicketStyle.Rule));
        var total=Number(b,"total");var discount=Number(b,"discountAmount");
        lines.Add(new("Tổng tiền hàng:",false,TicketStyle.Pair,Money(total+discount)));
        var discountTitle="Chiết khấu";
        if(Text(b,"discountType")=="percent" && Number(b,"discountValue")>0)discountTitle+=$" ({Number(b,"discountValue").ToString("0.##",Vi)}%)";
        lines.Add(new(discountTitle+":",false,TicketStyle.Pair,Money(discount)));
        lines.Add(new("Tổng cộng:",true,TicketStyle.Total,Money(total)));
        var transfer=Text(b,"paymentMethod")=="transfer";
        lines.Add(new("Thanh toán:",false,TicketStyle.Pair,transfer?"Chuyển khoản":"Tiền mặt"));
        var paid=transfer?total:(b.TryGetProperty("cashReceived",out var cash)&&cash.ValueKind==JsonValueKind.Number?Number(b,"cashReceived"):total);
        lines.Add(new("Tiền khách đưa:",false,TicketStyle.Pair,Money(paid)));
        lines.Add(new("Tiền trả lại:",false,TicketStyle.Pair,Money(transfer?0:Number(b,"changeAmount"))));
        lines.Add(new("Giá trên chưa bao gồm thuế VAT.",false,TicketStyle.Footer));
        lines.Add(new("Cảm ơn quý khách và hẹn gặp lại!",true,TicketStyle.Footer));
        return lines;
    }
}
