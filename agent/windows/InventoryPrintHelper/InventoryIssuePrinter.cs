using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;

namespace InventoryPrintHelper;

public sealed class InventoryIssuePrinter : IInventoryIssuePrinter
{
    public PrintResult Print(PrintJob job, string printerName)
    {
        if (job.Document is null) return PrintResult.Failed("Lệnh in không có nội dung phiếu xuất kho.");
        try
        {
            using var document = BuildDocument(job.Document, printerName);
            document.Print();
            return PrintResult.Printed();
        }
        catch (Exception exception)
        {
            AppLog.Error("Print failed", exception);
            return PrintResult.Failed(exception.Message);
        }
    }

    private static PrintDocument BuildDocument(PrintDocumentData data, string printerName)
    {
        var printDocument = new PrintDocument();
        printDocument.PrinterSettings.PrinterName = printerName;
        if (!printDocument.PrinterSettings.IsValid) throw new InvalidOperationException($"Không tìm thấy máy in {printerName}.");
        printDocument.DefaultPageSettings.Landscape = false;
        var a4 = printDocument.PrinterSettings.PaperSizes.Cast<PaperSize>().FirstOrDefault(size => size.Kind == PaperKind.A4);
        if (a4 is not null) printDocument.DefaultPageSettings.PaperSize = a4;
        printDocument.DefaultPageSettings.Margins = new Margins(45, 45, 45, 45);
        var pages = PrintLayout.Paginate(data.Items, 26);
        var pageIndex = 0;
        printDocument.PrintPage += (_, eventArgs) =>
        {
            if (eventArgs.Graphics is null) throw new InvalidOperationException("Windows không cung cấp bề mặt in.");
            DrawPage(eventArgs.Graphics, eventArgs.MarginBounds, data, pages[pageIndex], pageIndex + 1, pages.Count);
            pageIndex++;
            eventArgs.HasMorePages = pageIndex < pages.Count;
        };
        return printDocument;
    }

    private static void DrawPage(Graphics graphics, Rectangle bounds, PrintDocumentData data, IReadOnlyList<PrintDocumentItem> items, int page, int pageCount)
    {
        using var titleFont = new Font("Arial", 16, FontStyle.Bold);
        using var boldFont = new Font("Arial", 9, FontStyle.Bold);
        using var font = new Font("Arial", 9);
        using var pen = new Pen(Color.Black, 1);
        var y = bounds.Top;
        var title = "PHIẾU XUẤT KHO";
        var titleSize = graphics.MeasureString(title, titleFont);
        graphics.DrawString(title, titleFont, Brushes.Black, bounds.Left + (bounds.Width - titleSize.Width) / 2, y);
        y += 34;
        graphics.DrawString($"Mã phiếu: {data.IssueCode}", boldFont, Brushes.Black, bounds.Left, y);
        graphics.DrawString($"Ngày: {data.CompletedAt}", font, Brushes.Black, bounds.Left + bounds.Width / 2, y);
        y += 20;
        graphics.DrawString($"Người xuất: {data.IssuedBy}", font, Brushes.Black, bounds.Left, y);
        graphics.DrawString($"Nơi nhận: {data.Destination}", font, Brushes.Black, bounds.Left + bounds.Width / 2, y);
        y += 26;

        var widths = new[] { 38, 78, bounds.Width - 38 - 78 - 65 - 62 - 135, 65, 62, 135 };
        var headers = new[] { "STT", "Mã", "Nguyên liệu", "SL", "ĐVT", "Ghi chú" };
        DrawRow(graphics, pen, boldFont, bounds.Left, ref y, 26, widths, headers);
        var rowNumber = (page - 1) * 26;
        foreach (var item in items)
        {
            rowNumber++;
            DrawRow(graphics, pen, font, bounds.Left, ref y, 25, widths,
                [rowNumber.ToString(CultureInfo.InvariantCulture), item.IngredientCode, item.IngredientName, item.Quantity.ToString("0.###", CultureInfo.GetCultureInfo("vi-VN")), item.Unit, item.Note]);
        }
        y += 20;
        if (!string.IsNullOrWhiteSpace(data.Note)) graphics.DrawString("Ghi chú: " + data.Note, font, Brushes.Black, bounds.Left, y);
        y = Math.Max(y + 35, bounds.Bottom - 80);
        graphics.DrawString("Người xuất\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Left + 70, y);
        graphics.DrawString("Người nhận\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Right - 220, y);
        graphics.DrawString($"Trang {page}/{pageCount}", font, Brushes.Black, bounds.Right - 60, bounds.Bottom + 12);
    }

    private static void DrawRow(Graphics graphics, Pen pen, Font font, int left, ref int y, int height, int[] widths, string[] cells)
    {
        var x = left;
        for (var index = 0; index < widths.Length; index++)
        {
            var rectangle = new Rectangle(x, y, widths[index], height);
            graphics.DrawRectangle(pen, rectangle);
            graphics.DrawString(cells[index], font, Brushes.Black, new RectangleF(x + 3, y + 4, widths[index] - 6, height - 6));
            x += widths[index];
        }
        y += height;
    }
}
