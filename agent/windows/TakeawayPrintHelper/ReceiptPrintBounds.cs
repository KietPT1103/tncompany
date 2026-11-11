namespace TakeawayPrintHelper;

public static class ReceiptPrintBounds
{
    // Roll width includes unprintable edges. Some POS drivers report the whole
    // roll as printable, even though an 80 mm head only prints 72 mm.
    public static RectangleF Calculate(int paperWidth, float paperHeight, int receiptMm, RectangleF printable, RectangleF? clip = null)
    {
        var available = RectangleF.Intersect(new RectangleF(6, 6, paperWidth - 12, paperHeight - 12), printable);
        if (clip is { } actual) available = RectangleF.Intersect(available, actual);
        var headWidth = (receiptMm >= 80 ? 72 : 48) * 100f / 25.4f;
        var width = Math.Min(available.Width, headWidth);
        if (width <= 0 || available.Height <= 0) throw new InvalidOperationException("Driver máy in báo vùng in không hợp lệ. Kiểm tra khổ giấy.");
        return new RectangleF(available.Left, available.Top, width, available.Height);
    }
}
