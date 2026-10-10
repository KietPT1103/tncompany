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
        IReadOnlyList<IReadOnlyList<PrintDocumentItem>>? pages = null;
        var pageIndex = 0;
        printDocument.PrintPage += (_, eventArgs) =>
        {
            if (eventArgs.Graphics is null) throw new InvalidOperationException("Windows không cung cấp bề mặt in.");
            pages ??= MeasurePages(eventArgs.Graphics, eventArgs.MarginBounds, data);
            DrawPage(eventArgs.Graphics, eventArgs.MarginBounds, data, pages[pageIndex], pageIndex + 1, pages.Count, pages.Take(pageIndex).Sum(part => part.Count));
            pageIndex++;
            eventArgs.HasMorePages = pageIndex < pages.Count;
        };
        return printDocument;
    }

    private static void DrawPage(Graphics graphics, Rectangle bounds, PrintDocumentData data, IReadOnlyList<PrintDocumentItem> items, int page, int pageCount, int precedingRows)
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
        foreach (var text in HeaderLines(data))
        {
            var height = TextHeight(graphics, font, bounds.Width, text);
            graphics.DrawString(text, font, Brushes.Black, new RectangleF(bounds.Left, y, bounds.Width, height));
            y += height;
        }
        y += 6;

        var widths = PrintLayout.ColumnWidths(bounds.Width);
        var headers = new[] { "STT", "Mã", "Nguyên liệu", "SL", "ĐVT", "Ghi chú" };
        DrawRow(graphics, pen, boldFont, bounds.Left, ref y, 26, widths, headers);
        var rowNumber = precedingRows;
        foreach (var item in items)
        {
            rowNumber++;
            DrawRow(graphics, pen, font, bounds.Left, ref y, RowHeight(graphics, font, widths, item), widths,
                [rowNumber.ToString(CultureInfo.InvariantCulture), item.IngredientCode, item.IngredientName, PrintLayout.FormatQuantity(item.Quantity), item.Unit, item.Note]);
        }
        y = bounds.Bottom - 110 - NoteHeight(graphics, font, bounds.Width, data.Note);
        if (!string.IsNullOrWhiteSpace(data.Note)) graphics.DrawString("Ghi chú: " + data.Note, font, Brushes.Black, new RectangleF(bounds.Left, y, bounds.Width, NoteHeight(graphics, font, bounds.Width, data.Note)));
        y += NoteHeight(graphics, font, bounds.Width, data.Note) + 12;
        graphics.DrawString("Người xuất\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Left + 30, y);
        graphics.DrawString("Người nhận\n(Ký, ghi rõ họ tên)", boldFont, Brushes.Black, bounds.Left + bounds.Width / 2 + 30, y);
        graphics.DrawString($"Trang {page}/{pageCount}", font, Brushes.Black, bounds.Right - 60, bounds.Bottom + 12);
    }

    private static string[] HeaderLines(PrintDocumentData data) =>
        [$"Mã phiếu: {data.IssueCode}", $"Ngày: {data.CompletedAt}", $"Người xuất: {data.IssuedBy}", $"Nơi nhận: {data.Destination}"];

    private static int TextHeight(Graphics g, Font font, int width, string text) =>
        Math.Max(18, (int)Math.Ceiling(g.MeasureString(text, font, Math.Max(1, width)).Height) + 4);

    private static int NoteHeight(Graphics g, Font font, int width, string note) =>
        string.IsNullOrWhiteSpace(note) ? 0 : (int)Math.Ceiling(g.MeasureString("Ghi chú: " + note, font, width).Height) + 8;

    private static int RowHeight(Graphics g, Font font, int[] widths, PrintDocumentItem item)
    {
        var cells = new[] { "99999", item.IngredientCode, item.IngredientName, PrintLayout.FormatQuantity(item.Quantity), item.Unit, item.Note };
        return Math.Max(30, cells.Select((text, index) => (int)Math.Ceiling(g.MeasureString(text, font, Math.Max(1, widths[index] - 6)).Height) + 10).Max());
    }

    private static IReadOnlyList<IReadOnlyList<PrintDocumentItem>> MeasurePages(Graphics g, Rectangle bounds, PrintDocumentData data)
    {
        using var font = new Font("Arial", 8);
        var capacity = bounds.Height - 34 - HeaderLines(data).Sum(text => TextHeight(g, font, bounds.Width, text)) - 6 - 26 - 122 - NoteHeight(g, font, bounds.Width, data.Note);
        var widths = PrintLayout.ColumnWidths(bounds.Width);
        var pages = new List<IReadOnlyList<PrintDocumentItem>>();
        var current = new List<PrintDocumentItem>();
        var used = 0;
        foreach (var item in data.Items)
        {
            var height = RowHeight(g, font, widths, item);
            if (height > capacity) throw new InvalidOperationException("Nội dung quá dài cho khổ giấy. Hãy chọn A4 hoặc rút gọn ghi chú.");
            if (used + height > capacity && current.Count > 0)
            {
                pages.Add(current.ToArray());
                current.Clear();
                used = 0;
            }
            current.Add(item);
            used += height;
        }
        if (current.Count > 0 || pages.Count == 0) pages.Add(current.ToArray());
        return pages;
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
