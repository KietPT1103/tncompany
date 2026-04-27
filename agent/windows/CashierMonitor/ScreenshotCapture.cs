using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace CashierMonitor;

public static class ScreenshotCapture
{
    private const int MaxWidth = 960;
    private const long JpegQuality = 45L;

    public static Dictionary<string, string?> WithScreenshot(Dictionary<string, string?>? details = null)
    {
        var result = details ?? new Dictionary<string, string?>();

        try
        {
            var screenshotDataUrl = CaptureDataUrl();
            if (!string.IsNullOrWhiteSpace(screenshotDataUrl))
            {
                result["screenshotDataUrl"] = screenshotDataUrl;
                result["screenshotCapturedAt"] = DateTimeOffset.Now.ToString("O");
            }
        }
        catch (Exception exception)
        {
            AgentLog.Error(exception, "Screenshot capture failed");
        }

        return result;
    }

    private static string? CaptureDataUrl()
    {
        var bounds = SystemInformation.VirtualScreen;
        if (bounds.Width <= 0 || bounds.Height <= 0)
        {
            return null;
        }

        using var bitmap = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format24bppRgb);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
        }

        using var scaledBitmap = ScaleBitmap(bitmap);
        using var stream = new MemoryStream();

        var encoder = ImageCodecInfo.GetImageEncoders()
            .FirstOrDefault(codec => string.Equals(codec.MimeType, "image/jpeg", StringComparison.OrdinalIgnoreCase));

        if (encoder is null)
        {
            scaledBitmap.Save(stream, ImageFormat.Png);
            return $"data:image/png;base64,{Convert.ToBase64String(stream.ToArray())}";
        }

        using var encoderParameters = new EncoderParameters(1);
        encoderParameters.Param[0] = new EncoderParameter(Encoder.Quality, JpegQuality);
        scaledBitmap.Save(stream, encoder, encoderParameters);

        return $"data:image/jpeg;base64,{Convert.ToBase64String(stream.ToArray())}";
    }

    private static Bitmap ScaleBitmap(Bitmap source)
    {
        if (source.Width <= MaxWidth)
        {
            return (Bitmap)source.Clone();
        }

        var ratio = (double)MaxWidth / source.Width;
        var scaledHeight = Math.Max(1, (int)Math.Round(source.Height * ratio));
        var resized = new Bitmap(MaxWidth, scaledHeight, PixelFormat.Format24bppRgb);

        using var graphics = Graphics.FromImage(resized);
        graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        graphics.DrawImage(source, 0, 0, MaxWidth, scaledHeight);

        return resized;
    }
}
