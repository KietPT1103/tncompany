param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [string]$PreviewPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$model = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$labels = '{"title":"CH\u1ebe BI\u1ebeN","table":"B\u00e0n:","staff":"Ph\u1ee5c v\u1ee5:","item":"M\u00f3n","unit":"\u0110VT","note":"Ghi ch\u00fa:"}' | ConvertFrom-Json
$canvasWidth = 576
$margin = 24
$contentWidth = $canvasWidth - ($margin * 2)
$nameColumnWidth = 390
$unitColumnX = 432
$quantityColumnX = 500
$quantityColumnWidth = 52

$titleFont = [System.Drawing.Font]::new("Tahoma", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$metaFont = [System.Drawing.Font]::new("Tahoma", 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$metaBoldFont = [System.Drawing.Font]::new("Tahoma", 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$codeFont = [System.Drawing.Font]::new("Tahoma", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$headerFont = [System.Drawing.Font]::new("Tahoma", 25, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$itemFont = [System.Drawing.Font]::new("Tahoma", 26, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$quantityFont = [System.Drawing.Font]::new("Tahoma", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$noteFont = [System.Drawing.Font]::new("Tahoma", 21, [System.Drawing.FontStyle]::Italic, [System.Drawing.GraphicsUnit]::Pixel)
$blackBrush = [System.Drawing.Brushes]::Black
$linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::Black, 1)
$centerFormat = [System.Drawing.StringFormat]::new()
$centerFormat.Alignment = [System.Drawing.StringAlignment]::Center
$centerFormat.LineAlignment = [System.Drawing.StringAlignment]::Near
$rightFormat = [System.Drawing.StringFormat]::new()
$rightFormat.Alignment = [System.Drawing.StringAlignment]::Far
$rightFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

function Get-TextHeight {
    param($Graphics, [string]$Text, $Font, [float]$Width)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return [int][Math]::Ceiling($Graphics.MeasureString($Text, $Font, [int]$Width).Height)
}

$measureBitmap = [System.Drawing.Bitmap]::new(1, 1)
$measureGraphics = [System.Drawing.Graphics]::FromImage($measureBitmap)
$estimatedHeight = 238
foreach ($item in @($model.items)) {
    $estimatedHeight += (Get-TextHeight $measureGraphics ([string]$item.name) $itemFont $nameColumnWidth) + 22
    if (-not [string]::IsNullOrWhiteSpace([string]$item.note)) {
        $estimatedHeight += (Get-TextHeight $measureGraphics ([string]$item.note) $noteFont $contentWidth) + 6
    }
}
$measureGraphics.Dispose()
$measureBitmap.Dispose()
$canvasHeight = [Math]::Max(330, $estimatedHeight + 32)

$bitmap = [System.Drawing.Bitmap]::new($canvasWidth, $canvasHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::White)
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

try {
    [float]$y = 16
    $graphics.DrawString([string]$labels.title, $titleFont, $blackBrush, [System.Drawing.RectangleF]::new(0, $y, $canvasWidth, 50), $centerFormat)
    $y += 62

    $tableLabel = [string]$labels.table
    $graphics.DrawString($tableLabel, $metaBoldFont, $blackBrush, [float]$margin, $y)
    $tableLabelWidth = $graphics.MeasureString($tableLabel, $metaBoldFont).Width
    $graphics.DrawString([string]$model.tableNumber, $metaFont, $blackBrush, [float]($margin + $tableLabelWidth + 5), $y)
    $y += 35

    $staffLabel = [string]$labels.staff
    $graphics.DrawString($staffLabel, $metaBoldFont, $blackBrush, [float]$margin, $y)
    $staffLabelWidth = $graphics.MeasureString($staffLabel, $metaBoldFont).Width
    $graphics.DrawString([string]$model.staffName, $metaFont, $blackBrush, [float]($margin + $staffLabelWidth + 5), $y)
    $y += 35

    $graphics.DrawString("$($model.code) - $($model.dateTime)", $codeFont, $blackBrush, [float]$margin, $y)
    $y += 43

    $graphics.DrawString([string]$labels.item, $headerFont, $blackBrush, [float]$margin, $y)
    $graphics.DrawString([string]$labels.unit, $headerFont, $blackBrush, [float]$unitColumnX, $y)
    $graphics.DrawString("SL", $headerFont, $blackBrush, [System.Drawing.RectangleF]::new($quantityColumnX, $y, $quantityColumnWidth, 34), $rightFormat)
    $y += 38
    $graphics.DrawLine($linePen, $margin, $y, $canvasWidth - $margin, $y)
    $y += 12

    foreach ($item in @($model.items)) {
        $name = [string]$item.name
        $nameHeight = [Math]::Max(38, (Get-TextHeight $graphics $name $itemFont $nameColumnWidth))
        $graphics.DrawString($name, $itemFont, $blackBrush, [System.Drawing.RectangleF]::new($margin, $y, $nameColumnWidth, $nameHeight + 4))
        $graphics.DrawString([string]$item.quantity, $quantityFont, $blackBrush, [System.Drawing.RectangleF]::new($quantityColumnX, $y, $quantityColumnWidth, 40), $rightFormat)
        $y += $nameHeight + 8

        $note = [string]$item.note
        if (-not [string]::IsNullOrWhiteSpace($note)) {
            $noteText = "$($labels.note) $note"
            $noteHeight = Get-TextHeight $graphics $noteText $noteFont $contentWidth
            $graphics.DrawString($noteText, $noteFont, $blackBrush, [System.Drawing.RectangleF]::new($margin, $y, $contentWidth, $noteHeight + 3))
            $y += $noteHeight + 8
        }

        $graphics.DrawLine($linePen, $margin, $y, $canvasWidth - $margin, $y)
        $y += 14
    }

    $usedHeight = [Math]::Min($canvasHeight, [int][Math]::Ceiling($y + 18))
    $printBitmap = $bitmap.Clone([System.Drawing.Rectangle]::new(0, 0, $canvasWidth, $usedHeight), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        if ($PreviewPath) {
            $printBitmap.Save($PreviewPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }

        $rectangle = [System.Drawing.Rectangle]::new(0, 0, $printBitmap.Width, $printBitmap.Height)
        $bitmapData = $printBitmap.LockBits($rectangle, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $sourceBytes = [byte[]]::new($bitmapData.Stride * $printBitmap.Height)
            [Runtime.InteropServices.Marshal]::Copy($bitmapData.Scan0, $sourceBytes, 0, $sourceBytes.Length)
            $widthBytes = [int][Math]::Ceiling($printBitmap.Width / 8)
            $rasterBytes = [byte[]]::new($widthBytes * $printBitmap.Height)

            for ($row = 0; $row -lt $printBitmap.Height; $row++) {
                for ($column = 0; $column -lt $printBitmap.Width; $column++) {
                    $sourceIndex = ($row * $bitmapData.Stride) + ($column * 4)
                    $blue = [int]$sourceBytes[$sourceIndex]
                    $green = [int]$sourceBytes[$sourceIndex + 1]
                    $red = [int]$sourceBytes[$sourceIndex + 2]
                    $luminance = (($red * 299) + ($green * 587) + ($blue * 114)) / 1000
                    if ($luminance -lt 190) {
                        $targetIndex = ($row * $widthBytes) + [Math]::Floor($column / 8)
                        $rasterBytes[$targetIndex] = $rasterBytes[$targetIndex] -bor (0x80 -shr ($column % 8))
                    }
                }
            }
            [IO.File]::WriteAllBytes($OutputPath, $rasterBytes)
        }
        finally {
            $printBitmap.UnlockBits($bitmapData)
        }
    }
    finally {
        $printBitmap.Dispose()
    }
}
finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $titleFont.Dispose()
    $metaFont.Dispose()
    $metaBoldFont.Dispose()
    $codeFont.Dispose()
    $headerFont.Dispose()
    $itemFont.Dispose()
    $quantityFont.Dispose()
    $noteFont.Dispose()
    $linePen.Dispose()
    $centerFormat.Dispose()
    $rightFormat.Dispose()
}
