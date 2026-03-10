// ═══════════════════════════════════
// app.js — State, Init, UI, Steps, Items
// ═══════════════════════════════════
'use strict';

// ── Global state ──
let items=[], extraTaxes=[], undoStack=[], redoStack=[];
let currentTheme='classic', logoURL=null, logoW=70, logoBg=false;
const SW={rates:true,dscol:false,savings:false,vat:true,grandtot:true,notes:false,payterms:false,sign:false};

/* stubs for removed features */
function debouncedR(){dr();}
function validateDates(){return true;}
function closeM(){try{$('ov').classList.remove('open');}catch(e){}}
function clearActiveCapsule(){}

/* ─── CONFIRM NEW ─── */
function confirmNew(){
  // Show inline confirm banner
  let banner=$('confirm-new-bar');
  if(!banner){
    banner=document.createElement('div');
    banner.id='confirm-new-bar';
    banner.style.cssText='position:fixed;top:54px;left:0;right:0;z-index:400;background:#e53935;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;font-size:.84rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.2);animation:slideDown .2s ease';
    banner.innerHTML=`<span>⚠ Clear everything and start a new quotation?</span><div style="display:flex;gap:8px"><button onclick="document.getElementById('confirm-new-bar').remove()" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:600;font-size:.8rem">Cancel</button><button onclick="document.getElementById('confirm-new-bar').remove();resetAll()" style="background:#fff;border:none;color:#e53935;padding:5px 14px;border-radius:6px;cursor:pointer;font-weight:700;font-size:.8rem">Yes, Clear</button></div>`;
    document.body.appendChild(banner);
    setTimeout(()=>{if(banner.parentNode)banner.remove();},6000);
  }
}

/* ═══ STATE ═══ */
const $=id=>document.getElementById(id);
const g=id=>$(id)?$(id).value:'';
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const nl=s=>esc(s).replace(/\n/g,'<br>');
const iso=d=>d.toISOString().split('T')[0];
const fmt=n=>Number(n||0).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
function fmtD(s){if(!s)return'—';const d=new Date(s+'T00:00:00');return isNaN(d)?s:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
function uid(){return Math.random().toString(36).slice(2,9);}
function round(n){const m=g('p-round');if(m==='round')return Math.round(n);if(m==='ceil')return Math.ceil(n);if(m==='floor')return Math.floor(n);return Math.round(n*100)/100;}
function curr(){return g('s-curr')||'रु';}
function getVat(){const v=g('p-vat');return v==='custom'?parseFloat(g('p-vat-c'))||0:parseFloat(v)||0;}
function getUnit(){const v=g('s-unit');return v==='custom'?g('s-unit-custom')||'':v;}

let renderTimer=null;

/* ═══ INIT ═══ */
window.onload=()=>{
  // ── Dismiss splash after 3 seconds ──
  setTimeout(()=>{
    const sp=document.getElementById('splash');
    if(sp){
      sp.classList.add('hidden');
      setTimeout(()=>sp.style.display='none',500);
    }
  },2800);
  const t=new Date(),v=new Date(t);v.setDate(v.getDate()+30);
  $('q-date').value=iso(t);$('q-valid').value=iso(v);
  $('q-no').value=nextQNo();
  // Auto-detect system theme, override with saved preference if set
  const savedDark=localStorage.getItem('pq_dark');
  if(savedDark!==null){
    applyDark(savedDark==='1');
  } else {
    const prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyDark(prefersDark);
  }
  // Listen for system theme changes (if no manual override)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',e=>{
    if(localStorage.getItem('pq_dark')===null) applyDark(e.matches);
  });
  restoreDraft(); // async - handles buildItems/r internally
  buildItems();r(); // initial render with empty state
  initScaler();
  initSavedCounts();
  window.addEventListener('beforeunload',saveDraft);
  // Close modals on backdrop click
  ['ov-new','ov-saved','ov-templates'].forEach(id=>{
    const el=$(id);
    if(el) el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');});
  });
  // Undo/redo via Ctrl+Z / Ctrl+Y still supported
  document.addEventListener('keydown',e=>{
    const tag=document.activeElement.tagName;
    const typing=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
    if(e.shiftKey&&e.key==='A'&&!typing){e.preventDefault();if(!$('pane-4').classList.contains('active'))goS(4);addItem();}
    if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!typing){e.preventDefault();doUndo();}
    if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))&&!typing){e.preventDefault();doRedo();}
  });
  // Show install banner on mobile after a short delay
  setTimeout(maybeShowBanner, 1800);
};


/* ═══ QUOTE NO ═══ */
function nextQNo(){
  try{
    const yr=new Date().getFullYear();
    const d=JSON.parse(localStorage.getItem('pq_qno')||'{}');
    const n=(d[yr]||0)+1;d[yr]=n;
    localStorage.setItem('pq_qno',JSON.stringify(d));
    return`PQ-${yr}-${String(n).padStart(3,'0')}`;
  }catch(e){return'PQ-001';}
}

/* ═══ STEPS ═══ */
function goS(n){
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.stab').forEach(b=>b.classList.remove('active'));
  $('pane-'+n).classList.add('active');
  $('st'+n).classList.add('active');
  for(let i=1;i<=5;i++){const tab=$('st'+i),b=tab.querySelector('.sbadge');tab.classList.remove('done');b.textContent=i;}
  for(let i=1;i<n;i++){$('st'+i).classList.add('done');$('st'+i).querySelector('.sbadge').textContent='✓';}
  if(n===5)buildSum();
  document.querySelector('.fp').scrollTop=0;
}

/* ═══ DEBOUNCED RENDER ═══ */
function dr(){clearTimeout(renderTimer);renderTimer=setTimeout(r,180);}

/* ═══ UNDO/REDO ═══ */
function pushUndo(){undoStack.push(JSON.stringify(items));if(undoStack.length>30)undoStack.shift();redoStack=[];}
function doUndo(){if(!undoStack.length){toast('Nothing to undo');return;}redoStack.push(JSON.stringify(items));items=JSON.parse(undoStack.pop());buildItems();r();toast('Undo');}
function doRedo(){if(!redoStack.length){toast('Nothing to redo');return;}undoStack.push(JSON.stringify(items));items=JSON.parse(redoStack.pop());buildItems();r();toast('Redo');}


/* ═══ ITEMS UI ═══ */
function buildItems(){
  const c=$('items-body');if(!c)return;
  c.innerHTML='';
  items.forEach(item=>{
    const el=document.createElement('div');
    el.id='ir-'+item.id;
    if(item.type==='section'){
      el.className='irow-section';
      el.innerHTML=`<span style="font-size:.7rem;color:var(--dim)">§</span>
        <input type="text" value="${esc(item.desc)}" placeholder="Section heading…" onchange="upd('${item.id}','desc',this.value)">
        <button class="idel" onclick="delItem('${item.id}')">✕</button>`;
    } else {
      const gd=parseFloat(g('p-disc'))||0;
      const eff=item.useD?item.d:gd;
      el.className='irow'+(item.useD?' has-disc':'');
      if(item.optional)el.style.borderLeft='3px solid var(--warn)';
      el.innerHTML=`
        <input type="checkbox" ${item.sel?'checked':''} onchange="selItem('${item.id}',this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:var(--danger);flex-shrink:0">
        <div class="idesc-wrap">
          <div style="display:flex;align-items:center;gap:4px">
            <input type="text" value="${esc(item.desc)}" placeholder="Description" onchange="upd('${item.id}','desc',this.value)" style="flex:1;font-size:.77rem">
            ${item.optional?'<span style="font-size:.6rem;background:var(--warn-s);color:var(--warn);padding:1px 5px;border-radius:3px;font-weight:700;white-space:nowrap">Optional</span>':''}
          </div>
          <input type="text" value="${esc(item.note||'')}" placeholder="Note (optional)" onchange="upd('${item.id}','note',this.value)" style="font-size:.71rem;color:var(--muted);border-color:transparent;background:transparent;padding:2px 4px;margin-top:1px">
          <div class="idr">
            <span class="dtag">Disc:</span>
            <input type="number" value="${item.d}" min="0" max="100" step="0.5" style="width:52px;font-size:.74rem" onchange="upd('${item.id}','d',this.value)" placeholder="%">
            <span style="font-size:.67rem;color:var(--muted)">% override</span>
          </div>
        </div>
        <input type="number" value="${item.qty||''}" placeholder="1" min="0" step="any" onchange="upd('${item.id}','qty',this.value)" style="text-align:center;font-size:.78rem">
        <input type="number" value="${item.rate||''}" placeholder="0.00" min="0" step="any" onchange="upd('${item.id}','rate',this.value)" style="font-size:.78rem">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:2px">
          <span style="font-size:.68rem;color:${eff>0?'var(--warn)':'var(--dim)'}">${eff>0?eff+'%':'—'}</span>
          <button title="Item discount" onclick="togItemD('${item.id}')" style="width:17px;height:17px;border-radius:3px;border:1px solid ${item.useD?'var(--warn)':'var(--border)'};background:${item.useD?'var(--warn-s)':'transparent'};color:${item.useD?'var(--warn)':'var(--dim)'};cursor:pointer;font-size:.58rem;font-weight:700">%</button>
        </div>
        <button class="idel" onclick="delItem('${item.id}')">✕</button>`;
    }
    c.appendChild(el);
  });
  updateBulkBar();
}

function selItem(id,checked){
  const it=items.find(x=>x.id===id);if(!it)return;
  it.sel=checked;
  const row=$('ir-'+id);if(row&&it.type!=='section')row.style.background=checked?'#fff3f3':'';
  updateBulkBar();
}
function toggleSelAll(checked){items.forEach(it=>{if(it.type!=='section')it.sel=checked;});buildItems();}
function updateBulkBar(){
  const sel=items.filter(x=>x.sel&&x.type!=='section').length;
  const bar=$('bulk-bar');if(!bar)return;
  bar.style.display=sel?'flex':'none';
  $('bulk-count').textContent=sel+' selected';
  const allCb=$('sel-all');
  if(allCb){const t=items.filter(x=>x.type!=='section').length;allCb.checked=sel===t&&t>0;allCb.indeterminate=sel>0&&sel<t;}
}
function deleteSelected(){
  const n=items.filter(x=>x.sel&&x.type!=='section').length;if(!n)return;
  pushUndo();items=items.filter(x=>!x.sel);buildItems();r();toast(n+' removed — Ctrl+Z to undo');
}

function upd(id,k,v){
  const it=items.find(x=>x.id===id);if(!it)return;
  if(['qty','rate','d'].includes(k))v=parseFloat(v)||0;
  it[k]=v;
  if(['qty','rate','d'].includes(k)){buildItems();r();}else dr();
}
function togItemD(id){
  const it=items.find(x=>x.id===id);if(!it)return;
  it.useD=!it.useD;buildItems();r();
}
function addItem(){
  pushUndo();
  items.push({id:uid(),type:'item',desc:'',qty:'',rate:'',d:0,useD:false,sel:false,optional:false,note:''});
  buildItems();r();
  setTimeout(()=>{const pb=$('items-pane-body');if(pb)pb.scrollTop=pb.scrollHeight;},30);
}
function addSection(){
  pushUndo();
  items.push({id:uid(),type:'section',desc:''});
  buildItems();r();
  setTimeout(()=>{
    const pb=$('items-pane-body');if(pb)pb.scrollTop=pb.scrollHeight;
    // Focus the new section input
    const rows=document.querySelectorAll('.irow-section input[type=text]');
    if(rows.length)rows[rows.length-1].focus();
  },30);
  toast('Section added');
}
function addOptional(){
  pushUndo();
  items.push({id:uid(),type:'item',desc:'',qty:'',rate:'',d:0,useD:false,sel:false,optional:true,note:''});
  buildItems();r();
  setTimeout(()=>{const pb=$('items-pane-body');if(pb)pb.scrollTop=pb.scrollHeight;},30);
  toast('Optional item added');
}
function delItem(id){
  pushUndo();items=items.filter(x=>x.id!==id);buildItems();r();
  toast('Removed — Ctrl+Z to undo');
}

/* ═══ TOGGLES ═══ */
const SW_IDS={rates:['sw-rates','sw-rates-2'],dscol:['sw-dscol','sw-dscol-2'],savings:['sw-savings'],vat:['sw-vat'],grandtot:['sw-grandtot','sw-grandtot-2'],notes:['sw-notes'],payterms:['sw-payterms'],sign:['sw-sign']};
const VC_IDS={rates:'vc-rates',grandtot:'vc-grandtot',dscol:'vc-dscol'};
function tog(k){
  SW[k]=!SW[k];syncSW();r();
}
function syncSW(){
  Object.keys(SW).forEach(k=>{
    (SW_IDS[k]||[]).forEach(sid=>{const e=$(sid);if(e)e.className='sw'+(SW[k]?' on':'');});
    if(VC_IDS[k]){const e=$(VC_IDS[k]);if(e)e.className='vc'+(SW[k]?' on':'');}
  });
  const ns=$('notes-section');if(ns)ns.style.display=SW.notes?'':'none';
  const ps=$('payterms-section');if(ps)ps.style.display=SW.payterms?'':'none';
}

function vatChange(){const vc=$('vat-custom-row');if(vc)vc.style.display=g('p-vat')==='custom'?'':'none';r();}
function unitChange(){const uc=$('s-unit-custom');if(uc)uc.style.display=g('s-unit')==='custom'?'block':'none';r();}

/* ═══ EXTRA TAXES ═══ */
function addTaxLine(){extraTaxes.push({id:uid(),name:'Tax',rate:0});renderTaxLines();r();}
function removeTaxLine(id){extraTaxes=extraTaxes.filter(t=>t.id!==id);renderTaxLines();r();}
function updTax(id,k,v){const t=extraTaxes.find(x=>x.id===id);if(!t)return;t[k]=k==='rate'?parseFloat(v)||0:v;r();}
function renderTaxLines(){
  const c=$('tax-lines');if(!c)return;
  c.innerHTML=extraTaxes.map(t=>`
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:7px">
      <input type="text" value="${esc(t.name)}" placeholder="Tax name" onchange="updTax('${t.id}','name',this.value)" style="flex:1">
      <input type="number" value="${t.rate}" min="0" max="100" step="0.1" onchange="updTax('${t.id}','rate',this.value)" style="width:68px" placeholder="%">
      <span style="font-size:.8rem;color:var(--muted)">%</span>
      <button class="idel" onclick="removeTaxLine('${t.id}')" style="color:var(--danger)">✕</button>
    </div>`).join('');
}


function applyLogoBg(){
  const wrap=document.getElementById('ldrop-in');
  if(!wrap)return;
  const img=wrap.querySelector('img');
  if(!img)return;
  if(logoBg){wrap.style.background='#fff';wrap.style.padding='6px';wrap.style.borderRadius='6px';wrap.style.display='inline-block';}
  else{wrap.style.background='';wrap.style.padding='';wrap.style.borderRadius='';wrap.style.display='';}
  r();
}
function toggleLogoBg(checked){
  logoBg=checked;
  applyLogoBg();
  const hint=document.getElementById('logobg-hint');
  if(hint)hint.textContent=logoBg?'White background applied':'Transparent (for PNG logos)';
}

/* ═══ DARK MODE ═══ */
function toggleDark(){
  const on=!document.body.classList.contains('dark');
  applyDark(on);
  localStorage.setItem('pq_dark',on?'1':'0');
}
function applyDark(on){
  document.body.classList.toggle('dark',on);
  const btn=$('dark-btn');if(btn)btn.textContent=on?'☀️':'🌙';
}

/* ═══ THEMES ═══ */
function setTheme(name,el){
  currentTheme=name;
  document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('sel'));
  if(el)el.classList.add('sel');
  r();toast('Theme: '+name[0].toUpperCase()+name.slice(1));
}

/* ═══ LOGO ═══ */
function uploadLogo(e){
  const f=e.target.files[0];if(!f)return;
  if(f.size>3*1024*1024){toast('Max 3MB','err');return;}
  if(!f.type.startsWith('image/')){toast('Image files only','err');return;}
  const rd=new FileReader();
  rd.onerror=()=>toast('Failed to read file','err');
  rd.onload=ev=>{
    const src=ev.target.result;
    const img=new Image();
    img.onerror=()=>{logoURL=src;logoW=70;setLogoUI();};
    img.onload=()=>{
      try{
        const MAX=500;let w=img.width,h=img.height;
        if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
        const cv=document.createElement('canvas');cv.width=w;cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        logoURL=cv.toDataURL('image/jpeg',0.88);
      }catch(_){logoURL=src;}
      logoW=70;setLogoUI();
    };
    img.src=src;
  };
  rd.readAsDataURL(f);
}
function setLogoUI(){
  applyLogoBg();
  $('ldrop-in').innerHTML=`<img src="${logoURL}" style="max-width:${logoW}px;max-height:48px;object-fit:contain;border-radius:3px">`;
  $('logo-acts').style.display='flex';
  const bgRow=$('logo-bg-row');if(bgRow)bgRow.style.display='block';
  r();toast('Logo uploaded','ok');
}
function toggleResize(){const w=$('logo-resize');w.style.display=w.style.display==='none'?'block':'none';}
function resizeLogo(v){logoW=parseInt(v);$('lsize-lbl').textContent=v;const img=$('ldrop-in').querySelector('img');if(img)img.style.maxWidth=v+'px';r();}
function removeLogo(){
  logoURL=null;logoW=70;logoBg=false;
  $('ldrop-in').innerHTML='<div style="font-size:1.4rem;margin-bottom:4px">🏢</div><div class="ldrop-lbl">Click or drag logo here</div><div class="ldrop-sub">PNG, JPG, SVG · max 3MB</div>';
  $('logo-acts').style.display='none';$('logo-resize').style.display='none';
  const bgRow=$('logo-bg-row');if(bgRow)bgRow.style.display='none';
  const chk=$('logo-bg-chk');if(chk)chk.checked=false;
  r();
}

/* ═══ COLOR ═══ */
function setCol(v){document.documentElement.style.setProperty('--doc',v);r();}
function pickCol(el){
  setCol(el.dataset.c);$('co-col').value=el.dataset.c;
  document.querySelectorAll('.cpick').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
}

/* ═══ DATA HELPERS ═══ */
function collectData(){
  return {
    _v:2,_saved:new Date().toISOString(),
    items,extraTaxes,currentTheme,logoURL,logoW,
    coName:g('co-name'),coLoc:g('co-loc'),coPhone:g('co-phone'),coEmail:g('co-email'),coCol:g('co-col'),
    clName:g('cl-name'),clPerson:g('cl-person'),clPhone:g('cl-phone'),clAddr:g('cl-addr'),
    qNo:g('q-no'),qStatus:g('q-status'),qDate:g('q-date'),qValid:g('q-valid'),qSubj:g('q-subj'),
    pDisc:g('p-disc'),pVat:g('p-vat'),pVatC:g('p-vat-c'),pShip:g('p-ship'),pRound:g('p-round'),
    pNotes:g('p-notes'),pPay:g('p-payterms'),pBank:g('p-bank'),
    sCurr:g('s-curr'),sUnit:g('s-unit'),sUnitCustom:g('s-unit-custom'),sw:JSON.stringify(SW)
  };
}
function applyData(d){
  if(!d)return;
  if(d.items&&d.items.length)items=d.items; else items=[];
  extraTaxes=d.extraTaxes||[];
  if(d.currentTheme){currentTheme=d.currentTheme;const tc=document.querySelector(`.theme-card[data-theme="${currentTheme}"]`);if(tc){document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('sel'));tc.classList.add('sel');}}
  if(d.logoURL){logoURL=d.logoURL;logoW=d.logoW||70;$('ldrop-in').innerHTML=`<img src="${logoURL}" style="max-width:${logoW}px;max-height:48px;object-fit:contain;border-radius:3px">`;$('logo-acts').style.display='flex';}
  const set=(id,v)=>{const e=$(id);if(e&&v!=null)e.value=v;};
  set('co-name',d.coName);set('co-loc',d.coLoc);set('co-phone',d.coPhone);set('co-email',d.coEmail);
  if(d.coCol){setCol(d.coCol);$('co-col').value=d.coCol;}
  set('cl-name',d.clName);set('cl-person',d.clPerson);set('cl-phone',d.clPhone);set('cl-addr',d.clAddr);
  set('q-no',d.qNo);set('q-status',d.qStatus);set('q-date',d.qDate);set('q-valid',d.qValid);set('q-subj',d.qSubj);
  set('p-disc',d.pDisc);set('p-vat',d.pVat);set('p-vat-c',d.pVatC);set('p-ship',d.pShip);set('p-round',d.pRound);
  set('p-notes',d.pNotes);set('p-payterms',d.pPay);set('p-bank',d.pBank);
  set('s-curr',d.sCurr);set('s-unit',d.sUnit);set('s-unit-custom',d.sUnitCustom);
  if(d.sw){Object.assign(SW,JSON.parse(d.sw));}
  syncSW();renderTaxLines();
}

/* ═══ INDEXEDDB ═══ */
let _db=null;
function openDB(){
  return new Promise((res,rej)=>{
    if(_db){res(_db);return;}
    const req=indexedDB.open('ProQuoteDB',1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('quotes'))
        db.createObjectStore('quotes',{keyPath:'id'});
    };
    req.onsuccess=e=>{_db=e.target.result;res(_db);};
    req.onerror=()=>rej(req.error);
  });
}
function dbSave(id,data){
  return openDB().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction('quotes','readwrite');
    tx.objectStore('quotes').put({id,...data});
    tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
  }));
}
function dbLoad(id){
  return openDB().then(db=>new Promise((res,rej)=>{
    const req=db.transaction('quotes','readonly').objectStore('quotes').get(id);
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>rej(req.error);
  }));
}
function dbList(){
  return openDB().then(db=>new Promise((res,rej)=>{
    const req=db.transaction('quotes','readonly').objectStore('quotes').getAll();
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>rej(req.error);
  }));
}
function dbDelete(id){
  return openDB().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction('quotes','readwrite');
    tx.objectStore('quotes').delete(id);
    tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
  }));
}

