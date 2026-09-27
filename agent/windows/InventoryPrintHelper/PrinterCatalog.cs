using System.Drawing.Printing;

namespace InventoryPrintHelper;

public static class PrinterCatalog
{
    public static IReadOnlyList<PrinterInfo> GetInstalled()
    {
        var defaults = new PrinterSettings();
        var defaultName = defaults.PrinterName;
        return PrinterSettings.InstalledPrinters.Cast<string>()
            .Select(name => new PrinterInfo(name, string.Equals(name, defaultName, StringComparison.OrdinalIgnoreCase), IsInstalled(name)))
            .OrderByDescending(printer => printer.IsDefault)
            .ThenBy(printer => printer.Name, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();
    }

    public static bool IsInstalled(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return false;
        var settings = new PrinterSettings { PrinterName = name };
        return settings.IsValid;
    }
}
