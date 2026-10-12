/**
 * Fable & Folio storefront backend.
 * Create a spreadsheet, set SPREADSHEET_ID below, then deploy this project as a Web app.
 * Products tab headers: id | name | description | price | category | frontImage | backImage | active | sortOrder
 * Orders tab is created automatically. Keep it private; it contains customer delivery details.
 */
const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const PRODUCTS_TAB = 'Products';
const ORDERS_TAB = 'Orders';

function doGet(e) {
  const callback = (e && e.parameter && e.parameter.callback || '').replace(/[^\w.$]/g, '');
  try {
    const action = e && e.parameter && e.parameter.action || 'products';
    if (action === 'image') {
      const imageId = e.parameter.id || '';
      const allowedIds = getCatalogImageIds_();
      if (!imageId || allowedIds.indexOf(imageId) === -1) throw new Error('Image is not in the active product catalog');
      const file = DriveApp.getFileById(imageId);
      const blob = file.getBlob();
      const mimeType = blob.getContentType() || '';
      if (mimeType.indexOf('image/') !== 0) throw new Error('Drive file is not an image');
      if (blob.getBytes().length > 8 * 1024 * 1024) throw new Error('Image is over 8 MB; please optimize it and try again');
      return respond({ ok: true, mimeType: mimeType, base64: Utilities.base64Encode(blob.getBytes()) }, callback);
    }
    if (action !== 'products') return respond({ ok: false, error: 'Unknown action' }, callback);
    const products = readProducts_();
    return respond({ ok: true, products: products }, callback);
  } catch (err) {
    return respond({ ok: false, error: String(err.message || err) }, callback);
  }
}

function getCatalogImageIds_() {
  const ids = [];
  readProducts_().forEach(function (product) {
    [product.frontImage, product.backImage].forEach(function (url) {
      const match = String(url || '').match(/(?:\/d\/|[?&]id=)([\w-]+)/);
      if (match && ids.indexOf(match[1]) === -1) ids.push(match[1]);
    });
  });
  return ids;
}

function doPost(e) {
  try {
    const order = JSON.parse(e.postData.contents);
    validateOrder_(order);
    const sheet = getOrCreateOrdersSheet_();
    const rows = order.items.map(function (item) {
      return [order.orderId, order.createdAt, order.name, order.email, order.address,
        item.id, item.name, item.quantity, item.unitPrice, order.amount, order.currency,
        'PENDING UPI', ''];
    });
    if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return jsonOutput_({ ok: true, orderId: order.orderId });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err.message || err) });
  }
}

function readProducts_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PRODUCTS_TAB);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(function (h) { return h.trim(); });
  return values.map(function (row) {
    const p = {};
    headers.forEach(function (header, i) { p[header] = row[i]; });
    return p;
  }).filter(function (p) {
    return p.id && p.name && p.frontImage && p.backImage && Number(p.price) > 0 && isActive_(p.active);
  }).sort(function (a, b) { return Number(a.sortOrder || 0) - Number(b.sortOrder || 0); })
    .map(function (p) {
      return { id: p.id, name: p.name, tag: p.description || '', price: Number(p.price),
        category: p.category || '', frontImage: p.frontImage, backImage: p.backImage, active: true };
    });
}

function validateOrder_(order) {
  if (!order || !order.orderId || !order.name || !order.email || !order.address) throw new Error('Missing order details');
  if (!Array.isArray(order.items) || !order.items.length) throw new Error('Order has no items');
  // Recalculate from current sheet prices; never trust prices supplied by the browser.
  const catalog = readProducts_();
  const byId = {};
  catalog.forEach(function (p) { byId[p.id] = p; });
  let amount = 0;
  order.items.forEach(function (item) {
    const product = byId[item.id], quantity = Number(item.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new Error('Invalid item in order');
    item.name = product.name;
    item.unitPrice = product.price;
    amount += product.price * quantity;
  });
  order.amount = amount;
  order.currency = 'INR';
  order.createdAt = order.createdAt || new Date().toISOString();
}

function getOrCreateOrdersSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(ORDERS_TAB);
  if (!sheet) sheet = ss.insertSheet(ORDERS_TAB);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Order ID', 'Created At', 'Customer', 'Email', 'Delivery Address',
      'Product ID', 'Product', 'Quantity', 'Unit Price (INR)', 'Order Total (INR)',
      'Currency', 'Payment Status', 'UPI UTR / Reference']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isActive_(value) {
  return !value || ['true', 'yes', '1', 'active'].indexOf(String(value).toLowerCase()) !== -1;
}

function respond(data, callback) {
  const body = JSON.stringify(data);
  return ContentService.createTextOutput(callback ? callback + '(' + body + ');' : body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
