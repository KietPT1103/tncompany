# Internal invoices and independent warehouse

## Approved requirements
Internal invoices have a dedicated shared warehouse, entirely separate from ingredient and equipment inventory. No stock movement, product attachment, or category lookup may access those warehouses. Remove Store selection from the internal invoice entry form. Tax invoices retain their existing behavior.

## Entry form
Generate an internal invoice number on the server at creation, preserve it on edits, and remove manual number entry. Use a compact table with twelve empty rows for a new invoice and an Add row action. Ignore completely empty rows; reject partially filled invalid rows with a useful message. Notes are collapsed by default and remain editable. Existing invoices preserve all their rows when opened.

Each row contains material name, category, quantity, unit, price, total, and remove action. Material search uses only previously saved internal invoice materials; selecting one fills its last saved unit, price, and category. Categories such as wood, iron, and tools can be searched or created inline. Category belongs to each material row, allowing mixed categories on one invoice.

## Data and isolation
Extend internal invoice line data with a category reference and maintain an independent internal category catalog. Material suggestions come from internal invoice lines across the shared internal warehouse. Do not create a store record or reuse an ingredient/equipment warehouse identifier. If the existing invoice schema requires a store reference, retain its compatibility metadata internally while excluding it from internal warehouse grouping and user input; verify foreign keys before implementation. Historical invoice Store metadata is preserved.

Keep the existing scope-based permissions and require internal_invoices.access on every new read/write endpoint. Category creation is normalized, length validated, and safe under concurrent requests. Invoice numbering is unique under concurrent creation. Invoice and line writes remain transactional.

## Warehouse view
Add a Warehouse tab alongside the internal invoice list. Aggregate received quantity by material identity, category, and unit; never add different units together. This represents cumulative received quantity, not physical remaining stock, because this feature has no issue or consumption flow. Derive totals from saved internal invoice lines so edits and deletions update totals without duplicate stock movements. Include historical internal invoices as the default interpretation of total received; show uncategorized history separately and do not infer categories from free-text notes. This default can be adjusted during spec review.

The warehouse supports material search and category filtering. Show material, category, unit, and total received. Suggestions are sourced from the complete internal history, independently of invoice pagination.

## Invoice list and import/export
Reuse InventoryDateFilter for the compact invoice list filter. Remove Store filtering for the shared internal warehouse and remove the invoice number/code column. Keep invoice numbers internally for identification. Preserve tax invoice controls and layout. Include row categories in internal export and support the same category field in import; older import files remain valid and uncategorized. Imported internal invoices use the same shared warehouse and numbering rules.

## Verification
Test numbering uniqueness, category persistence and quick creation, suggestions scoped exclusively to internal data, blank versus invalid rows, twelve-row default, aggregation across edits/deletes and mixed units, historical uncategorized lines, and tax invoice isolation. Run PHP syntax checks, focused service/backend tests, and a production frontend build. Inspect the compact form and list layout where a running local app is available.
