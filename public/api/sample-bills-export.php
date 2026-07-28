<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

auth_require(['admin']);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Not found', 404);
}

$body = read_json_body();
$billType = trim((string) ($body['billType'] ?? ''));
$date = trim((string) ($body['date'] ?? ''));
$targetRevenue = round((float) ($body['targetRevenue'] ?? 0));
$rows = is_array($body['rows'] ?? null) ? $body['rows'] : [];

if (!in_array($billType, ['coffee', 'hotpot', 'farm'], true)) {
    respond_error('Loại bill không hợp lệ.', 422);
}
if ($targetRevenue <= 0 || $rows === [] || count($rows) > 5000) {
    respond_error('Dữ liệu xuất Excel không hợp lệ.', 422);
}

function sample_bill_xml_escape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function sample_bill_inline_cell(string $ref, string $value, int $style): string
{
    return sprintf(
        '<c r="%s" t="inlineStr" s="%d"><is><t xml:space="preserve">%s</t></is></c>',
        $ref,
        $style,
        sample_bill_xml_escape($value)
    );
}

function sample_bill_number_cell(string $ref, float $value, int $style): string
{
    $normalized = rtrim(rtrim(number_format($value, 2, '.', ''), '0'), '.');
    return sprintf('<c r="%s" s="%d"><v>%s</v></c>', $ref, $style, $normalized);
}

$normalizedRows = [];
$billTotals = [];
$generatedTotal = 0.0;

foreach ($rows as $rawRow) {
    $billCode = trim((string) ($rawRow['billCode'] ?? ''));
    $productCode = trim((string) ($rawRow['productCode'] ?? ''));
    $productName = trim((string) ($rawRow['productName'] ?? ''));
    $quantity = (int) ($rawRow['quantity'] ?? 0);
    $unitPrice = round((float) ($rawRow['unitPrice'] ?? 0));
    $lineTotal = round((float) ($rawRow['lineTotal'] ?? 0));

    if (
        $billCode === '' ||
        $productCode === '' ||
        $productName === '' ||
        $quantity <= 0 ||
        $unitPrice < 0 ||
        $lineTotal !== round($quantity * $unitPrice)
    ) {
        respond_error('Một dòng bill có dữ liệu không hợp lệ.', 422);
    }

    $billTotals[$billCode] = ($billTotals[$billCode] ?? 0) + $lineTotal;
    $generatedTotal += $lineTotal;
    $normalizedRows[] = [
        'billCode' => $billCode,
        'customerName' => trim((string) ($rawRow['customerName'] ?? 'Khách hàng lẻ')) ?: 'Khách hàng lẻ',
        'productCode' => $productCode,
        'productName' => $productName,
        'quantity' => $quantity,
        'unitPrice' => $unitPrice,
        'lineTotal' => $lineTotal,
    ];
}

if ($generatedTotal !== $targetRevenue) {
    respond_error('Tổng cột Thành tiền không khớp doanh thu mục tiêu.', 422);
}
foreach ($billTotals as $total) {
    if ($total > 7000000) {
        respond_error('Có bill vượt giới hạn 7.000.000 VND.', 422);
    }
}

$labels = [
    'coffee' => ['sheet' => 'Bill mẫu nước', 'file' => 'Bill_mau_nuoc'],
    'hotpot' => ['sheet' => 'Bill mẫu lẩu', 'file' => 'Bill_mau_lau'],
    'farm' => ['sheet' => 'Bill mẫu farm', 'file' => 'Bill_mau_farm'],
];
$label = $labels[$billType];
$safeDate = preg_replace('/[^0-9-]/', '', $date) ?: date('Y-m-d');
$fileDate = implode('_', array_reverse(explode('-', $safeDate)));
$fileName = sprintf('%s_%s.xlsx', $label['file'], $fileDate);

$headers = [
    'Mã bill',
    'Tên khách hàng',
    'Mã hàng hóa',
    'Tên hàng hóa, dịch vụ',
    'Số lượng',
    'Đơn giá',
    'Thành tiền',
];
$sheetRows = [];
$headerCells = [];
foreach ($headers as $index => $header) {
    $headerCells[] = sample_bill_inline_cell(chr(65 + $index) . '1', $header, 1);
}
$headerCells[] = sprintf(
    '<c r="H1" s="6"><f>SUM(G2:G%d)</f><v>%d</v></c>',
    count($normalizedRows) + 1,
    (int) $generatedTotal
);
$sheetRows[] = '<row r="1" ht="22" customHeight="1">' . implode('', $headerCells) . '</row>';

$billBands = [];
foreach ($normalizedRows as $index => $row) {
    if (!array_key_exists($row['billCode'], $billBands)) {
        $billBands[$row['billCode']] = count($billBands);
    }

    $excelRow = $index + 2;
    $isBlue = $billBands[$row['billCode']] % 2 === 1;
    $isFirstInBill = $index === 0 || $normalizedRows[$index - 1]['billCode'] !== $row['billCode'];
    $textStyle = $isBlue ? 3 : 2;
    $numberStyle = $isBlue ? 5 : 4;
    if ($isFirstInBill) {
        $textStyle = $isBlue ? 8 : 7;
        $numberStyle = $isBlue ? 10 : 9;
    }

    $cells = [];
    if (ctype_digit($row['billCode'])) {
        $cells[] = sample_bill_number_cell('A' . $excelRow, (float) $row['billCode'], $numberStyle);
    } else {
        $cells[] = sample_bill_inline_cell('A' . $excelRow, $row['billCode'], $textStyle);
    }
    $cells[] = sample_bill_inline_cell('B' . $excelRow, $row['customerName'], $textStyle);
    $cells[] = sample_bill_inline_cell('C' . $excelRow, $row['productCode'], $textStyle);
    $cells[] = sample_bill_inline_cell('D' . $excelRow, $row['productName'], $textStyle);
    $cells[] = sample_bill_number_cell('E' . $excelRow, (float) $row['quantity'], $numberStyle);
    $cells[] = sample_bill_number_cell('F' . $excelRow, (float) $row['unitPrice'], $numberStyle);
    $cells[] = sample_bill_number_cell('G' . $excelRow, (float) $row['lineTotal'], $numberStyle);
    $sheetRows[] = sprintf('<row r="%d">%s</row>', $excelRow, implode('', $cells));
}

$lastRow = count($normalizedRows) + 1;
$worksheetXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<sheetViews><sheetView workbookViewId="0" showGridLines="0">'
    . '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    . '</sheetView></sheetViews>'
    . '<cols>'
    . '<col min="1" max="1" width="11" customWidth="1"/>'
    . '<col min="2" max="2" width="22" customWidth="1"/>'
    . '<col min="3" max="3" width="18" customWidth="1"/>'
    . '<col min="4" max="4" width="44" customWidth="1"/>'
    . '<col min="5" max="5" width="13" customWidth="1"/>'
    . '<col min="6" max="7" width="18" customWidth="1"/>'
    . '<col min="8" max="8" width="18" customWidth="1"/>'
    . '</cols>'
    . '<sheetData>' . implode('', $sheetRows) . '</sheetData>'
    . sprintf('<autoFilter ref="A1:G%d"/>', $lastRow)
    . '</worksheet>';

$stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>'
    . '<fonts count="3">'
    . '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>'
    . '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>'
    . '<font><b/><color rgb="FF000000"/><sz val="11"/><name val="Calibri"/></font>'
    . '</fonts>'
    . '<fills count="5">'
    . '<fill><patternFill patternType="none"/></fill>'
    . '<fill><patternFill patternType="gray125"/></fill>'
    . '<fill><patternFill patternType="solid"><fgColor theme="4"/><bgColor indexed="64"/></patternFill></fill>'
    . '<fill><patternFill patternType="solid"><fgColor theme="4" tint="0.80"/><bgColor indexed="64"/></patternFill></fill>'
    . '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>'
    . '</fills>'
    . '<borders count="2">'
    . '<border><left/><right/><top/><bottom/><diagonal/></border>'
    . '<border><left/><right/><top style="thin"><color rgb="FFD9E2F3"/></top><bottom/><diagonal/></border>'
    . '</borders>'
    . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    . '<cellXfs count="11">'
    . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    . '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>'
    . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    . '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>'
    . '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    . '<xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyNumberFormat="1"/>'
    . '<xf numFmtId="164" fontId="2" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"/>'
    . '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>'
    . '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>'
    . '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1"/>'
    . '<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1"/>'
    . '</cellXfs>'
    . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    . '</styleSheet>';

$themeXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office">'
    . '<a:themeElements><a:clrScheme name="Office">'
    . '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
    . '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
    . '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>'
    . '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>'
    . '<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>'
    . '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>'
    . '<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>'
    . '</a:clrScheme><a:fontScheme name="Office"><a:majorFont/><a:minorFont/></a:fontScheme>'
    . '<a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>'
    . '</a:themeElements></a:theme>';

$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    . '<Default Extension="xml" ContentType="application/xml"/>'
    . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    . '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
    . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
    . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
    . '</Types>';

$rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    . '</Relationships>';

$workbookXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    . '<sheets><sheet name="' . sample_bill_xml_escape($label['sheet']) . '" sheetId="1" r:id="rId1"/></sheets>'
    . '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';

$workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    . '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
    . '</Relationships>';

$now = gmdate('Y-m-d\TH:i:s\Z');
$coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    . 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
    . 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    . '<dc:creator>TN Company</dc:creator><cp:lastModifiedBy>TN Company</cp:lastModifiedBy>'
    . '<dcterms:created xsi:type="dcterms:W3CDTF">' . $now . '</dcterms:created>'
    . '<dcterms:modified xsi:type="dcterms:W3CDTF">' . $now . '</dcterms:modified>'
    . '</cp:coreProperties>';

$appXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
    . 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    . '<Application>TN Company</Application></Properties>';

$tempPath = tempnam(sys_get_temp_dir(), 'sample-bills-');
if ($tempPath === false) {
    respond_error('Không tạo được file Excel tạm.', 500);
}

$zip = new ZipArchive();
if ($zip->open($tempPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    @unlink($tempPath);
    respond_error('Không khởi tạo được file Excel.', 500);
}

$zip->addFromString('[Content_Types].xml', $contentTypes);
$zip->addFromString('_rels/.rels', $rootRels);
$zip->addFromString('docProps/core.xml', $coreXml);
$zip->addFromString('docProps/app.xml', $appXml);
$zip->addFromString('xl/workbook.xml', $workbookXml);
$zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRels);
$zip->addFromString('xl/styles.xml', $stylesXml);
$zip->addFromString('xl/theme/theme1.xml', $themeXml);
$zip->addFromString('xl/worksheets/sheet1.xml', $worksheetXml);
$zip->close();

while (ob_get_level() > 0) {
    @ob_end_clean();
}
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('Content-Length: ' . filesize($tempPath));
header('Cache-Control: no-store, max-age=0');
readfile($tempPath);
@unlink($tempPath);
exit;
