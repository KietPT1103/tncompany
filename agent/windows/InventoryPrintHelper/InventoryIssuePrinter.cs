using System.Drawing;
using System.Drawing.Printing;
using System.Globalization;

namespace InventoryPrintHelper;

public sealed class InventoryIssuePrinter(Func<string>? paperSize = null) : IInventoryIssuePrinter
{
    public PrintResult Print(PrintJob job, string printerName)
    {
        if (job.Document is null) return PrintResult.Failed("Lệnh in không có nội dung phiếu xuất kho.");
        try
        {
            using var document = BuildDocument(job.Document, printerName, paperSize?.Invoke() ?? "A5");
            document.Print();
            return PrintResult.Printed();
        }
        catch (Exception exception)
        {
            AppLog.Error("Print failed", exception);
            return PrintResult.Failed(exception.Message);
        }
    }

    private static PrintDocument BuildDocument(PrintDocumentData data, string printerName, string paperSize)
    {
        var printDocument = new PrintDocument();
        printDocument.PrinterSettings.PrinterName = printerName;
        if (!printDocument.PrinterSettings.IsValid) throw new InvalidOperationException($"Không tìm thấy máy in {printerName}.");
        printDocument.DefaultPageSettings.Landscape = false;
        var isA4 = paperSize == "A4";
        var kind = isA4 ? PaperKind.A4 : PaperKind.A5;
        var selectedSize = printDocument.PrinterSettings.PaperSizes.Cast<PaperSize>().FirstOrDefault(size => size.Kind == kind);
        printDocument.DefaultPageSettings.PaperSize = selectedSize ?? (isA4 ? new PaperSize("A4", 827, 1169) : new PaperSize("A5", 583, 827));
        printDocument.DefaultPageSettings.Margins = new Margins(40, 40, 40, 40);
        var rowsPerPage = PrintLayout.RowsForPaper(paperSize);
        var pages = PrintLayout.Paginate(data.Items, rowsPerPage);
        var pageIndex = 0;
        printDocument.PrintPage += (_, eventArgs) =>
        {
            if (eventArgs.Graphics is null) throw new InvalidOperationException("Windows không cung cấp bề mặt in.");
            DrawPage(eventArgs.Graphics, eventArgs.MarginBounds, data, pages[pageIndex], pageIndex + 1, pages.Count, rowsPerPage);
            pageIndex++;
            eventArgs.HasMorePages = pageIndex < pages.Count;
        };
        return printDocument;
    }

    private static void DrawPage(Graphics graphics, Rectangle bounds, PrintDocumentData data, IReadOnlyList<PrintDocumentItem> items, int page, int pageCount, int rowsPerPage)
    {
        using var titleFont = new Font("Arial", 14, FontStyle.Bold);
        using var boldFont = new Font("Arial", 8, FontStyle.Bold);
        using var font = new Font("Arial", 8);
        using var pen = new Pen(Color.Black, 1);
        var y = bounds.Top;
        var title = "PHIẾU XUẤT KHO";
        var titleSize = graphics.MeasureString(title, titleFont);
        graphics.DrawString(title, titleFont, Brushes.Black, bounds.Left + (bounds.Width - titleSize.Width) / 2, y);
        y += 34;
        graphics.DrawString($"Mã phiếu: {data.IssueCode}", boldFont, Brushes.Black, bounds.Left, y);
        y += 18;
        graphics.DrawString($"Ngày: {data.CompletedAt}", font, Brushes.Black, bounds.Left, y);
        y += 18;
        graphics.DrawString($"Người xuất: {data.IssuedBy}", font, Brushes.Black, bounds.Left, y);
        y += 18;
        graphics.DrawString($"Nơi nhận: {data.Destination}", font, Brushes.Black, bounds.Left, y);
        y += 24;

        var widths = PrintLayout.ColumnWidths(bounds.Width);
        var headers = new[] { "STT", "Mã", "Nguyên liệu", "SL", "ĐVT", "Ghi chú" };
        DrawRow(graphics, pen, boldFont, bounds.Left, ref y, 26, widths, headers);
        var rowNumber = (page - 1) * rowsPerPage;
        foreach (var item in items)
        {
            rowNumber++;
            DrawRow(graphics, pen, font, bounds.Left, ref y, 30, widths,
                [rowNumber.ToString(CultureInfo.InvariantCulture), item.IngredientCode, item.IngredientName, PrintLayout.FormatQuantity(item.Quantity), item.Unit, item.Note]);
        }
        y += 20;
        if (!string.IsNullOrWhiteSpace(data.Note)) graphics.DrawString("Ghi chú: " + data.Note, font, Brushes.Black, new RectangleF(bounds.Left, y, bounds.Width, 40));
        y = Math.Max(y + 45, bounds.Bottom - 140);
        graphics.DrawString("Người xuất\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Left + 30, y);
        graphics.DrawString("Người nhận\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Left + bounds.Width / 2 + 30, y);
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
