namespace InventoryPrintHelper;

public sealed record PrinterSelectionResult(bool NeedsSelection, string SuggestedPrinter);

public static class PrinterSelection
{
    public static PrinterSelectionResult Resolve(string savedName, IReadOnlyList<PrinterInfo> printers)
    {
        var saved = printers.FirstOrDefault(printer => string.Equals(printer.Name, savedName, StringComparison.OrdinalIgnoreCase) && printer.IsAvailable);
        if (saved is not null) return new(false, saved.Name);
        var suggestion = printers.FirstOrDefault(printer => printer.IsDefault && printer.IsAvailable)
            ?? printers.FirstOrDefault(printer => printer.IsAvailable);
        return new(true, suggestion?.Name ?? "");
    }
}

public static class QueueUiRules
{
    public static bool RequiresCancelAllConfirmation(int cancellableCount) => cancellableCount > 0;
}

public static class WindowCloseBehavior
{
    public static bool ShouldExit(bool explicitExitRequested) => explicitExitRequested;
}
