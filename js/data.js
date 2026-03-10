// ═══════════════════════════════════
// data.js — Draft, Saved Quotes, Toast, Summary
// ═══════════════════════════════════
/* ═══ DRAFT SAVE/RESTORE (IndexedDB + localStorage fallback) ═══ */
function saveDraft(){
  const d=collectData();
  // Save to IndexedDB
  dbSave('__draft__',d).catch(()=>{});
  // Also localStorage fallback (strip logo to save space)
  try{
    const small={...d,logoURL:null};
    localStorage.setItem('pq_v9',JSON.stringify(small));
  }catch(e){}
}
function restoreDraft(){
  // Try IndexedDB first, fall back to localStorage
  dbLoad('__draft__').then(d=>{
    if(d){applyData(d);buildItems();r();toast('Draft restored','ok');}
    else restoreDraftLS();
  }).catch(()=>restoreDraftLS());
}
function restoreDraftLS(){
  try{
    const raw=localStorage.getItem('pq_v9');if(!raw)return;
    const d=JSON.parse(raw);
    applyData(d);buildItems();r();toast('Draft restored','ok');
  }catch(e){console.warn('Draft restore failed',e);}
}

/* ═══ SAVE TO DEVICE FILE ═══ */
function saveToFile(){
  const d=collectData();
  const name=(g('q-no')||'quote').replace(/[^a-z0-9_-]/gi,'_');
  const json=JSON.stringify(d,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=name+'.proquote';
  document.body.appendChild(a);a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast('Saved: '+name+'.proquote','ok');
}

/* ═══ OPEN FROM DEVICE FILE ═══ */
function openFromFile(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='.proquote,.json';
  inp.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        applyData(d);buildItems();r();
        toast('Loaded: '+f.name,'ok');
      }catch(err){toast('Invalid file','err');}
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ═══ SAVED QUOTES (in-app, IndexedDB) ═══ */
function openSavedModal(){
  dbList().then(quotes=>{
    const list=$('saved-list');if(!list)return;
    if(!quotes.filter(q=>q.id!=='__draft__').length){
      list.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:.82rem">No saved quotes yet.<br>Use <b>Save Quote</b> to save one.</div>';
    } else {
      list.innerHTML=quotes.filter(q=>q.id!=='__draft__').sort((a,b)=>b._saved>a._saved?1:-1).map(q=>`
        <div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:8px">
          <div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.88rem">${esc(q.clName||'(no client)')}</div>
              <div style="font-size:.72rem;color:var(--muted)">${esc(q.qNo||'')} · ${esc(q.coName||'')} · ${q._saved?new Date(q._saved).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):''}</div>
            </div>
            <div style="font-size:.78rem;font-weight:700;color:var(--accent)">${esc(q.sCurr||'')}</div>
          </div>
          <div style="display:flex;border-top:1px solid var(--border)">
            <button class="btn btn-sm" onclick="loadSaved('${q.id}')" style="flex:1;border-radius:0;border:none;background:var(--accent-s);color:var(--accent);font-weight:600;padding:8px">⬆ Load</button>
            <div style="width:1px;background:var(--border)"></div>
            <button class="btn btn-sm btn-danger" onclick="deleteSaved('${q.id}')" style="border-radius:0;border:none;padding:8px 12px">🗑</button>
          </div>
        </div>`).join('');
    }
    $('ov-saved').classList.add('open');
  }).catch(()=>toast('Could not load saved quotes','err'));
}
function saveQuote(){
  const d=collectData();
  const id='q_'+Date.now();
  dbSave(id,d).then(()=>{
    toast('Quote saved ✓','ok');
  }).catch(()=>toast('Save failed','err'));
}
function loadSaved(id){
  dbLoad(id).then(d=>{
    if(!d){toast('Not found','err');return;}
    applyData(d);buildItems();r();
    $('ov-saved').classList.remove('open');
    toast('Quote loaded','ok');
  });
}
function deleteSaved(id){
  dbDelete(id).then(()=>{
    toast('Deleted');
    openSavedModal();
  });
}


/* ═══ TOAST ═══ */
function toast(msg,type=''){
  const t=document.createElement('div');
  t.className='toast'+(type?' '+type:'');t.textContent=msg;
  $('tray').appendChild(t);
  setTimeout(()=>{t.style.animation='tOut .2s ease forwards';setTimeout(()=>t.remove(),220);},2200);
}

/* ═══ SUMMARY (Step 5) ═══ */
function buildSum(){
  const gd=parseFloat(g('p-disc'))||0;
  let sub=0;
  items.forEach(it=>{
    if(it.type==='section'||it.optional)return;
    const eff=it.useD?it.d:gd;
    sub+=round(it.qty*it.rate*(1-eff/100));
  });
  const vp=getVat(),va=round(sub*vp/100),ship=parseFloat(g('p-ship'))||0;
  let extTax=0;extraTaxes.forEach(tx=>{extTax+=round(sub*tx.rate/100);});
  const grand=round(sub+(SW.vat?va:0)+extTax+ship);
  const box=$('sum-box');if(!box)return;
  box.innerHTML=`
    <div>Customer: <strong>${esc(g('cl-name')||'—')}</strong></div>
    <div>Quote No: <strong>${esc(g('q-no')||'—')}</strong></div>
    <div>Items: <strong>${items.filter(x=>x.type!=='section').length}</strong></div>
    <div>Subtotal: <strong>${curr()} ${fmt(sub)}</strong></div>
    ${vp>0?`<div>VAT (${vp}%): <strong>${curr()} ${fmt(va)}</strong></div>`:''}
    <div style="color:var(--accent)">Grand Total: <strong>${curr()} ${fmt(grand)}</strong></div>`;
}

/* ═══ RESET ═══ */
function showNewModal(){
  const ov=document.getElementById('ov-new');
  if(ov)ov.classList.add('open');
}
function closeNewModal(){
  const ov=document.getElementById('ov-new');
  if(ov)ov.classList.remove('open');
}
function resetAll(){
  items=[];extraTaxes=[];undoStack=[];redoStack=[];currentTheme='classic';logoURL=null;
  ['co-name','co-loc','co-phone','co-email','cl-name','cl-person','cl-phone','cl-addr',
   'q-subj','p-notes','p-payterms','p-bank'].forEach(id=>{const e=$(id);if(e)e.value='';});
  $('p-disc').value='0';$('p-vat').value='13';$('p-ship').value='0';$('s-curr').value='रु';$('q-status').value='draft';
  const t=new Date(),v=new Date(t);v.setDate(v.getDate()+30);
  $('q-date').value=iso(t);$('q-valid').value=iso(v);$('q-no').value=nextQNo();
  document.querySelectorAll('.theme-card').forEach(c=>c.classList.remove('sel'));
  document.querySelector('.theme-card[data-theme="classic"]').classList.add('sel');
  removeLogo();buildItems();renderTaxLines();
  localStorage.removeItem('pq_v9');
  goS(1);r();toast('New quotation','ok');
}

/* ═══ SCALER ═══ */
function initScaler(){
  const pp=$('pp'),inner=$('doc-scaler-inner');
  if(!pp||!inner)return;
  function scale(){
    const avail=pp.clientWidth-32;
    const s=Math.min(1,avail/794);
    inner.style.transform=`scale(${s})`;
    const wrapper=inner.parentElement;
    wrapper.style.width=(794*s)+'px';
    requestAnimationFrame(()=>{
      const h=inner.getBoundingClientRect().height/s;
      wrapper.style.height=(h*s)+'px';
      wrapper.style.overflow='visible';
    });
  }
  scale();
  window._scale=scale;
  new ResizeObserver(scale).observe(pp);
}


/* ═══ SAVED DATA SYSTEM ═══ */

function toggleDrawer(id){
  const d=document.getElementById(id);
  if(!d)return;
  d.classList.toggle('open');
  // Refresh content when opening
  if(d.classList.contains('open')){
    if(id==='drawer-co')renderCoList();
    if(id==='drawer-cl')renderClList();
    if(id==='drawer-lib')renderLibList();
  }
}

/* ── COMPANY PROFILES ── */
function getCompanies(){try{return JSON.parse(localStorage.getItem('pq_companies')||'[]');}catch(e){return[];}}
function setCompanies(a){localStorage.setItem('pq_companies',JSON.stringify(a));}

function saveCompany(){
  const name=g('co-name').trim();
  if(!name){toast('Enter company name first','err');return;}
  const all=getCompanies();
  const existing=all.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());
  const data={
    id:existing>=0?all[existing].id:uid(),
    name,loc:g('co-loc'),phone:g('co-phone'),email:g('co-email'),
    color:g('co-col')||'#1e40af',logoURL:logoURL||null,logoW,
    saved:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  };
  if(existing>=0){all[existing]=data;toast('✓ Company updated','ok');}
  else{all.unshift(data);toast('✓ Company saved!','ok');}
  setCompanies(all);
  renderCoList();
  // Flash the button green
  const btn=$('co-save-btn');if(btn){btn.style.background='var(--success)';btn.textContent='✓ Saved!';setTimeout(()=>{btn.style.background='';btn.innerHTML='💾 Save This Company';},2000);}
}

function loadCompany(id){
  const p=getCompanies().find(x=>x.id===id);if(!p)return;
  const set=(el,v)=>{const e=$(el);if(e)e.value=v||'';};
  set('co-name',p.name);set('co-loc',p.loc);set('co-phone',p.phone);set('co-email',p.email);
  if(p.color){setCol(p.color);$('co-col').value=p.color;}
  if(p.logoURL){logoURL=p.logoURL;logoW=p.logoW||70;setLogoUI();}
  else{logoURL=null;removeLogo();}
  dr();toast('Loaded: '+p.name,'ok');
}

function delCompany(id){
  setCompanies(getCompanies().filter(x=>x.id!==id));
  renderCoList();toast('Company deleted');
}

function renderCoList(){
  const all=getCompanies();
  const count=$('co-saved-count');
  if(count)count.textContent=all.length+(all.length===1?' saved':' saved');
  const list=$('co-saved-list');if(!list)return;
  if(!all.length){
    list.innerHTML=`<div class="saved-empty"><div class="saved-empty-icon">🏢</div>No companies saved yet.<br>Fill your details below and tap <strong>Save This Company</strong></div>`;
    return;
  }
  list.innerHTML=all.map(p=>`
    <div class="saved-row" onclick="loadCompany('${p.id}')" title="Tap to load">
      <div class="saved-dot" style="background:${p.color||'#1e40af'}">${(p.name[0]||'?').toUpperCase()}</div>
      <div class="saved-row-info">
        <div class="saved-row-name">${esc(p.name)}</div>
        <div class="saved-row-meta">${[p.loc,p.email].filter(Boolean).join(' · ')||'Tap to load'}</div>
      </div>
      <button class="saved-row-del" onclick="event.stopPropagation();delCompany('${p.id}')" title="Delete this company">🗑</button>
    </div>`).join('');
}

/* ── CLIENT BOOK ── */
function getClients(){try{return JSON.parse(localStorage.getItem('pq_clients2')||'[]');}catch(e){return[];}}
function setClients(a){localStorage.setItem('pq_clients2',JSON.stringify(a));}

function saveClient(){
  const name=g('cl-name').trim();
  if(!name){toast('Enter client name first','err');return;}
  const all=getClients();
  const existing=all.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());
  const data={
    id:existing>=0?all[existing].id:uid(),
    name,person:g('cl-person'),phone:g('cl-phone'),addr:g('cl-addr'),
    saved:new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
  };
  if(existing>=0){all[existing]=data;toast('✓ Client updated','ok');}
  else{all.unshift(data);toast('✓ Client saved!','ok');}
  setClients(all);
  renderClList();
  const btn=$('cl-save-btn');if(btn){btn.style.background='var(--success)';btn.textContent='✓ Saved!';setTimeout(()=>{btn.style.background='';btn.innerHTML='💾 Save This Client';},2000);}
}

function loadClient(id){
  const c=getClients().find(x=>x.id===id);if(!c)return;
  const set=(el,v)=>{const e=$(el);if(e)e.value=v||'';};
  set('cl-name',c.name);set('cl-person',c.person);set('cl-phone',c.phone);set('cl-addr',c.addr);
  dr();toast('Loaded: '+c.name,'ok');
}

function delClient(id){
  setClients(getClients().filter(x=>x.id!==id));
  renderClList();toast('Client deleted');
}

function renderClList(){
  const all=getClients();
  const count=$('cl-saved-count');
  if(count)count.textContent=all.length+' saved';
  const list=$('cl-saved-list');if(!list)return;
  if(!all.length){
    list.innerHTML=`<div class="saved-empty"><div class="saved-empty-icon">👥</div>No clients saved yet.<br>Fill client details below and tap <strong>Save This Client</strong></div>`;
    return;
  }
  list.innerHTML=all.map(cl=>`
    <div class="saved-row" onclick="loadClient('${cl.id}')" title="Tap to load">
      <div class="saved-dot" style="background:var(--accent)">${(cl.name[0]||'?').toUpperCase()}</div>
      <div class="saved-row-info">
        <div class="saved-row-name">${esc(cl.name)}</div>
        <div class="saved-row-meta">${[cl.person,cl.phone].filter(Boolean).join(' · ')||'Tap to load'}</div>
      </div>
      <button class="saved-row-del" onclick="event.stopPropagation();delClient('${cl.id}')" title="Delete this client">🗑</button>
    </div>`).join('');
}

/* ── PRODUCT LIBRARY ── */
function getLibrary(){try{return JSON.parse(localStorage.getItem('pq_library2')||'[]');}catch(e){return[];}}
function setLibrary(a){localStorage.setItem('pq_library2',JSON.stringify(a));}

function saveLibItem(){
  const name=g('lib-name').trim();
  if(!name){toast('Enter product name','err');return;}
  const lib=getLibrary();
  lib.unshift({id:uid(),name,rate:parseFloat(g('lib-rate'))||0,unit:g('lib-unit')||''});
  setLibrary(lib);
  $('lib-name').value='';$('lib-rate').value='';$('lib-unit').value='';
  renderLibList();toast('Saved to library','ok');
}

function insertLibItem(id){
  const it=getLibrary().find(x=>x.id===id);if(!it)return;
  pushUndo();
  items.push({id:uid(),type:'item',desc:it.name,qty:'',rate:it.rate||'',d:0,useD:false,sel:false,optional:false,note:''});
  buildItems();r();
  toast('Added: '+it.name,'ok');
}

function delLibItem(id){
  setLibrary(getLibrary().filter(x=>x.id!==id));
  renderLibList();toast('Removed from library');
}

function renderLibList(){
  const all=getLibrary();
  const count=$('lib-saved-count');
  if(count)count.textContent=all.length+' saved';
  const list=$('lib-saved-list');if(!list)return;
  if(!all.length){
    list.innerHTML=`<div class="saved-empty" style="padding:8px 0">Type a product name above and tap <strong>＋ Save</strong> to build your library</div>`;
    return;
  }
  list.innerHTML=all.map(it=>`
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
function initSavedCounts(){
  renderCoList();
  renderClList();
  renderLibList();
}


