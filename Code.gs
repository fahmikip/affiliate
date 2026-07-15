/** Affiliate Link Manager web entry point. */
function doGet() {
  ensureDatabase_();
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Affiliate Link Manager')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** Includes partial HTML files in templates. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Returns all boot data in one server round trip. */
function getAppData() {
  var products = getProducts_();
  return { products: products, categories: getCategories_(products), stats: buildStats_(products), user: Session.getActiveUser().getEmail() || 'Ruang kerja pribadi' };
}

function saveProduct(product) { return saveProduct_(product); }
function deleteProducts(ids) { return deleteProducts_(ids); }
function setFavorite(id, favorite) { return setFavorite_(id, favorite); }
function importCsvRows(rows) { return importCsvRows_(rows); }
function createCategory(name) { return createCategory_(name); }
function renameCategory(oldName, newName) { return renameCategory_(oldName, newName); }
function deleteCategory(name) { return deleteCategory_(name); }
