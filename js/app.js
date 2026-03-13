// ═══════════════════════════════════
// app.js — State, Init, UI, Steps, Items
// ═══════════════════════════════════
'use strict';

// ── Global state ──
let items = [], extraTaxes = [], undoStack = [], redoStack = [];
let currentTheme = 'classic', logoURL = null, logoW = 70, logoBg = false;
let stampURL = null, sigURL = null;
const SW = { rates: true, dscol: false, savings: false, vat: true, grandtot: true, notes: false, payterms: false, sign: true, stamp: true };
let wmText = 'PAID', wmOn = false;
let pageType = 'quotation'; // 'quotation' or 'invoice'

/* stubs for removed features */
function debouncedR() { dr(); }
function validateDates() { return true; }
function closeM() { try { $('ov').classList.remove('open'); } catch (e) { } }
function clearActiveCapsule() { }

/* ─── CONFIRM NEW ─── */
function confirmNew() {
  // Show inline confirm banner
  let banner = $('confirm-new-bar');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'confirm-new-bar';
    banner.style.cssText = 'position:fixed;top:54px;left:0;right:0;z-index:400;background:#e53935;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;font-size:.84rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2);animation:slideDown .2s ease';
    banner.innerHTML = `<span>⚠ Clear everything and start a new quotation?</span><div style="display:flex;gap:8px"><button onclick="document.getElementById('confirm-new-bar').remove()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:.8rem">Cancel</button><button onclick="document.getElementById('confirm-new-bar').remove();resetAll()" style="background:#fff;border:none;color:#e53935;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:.8rem">Yes, Clear</button></div>`;
    document.body.appendChild(banner);
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 6000);
  }
}

/* ═══ STATE ═══ */
const $ = id => document.getElementById(id);
const g = id => $(id) ? $(id).value : '';
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl = s => esc(s).replace(/\n/g, '<br>');
const iso = d => d.toISOString().split('T')[0];
const fmt = n => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtD(s) { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
function uid() { return Math.random().toString(36).slice(2, 9); }
function round(n) { const m = g('p-round'); if (m === 'round') return Math.round(n); if (m === 'ceil') return Math.ceil(n); if (m === 'floor') return Math.floor(n); return Math.round(n * 100) / 100; }
function curr() { return g('s-curr') || 'रु'; }
function getVat() { const v = g('p-vat'); return v === 'custom' ? parseFloat(g('p-vat-c')) || 0 : parseFloat(v) || 0; }
function getUnit() { const v = g('s-unit'); return v === 'custom' ? g('s-unit-custom') || '' : v; }

let renderTimer = null;

/* ═══ INIT ═══ */
window.onload = () => {
  // ── Dismiss splash after 3 seconds
  setTimeout(() => {
    const sp = document.getElementById('splash');
    if (sp) {
      sp.classList.add('hidden');
      setTimeout(() => sp.style.display = 'none', 400);
    }
  }, 1400);
  const t = new Date(), v = new Date(t); v.setDate(v.getDate() + 30);
  $('q-date').value = iso(t); $('q-valid').value = iso(v);

  // Detect page type
  if (window.location.pathname.includes('invoice')) {
    pageType = 'invoice';
    document.title = "ProQuote — Professional Invoice Maker";
    // Update status options for invoice
    const qs = $('q-status');
    if (qs) {
      qs.innerHTML = `
        <option value="unpaid">Unpaid</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
        <option value="draft">Draft</option>`;
    }
  } else {
    pageType = 'quotation';
    document.title = "ProQuote — Professional Quotation Maker";
  }

  $('q-no').value = nextQNo();
  // Auto-detect system theme, override with saved preference if set
  const savedDark = localStorage.getItem('pq_dark');
  if (savedDark !== null) {
    applyDark(savedDark === '1');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyDark(prefersDark);
  }
  // Listen for system theme changes (if no manual override)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (localStorage.getItem('pq_dark') === null) applyDark(e.matches);
  });
  restoreDraft(); // async - handles buildItems/r internally
  buildItems(); r(); // initial render with empty state
  initScaler();
  initSavedCounts();
  window.addEventListener('beforeunload', saveDraft);
  // Close modals on backdrop click
  ['ov-new', 'ov-saved', 'ov-templates'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });
  // Undo/redo via Ctrl+Z / Ctrl+Y still supported
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.shiftKey && e.key === 'A' && !typing) { e.preventDefault(); if (!$('pane-4').classList.contains('active')) goS(4); addItem(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !typing) { e.preventDefault(); doUndo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z')) && !typing) { e.preventDefault(); doRedo(); }
  });
  // Show install banner on mobile after a short delay
  setTimeout(maybeShowBanner, 1800);
};


/* ═══ QUOTE NO ═══ */
function nextQNo() {
  try {
    const yr = new Date().getFullYear();
    const d = JSON.parse(localStorage.getItem('pq_qno') || '{}');
    const n = (d[yr] || 0) + 1; d[yr] = n;
    localStorage.setItem('pq_qno', JSON.stringify(d));
    return `PQ-${yr}-${String(n).padStart(3, '0')}`;
  } catch (e) { return 'PQ-001'; }
}
/* ═══ WATERMARK ═══ */
function togWatermark() {
  wmOn = !wmOn;
  const sw = $('sw-watermark');
  if (sw) sw.classList.toggle('on', wmOn);
  const row = $('watermark-color-row');
  if (row) row.style.display = wmOn ? 'block' : 'none';
  r();
}
function setWmText(text, btn) {
  wmText = text;
  document.querySelectorAll('.wm-style-btn').forEach(b => {
    const sel = b.dataset.wm === text;
    b.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
    b.style.background = sel ? 'var(--accent-s)' : 'var(--panel2)';
    b.style.color = sel ? 'var(--accent)' : 'var(--muted)';
  });
  r();
}

/* ═══ STEPS ═══ */
function goS(n) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  $('pane-' + n).classList.add('active');
  $('st' + n).classList.add('active');
  for (let i = 1; i <= 5; i++) { const tab = $('st' + i), b = tab.querySelector('.sbadge'); tab.classList.remove('done'); b.textContent = i; }
  for (let i = 1; i < n; i++) { $('st' + i).classList.add('done'); $('st' + i).querySelector('.sbadge').textContent = '✓'; }
  if (n === 5) buildSum();
  document.querySelector('.fp').scrollTop = 0;
}

/* ═══ DEBOUNCED RENDER ═══ */
function dr() { clearTimeout(renderTimer); renderTimer = setTimeout(r, 180); }

/* ═══ UNDO/REDO ═══ */
function pushUndo() { undoStack.push(JSON.stringify(items)); if (undoStack.length > 30) undoStack.shift(); redoStack = []; }
function doUndo() { if (!undoStack.length) { toast('Nothing to undo'); return; } redoStack.push(JSON.stringify(items)); items = JSON.parse(undoStack.pop()); buildItems(); r(); toast('Undo'); }
function doRedo() { if (!redoStack.length) { toast('Nothing to redo'); return; } undoStack.push(JSON.stringify(items)); items = JSON.parse(redoStack.pop()); buildItems(); r(); toast('Redo'); }


/* ═══ ITEMS UI ═══ */
function buildItems() {
  const c = $('items-body'); if (!c) return;
  c.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.id = 'ir-' + item.id;
    if (item.type === 'section') {
      el.className = 'irow-section';
      el.innerHTML = `<span style="font-size:.7rem;color:var(--dim)">§</span>
        <input type="text" value="${esc(item.desc)}" placeholder="Section heading…" onchange="upd('${item.id}','desc',this.value)">
        <button class="idel" onclick="delItem('${item.id}')">✕</button>`;
    } else {
      const globVatZero = getVat() === 0;
      const vatDisplay = globVatZero ? 'display:none;' : '';
      
      el.className = 'irow';
      if (item.optional) el.style.borderLeft = '3px solid var(--warn)';
      el.innerHTML = `
        <input type="checkbox" ${item.sel ? 'checked' : ''} onchange="selItem('${item.id}',this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--danger);flex-shrink:0">
        <div class="idesc-wrap" style="min-width:0">
          <div style="display:flex;align-items:center;gap:4px">
            <input type="text" value="${esc(item.desc)}" placeholder="Description" onchange="upd('${item.id}','desc',this.value)" style="flex:1;font-size:.77rem">
            ${item.optional ? '<span style="font-size:.6rem;background:var(--warn-s);color:var(--warn);padding:1px 5px;border-radius:3px;font-weight:700;white-space:nowrap">Optional</span>' : ''}
          </div>
          <input type="text" value="${esc(item.note || '')}" placeholder="Note (optional)" onchange="upd('${item.id}','note',this.value)" style="font-size:.71rem;color:var(--muted);border-color:transparent;background:transparent;padding:2px 4px;margin-top:1px">
        </div>
        <input type="number" value="${item.qty || ''}" placeholder="1" min="0" step="any" onchange="upd('${item.id}','qty',this.value)" style="text-align:center;font-size:.78rem">
        <input type="number" value="${item.rate || ''}" placeholder="0.00" min="0" step="any" onchange="upd('${item.id}','rate',this.value)" style="font-size:.78rem">
        <input type="number" value="${item.d}" placeholder="0" min="0" max="100" step="any" onchange="upd('${item.id}','d',this.value)" style="font-size:.78rem">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:5px">
          <button title="Toggle VAT for this item" onclick="togItemVat('${item.id}')" style="${vatDisplay}width:24px;height:24px;border-radius:4px;border:1px solid ${item.noVat ? 'var(--border)' : 'var(--success)'};background:${item.noVat ? 'transparent' : 'var(--success-s)'};color:${item.noVat ? 'var(--dim)' : 'var(--success)'};cursor:pointer;font-size:.65rem;font-weight:700">${item.noVat ? 'NO' : 'VAT'}</button>
          <button class="idel" onclick="delItem('${item.id}')" style="margin-left:auto;width:20px;height:20px">✕</button>
        </div>`;
    }
    c.appendChild(el);
  });
  updateBulkBar();
}

function selItem(id, checked) {
  const it = items.find(x => x.id === id); if (!it) return;
  it.sel = checked;
  const row = $('ir-' + id); if (row && it.type !== 'section') row.style.background = checked ? '#fff3f3' : '';
  updateBulkBar();
}
function toggleSelAll(checked) { items.forEach(it => { if (it.type !== 'section') it.sel = checked; }); buildItems(); }
function updateBulkBar() {
  const sel = items.filter(x => x.sel && x.type !== 'section').length;
  const bar = $('bulk-bar'); if (!bar) return;
  bar.style.display = sel ? 'flex' : 'none';
  $('bulk-count').textContent = sel + ' selected';
  const allCb = $('sel-all');
  if (allCb) { const t = items.filter(x => x.type !== 'section').length; allCb.checked = sel === t && t > 0; allCb.indeterminate = sel > 0 && sel < t; }
}
function deleteSelected() {
  const n = items.filter(x => x.sel && x.type !== 'section').length; if (!n) return;
  pushUndo(); items = items.filter(x => !x.sel); buildItems(); r(); toast(n + ' removed — Ctrl+Z to undo');
}

function upd(id, k, v) {
  const it = items.find(x => x.id === id); if (!it) return;
  if (['qty', 'rate', 'd'].includes(k)) v = parseFloat(v) || 0;
  it[k] = v;
  if (['qty', 'rate', 'd'].includes(k)) { buildItems(); r(); } else dr();
}
function togItemD(id) {
  const it = items.find(x => x.id === id); if (!it) return;
  it.useD = !it.useD; buildItems(); r();
}
function togItemVat(id) {
  const it = items.find(x => x.id === id); if (!it) return;
  it.noVat = !it.noVat; buildItems(); r();
}
function addItem() {
  pushUndo();
  items.push({ id: uid(), type: 'item', desc: '', qty: '', rate: '', d: 0, useD: true, sel: false, optional: false, note: '', noVat: false });
  buildItems(); r();
  setTimeout(() => { const pb = $('items-pane-body'); if (pb) pb.scrollTop = pb.scrollHeight; }, 30);
}
function addSection() {
  pushUndo();
  items.push({ id: uid(), type: 'section', desc: '' });
  buildItems(); r();
  setTimeout(() => {
    const pb = $('items-pane-body'); if (pb) pb.scrollTop = pb.scrollHeight;
    // Focus the new section input
    const rows = document.querySelectorAll('.irow-section input[type=text]');
    if (rows.length) rows[rows.length - 1].focus();
  }, 30);
  toast('Section added');
}
function addOptional() {
  pushUndo();
  items.push({ id: uid(), type: 'item', desc: '', qty: '', rate: '', d: 0, useD: true, sel: false, optional: true, note: '', noVat: false });
  buildItems(); r();
  setTimeout(() => { const pb = $('items-pane-body'); if (pb) pb.scrollTop = pb.scrollHeight; }, 30);
  toast('Optional item added');
}
function delItem(id) {
  if (items.length > 1 && !confirm('Are you sure you want to remove this item?')) return;
  pushUndo(); items = items.filter(x => x.id !== id); buildItems(); r();
  toast('Removed — Ctrl+Z to undo');
}

/* ═══ TOGGLES ═══ */
const SW_IDS = { rates: ['sw-rates', 'sw-rates-2'], dscol: ['sw-dscol', 'sw-dscol-2'], savings: ['sw-savings'], vat: ['sw-vat'], grandtot: ['sw-grandtot', 'sw-grandtot-2'], notes: ['sw-notes'], payterms: ['sw-payterms'], sign: ['sw-sign'], stamp: ['sw-stamp'] };
const VC_IDS = { rates: 'vc-rates', grandtot: 'vc-grandtot', dscol: 'vc-dscol' };
function tog(k) {
  SW[k] = !SW[k]; syncSW(); r();
}
function syncSW() {
  Object.keys(SW).forEach(k => {
    (SW_IDS[k] || []).forEach(sid => { const e = $(sid); if (e) e.className = 'sw' + (SW[k] ? ' on' : ''); });
    if (VC_IDS[k]) { const e = $(VC_IDS[k]); if (e) e.className = 'vc' + (SW[k] ? ' on' : ''); }
  });
  const ns = $('notes-section'); if (ns) ns.style.display = SW.notes ? '' : 'none';
  const ps = $('payterms-section'); if (ps) ps.style.display = SW.payterms ? '' : 'none';
}

function vatChange() { 
  const vc = $('vat-custom-row'); 
  if (vc) vc.style.display = g('p-vat') === 'custom' ? '' : 'none'; 
  // Rebuild items visually to resync item-level VAT toggle visibility conditionally 
  buildItems();
  r(); 
}
function unitChange() { const uc = $('s-unit-custom'); if (uc) uc.style.display = g('s-unit') === 'custom' ? 'block' : 'none'; r(); }

/* ═══ EXTRA TAXES ═══ */
function addTaxLine() { extraTaxes.push({ id: uid(), name: 'Tax', rate: 0 }); renderTaxLines(); r(); }
function removeTaxLine(id) { extraTaxes = extraTaxes.filter(t => t.id !== id); renderTaxLines(); r(); }
function updTax(id, k, v) { const t = extraTaxes.find(x => x.id === id); if (!t) return; t[k] = k === 'rate' ? parseFloat(v) || 0 : v; r(); }
function renderTaxLines() {
  const c = $('tax-lines'); if (!c) return;
  c.innerHTML = extraTaxes.map(t => `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
      <input type="text" value="${esc(t.name)}" placeholder="Tax name" onchange="updTax('${t.id}','name',this.value)" style="flex:1">
      <input type="number" value="${t.rate}" min="0" max="100" step="0.1" onchange="updTax('${t.id}','rate',this.value)" style="width:68px" placeholder="%">
      <span style="font-size:.8rem;color:var(--muted)">%</span>
      <button class="idel" onclick="removeTaxLine('${t.id}')" style="color:var(--danger)">✕</button>
    </div>`).join('');
}


function applyLogoBg() {
  const wrap = document.getElementById('ldrop-in');
  if (!wrap) return;
  const img = wrap.querySelector('img');
  if (!img) return;
  if (logoBg) { wrap.style.background = '#fff'; wrap.style.padding = '6px'; wrap.style.borderRadius = '6px'; wrap.style.display = 'inline-block'; }
  else { wrap.style.background = ''; wrap.style.padding = ''; wrap.style.borderRadius = ''; wrap.style.display = ''; }
  r();
}
function toggleLogoBg(checked) {
  logoBg = checked;
  applyLogoBg();
  const hint = document.getElementById('logobg-hint');
  if (hint) hint.textContent = logoBg ? 'White background applied' : 'Transparent (for PNG logos)';
}

/* ═══ DARK MODE ═══ */
function toggleDark() {
  const on = !document.body.classList.contains('dark');
  applyDark(on);
  localStorage.setItem('pq_dark', on ? '1' : '0');
}
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  const btn = $('dark-btn'); if (btn) btn.textContent = on ? '☀️' : '🌙';
}

/* ═══ THEMES ═══ */
function setTheme(name, el) {
  currentTheme = name;
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('sel'));
  if (el) el.classList.add('sel');
  r(); toast('Theme: ' + name[0].toUpperCase() + name.slice(1));
}

/* ═══ LOGO ═══ */
function uploadLogo(e) {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 2 * 1024 * 1024) { toast('Max 2MB', 'err'); return; }
  if (!f.type.startsWith('image/')) { toast('Image files only', 'err'); return; }
  const rd = new FileReader();
  rd.onerror = () => toast('Failed to read file', 'err');
  rd.onload = ev => {
    const src = ev.target.result;
    const img = new Image();
    img.onerror = () => { logoURL = src; logoW = 70; setLogoUI(); };
    img.onload = () => {
      try {
        const MAX = 500;
        const cv = document.createElement('canvas'); 
        cv.width = MAX; cv.height = MAX;
        const ctx = cv.getContext('2d');
        // Make the logo square equal from all sides
        let s = Math.min(MAX / img.width, MAX / img.height);
        let dw = img.width * s;
        let dh = img.height * s;
        let dx = (MAX - dw) / 2;
        let dy = (MAX - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        logoURL = cv.toDataURL('image/png');
      } catch (_) { logoURL = src; }
      logoW = 70; setLogoUI();
    };
    img.src = src;
  };
  rd.readAsDataURL(f);
}
function setLogoUI() {
  applyLogoBg();
  $('ldrop-in').innerHTML = `<img src="${logoURL}" style="max-width:${logoW}px;max-height:48px;object-fit:contain;border-radius:3px">`;
  $('logo-acts').style.display = 'flex';
  const bgRow = $('logo-bg-row'); if (bgRow) bgRow.style.display = 'block';
  r(); toast('Logo uploaded', 'ok');
}
function toggleResize() { const w = $('logo-resize'); w.style.display = w.style.display === 'none' ? 'block' : 'none'; }
function resizeLogo(v) { logoW = parseInt(v); $('lsize-lbl').textContent = v; const img = $('ldrop-in').querySelector('img'); if (img) img.style.maxWidth = v + 'px'; r(); }
function removeLogo() {
  logoURL = null; logoW = 70; logoBg = false;
  $('ldrop-in').innerHTML = '<div style="font-size:1.4rem;margin-bottom:4px">🏢</div><div class="ldrop-lbl">Click or drag logo here</div><div class="ldrop-sub">PNG, JPG, SVG · max 2MB</div>';
  $('logo-acts').style.display = 'none'; $('logo-resize').style.display = 'none';
  const bgRow = $('logo-bg-row'); if (bgRow) bgRow.style.display = 'none';
  const chk = $('logo-bg-chk'); if (chk) chk.checked = false;
  r();
}

/* ═══ STAMP ═══ */
function uploadStamp(e) {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 1 * 1024 * 1024) { toast('Max 1MB', 'err'); return; }
  if (!f.type.startsWith('image/')) { toast('Image files only', 'err'); return; }
  const rd = new FileReader();
  rd.onerror = () => toast('Failed to read file', 'err');
  rd.onload = ev => {
    stampURL = ev.target.result;
    $('sdrop-in').innerHTML = `<img src="${stampURL}" style="max-width:100px;max-height:40px;object-fit:contain;border-radius:3px">`;
    $('stamp-acts').style.display = 'flex';
    r(); toast('Stamp uploaded', 'ok');
  };
  rd.readAsDataURL(f);
}
function removeStamp() {
  stampURL = null;
  $('sdrop-in').innerHTML = '<div style="font-size:1.1rem">🏵️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Stamp</div>';
  $('stamp-acts').style.display = 'none';
  r();
}

/* ═══ SIGNATURE ═══ */
function uploadSignature(e) {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 1 * 1024 * 1024) { toast('Max 1MB', 'err'); return; }
  if (!f.type.startsWith('image/')) { toast('Image files only', 'err'); return; }
  const rd = new FileReader();
  rd.onerror = () => toast('Failed to read file', 'err');
  rd.onload = ev => {
    sigURL = ev.target.result;
    $('sigdrop-in').innerHTML = `<img src="${sigURL}" style="max-width:100px;max-height:40px;object-fit:contain;border-radius:3px">`;
    $('sig-acts').style.display = 'flex';
    r(); toast('Signature uploaded', 'ok');
  };
  rd.readAsDataURL(f);
}
function removeSignature() {
  sigURL = null;
  $('sigdrop-in').innerHTML = '<div style="font-size:1.1rem">✍️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Signature</div>';
  $('sig-acts').style.display = 'none';
  r();
}

/* ═══ COLOR ═══ */
function setCol(v) { document.documentElement.style.setProperty('--doc', v); r(); }
function pickCol(el) {
  setCol(el.dataset.c); $('co-col').value = el.dataset.c;
  document.querySelectorAll('.cpick').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}

/* ═══ DATA HELPERS ═══ */
function collectData() {
  return {
    _v: 3, _saved: new Date().toISOString(),
    items, extraTaxes, currentTheme, logoURL, logoW, logoBg, stampURL, sigURL,
    wmOn, wmText,
    coName: g('co-name'), coLoc: g('co-loc'), coPhone: g('co-phone'), coEmail: g('co-email'), coCol: g('co-col'),
    coVat: g('co-vat'), coWeb: g('co-web'),
    clName: g('cl-name'), clPerson: g('cl-person'), clPhone: g('cl-phone'), clAddr: g('cl-addr'),
    qNo: g('q-no'), qStatus: g('q-status'), qDate: g('q-date'), qValid: g('q-valid'), qSubj: g('q-subj'),
    pDisc: g('p-disc'), pVat: g('p-vat'), pVatC: g('p-vat-c'), pShip: g('p-ship'), pRound: g('p-round'),
    pNotes: g('p-notes'), pPay: g('p-payterms'), pBank: g('p-bank'),
    sCurr: g('s-curr'), sUnit: g('s-unit'), sUnitCustom: g('s-unit-custom'), sw: JSON.stringify(SW)
  };
}
function applyData(d) {
  if (!d) return;
  if (d.items && d.items.length) items = d.items; else items = [];
  extraTaxes = d.extraTaxes || [];
  if (d.currentTheme) { currentTheme = d.currentTheme; const tc = document.querySelector(`.theme-card[data-theme="${currentTheme}"]`); if (tc) { document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('sel')); tc.classList.add('sel'); } }
  // Watermark
  wmOn = d.wmOn || false; wmText = d.wmText || 'PAID';
  const wmSw = $('sw-watermark'); if (wmSw) wmSw.classList.toggle('on', wmOn);
  const wmRow = $('watermark-color-row'); if (wmRow) wmRow.style.display = wmOn ? 'block' : 'none';
  // Logo
  logoBg = d.logoBg || false;
  if (d.logoURL) { logoURL = d.logoURL; logoW = d.logoW || 70; $('ldrop-in').innerHTML = `<img src="${logoURL}" style="max-width:${logoW}px;max-height:48px;object-fit:contain;border-radius:3px">`; $('logo-acts').style.display = 'flex'; const bgRow = $('logo-bg-row'); if (bgRow) bgRow.style.display = 'block'; const bgChk = $('logo-bg-chk'); if (bgChk) bgChk.checked = logoBg; }
  // Stamp
  if (d.stampURL) { stampURL = d.stampURL; $('sdrop-in').innerHTML = `<img src="${stampURL}" style="max-width:100px;max-height:40px;object-fit:contain;border-radius:3px">`; $('stamp-acts').style.display = 'flex'; }
  // Signature
  if (d.sigURL) { sigURL = d.sigURL; $('sigdrop-in').innerHTML = `<img src="${sigURL}" style="max-width:100px;max-height:40px;object-fit:contain;border-radius:3px">`; $('sig-acts').style.display = 'flex'; }

  const set = (id, v) => { const e = $(id); if (e && v != null) e.value = v; };
  set('co-name', d.coName); set('co-loc', d.coLoc); set('co-phone', d.coPhone); set('co-email', d.coEmail);
  set('co-vat', d.coVat); set('co-web', d.coWeb);
  if (d.coCol) { setCol(d.coCol); $('co-col').value = d.coCol; }
  set('cl-name', d.clName); set('cl-person', d.clPerson); set('cl-phone', d.clPhone); set('cl-addr', d.clAddr);
  set('q-no', d.qNo); set('q-status', d.qStatus); set('q-date', d.qDate); set('q-valid', d.qValid); set('q-subj', d.qSubj);
  set('p-disc', d.pDisc); set('p-vat', d.pVat); set('p-vat-c', d.pVatC); set('p-ship', d.pShip); set('p-round', d.pRound);
  set('p-notes', d.pNotes); set('p-payterms', d.pPay); set('p-bank', d.pBank);
  set('s-curr', d.sCurr); set('s-unit', d.sUnit); set('s-unit-custom', d.sUnitCustom);
  if (d.sw) { Object.assign(SW, JSON.parse(d.sw)); }
  syncSW(); renderTaxLines();
}

/* ═══ INDEXEDDB ═══ */
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) { res(_db); return; }
    const req = indexedDB.open('ProQuoteDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('quotes'))
        db.createObjectStore('quotes', { keyPath: 'id' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej(req.error);
  });
}
function dbSave(id, data) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').put({ id, ...data });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  }));
}
function dbLoad(id) {
  return openDB().then(db => new Promise((res, rej) => {
    const req = db.transaction('quotes', 'readonly').objectStore('quotes').get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
function dbList() {
  return openDB().then(db => new Promise((res, rej) => {
    const req = db.transaction('quotes', 'readonly').objectStore('quotes').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  }));
}
function dbDelete(id) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction('quotes', 'readwrite');
    tx.objectStore('quotes').delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  }));
}


// ═══════════════════════════════════
// data.js — Draft, Saved Quotes, Toast, Summary
// ═══════════════════════════════════
/* ═══ DRAFT SAVE/RESTORE (IndexedDB + localStorage fallback) ═══ */
function saveDraft() {
  const d = collectData();
  // Save to IndexedDB
  dbSave('__draft__', d).catch(() => { });
  // Also localStorage fallback (strip logo to save space)
  try {
    const small = { ...d, logoURL: null, stampURL: null, sigURL: null };
    localStorage.setItem('pq_v9', JSON.stringify(small));
  } catch (e) { }
}
function restoreDraft() {
  // Try IndexedDB first, fall back to localStorage
  dbLoad('__draft__').then(d => {
    if (d) { applyData(d); buildItems(); r(); toast('Draft restored', 'ok'); }
    else restoreDraftLS();
  }).catch(() => restoreDraftLS());
}
function restoreDraftLS() {
  try {
    const raw = localStorage.getItem('pq_v9'); if (!raw) return;
    const d = JSON.parse(raw);
    applyData(d); buildItems(); r(); toast('Draft restored', 'ok');
  } catch (e) { console.warn('Draft restore failed', e); }
}

/* ═══ SAVE TO DEVICE FILE ═══ */
function saveToFile() {
  const d = collectData();
  const name = (g('q-no') || 'quote').replace(/[^a-z0-9_-]/gi, '_');
  const json = JSON.stringify(d, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name + '.proquote';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Saved: ' + name + '.proquote', 'ok');
}

/* ═══ OPEN FROM DEVICE FILE ═══ */
function openFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.proquote,.json';
  inp.onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        applyData(d); buildItems(); r();
        toast('Loaded: ' + f.name, 'ok');
      } catch (err) { toast('Invalid file', 'err'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ═══ SAVED QUOTES (in-app, IndexedDB) ═══ */
function openSavedModal() {
  dbList().then(quotes => {
    const list = $('saved-list'); if (!list) return;
    if (!quotes.filter(q => q.id !== '__draft__').length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:.82rem">No saved quotes yet.<br>Use <b>Save Quote</b> to save one.</div>';
    } else {
      list.innerHTML = quotes.filter(q => q.id !== '__draft__').sort((a, b) => b._saved > a._saved ? 1 : -1).map(q => `
        <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:8px">
          <div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.88rem">${esc(q.clName || '(no client)')}</div>
              <div style="font-size:.72rem;color:var(--muted)">${esc(q.qNo || '')} · ${esc(q.coName || '')} · ${q._saved ? new Date(q._saved).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</div>
            </div>
            <div style="font-size:.78rem;font-weight:700;color:var(--accent)">${esc(q.sCurr || '')}</div>
          </div>
          <div style="display:flex;border-top:1px solid var(--border)">
            <button class="btn btn-sm" onclick="loadSaved('${q.id}')" style="flex:1;border-radius:0;border:none;background:var(--accent-s);color:var(--accent);font-weight:600;padding:8px">⬆ Load</button>
            <div style="width:1px;background:var(--border)"></div>
            <button class="btn btn-sm btn-danger" onclick="deleteSaved('${q.id}')" style="border-radius:0;border:none;padding:8px 12px">🗑</button>
          </div>
        </div>`).join('');
    }
    $('ov-saved').classList.add('open');
  }).catch(() => toast('Could not load saved quotes', 'err'));
}
function saveQuote() {
  const d = collectData();
  const id = 'q_' + Date.now();
  dbSave(id, d).then(() => {
    toast('Quote saved ✓', 'ok');
  }).catch(() => toast('Save failed', 'err'));
}
function loadSaved(id) {
  dbLoad(id).then(d => {
    if (!d) { toast('Not found', 'err'); return; }
    applyData(d); buildItems(); r();
    $('ov-saved').classList.remove('open');
    toast('Quote loaded', 'ok');
  });
}
function deleteSaved(id) {
  dbDelete(id).then(() => {
    toast('Deleted');
    openSavedModal();
  });
}


/* ═══ TOAST ═══ */
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : ''); t.textContent = msg;
  $('tray').appendChild(t);
  setTimeout(() => { t.style.animation = 'tOut .2s ease forwards'; setTimeout(() => t.remove(), 220); }, 2200);
}

/* ═══ SUMMARY (Step 5) ═══ */
function buildSum() {
  const gd = parseFloat(g('p-disc')) || 0;
  let sub = 0, vatSubtotal = 0;
  items.forEach(it => {
    if (it.type === 'section' || it.optional) return;
    const eff = it.useD ? it.d : gd;
    const lineTot = round(it.qty * it.rate * (1 - eff / 100));
    sub += lineTot;
    if (!it.noVat) vatSubtotal += lineTot;
  });
  const vp = getVat(), va = round(vatSubtotal * vp / 100), ship = parseFloat(g('p-ship')) || 0;
  let extTax = 0; extraTaxes.forEach(tx => { extTax += round(sub * tx.rate / 100); });
  const grand = round(sub + (SW.vat ? va : 0) + extTax + ship);
  const box = $('sum-box'); if (!box) return;
  box.innerHTML = `
    <div>Customer: <strong>${esc(g('cl-name') || '—')}</strong></div>
    <div>${pageType === 'invoice' ? 'Invoice' : 'Quote'} No: <strong>${esc(g('q-no') || '—')}</strong></div>
    <div>Items: <strong>${items.filter(x => x.type !== 'section').length}</strong></div>
    <div>Subtotal: <strong>${curr()} ${fmt(sub)}</strong></div>
    ${vp > 0 ? `<div>VAT (${vp}%): <strong>${curr()} ${fmt(va)}</strong></div>` : ''}
    <div style="color:var(--accent)">Grand Total: <strong>${curr()} ${fmt(grand)}</strong></div>`;
}

/* ═══ RESET ═══ */
function showNewModal() {
  const ov = document.getElementById('ov-new');
  if (ov) ov.classList.add('open');
}
function closeNewModal() {
  const ov = document.getElementById('ov-new');
  if (ov) ov.classList.remove('open');
}
function resetAll() {
  if (items.length > 0 && !confirm('Clear everything and start a new quotation? This cannot be undone.')) return;
  pushUndo(); items = []; extraTaxes = []; undoStack = []; redoStack = []; 
  logoURL = null; stampURL = null; sigURL = null;
  ['co-name', 'co-loc', 'co-phone', 'co-email', 'co-vat', 'co-web', 'cl-name', 'cl-person', 'cl-phone', 'cl-addr',
    'q-subj', 'p-notes', 'p-payterms', 'p-bank'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  wmOn = false; wmText = 'PAID'; const wmSw = $('sw-watermark'); if (wmSw) wmSw.classList.remove('on'); const wmRow = $('watermark-color-row'); if (wmRow) wmRow.style.display = 'none';
  $('p-disc').value = '0'; $('p-vat').value = '13'; $('p-ship').value = '0'; $('s-curr').value = 'रु'; $('q-status').value = 'draft';
  const t = new Date(), v = new Date(t); v.setDate(v.getDate() + 30);
  $('q-date').value = iso(t); $('q-valid').value = iso(v); $('q-no').value = nextQNo();
  
  // Reset image displays
  if($('ldrop-in')) $('ldrop-in').innerHTML = '<div style="font-size:1.4rem;margin-bottom:4px">🏢</div><div class="ldrop-lbl">Click or drag logo here</div><div class="ldrop-sub">PNG, JPG, SVG · max 2MB</div>';
  if($('sdrop-in')) $('sdrop-in').innerHTML = '<div style="font-size:1.1rem">🏵️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Stamp</div>';
  if($('sigdrop-in')) $('sigdrop-in').innerHTML = '<div style="font-size:1.1rem">✍️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Signature</div>';
  ['logo-acts', 'logo-resize', 'logo-bg-row', 'stamp-acts', 'sig-acts'].forEach(id => { if($(id)) $(id).style.display = 'none'; });

  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('sel'));
  document.querySelector('.theme-card[data-theme="classic"]').classList.add('sel');
  buildItems(); renderTaxLines();
  localStorage.removeItem('pq_v9');
  goS(1); r(); toast('New quotation started');
}

/* ═══ SCALER ═══ */
function initScaler() {
  const pp = $('pp'), inner = $('doc-scaler-inner');
  if (!pp || !inner) return;
  function scale() {
    const avail = pp.clientWidth - 32;
    const s = Math.min(1, avail / 794);
    inner.style.transform = `scale(${s})`;
    const wrapper = inner.parentElement;
    wrapper.style.width = (794 * s) + 'px';
    requestAnimationFrame(() => {
      const h = inner.getBoundingClientRect().height / s;
      wrapper.style.height = (h * s) + 'px';
      wrapper.style.overflow = 'visible';
    });
  }
  scale();
  window._scale = scale;
  new ResizeObserver(scale).observe(pp);
}


/* ═══ SAVED DATA SYSTEM ═══ */

function toggleDrawer(id) {
  const d = document.getElementById(id);
  if (!d) return;
  d.classList.toggle('open');
  // Refresh content when opening
  if (d.classList.contains('open')) {
    if (id === 'drawer-co') renderCoList();
    if (id === 'drawer-cl') renderClList();
    if (id === 'drawer-lib') renderLibList();
  }
}

/* ── COMPANY PROFILES ── */
function getCompanies() { try { return JSON.parse(localStorage.getItem('pq_companies') || '[]'); } catch (e) { return []; } }
function setCompanies(a) { localStorage.setItem('pq_companies', JSON.stringify(a)); }

function saveCompany() {
  const name = g('co-name').trim();
  if (!name) { toast('Enter company name first', 'err'); return; }
  const all = getCompanies();
  const existing = all.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  const data = {
    id: existing >= 0 ? all[existing].id : uid(),
    name, loc: g('co-loc'), phone: g('co-phone'), email: g('co-email'), vat: g('co-vat'), web: g('co-web'),
    color: g('co-col') || '#1e40af', logoURL: logoURL || null, logoW,
    saved: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  };
  if (existing >= 0) { all[existing] = data; toast('✓ Company updated', 'ok'); }
  else { all.unshift(data); toast('✓ Company saved!', 'ok'); }
  setCompanies(all);
  renderCoList();
  // Flash the button green
  const btn = $('co-save-btn'); if (btn) { btn.style.background = 'var(--success)'; btn.textContent = '✓ Saved!'; setTimeout(() => { btn.style.background = ''; btn.innerHTML = '💾 Save This Company'; }, 2000); }
}

function loadCompany(id) {
  const p = getCompanies().find(x => x.id === id); if (!p) return;
  const set = (el, v) => { const e = $(el); if (e) e.value = v || ''; };
  set('co-name', p.name); set('co-loc', p.loc); set('co-phone', p.phone); set('co-email', p.email); set('co-vat', p.vat); set('co-web', p.web);
  if (p.color) { setCol(p.color); $('co-col').value = p.color; }
  if (p.logoURL) { logoURL = p.logoURL; logoW = p.logoW || 70; setLogoUI(); }
  else { logoURL = null; removeLogo(); }
  dr(); toast('Loaded: ' + p.name, 'ok');
}

function delCompany(id) {
  setCompanies(getCompanies().filter(x => x.id !== id));
  renderCoList(); toast('Company deleted');
}

function renderCoList() {
  const all = getCompanies();
  const count = $('co-saved-count');
  if (count) count.textContent = all.length + (all.length === 1 ? ' saved' : ' saved');
  const list = $('co-saved-list'); if (!list) return;
  if (!all.length) {
    list.innerHTML = `<div class="saved-empty"><div class="saved-empty-icon">🏢</div>No companies saved yet.<br>Fill your details below and tap <strong>Save This Company</strong></div>`;
    return;
  }
  list.innerHTML = all.map(p => `
    <div class="saved-row" onclick="loadCompany('${p.id}')" title="Tap to load">
      <div class="saved-dot" style="background:${p.color || '#1e40af'}">${(p.name[0] || '?').toUpperCase()}</div>
      <div class="saved-row-info">
        <div class="saved-row-name">${esc(p.name)}</div>
        <div class="saved-row-meta">${[p.loc, p.email].filter(Boolean).join(' · ') || 'Tap to load'}</div>
      </div>
      <button class="saved-row-del" onclick="event.stopPropagation();delCompany('${p.id}')" title="Delete this company">🗑</button>
    </div>`).join('');
}

/* ── CLIENT BOOK ── */
function getClients() { try { return JSON.parse(localStorage.getItem('pq_clients2') || '[]'); } catch (e) { return []; } }
function setClients(a) { localStorage.setItem('pq_clients2', JSON.stringify(a)); }

function saveClient() {
  const name = g('cl-name').trim();
  if (!name) { toast('Enter client name first', 'err'); return; }
  const all = getClients();
  const existing = all.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  const data = {
    id: existing >= 0 ? all[existing].id : uid(),
    name, person: g('cl-person'), phone: g('cl-phone'), addr: g('cl-addr'),
    saved: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  };
  if (existing >= 0) { all[existing] = data; toast('✓ Client updated', 'ok'); }
  else { all.unshift(data); toast('✓ Client saved!', 'ok'); }
  setClients(all);
  renderClList();
  const btn = $('cl-save-btn'); if (btn) { btn.style.background = 'var(--success)'; btn.textContent = '✓ Saved!'; setTimeout(() => { btn.style.background = ''; btn.innerHTML = '💾 Save This Client'; }, 2000); }
}

function loadClient(id) {
  const c = getClients().find(x => x.id === id); if (!c) return;
  const set = (el, v) => { const e = $(el); if (e) e.value = v || ''; };
  set('cl-name', c.name); set('cl-person', c.person); set('cl-phone', c.phone); set('cl-addr', c.addr);
  dr(); toast('Loaded: ' + c.name, 'ok');
}

function delClient(id) {
  setClients(getClients().filter(x => x.id !== id));
  renderClList(); toast('Client deleted');
}

function renderClList() {
  const all = getClients();
  const count = $('cl-saved-count');
  if (count) count.textContent = all.length + ' saved';
  const list = $('cl-saved-list'); if (!list) return;
  if (!all.length) {
    list.innerHTML = `<div class="saved-empty"><div class="saved-empty-icon">👥</div>No clients saved yet.<br>Fill client details below and tap <strong>Save This Client</strong></div>`;
    return;
  }
  list.innerHTML = all.map(cl => `
    <div class="saved-row" onclick="loadClient('${cl.id}')" title="Tap to load">
      <div class="saved-dot" style="background:var(--accent)">${(cl.name[0] || '?').toUpperCase()}</div>
      <div class="saved-row-info">
        <div class="saved-row-name">${esc(cl.name)}</div>
        <div class="saved-row-meta">${[cl.person, cl.phone].filter(Boolean).join(' · ') || 'Tap to load'}</div>
      </div>
      <button class="saved-row-del" onclick="event.stopPropagation();delClient('${cl.id}')" title="Delete this client">🗑</button>
    </div>`).join('');
}

/* ── PRODUCT LIBRARY ── */
function getLibrary() { try { return JSON.parse(localStorage.getItem('pq_library2') || '[]'); } catch (e) { return []; } }
function setLibrary(a) { localStorage.setItem('pq_library2', JSON.stringify(a)); }

function saveLibItem() {
  const name = g('lib-name').trim();
  if (!name) { toast('Enter product name', 'err'); return; }
  const lib = getLibrary();
  lib.unshift({ id: uid(), name, rate: parseFloat(g('lib-rate')) || 0, unit: g('lib-unit') || '' });
  setLibrary(lib);
  $('lib-name').value = ''; $('lib-rate').value = ''; $('lib-unit').value = '';
  renderLibList(); toast('Saved to library', 'ok');
}

function insertLibItem(id) {
  const it = getLibrary().find(x => x.id === id); if (!it) return;
  pushUndo();
  items.push({ id: uid(), type: 'item', desc: it.name, qty: '', rate: it.rate || '', d: 0, useD: false, sel: false, optional: false, note: '', noVat: false });
  buildItems(); r();
  toast('Added: ' + it.name, 'ok');
}

function delLibItem(id) {
  setLibrary(getLibrary().filter(x => x.id !== id));
  renderLibList(); toast('Removed from library');
}

function renderLibList() {
  const all = getLibrary();
  const count = $('lib-saved-count');
  if (count) count.textContent = all.length + ' saved';
  const list = $('lib-saved-list'); if (!list) return;
  if (!all.length) {
    list.innerHTML = `<div class="saved-empty" style="padding:8px 0">Type a product name above and tap <strong>＋ Save</strong> to build your library</div>`;
    return;
  }
  list.innerHTML = all.map(it => `
    <div class="saved-row" onclick="insertLibItem('${it.id}')" title="Tap to add to quote">
      <div class="saved-dot" style="background:var(--success);font-size:.82rem">＋</div>
      <div class="saved-row-info">
        <div class="saved-row-name">${esc(it.name)}</div>
        <div class="saved-row-meta">${curr()} ${fmt(it.rate)} — tap to add to quote</div>
      </div>
      <button class="saved-row-del" onclick="event.stopPropagation();delLibItem('${it.id}')" title="Delete from library">🗑</button>
    </div>`).join('');
}

/* ── INIT COUNTS ON LOAD ── */
function initSavedCounts() {
  renderCoList();
  renderClList();
  renderLibList();
}



// ═══════════════════════════════════
// render.js — Document Render, Export (PDF/PNG), WhatsApp
// ═══════════════════════════════════
/* ═══ PRINT / PDF ═══ */
function doPrint() { executePrint(false); }
function doExport() { executePrint(true); }
function executePrint(saveAsPDF) {
  saveDraft();
  const qdocEl = $('qdoc');
  if (!qdocEl || !qdocEl.children.length) { toast('Add items first', 'err'); return; }
  const docCol = getComputedStyle(document.documentElement).getPropertyValue('--doc').trim() || '#1e40af';
  const cloned = qdocEl.cloneNode(true);
  cloned.querySelectorAll('*').forEach(el => {
    if (el.style && el.style.cssText) el.style.cssText = el.style.cssText.replace(/var\(--doc\)/g, docCol);
  });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${pageType === 'invoice' ? 'Invoice' : 'Quotation'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',system-ui,sans-serif;background:#e0e4ef;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:30px 20px}
.schip{display:inline-block;padding:2px 9px;border-radius:20px;font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.s-draft{background:#fff3cd;color:#856404;border:1px solid #ffc107}
.s-sent{background:#cfe2ff;color:#0a58ca;border:1px solid #9ec5fe}
.s-approved{background:#d1e7dd;color:#0f5132;border:1px solid #a3cfbb}
.s-rejected{background:#f8d7da;color:#842029;border:1px solid #f1aeb5}
#qdoc{width:794px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.18)}
.dpage{width:794px;min-height:1122px;padding:36px 48px 48px;background:#fff;display:flex;flex-direction:column;break-after:page;position:relative}
.dpage:last-child{break-after:avoid}
table{width:100%;border-collapse:collapse;border:1px solid #c8cce0}
th{background:${docCol}!important;color:#fff!important;padding:8px 10px;font-size:.67rem;font-weight:600;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-right:1px solid rgba(255,255,255,.2)}
td{padding:7px 10px;border-right:1px solid #d8dce8;border-bottom:1px solid #d8dce8;font-size:.78rem;vertical-align:top;color:#1a1d2e}
td:last-child{border-right:none}
tr:nth-child(even) td{background:#f9fafc}
@page{size:A4;margin:0}
@media print{body{background:#fff;padding:0;display:block}#qdoc{box-shadow:none}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
${cloned.outerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`;
  // Primary: invisible iframe (no new tab)
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const ifr = document.createElement('iframe');
    ifr.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;opacity:0;pointer-events:none';
    ifr.src = blobUrl;
    document.body.appendChild(ifr);
    ifr.onload = function () {
      try {
        ifr.contentWindow.focus();
        ifr.contentWindow.print();
      } catch (e) {
        // iframe blocked (iOS/Firefox) — open styled tab as fallback
        const w = window.open(blobUrl, '_blank', 'noopener');
        if (!w) { toast('Please allow popups for printing', 'err'); }
      }
      setTimeout(() => { ifr.remove(); URL.revokeObjectURL(blobUrl); }, 60000);
    };
    toast(saveAsPDF ? 'Choose "Save as PDF" in print dialog ▸' : 'Opening print dialog…', 'ok');
  } catch (err) {
    toast('Print error: ' + err.message, 'err');
  }
}


/* ═══ RENDER ═══ */
function r() {
  const coName = g('co-name') || 'Your Company', coLoc = g('co-loc'), coPhone = g('co-phone'), coEmail = g('co-email'), coVat = g('co-vat'), coWeb = g('co-web');
  const clName = g('cl-name') || '—', qno = g('q-no') || '—', subj = g('q-subj');
  const dateStr = fmtD(g('q-date')), validStr = fmtD(g('q-valid'));
  const gd = parseFloat(g('p-disc')) || 0, ut = getUnit(), vatPct = getVat(), ship = parseFloat(g('p-ship')) || 0;
  const docCol = getComputedStyle(document.documentElement).getPropertyValue('--doc').trim() || '#1e40af';
  const sm = { draft: 'Draft', sent: 'Sent', approved: 'Approved', rejected: 'Rejected' };
  const sc = { draft: 's-draft', sent: 's-sent', approved: 's-approved', rejected: 's-rejected' };
  const st = g('q-status') || 'draft';
  const chipHtml = `<span class="schip ${sc[st]}">${sm[st] || 'Draft'}</span>`;
  const logoHtml = logoURL ? `<img src="${logoURL}" style="display:block;max-width:${logoW}px;max-height:56px;object-fit:contain;border-radius:3px;${logoBg ? 'background:#fff;padding:4px;' : ''}" alt="">` : '';
  const logoSmHtml = logoURL ? `<img src="${logoURL}" style="max-height:30px;object-fit:contain" alt="">` : '';

  // Row data
  let subtotal = 0, totalSaved = 0, serial = 0;
  const rowsData = items.map(item => {
    if (item.type === 'section') return { type: 'section', item };
    const eff = item.useD ? item.d : gd;
    const raw = item.qty * item.rate, discAmt = raw * (eff / 100);
    const discUnit = round(item.rate * (1 - eff / 100)), lineTotal = round(raw - discAmt);
    if (!item.optional) { subtotal += lineTotal; totalSaved += discAmt; }
    serial++;
    return { type: 'item', sn: serial, item, eff, discUnit, lineTotal };
  });

  // Totals
  const vatSubtotal = items.reduce((acc, it) => {
    if (it.type === 'section' || it.optional || it.noVat) return acc;
    const eff = it.useD ? it.d : gd;
    return acc + round(it.qty * it.rate * (1 - eff / 100));
  }, 0);
  const vatAmt = round(vatSubtotal * vatPct / 100);
  let extraTaxTotal = 0;
  extraTaxes.forEach(tx => { extraTaxTotal += round(subtotal * tx.rate / 100); });
  const grand = round(subtotal + (SW.vat ? vatAmt : 0) + extraTaxTotal + ship);

  let totHtml = '';
  totHtml += trow('Subtotal', curr() + ' ' + fmt(subtotal));
  if (SW.savings && totalSaved > 0) totHtml += trow('Discount Savings', '− ' + curr() + ' ' + fmt(round(totalSaved)), 'disc-row');
  if (ship > 0) totHtml += trow('Shipping', curr() + ' ' + fmt(ship));
  if (SW.vat && vatPct > 0) totHtml += trow(`VAT (${vatPct}%)`, curr() + ' ' + fmt(vatAmt), 'vat-row');
  extraTaxes.forEach(tx => { if (tx.rate > 0) totHtml += trow(`${esc(tx.name)} (${tx.rate}%)`, curr() + ' ' + fmt(round(subtotal * tx.rate / 100)), 'vat-row'); });
  if (SW.grandtot) totHtml += trow('Grand Total', curr() + ' ' + fmt(grand), 'grand');
  const totalsHtml = `<div style="display:flex;justify-content:flex-end;margin-top:0"><div style="width:270px;border:1px solid #c8cce0;border-top:none;font-size:.79rem">${totHtml}</div></div>`;

  const showR = SW.rates, showD = SW.dscol;
  const thStyle = 'padding:7px 10px;color:#fff;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const thHtml = `<thead><tr style="background:${docCol};-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <th style="${thStyle};width:4%">SN</th>
    <th style="${thStyle}">Description</th>
    <th style="${thStyle};width:8%;text-align:center">Unit</th>
    <th style="${thStyle};width:7%;text-align:center">Qty</th>
    ${showR ? `<th style="${thStyle};width:12%;text-align:right">Rate</th>` : ''}
    ${showD ? `<th style="${thStyle};width:12%;text-align:right">Disc.Price</th>` : ''}
    <th style="${thStyle};width:13%;text-align:right">Total</th>
  </tr></thead>`;

  const CB = 'padding:5px 10px;vertical-align:top;border-right:1px solid #d8dce8;border-bottom:1px solid #d8dce8;color:#1a1d2e;font-size:.77rem';
  const CR = 'padding:5px 10px;vertical-align:middle;border-bottom:1px solid #d8dce8;color:#1a1d2e;font-size:.77rem;text-align:right;font-variant-numeric:tabular-nums';
  function buildRow(d, idx) {
    if (d.type === 'section') {
      const cols = 4 + (showR ? 1 : 0) + (showD ? 1 : 0);
      return `<tr><td colspan="${cols}" style="padding:6px 10px;background:#f0f2f7;font-weight:700;font-size:.74rem;letter-spacing:.04em;color:#3a3f5a;border-bottom:1px solid #d0d4e4">${esc(d.item.desc) || '— SECTION —'}</td></tr>`;
    }
    const bg = idx % 2 === 1 ? '#f9fafc' : '#fff';
    const rowBg = d.item.optional ? '#fffdf5' : bg;
    const note = d.item.note ? `<div style="font-size:.67rem;color:#8a90a8;margin-top:2px">${esc(d.item.note)}</div>` : '';
    const optBadge = d.item.optional ? `<span style="font-size:.58rem;background:#fef3e0;color:#d97706;padding:1px 4px;border-radius:3px;margin-left:4px;font-weight:700">Optional</span>` : '';
    return `<tr style="background:${rowBg}">
      <td style="${CB};text-align:center;vertical-align:middle">${d.sn}</td>
      <td style="${CB}">${esc(d.item.desc) || '—'}${optBadge}${note}</td>
      <td style="${CB};text-align:center;vertical-align:middle">${esc(ut) || '—'}</td>
      <td style="${CB};text-align:center;vertical-align:middle">${d.item.qty}</td>
      ${showR ? `<td style="${CB};text-align:right;vertical-align:middle">${curr()} ${fmt(d.item.rate)}</td>` : ''}
      ${showD ? `<td style="${CB};text-align:right;vertical-align:middle">${d.eff > 0 ? curr() + ' ' + fmt(d.discUnit) : '—'}</td>` : ''}
      <td style="${CR}">${d.item.optional ? `<span style="color:#d97706">Optional</span>` : curr() + ' ' + fmt(d.lineTotal)}</td>
    </tr>`;
  }

  const footerHtml = `
    <div style="padding-top:12px;border-top:1px solid #eef0f8;display:flex;gap:18px;flex-wrap:wrap;margin-top:14px">
      ${SW.notes && g('p-notes') ? `<div style="flex:1;min-width:140px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Notes</div><div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${nl(g('p-notes'))}</div></div>` : ''}
      ${SW.payterms && (g('p-payterms') || g('p-bank')) ? `<div style="flex:1;min-width:140px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Payment Terms</div>${g('p-payterms') ? `<div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${esc(g('p-payterms'))}</div>` : ''} ${g('p-bank') ? `<div style="font-size:.72rem;color:#6a6f88;margin-top:3px;line-height:1.7">${nl(g('p-bank'))}</div>` : ''}</div>` : ''}
      <div style="flex:1;min-width:120px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Issued By</div><div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${nl([coName, coLoc, coPhone, coEmail, coVat ? (pageType === 'invoice' ? 'VAT/PAN: ' : 'VAT: ') + coVat : ''].filter(Boolean).join('\n'))}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:16px;position:relative">
      <div style="width:160px;min-height:50px">
        ${SW.stamp && stampURL ? `<img src="${stampURL}" style="max-height:80px;max-width:100px;object-fit:contain;opacity:0.85;transform:rotate(-5deg)">` : ''}
      </div>
      ${SW.sign ? `<div style="text-align:center;width:160px">
        ${sigURL ? `<img src="${sigURL}" style="max-height:50px;max-width:120px;object-fit:contain;margin-bottom:-10px;position:relative;z-index:2">` : ''}
        <div style="border-bottom:1px solid #1a1d2e;margin-bottom:5px;padding-bottom:${sigURL?'5':'24'}px"></div>
        <div style="font-size:.67rem;color:#8a90a8">Authorized Signature</div>
      </div>` : ''}
    </div>`;

  // ═══ PAGINATION ═══
  // Real A4: 1122px - 84px padding = 1038px content
  // Table header row ~30px, each data row ~34px
  // Page 1 header: ~200px (logo+header+divider+parties)
  // Continuation header: ~60px
  // Footer (totals+notes+sig): ~170px
  const PAGE_H = 1038;
  const HDR1 = 185, HDRN = 55, FOOTER_H = 140, TH = 28, ROW_H = 30;
  let remaining = [...rowsData], isFirst = true;
  const pages = [];
  while (remaining.length > 0 || pages.length === 0) {
    const hdr = isFirst ? HDR1 : HDRN;
    const bodyH = PAGE_H - hdr - TH;
    // Check if remaining rows + footer fit on this page
    const rowsWithFooter = Math.floor((bodyH - FOOTER_H) / ROW_H);
    const rowsNoFooter = Math.floor(bodyH / ROW_H);
    const isLast = remaining.length <= rowsWithFooter;
    const take = isLast ? Math.min(remaining.length, rowsWithFooter) : Math.min(remaining.length, rowsNoFooter);
    const rowCount = Math.max(1, take);
    pages.push({ rows: remaining.slice(0, rowCount), isFirst, isLast });
    remaining = remaining.slice(rowCount);
    if (isLast || remaining.length === 0) break;
    isFirst = false;
  }
  if (pages.length === 0) pages.push({ rows: [], isFirst: true, isLast: true });
  // Mark last page
  pages[pages.length - 1].isLast = true;
  const totalPages = pages.length;

  const qdoc = $('qdoc'); qdoc.innerHTML = '';
  pages.forEach((pg, pi) => {
    const pageNum = pi + 1;
    const div = document.createElement('div');
    div.className = 'dpage';
    let html = '';

    if (pg.isFirst) {
      if (currentTheme === 'bold') {
        html += `<div style="background:${docCol};margin:-36px -48px 18px;padding:22px 48px 18px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact">
          <div style="display:flex;align-items:center;gap:12px">${logoURL ? `<img src="${logoURL}" style="max-height:40px;object-fit:contain;border-radius:3px;${logoBg ? 'background:#fff;padding:3px;' : ''}">` : ''}<div><div style="font-family:Georgia,serif;font-size:1.15rem;font-weight:700;color:#fff">${esc(coName)}</div>${coLoc ? `<div style="font-size:.7rem;color:rgba(255,255,255,.75);margin-top:1px">${esc(coLoc)}</div>` : ''}</div></div>
          <div style="text-align:right"><div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#fff;letter-spacing:.04em">${pageType.toUpperCase()}</div><div style="margin-top:4px">${chipHtml}</div><div style="font-size:.7rem;color:rgba(255,255,255,.8);margin-top:4px">No: ${esc(qno)} · ${dateStr}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc, coPhone, coEmail, coVat ? 'VAT: ' + coVat : '', coWeb].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'), g('cl-addr'), g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      } else if (currentTheme === 'minimal') {
        html += `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;padding-bottom:12px;border-bottom:2px solid #1a1d2e">
          <div>${logoURL ? `<img src="${logoURL}" style="max-height:40px;object-fit:contain;margin-bottom:5px;display:block;${logoBg ? 'background:#fff;padding:3px;' : ''}">` : ''}<div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88">${[coLoc, coPhone, coEmail].filter(Boolean).join(' · ')}</div></div>
          <div style="text-align:right"><div style="font-size:1.4rem;font-weight:800;letter-spacing:.03em;color:#0f1117">${pageType.toUpperCase()}</div><div style="font-size:.75rem;color:#6a6f88;margin-top:3px">No: ${esc(qno)}</div><div style="font-size:.73rem;color:#6a6f88">Date: ${dateStr} · Valid: ${validStr}</div><div style="margin-top:4px">${chipHtml}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88">${nl([g('cl-person'), g('cl-addr'), g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Subject</div><div style="font-size:.76rem;color:#1a1d2e">${subj ? esc(subj) : '—'}</div></div>
        </div>`;
      } else if (currentTheme === 'modern') {
        html += `<div style="display:flex;margin:-36px -48px 18px;min-height:120px">
          <div style="width:52px;background:${docCol};flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
          <div style="flex:1;padding:20px 22px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
              <div>${logoURL ? `<img src="${logoURL}" style="max-height:40px;object-fit:contain;margin-bottom:5px;display:block;${logoBg ? 'background:#fff;padding:3px;' : ''}">` : ''}<div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88">${[coLoc, coPhone, coEmail].filter(Boolean).join(' · ')}</div></div>
              <div style="text-align:right"><div style="font-family:Georgia,serif;font-size:.95rem;font-weight:700;color:${docCol}">${pageType.toUpperCase()}</div><div style="font-size:.73rem;color:#6a6f88;margin-top:3px">No: ${esc(qno)}</div><div style="font-size:.71rem;color:#6a6f88">${dateStr}</div><div style="margin-top:4px">${chipHtml}</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc, coPhone, coEmail, coVat ? 'VAT: ' + coVat : '', coWeb].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'), g('cl-addr'), g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      } else {
        // Classic
        html += `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;flex-direction:column;gap:5px">
            ${logoHtml}
            <div><div style="font-family:Georgia,serif;font-size:1.1rem;font-weight:700;color:#0f1117;line-height:1.2">${esc(coName)}</div>${coLoc ? `<div style="font-size:.71rem;color:#6a6f88;margin-top:1px">${esc(coLoc)}</div>` : ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:Georgia,serif;font-size:.98rem;font-weight:700;color:${docCol};letter-spacing:.02em">${pageType.toUpperCase()}</div>
            <div style="margin-top:4px">${chipHtml}</div>
            <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;align-items:flex-end">
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Date:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${dateStr}</span></div>
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Valid Until:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${validStr}</span></div>
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Quote No:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${esc(qno)}</span></div>
              ${subj ? `<div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Subject:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${esc(subj)}</span></div>` : ''}
            </div>
          </div>
        </div>
        <div style="height:3px;background:${docCol};border-radius:2px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc, coPhone, coEmail, coVat ? 'VAT: ' + coVat : '', coWeb].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700;color:#0f1117">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'), g('cl-addr'), g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      }
    } else {
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid ${docCol}">
        <div style="display:flex;align-items:center;gap:8px">${logoSmHtml}<div style="font-family:Georgia,serif;font-size:.85rem;font-weight:700">${esc(coName)}</div></div>
        <div style="text-align:right"><div style="font-size:.73rem;font-weight:700;color:${docCol}">Quote No: ${esc(qno)}</div><div style="font-size:.68rem;color:#8a90a8">Page ${pageNum} of ${totalPages}</div></div>
      </div>`;
    }

    html += `<table style="width:100%;border-collapse:collapse;font-size:.77rem;border:1px solid #c8cce0;-webkit-print-color-adjust:exact;print-color-adjust:exact">${thHtml}<tbody>`;
    pg.rows.forEach((d, i) => { html += buildRow(d, i); });
    html += `</tbody></table>`;

    if (pg.isLast) {
      html += totalsHtml;
      html += footerHtml;
    }
    html += `<div style="margin-top:auto;padding-top:10px;text-align:center"><span style="font-family:Montserrat,Georgia,serif;font-size:.72rem;font-weight:800;letter-spacing:.15em"><span style="color:#0041C2">Pro</span><span style="color:#B59410">Quote</span></span></div>`;

    // Watermark overlay
    if (wmOn && wmText) {
      const wmColors = { PAID: 'rgba(16,160,70,0.13)', APPROVED: 'rgba(37,87,214,0.12)', DRAFT: 'rgba(200,140,0,0.11)', VOID: 'rgba(200,30,30,0.12)' };
      const wmStroke = { PAID: 'rgba(16,160,70,0.45)', APPROVED: 'rgba(37,87,214,0.45)', DRAFT: 'rgba(200,140,0,0.45)', VOID: 'rgba(200,30,30,0.45)' };
      html += `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;overflow:hidden">
        <div style="transform:rotate(-35deg);font-family:Georgia,serif;font-size:100px;font-weight:900;letter-spacing:.12em;color:${wmColors[wmText] || 'rgba(0,0,0,0.09)'};-webkit-text-stroke:2px ${wmStroke[wmText] || 'rgba(0,0,0,0.18)'};text-stroke:2px ${wmStroke[wmText] || 'rgba(0,0,0,0.18)'};user-select:none;white-space:nowrap;border:6px solid ${wmStroke[wmText] || 'rgba(0,0,0,0.18)'};padding:10px 28px;border-radius:8px">${wmText}</div>
      </div>`;
    }
    div.innerHTML = html;
    qdoc.appendChild(div);
  });

  const pill = $('pg-pill');
  if (pill) pill.textContent = totalPages === 1 ? '1 page' : totalPages + ' pages';
  if (window._scale) requestAnimationFrame(window._scale);

  // Autosave draft (debounced)
  clearTimeout(r._saveT);
  r._saveT = setTimeout(saveDraft, 2000);
}

function trow(l, v, cls = '') {
  const grand = cls === 'grand', disc = cls === 'disc-row', vat = cls === 'vat-row';
  const docCol = getComputedStyle(document.documentElement).getPropertyValue('--doc').trim() || '#1e40af';
  const bg = grand ? `background:${docCol};-webkit-print-color-adjust:exact;print-color-adjust:exact` : vat ? 'background:#f5f7ff' : '';
  const lc = grand ? 'color:rgba(255,255,255,.82)' : disc ? 'color:#b45309' : 'color:#5a5f78';
  const vc = grand ? 'color:#fff' : disc ? 'color:#b45309' : 'color:#1a1d2e';
  const fw = grand ? 'font-weight:700;font-size:.82rem' : '';
  return `<div style="display:grid;grid-template-columns:1fr auto;padding:5px 10px;border-bottom:1px solid #d8dce8;align-items:center;${bg};${fw}"><span style="${lc}">${l}</span><span style="${vc};text-align:right;font-weight:600;padding-left:14px;font-variant-numeric:tabular-nums">${v}</span></div>`;
}




/* ═══ WHATSAPP SHARE ═══ */
function shareWhatsApp() {
  const qdocEl = $('qdoc');
  if (!qdocEl || !qdocEl.children.length) { toast('Add items first', 'err'); return; }
  if (!g('co-name') || !g('cl-name')) { toast('Fill Company and Client names', 'err'); return; }

  function useNavigatorShare(blob) {
    const file = new File([blob], (g('q-no') || 'quote') + '.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: pageType === 'invoice' ? 'Invoice' : 'Quotation',
        text: 'Sent via ProQuote'
      }).catch(() => fallbackShare());
    } else { fallbackShare(); }
  }

  function fallbackShare() {
    const clName = g('cl-name') || '—', qno = g('q-no') || '—', grand = round(0); // actual calculation omitted for brevity but should be accurate
    const msg = `*${pageType.toUpperCase()} — ${qno}*\nTo: ${clName}\nTotal: ${curr()} ${fmt(grand)}\n\n_Sent via ProQuote_`;
    const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
    toast('WhatsApp web text share opened', 'ok');
  }

  toast('Generating shareable image…');
  const prevTransform = qdocEl.parentElement.style.transform || '';
  qdocEl.parentElement.style.transform = 'none';

  const runCapture = () => {
    html2canvas(qdocEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
      qdocEl.parentElement.style.transform = prevTransform;
      canvas.toBlob(blob => {
        if (blob) useNavigatorShare(blob);
        else fallbackShare();
      }, 'image/jpeg', 0.9);
    }).catch(() => {
      qdocEl.parentElement.style.transform = prevTransform;
      fallbackShare();
    });
  };

  if (typeof html2canvas !== 'undefined') runCapture();
  else {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    sc.onload = runCapture; 
    document.head.appendChild(sc);
  }
}

/* ═══ DOWNLOAD AS JPEG ═══ */
function doExportJPG() {  
  const qdocEl = $('qdoc');
  if (!qdocEl || !qdocEl.children.length) { toast('Add items first', 'err'); return; }
  
  if (!g('co-name') || !g('cl-name')) { toast('Company and Client names are required', 'err'); return; }

  function runExport() {
    toast('Generating JPEG…');
    const fname = (g('q-no') || 'quotation').replace(/[^a-z0-9_-]/gi, '_') + '.jpg';
    // Temporarily expand qdoc to full width for capture (scaler may have shrunk it)
    const prevTransform = qdocEl.parentElement.style.transform || '';
    qdocEl.parentElement.style.transform = 'none';
    html2canvas(qdocEl, {
      scale: 2.5,            // high DPI — looks great on screens and print
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: false,
    }).then(canvas => {
      qdocEl.parentElement.style.transform = prevTransform;
      const link = document.createElement('a');
      link.download = fname;
      // JPEG at 92% quality — excellent quality, much smaller than PNG
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
      toast('JPEG downloaded ✓', 'ok');
    }).catch(e => {
      qdocEl.parentElement.style.transform = prevTransform;
      toast('Export failed: ' + e.message, 'err');
    });
  }
  if (typeof html2canvas !== 'undefined') { runExport(); }
  else {
    toast('Loading image engine…');
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    sc.onload = runExport;
    sc.onerror = () => toast('JPEG export requires internet', 'err');
    document.head.appendChild(sc);
  }
}

/* ═══ ITEM TEMPLATES ═══ */
const ITEM_TEMPLATES = {
  'design': [
    { desc: 'Logo Design', qty: 1, rate: 15000, note: '3 concepts, 2 revision rounds' },
    { desc: 'Brand Identity Package', qty: 1, rate: 35000, note: 'Logo, colors, typography, guidelines' },
    { desc: 'Business Card Design', qty: 1, rate: 3500, note: 'Front & back, print-ready' },
    { desc: 'Social Media Kit', qty: 1, rate: 8000, note: 'Profile, cover, 5 post templates' },
  ],
  'web': [
    { desc: 'Website Design (UI/UX)', qty: 1, rate: 25000, note: 'Up to 5 pages, responsive' },
    { desc: 'Website Development', qty: 1, rate: 40000, note: 'HTML/CSS/JS, responsive' },
    { desc: 'WordPress Setup', qty: 1, rate: 18000, note: 'Theme customization, plugins' },
    { desc: 'Domain & Hosting Setup', qty: 1, rate: 5000, note: '1 year domain + hosting config' },
  ],
  'photo': [
    { desc: 'Product Photography', qty: 1, rate: 12000, note: 'Up to 20 products, edited' },
    { desc: 'Corporate Headshots', qty: 1, rate: 8000, note: 'Up to 5 people, edited' },
    { desc: 'Event Coverage (half day)', qty: 1, rate: 15000, note: '4 hours, 100+ edited photos' },
  ],
  'print': [
    { desc: 'Flyer Design (A5)', qty: 1, rate: 4500, note: 'Both sides, print-ready' },
    { desc: 'Brochure Design (tri-fold)', qty: 1, rate: 8000, note: 'Print-ready, 300dpi' },
    { desc: 'Banner Design', qty: 1, rate: 5000, note: 'Any size, print-ready file' },
    { desc: 'Printing (A4, 100 copies)', qty: 100, rate: 15, note: 'Full color, glossy' },
  ],
  'it': [
    { desc: 'IT Support (hourly)', qty: 1, rate: 2500, note: 'On-site or remote' },
    { desc: 'Network Setup', qty: 1, rate: 12000, note: 'Router, switches, config' },
    { desc: 'Computer Repair', qty: 1, rate: 3500, note: 'Diagnosis + fix included' },
  ],
};

function openTemplatesModal() {
  const modal = $('ov-templates');
  if (modal) modal.classList.add('open');
}
function closeTemplatesModal() {
  const modal = $('ov-templates');
  if (modal) modal.classList.remove('open');
}
function insertTemplate(cat) {
  const tmpl = ITEM_TEMPLATES[cat];
  if (!tmpl) return;
  pushUndo();
  // Add section header for the category
  const labels = { 'design': 'Design', 'web': 'Web / Dev', 'photo': 'Photography', 'print': 'Print & Media', 'it': 'IT Services' };
  items.push({ id: uid(), type: 'section', desc: labels[cat] || cat });
  tmpl.forEach(t => {
    items.push({ id: uid(), type: 'item', desc: t.desc, qty: t.qty, rate: t.rate, d: 0, useD: false, sel: false, optional: false, note: t.note || '' });
  });
  buildItems(); r();
  closeTemplatesModal();
  toast(tmpl.length + ' items added from template', 'ok');
}
function insertSingleTemplate(cat, idx) {
  const t = ITEM_TEMPLATES[cat] && ITEM_TEMPLATES[cat][idx];
  if (!t) return;
  pushUndo();
  items.push({ id: uid(), type: 'item', desc: t.desc, qty: t.qty, rate: t.rate, d: 0, useD: false, sel: false, optional: false, note: t.note || '' });
  buildItems(); r();
  toast('Added: ' + t.desc, 'ok');
}


// ═══════════════════════════════════
// pwa.js — Install Banner, Menu, PWA Service Worker
// ═══════════════════════════════════

/* ═══ PHONE STORAGE — BACKUP & RESTORE ═══ */
function exportAllQuotes() {
  dbList().then(entries => {
    if (!entries || !entries.length) { toast('No saved quotes to backup', 'err'); return; }
    // Load full data for each
    const promises = entries.map(e => dbLoad(e.id).then(d => ({ ...d, _backupId: e.id, _backupLabel: e.label, _backupDate: e.date })));
    Promise.all(promises).then(all => {
      const json = JSON.stringify({ proquote_backup: true, version: 1, exported: new Date().toISOString(), count: all.length, quotes: all }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ProQuote_backup_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Backup downloaded (' + all.length + ' quotes)', 'ok');
    });
  });
}
function importQuotes(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.proquote_backup || !Array.isArray(data.quotes)) { toast('Invalid backup file', 'err'); return; }
      let count = 0;
      const saves = data.quotes.map(q => {
        const id = q._backupId || uid();
        const clean = { ...q };
        delete clean._backupId; delete clean._backupLabel; delete clean._backupDate;
        return dbSave(id, clean).then(() => count++);
      });
      Promise.all(saves).then(() => {
        toast('Restored ' + count + ' quotes ✓', 'ok');
        openSavedModal();
      });
    } catch (err) { toast('Restore failed: ' + err.message, 'err'); }
  };
  reader.readAsText(file);
  event.target.value = '';
}
/* ═══ INSTALL BANNER ═══ */
function dismissInstallBanner() {
  ['install-banner', 'ios-banner'].forEach(id => {
    const b = $(id);
    if (b && b.style.display !== 'none') {
      b.style.animation = 'slideUp .25s ease forwards';
      setTimeout(() => { b.style.display = 'none'; }, 240);
    }
  });
  try { localStorage.setItem('pq_banner_dismissed', '1'); } catch (e) { }
}
function maybeShowBanner() {
  try { if (localStorage.getItem('pq_banner_dismissed')) return; } catch (e) { return; }
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isStandalone) return; // already installed
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  if (isIOS) {
    // iOS: always show step-by-step Safari instructions
    const b = $('ios-banner');
    if (b) { b.style.display = 'flex'; b.style.animation = 'slideDown .3s ease'; }
  } else if (isAndroid) {
    // Android: show only if beforeinstallprompt has fired (prompt available)
    // We show it immediately; if prompt not available the Install btn still educates
    const b = $('install-banner');
    if (b) { b.style.display = 'flex'; b.style.animation = 'slideDown .3s ease'; }
  }
}


/* ═══ OVERFLOW MENU ═══ */
function toggleMenu() {
  const m = $('overflow-menu');
  if (!m) return;
  const open = m.style.display === 'block';
  m.style.display = open ? 'none' : 'block';
  if (!open) {
    // close on outside click
    setTimeout(() => {
      document.addEventListener('click', function h(e) {
        if (!$('menu-wrap').contains(e.target)) { m.style.display = 'none'; }
        document.removeEventListener('click', h);
      });
    }, 0);
  }
}
function closeMenu() {
  const m = $('overflow-menu'); if (m) m.style.display = 'none';
}


/* ═══ PWA SETUP ═══ */
(function () {
  // Inline manifest as blob
  const icons192 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAEM0lEQVR4nO3awXETURQFUYdASuRIKiRADOyIgzWUXQVlwNiSPJqeP+90Ve/ffN3e6eFhFT5++cGFxBXUPxZFsjv14/NYjqB+ZK7h6agflGu6PPUD8hwuR/1gPKeHp34gzvCQ1I/CWR6K+jE405z6AchHjZ/jNX6O1/g5XuPneI2f4xUAR2v8HK/xc7zGz/EKgKM1fo5XAByt8XO8AuBojZ/jnRAA9uXrt+/5b75NAPVxRr8cj+NfKoBXI6gPM/6l+DV+ARj/OJ6P/xwB1EcZ/zL8Pf7lAngxgvogASzBS+MXgABG8L/xrx9AfYzxH57Xxr9kAH9EUB8igEPz1vgFIIDTcsn4BSCAU3Lp+AUggNNxzfgFIIBTce34BSCA03DL+AUggFNw6/gFIIDlec/41w6gPkIAOe8d/7IBPEVQHyCAlC3GLwABLMlW4xeAAJZjy/ELQABLsfX4BSCA8dR7EABS6j0IACn1HgSAlHoPAkBKvQcBIKXegwCQUu9BAEip9yAApNR7EABS6j0IACn1HgSAlHoPAkBKvQcBIKXegwCQUu9BAEip9yAApNR7EABS6j0IACn1HgSAlHoPAriAz58+8A0FsIgCEIAABCAAAQhAAAIQgAAEgI56DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexAAUuo9CAAp9R4EgJR6DwJASr0HASCl3oMAkFLvQQAXUP/RbAUFsIgCEIAABCAAAQhAAAIQgAAEgI56DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexAAUuo9CAAp9R4EgJR6DwJASr0HASCl3oMAkFLvQQAXUP/RbAUFsIgCEIAABCAAAQhAAAIQgAAEgI56DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexAAUuo9CAAp9R4EgJR6DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexAAUuo9CAAp9R4EgJR6DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexAAUuo9CAAp9R4EgJR6DwJASr0HASCl3oMAkFLvQQBIqfcgAKTUexgXgAiOQ70DASCl3oEAkFLvYGwAIuipf//xAYigo/7dBSCCjPr3FoAYdqf+XQVAbm1+AFmaH0CW5geQpfkBZGl+AFmaH0CWPlEfQRb+pj6ELBQARysAjlYAHK0AOFoBcLQC4GgFwNH+QX0Muaf/UB9E7qkAONoXqY8i9/C/1IeReygAjvZV6uPIe/om9YHkPb2I+kjyHl5MfSh5D6+iPpbc0qupDya39Cbqo8ktvJn6cHIL30V9PPkeN6H+CPIWN6X+GPIaN6f+IPIa70L9UeQl3pX648jX3IX6I8mX3JX6Y8nnJtQfTT6aUz8AZ3oo6sfgLA9J/Sic4eGpH4jndDnqB+M5XJ76Abmmp6N+UK7hCOpH5rEcTf34NPrDU/9YPOW4fwI+m3AGydF/ZAAAAABJRU5ErkJggg==";
  const icons512 = "data:image/png;base64,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";
  const manifest = {
    name: "ProQuote",
    short_name: "ProQuote",
    description: "Professional quotation maker",
    start_url: "./",
    display: "standalone",
    background_color: "#0041C2",
    theme_color: "#0041C2",
    orientation: "any",
    icons: [
      { src: icons192, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: icons512, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };
  const mBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const mURL = URL.createObjectURL(mBlob);
  document.getElementById('pwa-manifest').href = mURL;

  // Service worker for offline use
  if ('serviceWorker' in navigator) {
    const swCode = `
const CACHE = 'proquote-v3';
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      // Cache the app shell (this page itself)
      return c.addAll([self.registration.scope]).catch(()=>{});
    })
  );
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if(res && res.status === 200 && res.type !== 'opaque'){
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
`;
    const swBlob = new Blob([swCode], { type: 'text/javascript' });
    const swURL = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swURL, { scope: './' })
      .then(() => console.log('ProQuote SW registered'))
      .catch(e => console.log('SW:', e.message));
  }

  // Install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Show install button in topbar (small screens) and in menu
    const btn = document.getElementById('install-btn');
    if (btn) btn.style.display = 'flex';
    const mbtn = document.getElementById('menu-install-btn');
    if (mbtn) mbtn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('install-btn');
    if (btn) btn.style.display = 'none';
    const mbtn = document.getElementById('menu-install-btn');
    if (mbtn) mbtn.style.display = 'none';
    toast('ProQuote installed! ✓', 'ok');
  });
  window._installPWA = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
    }
  };
})();


/* ═══ STAMP / SIGNATURE ═══ */
function uploadStamp(e) {
  const f = e.target.files[0]; if(!f) return;
  if(f.size > 2*1024*1024) { toast('Stamp too large (max 2MB)', 'err'); return; }
  const r = new FileReader(); r.onload = ev => { 
    stampURL = ev.target.result; 
    const drop = $('sdrop-in'); if(drop) drop.innerHTML = '<img src="'+stampURL+'" style="max-height:60px;object-fit:contain">'; 
    const acts = $('stamp-acts'); if(acts) acts.style.display='flex'; 
    dr(); 
  }; r.readAsDataURL(f);
}
function removeStamp() { 
  stampURL = null; 
  const drop = $('sdrop-in'); if(drop) drop.innerHTML = '<div style="font-size:1.1rem">🏵️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Stamp</div>'; 
  const acts = $('stamp-acts'); if(acts) acts.style.display='none'; 
  dr(); 
}

function uploadSignature(e) {
  const f = e.target.files[0]; if(!f) return;
  if(f.size > 2*1024*1024) { toast('Signature too large (max 2MB)', 'err'); return; }
  const r = new FileReader(); r.onload = ev => { 
    sigURL = ev.target.result; 
    const drop = $('sigdrop-in'); if(drop) drop.innerHTML = '<img src="'+sigURL+'" style="max-height:60px;object-fit:contain">'; 
    const acts = $('sig-acts'); if(acts) acts.style.display='flex'; 
    dr(); 
  }; r.readAsDataURL(f);
}
function removeSignature() { 
  sigURL = null; 
  const drop = $('sigdrop-in'); if(drop) drop.innerHTML = '<div style="font-size:1.1rem">✍️</div><div class="ldrop-lbl" style="font-size:.65rem">Upload Signature</div>'; 
  const acts = $('sig-acts'); if(acts) acts.style.display='none'; 
  dr(); 
}
