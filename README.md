# Affiliate Link Manager

A production-ready Google Apps Script web app for managing Shopee affiliate products in Google Sheets.

## Project files

```text
Code.gs             Web entry point and public server API
Utils.gs            Configuration, validation, normalization and statistics
Database.gs         Cached/locked spreadsheet data access and CSV import
Index.html          Application shell
Sidebar.html        Navigation
Dashboard.html      Dashboard cards and chart containers
Product.html        Products, categories, favorites and settings views
Import.html         CSV upload, preview, progress and report view
Style.html          Responsive light/dark premium dashboard styling
Script.html         Vanilla JavaScript application logic
appsscript.json     Apps Script V8 manifest
```

## Spreadsheet setup

1. Create a Google Spreadsheet.
2. Create a sheet named `Products` (the app will also create it automatically).
3. Row 1 uses these columns:

   `ID | Product Name | Category | Store | Price | Sales | Commission | Affiliate Link | Extra Commission Link | Status | Created At | Favorite | Image URL`

The first eleven columns match the requested schema. `Favorite` and `Image URL` are appended to persist favorites and optional product images.

## Installation and deployment

1. Open the spreadsheet and choose **Extensions → Apps Script**, or create a standalone Apps Script project.
2. Add every `.gs` and `.html` file from this folder. In Apps Script, paste `appsscript.json` through **Project Settings → Show appsscript.json manifest file**.
3. For a spreadsheet-bound project, no property is needed. For a standalone project, open **Project Settings → Script Properties** and add `SPREADSHEET_ID` with the ID from the spreadsheet URL.
4. Run `ensureDatabase_` once from the editor and approve the requested spreadsheet permissions. This step is optional because the first web request also initializes the sheet.
5. Select **Deploy → New deployment → Web app**.
6. Set **Execute as** to yourself and choose the desired access level. For a personal tool, restricting access to your Google account or Workspace domain is recommended.
7. Deploy, authorize, and open the generated web-app URL.

When code changes, use **Deploy → Manage deployments → Edit → New version**.

## CSV format

`Product Name` is required. Supported headers are:

```csv
Product Name,Category,Store,Price,Sales,Commission,Affiliate Link,Extra Commission Link,Status,Created At,Image URL
```

Duplicates are detected using the case-insensitive combination of product name, store, and affiliate link. Imports are limited to 5,000 rows per request.

## Operational notes

- Prices are stored as numeric IDR values; commissions are numeric percentages.
- Reads are cached for five minutes and every mutation clears the cache.
- Writes use `LockService` and batch ranges to prevent concurrent corruption and minimize spreadsheet calls.
- For stronger access control, deploy only to your account/domain. UI escaping and server validation do not replace deployment-level authentication.

## Future improvements

- Add scheduled Shopee product metadata and image synchronization through an authorized API.
- Add historical commission/sales snapshots for time-series charts.
- Add export, undo/archive, audit history, and automatic backups.
- Add server-side pagination when the catalog grows beyond several thousand products.
- Add configurable CSV column mapping for exports from different marketplaces.
