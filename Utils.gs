var CONFIG = Object.freeze({
  SHEET: 'Products', CACHE_KEY: 'affiliate_products_v2', CACHE_SECONDS: 300,
  HEADERS: ['ID','Product Name','Category','Store','Price','Sales','Commission','Affiliate Link','Extra Commission Link','Status','Created At','Favorite','Image URL']
});

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function ensureDatabase_() {
  var ss = getSpreadsheet_();
  if (!ss) throw new Error('Atur SPREADSHEET_ID di Properti Skrip atau hubungkan proyek ini ke spreadsheet.');
  var sheet = ss.getSheetByName(CONFIG.SHEET) || ss.insertSheet(CONFIG.SHEET);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
  if (sheet.getMaxColumns() < CONFIG.HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), CONFIG.HEADERS.length - sheet.getMaxColumns());
  var current = sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).getValues()[0];
  if (current.join('|') !== CONFIG.HEADERS.join('|')) sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,CONFIG.HEADERS.length).setFontWeight('bold').setBackground('#ff6a00').setFontColor('#ffffff');
  return sheet;
}

function cleanText_(value, max) { return String(value == null ? '' : value).replace(/[<>]/g, '').trim().slice(0, max || 1000); }
function number_(value) { var n = Number(String(value == null ? 0 : value).replace(/[^0-9.-]/g, '')); return isFinite(n) ? n : 0; }

/** Converts Indonesian marketplace numbers such as 90,6RB, 10RB+, Rp9.064 and 10,50%. */
function localizedNumber_(value, kind) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  var text = String(value == null ? '' : value).trim().toUpperCase();
  if (!text) return 0;
  var multiplier = /(?:RB|RIBU|K)\+?$/.test(text) ? 1000 : /(?:JT|JUTA|M)\+?$/.test(text) ? 1000000 : 1;
  text = text.replace(/RP\s*/g, '').replace(/(?:RB|RIBU|JT|JUTA|K|M)\+?$/g, '').replace(/%/g, '').trim();
  if (kind === 'money' && multiplier === 1) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.indexOf(',') >= 0) text = text.replace(/\./g, '').replace(',', '.');
  else if (kind !== 'decimal' && /^\d{1,3}(?:\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  var n = Number(text.replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n * multiplier : 0;
}
function bool_(value) { return value === true || /^(true|yes|1)$/i.test(String(value)); }
function dateIso_(value) { var d = value instanceof Date ? value : new Date(value); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
function newId_() { return 'PRD-' + Utilities.getUuid().split('-')[0].toUpperCase(); }
function clearCache_() { CacheService.getScriptCache().remove(CONFIG.CACHE_KEY); }

function normalizeProduct_(p) {
  return {
    id: cleanText_(p.id, 64), name: cleanText_(p.name, 250), category: cleanText_(p.category || 'Uncategorized', 100),
    store: cleanText_(p.store, 150), price: Math.max(0, localizedNumber_(p.price, 'money')), sales: Math.max(0, localizedNumber_(p.sales, 'count')),
    commission: Math.max(0, localizedNumber_(p.commission, 'decimal')), affiliateLink: cleanText_(p.affiliateLink, 2000),
    extraLink: cleanText_(p.extraLink, 2000), status: cleanText_(p.status || 'Active', 30),
    createdAt: dateIso_(p.createdAt), favorite: bool_(p.favorite), imageUrl: cleanText_(p.imageUrl, 2000)
  };
}

function validateProduct_(p) {
  if (!p.name) throw new Error('Nama produk wajib diisi.');
  if (p.affiliateLink && !/^https?:\/\//i.test(p.affiliateLink)) throw new Error('Tautan afiliasi harus diawali http:// atau https://.');
  if (p.extraLink && !/^https?:\/\//i.test(p.extraLink)) throw new Error('Tautan komisi ekstra harus diawali http:// atau https://.');
  if (p.imageUrl && !/^https?:\/\//i.test(p.imageUrl)) throw new Error('URL gambar harus diawali http:// atau https://.');
}

function buildStats_(products) {
  var commissions = products.map(function(p){ return p.commission; });
  var sorted = products.slice().sort(function(a,b){ return new Date(a.createdAt)-new Date(b.createdAt); });
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return { total: products.length, categories: new Set(products.map(function(p){return p.category;})).size,
    averageCommission: products.length ? commissions.reduce(function(a,b){return a+b;},0)/products.length : 0,
    highestCommission: commissions.length ? Math.max.apply(null, commissions) : 0,
    lowestCommission: commissions.length ? Math.min.apply(null, commissions) : 0,
    newest: sorted.length ? sorted[sorted.length-1].name : '—', oldest: sorted.length ? sorted[0].name : '—',
    today: products.filter(function(p){return Utilities.formatDate(new Date(p.createdAt), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today;}).length };
}
