namespace InventoryPrintHelper;

public static class PrintLayout
{
    public const int RowsPerPage = 14;
    public static int RowsForPaper(string paperSize) => paperSize == "A4" ? 26 : RowsPerPage;

    public static int[] ColumnWidths(int width)
    {
        var widths = new[] { width * 6 / 100, width * 13 / 100, width * 33 / 100, width * 12 / 100, width * 10 / 100, 0 };
        widths[5] = width - widths.Take(5).Sum();
        return widths;
    }

    public static string FormatQuantity(decimal quantity) => quantity.ToString("0.######", System.Globalization.CultureInfo.GetCultureInfo("vi-VN"));

    public static IReadOnlyList<IReadOnlyList<PrintDocumentItem>> Paginate(IReadOnlyList<PrintDocumentItem> items, int rowsPerPage)
    {
        if (rowsPerPage < 1) throw new ArgumentOutOfRangeException(nameof(rowsPerPage));
        if (items.Count == 0) return [Array.Empty<PrintDocumentItem>()];
        var pages = new List<IReadOnlyList<PrintDocumentItem>>();
        for (var index = 0; index < items.Count; index += rowsPerPage)
            pages.Add(items.Skip(index).Take(rowsPerPage).ToArray());
        return pages;
    }
}
