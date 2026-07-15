/** Reads the database once and caches the serialized product list. */
function getProducts_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(CONFIG.CACHE_KEY);
  if (cached) { try { return JSON.parse(cached); } catch (ignore) {} }
  var sheet = ensureDatabase_(), last = sheet.getLastRow();
  if (last < 2) return [];
  var rows = sheet.getRange(2, 1, last - 1, CONFIG.HEADERS.length).getValues();
  var products = rows.filter(function(r){return r[0];}).map(function(r){ return normalizeProduct_({
    id:r[0], name:r[1], category:r[2], store:r[3], price:r[4], sales:r[5], commission:r[6], affiliateLink:r[7],
    extraLink:r[8], status:r[9], createdAt:r[10], favorite:r[11], imageUrl:r[12]
  }); });
  var json = JSON.stringify(products); if (json.length < 95000) cache.put(CONFIG.CACHE_KEY, json, CONFIG.CACHE_SECONDS);
  return products;
}

function toRow_(p) { return [p.id,p.name,p.category,p.store,p.price,p.sales,p.commission,p.affiliateLink,p.extraLink,p.status,new Date(p.createdAt),p.favorite,p.imageUrl]; }

/** Inserts or updates a product under a script lock. */
function saveProduct_(input) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var p = normalizeProduct_(input || {}); validateProduct_(p);
    var sheet = ensureDatabase_(), products = getProducts_(), index = products.findIndex(function(x){return x.id === p.id;});
    if (!p.id) { p.id = newId_(); while(products.some(function(x){return x.id===p.id;})) p.id=newId_(); p.createdAt=new Date().toISOString(); }
    if (index >= 0) sheet.getRange(index + 2, 1, 1, CONFIG.HEADERS.length).setValues([toRow_(p)]);
    else sheet.appendRow(toRow_(p));
    clearCache_(); return { ok:true, product:p, message:index >= 0 ? 'Produk diperbarui.' : 'Produk ditambahkan.' };
  } finally { lock.releaseLock(); }
}

/** Deletes many records with one batch rewrite. */
function deleteProducts_(ids) {
  ids = Array.isArray(ids) ? ids.map(String) : [];
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try { var sheet=ensureDatabase_(), kept=getProducts_().filter(function(p){return ids.indexOf(p.id)<0;});
    var last=sheet.getLastRow(); if(last>1) sheet.getRange(2,1,last-1,CONFIG.HEADERS.length).clearContent();
    if(kept.length) sheet.getRange(2,1,kept.length,CONFIG.HEADERS.length).setValues(kept.map(toRow_));
    clearCache_(); return {ok:true, deleted:ids.length};
  } finally { lock.releaseLock(); }
}

function setFavorite_(id, favorite) { var p=getProducts_().find(function(x){return x.id===String(id);}); if(!p) throw new Error('Produk tidak ditemukan.'); p.favorite=!!favorite; return saveProduct_(p); }

/** Validates and imports parsed CSV objects in one write. */
function importCsvRows_(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('CSV tidak berisi data.');
  if (rows.length > 5000) throw new Error('Maksimal 5.000 baris untuk setiap impor.');
  var lock=LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sheet=ensureDatabase_(), existing=getProducts_(), keys={};
    existing.forEach(function(p){keys[(p.name+'|'+p.store+'|'+p.affiliateLink).toLowerCase()]=true;});
    var added=[], duplicates=0, errors=[];
    rows.forEach(function(raw,i){ try { var p=normalizeProduct_({id:'',name:raw['Product Name']||raw['Nama Produk']||raw.name,category:raw.Category||raw.Kategori||raw.category,
      store:raw.Store||raw['Nama Toko']||raw.Toko||raw.store,price:raw.Price||raw.Harga||raw.price,sales:raw.Sales||raw.Penjualan||raw.sales,
      commission:raw['Komisi hingga']||raw['Komisi Hingga']||raw.Commission||raw.commission,
      affiliateLink:raw['Affiliate Link']||raw['Link Produk']||raw.affiliateLink,extraLink:raw['Extra Commission Link']||raw['Link Komisi Ekstra']||raw.extraLink,
      status:raw.Status||raw.status,createdAt:raw['Created At']||raw['Dibuat Pada']||raw.createdAt,imageUrl:raw['Image URL']||raw['URL Gambar']||raw.imageUrl}); validateProduct_(p);
      var key=(p.name+'|'+p.store+'|'+p.affiliateLink).toLowerCase(); if(keys[key]) {duplicates++;return;} keys[key]=true;p.id=newId_();added.push(p);
    } catch(e){errors.push('Baris '+(i+2)+': '+e.message);} });
    if(added.length) sheet.getRange(sheet.getLastRow()+1,1,added.length,CONFIG.HEADERS.length).setValues(added.map(toRow_));
    clearCache_(); return {ok:true, imported:added.length,duplicates:duplicates,errors:errors.slice(0,50)};
  } finally {lock.releaseLock();}
}

function renameCategory_(oldName,newName) {
  oldName=cleanText_(oldName,100);newName=cleanText_(newName,100);if(!newName)throw new Error('Nama kategori wajib diisi.');
  var products=getProducts_(), changed=0;products.forEach(function(p){if(p.category===oldName){p.category=newName;changed++;}});
  var lock=LockService.getScriptLock();lock.waitLock(30000);
  try{var sheet=ensureDatabase_();if(products.length)sheet.getRange(2,1,products.length,CONFIG.HEADERS.length).setValues(products.map(toRow_));
    var categories=getCategories_(products).filter(function(n){return n!==oldName;});if(categories.indexOf(newName)<0)categories.push(newName);saveCategories_(categories);clearCache_();return{ok:true,changed:changed};}finally{lock.releaseLock();}
}

function getCategories_(products) { var saved=[];try{saved=JSON.parse(PropertiesService.getScriptProperties().getProperty('CUSTOM_CATEGORIES')||'[]');}catch(ignore){}
  return Array.from(new Set(saved.concat((products||[]).map(function(p){return p.category;})).filter(Boolean))).sort(); }
function saveCategories_(categories) { PropertiesService.getScriptProperties().setProperty('CUSTOM_CATEGORIES',JSON.stringify(Array.from(new Set(categories)).sort())); }
function createCategory_(name) { name=cleanText_(name,100);if(!name)throw new Error('Nama kategori wajib diisi.');var categories=getCategories_(getProducts_());if(categories.indexOf(name)>=0)throw new Error('Kategori sudah ada.');categories.push(name);saveCategories_(categories);return{ok:true}; }
function deleteCategory_(name) { name=cleanText_(name,100);var result=renameCategory_(name,'Uncategorized');var categories=getCategories_(getProducts_()).filter(function(n){return n!==name;});saveCategories_(categories);return result; }
