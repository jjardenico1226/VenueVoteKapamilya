/**
 * Kapamilya ABS-CBN Reunion - Venue Vote backend
 *
 * Paste this whole file into Extensions > Apps Script of your Google Sheet,
 * then deploy it as a Web app (see SETUP.md).
 *
 * Votes are saved in a sheet tab named "Votes".
 */

// ---------- Settings (edit these) ----------
const ADMIN_PIN = '2026';          // PIN for the organizer view on the website. CHANGE THIS.
const SHEET_NAME = 'Votes';        // Tab name where votes are saved
const SPREADSHEET_ID = '';         // Leave empty if this script was opened from the Sheet (Extensions > Apps Script)

// Venue ids must match the website. Values are what gets written in the sheet.
const VENUES = { kuyas: "Kuya's", talabar: 'Talabar', '9501': '9501' };

const HEADERS = ['Timestamp', 'First Name', 'Last Name', 'Mobile', 'Venue', 'Venue ID', 'Name Key'];

// ---------- Entry points ----------

// Public, read-only: vote totals.
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'results';
  try {
    if (action === 'results') return json_(getResults_());
  } catch (err) {
    return json_({ ok: false, error: 'Backend error: ' + err.message });
  }
  return json_({ ok: false, error: 'Unknown action.' });
}

// Voting and organizer actions.
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  try {
    switch (body.action) {
      case 'vote':       return json_(castVote_(body));
      case 'adminList':  return json_(adminList_(body));
      case 'adminReset': return json_(adminReset_(body));
    }
  } catch (err) {
    return json_({ ok: false, error: 'Backend error: ' + err.message });
  }
  return json_({ ok: false, error: 'Unknown action.' });
}

// Run this once from the editor to create the sheet tab and grant permissions.
function setup() {
  const sh = getSheet_();
  Logger.log('Ready. Votes are saved in tab "' + sh.getName() + '".');
}

// ---------- Voting ----------

function castVote_(b) {
  const first = cleanName_(b.first);
  const last = cleanName_(b.last);
  const phone = normPhone_(b.mobile);
  const venueId = String(b.venue || '');

  if (!first || !last) return { ok: false, error: 'Enter your first and last name.' };
  if (!phone) return { ok: false, error: 'Enter a valid Philippine mobile number, like 0917 123 4567.' };
  if (!VENUES[venueId]) return { ok: false, error: 'Choose a venue.' };

  const nameKey = (first + '|' + last).toLowerCase();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return { ok: false, error: 'Too many people are voting right now. Please try again.' };
  }

  try {
    const sh = getSheet_();
    const lastRow = sh.getLastRow();

    if (lastRow > 1) {
      // Columns D..G: Mobile, Venue, Venue ID, Name Key
      const rows = sh.getRange(2, 4, lastRow - 1, 4).getValues();
      for (let i = 0; i < rows.length; i++) {
        if (normPhone_(rows[i][0]) === phone) {
          return { ok: false, code: 'DUP_PHONE', error: 'This mobile number has already voted. Each person can vote once.' };
        }
        if (String(rows[i][3]) === nameKey) {
          return { ok: false, code: 'DUP_NAME', error: first + ' ' + last + ' has already voted. Each person can vote once.' };
        }
      }
    }

    // Write as text so the leading 0 in mobile numbers is kept.
    const row = lastRow + 1;
    const range = sh.getRange(row, 1, 1, 7);
    range.setNumberFormats([['yyyy-mm-dd hh:mm:ss', '@', '@', '@', '@', '@', '@']]);
    range.setValues([[new Date(), first, last, phone, VENUES[venueId], venueId, nameKey]]);
    SpreadsheetApp.flush();

    CacheService.getScriptCache().remove('results');
    return { ok: true, first: first, venue: VENUES[venueId] };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Results (public) ----------

function getResults_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('results');
  if (hit) return JSON.parse(hit);

  const counts = {};
  Object.keys(VENUES).forEach(function (id) { counts[id] = 0; });

  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const ids = sh.getRange(2, 6, lastRow - 1, 1).getValues();
    ids.forEach(function (r) {
      const id = String(r[0]);
      if (counts.hasOwnProperty(id)) counts[id]++;
    });
  }
  const total = Object.keys(counts).reduce(function (s, id) { return s + counts[id]; }, 0);
  const res = { ok: true, counts: counts, total: total };
  cache.put('results', JSON.stringify(res), 15);
  return res;
}

// ---------- Organizer ----------

function adminList_(b) {
  if (String(b.pin) !== ADMIN_PIN) return { ok: false, error: 'Wrong PIN.' };
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  const voters = [];
  if (lastRow > 1) {
    const rows = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    rows.forEach(function (r) {
      voters.push({
        ts: r[0] instanceof Date ? r[0].getTime() : 0,
        first: String(r[1]),
        last: String(r[2]),
        phone: String(r[3]),
        venue: String(r[4])
      });
    });
  }
  voters.sort(function (a, b) { return b.ts - a.ts; });
  return { ok: true, voters: voters };
}

function adminReset_(b) {
  if (String(b.pin) !== ADMIN_PIN) return { ok: false, error: 'Wrong PIN.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
    CacheService.getScriptCache().remove('results');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Helpers ----------

function getSheet_() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('B:G').setNumberFormat('@');
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(4, 130);
  }
  return sh;
}

function normPhone_(raw) {
  let d = String(raw === undefined || raw === null ? '' : raw).replace(/\D/g, '');
  if (d.indexOf('63') === 0 && d.length === 12) d = '0' + d.slice(2);
  else if (d.indexOf('9') === 0 && d.length === 10) d = '0' + d;
  return /^09\d{9}$/.test(d) ? d : '';
}

function cleanName_(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[=+\-@]+/, '')   // avoid spreadsheet formula characters
    .slice(0, 40);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
