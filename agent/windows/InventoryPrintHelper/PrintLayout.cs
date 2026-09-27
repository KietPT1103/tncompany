namespace InventoryPrintHelper;

public static class PrintLayout
{
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
