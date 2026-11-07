# Internal invoice Google Sheets sync

User requested five initial rows, seller history search, and automatic imports from Bill Vật Tư 2.0. User selected adding unit price to the Sheet.

Use existing PHP/React and the existing public Google CSV transport. Read weekly tab names from `Danh sách tuần`, then identify columns by headers, including `Đơn giá`. Group globally across weekly tabs by date and normalized bill URL. Require complete positive quantities/prices and consistent supplier for the whole bill; quarantine incomplete groups. User subsequently made links optional: without a link, group by weekly tab, date and supplier and save no evidence. This identity is independent of row position. Never delete invoices merely because a source row disappears.

Persist a unique source/date/link mapping, source hash and saved invoice version. Repeated imports skip unchanged invoices; source changes replace the same invoice while retaining categories and manually added evidence. Local edits produce a conflict instead of being overwritten. A deleted invoice is reported rather than recreated. Store the bill as an external evidence link, support image thumbnails for Google Drive files, and retain an original link for folders/PDFs.

Approaches: public CSV polling fits the already accessible source and existing transport; Apps Script pushes need script installation; service accounts need additional Google credentials. Choose CSV polling. Provide an authenticated sync/status panel and a CLI worker for cron every five minutes, independent of an open browser. Deployment/cron activation is a separate server operation and must be reported accurately.

Seller search queries all historical internal invoices, independently of current page/date filters. Keep free text available.

Sync UI is compact: title, small count/time summary and actions; help, timestamps and detailed errors sit inside a disclosure closed by default. Keep error count visible in the disclosure summary.

User subsequently selected importing `Phát sinh` as a separate cost line. If present and positive, create quantity 1 / unit khoản / category Chi phí phát sinh / name Phát sinh – material. Blank or zero adds no line; unsupported negative amounts block that bill.
