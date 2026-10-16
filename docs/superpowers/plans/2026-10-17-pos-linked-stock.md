# POS linked stock implementation
Goal: link equipment goods to POS products and show daily receipts/sales/current balance.
Architecture: completed receipts are inbound truth; completed bills since link activation are outbound truth. Cancellation/edit automatically recomputes balances, avoiding duplicate deductions. One immutable same-store product link per stock identity, 1 POS unit = 1 stock unit. No historical sales deducted before activation.
- Add mapping schema and shared balance query with daily opening/inbound/sold/closing.
- Add authenticated mapping/report endpoint and admin linking UI in equipment stock.
- Show today inbound and current stock on linked POS product cards, refreshed periodically.
- Verify SQL behavior against isolated SQLite fixtures; build application.
