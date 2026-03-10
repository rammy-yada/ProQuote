// ═══════════════════════════════════
// render.js — Document Render, Export (PDF/PNG), WhatsApp
// ═══════════════════════════════════
/* ═══ PRINT / PDF ═══ */
function doPrint(){executePrint(false);}
function doExport(){executePrint(true);}
function executePrint(saveAsPDF){
  saveDraft();
  const qdocEl=$('qdoc');
  if(!qdocEl||!qdocEl.children.length){toast('Add items first','err');return;}
  const docCol=getComputedStyle(document.documentElement).getPropertyValue('--doc').trim()||'#1e40af';
  const cloned=qdocEl.cloneNode(true);
  cloned.querySelectorAll('*').forEach(el=>{
    if(el.style&&el.style.cssText)el.style.cssText=el.style.cssText.replace(/var\(--doc\)/g,docCol);
  });
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',system-ui,sans-serif;background:#fff}
.schip{display:inline-block;padding:2px 9px;border-radius:20px;font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.s-draft{background:#fff3cd;color:#856404;border:1px solid #ffc107}
.s-sent{background:#cfe2ff;color:#0a58ca;border:1px solid #9ec5fe}
.s-approved{background:#d1e7dd;color:#0f5132;border:1px solid #a3cfbb}
.s-rejected{background:#f8d7da;color:#842029;border:1px solid #f1aeb5}
#qdoc{width:794px}
.dpage{width:794px;min-height:1122px;padding:36px 48px 48px;background:#fff;display:flex;flex-direction:column;break-after:page}
.dpage:last-child{break-after:avoid}
table{width:100%;border-collapse:collapse;border:1px solid #c8cce0}
th{background:${docCol}!important;color:#fff!important;padding:8px 10px;font-size:.67rem;font-weight:600;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;border-right:1px solid rgba(255,255,255,.2)}
td{padding:7px 10px;border-right:1px solid #d8dce8;border-bottom:1px solid #d8dce8;font-size:.78rem;vertical-align:top;color:#1a1d2e}
td:last-child{border-right:none}
tr:nth-child(even) td{background:#f9fafc}
@page{size:A4;margin:0}
@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{margin:0}}
</style></head><body>
${cloned.outerHTML}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
</body></html>`;
  // Use blob URL to avoid popup blocker
  try{
    const blob=new Blob([html],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,'_blank');
    if(!w){
      // Fallback: inject into hidden iframe
      const ifr=document.createElement('iframe');
      ifr.style.cssText='position:fixed;width:0;height:0;border:0;left:-9999px';
      document.body.appendChild(ifr);
      ifr.contentDocument.open();
      ifr.contentDocument.write(html);
      ifr.contentDocument.close();
      setTimeout(()=>{ifr.contentWindow.print();setTimeout(()=>ifr.remove(),1000);},300);
    }
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast(saveAsPDF?'Choose "Save as PDF" in print dialog':'Print dialog opened','ok');
  }catch(err){
    toast('Print error: '+err.message,'err');
  }
}


/* ═══ RENDER ═══ */
function r(){
  const coName=g('co-name')||'Your Company',coLoc=g('co-loc'),coPhone=g('co-phone'),coEmail=g('co-email');
  const clName=g('cl-name')||'—',qno=g('q-no')||'—',subj=g('q-subj');
  const dateStr=fmtD(g('q-date')),validStr=fmtD(g('q-valid'));
  const gd=parseFloat(g('p-disc'))||0,ut=getUnit(),vatPct=getVat(),ship=parseFloat(g('p-ship'))||0;
  const docCol=getComputedStyle(document.documentElement).getPropertyValue('--doc').trim()||'#1e40af';
  const sm={draft:'Draft',sent:'Sent',approved:'Approved',rejected:'Rejected'};
  const sc={draft:'s-draft',sent:'s-sent',approved:'s-approved',rejected:'s-rejected'};
  const st=g('q-status')||'draft';
  const chipHtml=`<span class="schip ${sc[st]}">${sm[st]||'Draft'}</span>`;
  const logoHtml=logoURL?`<img src="${logoURL}" style="display:block;max-width:${logoW}px;max-height:56px;object-fit:contain;border-radius:3px;${logoBg?'background:#fff;padding:4px;':''}" alt="">`:'' ;
  const logoSmHtml=logoURL?`<img src="${logoURL}" style="max-height:30px;object-fit:contain" alt="">`:'' ;

  // Row data
  let subtotal=0,totalSaved=0,serial=0;
  const rowsData=items.map(item=>{
    if(item.type==='section')return{type:'section',item};
    const eff=item.useD?item.d:gd;
    const raw=item.qty*item.rate,discAmt=raw*(eff/100);
    const discUnit=round(item.rate*(1-eff/100)),lineTotal=round(raw-discAmt);
    if(!item.optional){subtotal+=lineTotal;totalSaved+=discAmt;}
    serial++;
    return{type:'item',sn:serial,item,eff,discUnit,lineTotal};
  });

  // Totals
  const vatAmt=round(subtotal*vatPct/100);
  let extraTaxTotal=0;
  extraTaxes.forEach(tx=>{extraTaxTotal+=round(subtotal*tx.rate/100);});
  const grand=round(subtotal+(SW.vat?vatAmt:0)+extraTaxTotal+ship);

  let totHtml='';
  totHtml+=trow('Subtotal',curr()+' '+fmt(subtotal));
  if(SW.savings&&totalSaved>0)totHtml+=trow('Discount Savings','− '+curr()+' '+fmt(round(totalSaved)),'disc-row');
  if(ship>0)totHtml+=trow('Shipping',curr()+' '+fmt(ship));
  if(SW.vat&&vatPct>0)totHtml+=trow(`VAT (${vatPct}%)`,curr()+' '+fmt(vatAmt),'vat-row');
  extraTaxes.forEach(tx=>{if(tx.rate>0)totHtml+=trow(`${esc(tx.name)} (${tx.rate}%)`,curr()+' '+fmt(round(subtotal*tx.rate/100)),'vat-row');});
  if(SW.grandtot)totHtml+=trow('Grand Total',curr()+' '+fmt(grand),'grand');
  const totalsHtml=`<div style="display:flex;justify-content:flex-end;margin-top:0"><div style="width:270px;border:1px solid #c8cce0;border-top:none;font-size:.79rem">${totHtml}</div></div>`;

  const showR=SW.rates,showD=SW.dscol;
  const thStyle='padding:7px 10px;color:#fff;font-size:.8rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const thHtml=`<thead><tr style="background:${docCol};-webkit-print-color-adjust:exact;print-color-adjust:exact">
    <th style="${thStyle};width:4%">SN</th>
    <th style="${thStyle}">Description</th>
    <th style="${thStyle};width:8%;text-align:center">Unit</th>
    <th style="${thStyle};width:7%;text-align:center">Qty</th>
    ${showR?`<th style="${thStyle};width:12%;text-align:right">Rate</th>`:''}
    ${showD?`<th style="${thStyle};width:12%;text-align:right">Disc.Price</th>`:''}
    <th style="${thStyle};width:13%;text-align:right">Total</th>
  </tr></thead>`;

  const CB='padding:5px 10px;vertical-align:top;border-right:1px solid #d8dce8;border-bottom:1px solid #d8dce8;color:#1a1d2e;font-size:.77rem';
  const CR='padding:5px 10px;vertical-align:middle;border-bottom:1px solid #d8dce8;color:#1a1d2e;font-size:.77rem;text-align:right;font-variant-numeric:tabular-nums';
  function buildRow(d,idx){
    if(d.type==='section'){
      const cols=4+(showR?1:0)+(showD?1:0);
      return`<tr><td colspan="${cols}" style="padding:6px 10px;background:#f0f2f7;font-weight:700;font-size:.74rem;letter-spacing:.04em;color:#3a3f5a;border-bottom:1px solid #d0d4e4">${esc(d.item.desc)||'— SECTION —'}</td></tr>`;
    }
    const bg=idx%2===1?'#f9fafc':'#fff';
    const rowBg=d.item.optional?'#fffdf5':bg;
    const note=d.item.note?`<div style="font-size:.67rem;color:#8a90a8;margin-top:2px">${esc(d.item.note)}</div>`:'';
    const optBadge=d.item.optional?`<span style="font-size:.58rem;background:#fef3e0;color:#d97706;padding:1px 4px;border-radius:3px;margin-left:4px;font-weight:700">Optional</span>`:'';
    return`<tr style="background:${rowBg}">
      <td style="${CB};text-align:center;vertical-align:middle">${d.sn}</td>
      <td style="${CB}">${esc(d.item.desc)||'—'}${optBadge}${note}</td>
      <td style="${CB};text-align:center;vertical-align:middle">${esc(ut)||'—'}</td>
      <td style="${CB};text-align:center;vertical-align:middle">${d.item.qty}</td>
      ${showR?`<td style="${CB};text-align:right;vertical-align:middle">${curr()} ${fmt(d.item.rate)}</td>`:''}
      ${showD?`<td style="${CB};text-align:right;vertical-align:middle">${d.eff>0?curr()+' '+fmt(d.discUnit):'—'}</td>`:''}
      <td style="${CR}">${d.item.optional?`<span style="color:#d97706">Optional</span>`:curr()+' '+fmt(d.lineTotal)}</td>
    </tr>`;
  }

  const footerHtml=`
    <div style="padding-top:12px;border-top:1px solid #eef0f8;display:flex;gap:18px;flex-wrap:wrap;margin-top:14px">
      ${SW.notes&&g('p-notes')?`<div style="flex:1;min-width:140px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Notes</div><div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${nl(g('p-notes'))}</div></div>`:''}
      ${SW.payterms&&(g('p-payterms')||g('p-bank'))?`<div style="flex:1;min-width:140px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Payment Terms</div>${g('p-payterms')?`<div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${esc(g('p-payterms'))}</div>`:''} ${g('p-bank')?`<div style="font-size:.72rem;color:#6a6f88;margin-top:3px;line-height:1.7">${nl(g('p-bank'))}</div>`:''}</div>`:''}
      <div style="flex:1;min-width:120px"><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Issued By</div><div style="font-size:.72rem;color:#6a6f88;line-height:1.7">${nl([coName,coLoc,coPhone,coEmail].filter(Boolean).join('\n'))}</div></div>
    </div>
    ${SW.sign?`<div style="display:flex;justify-content:flex-end;margin-top:16px;padding-top:12px;border-top:1px solid #eef0f8"><div style="text-align:center;width:160px"><div style="border-bottom:1px solid #1a1d2e;margin-bottom:5px;padding-bottom:24px"></div><div style="font-size:.67rem;color:#8a90a8">Authorized Signature</div></div></div>`:''}`;

  // ═══ PAGINATION ═══
  // Real A4: 1122px - 84px padding = 1038px content
  // Table header row ~30px, each data row ~34px
  // Page 1 header: ~200px (logo+header+divider+parties)
  // Continuation header: ~60px
  // Footer (totals+notes+sig): ~170px
  const PAGE_H=1038;
  const HDR1=185, HDRN=55, FOOTER_H=140, TH=28, ROW_H=30;
  let remaining=[...rowsData],isFirst=true;
  const pages=[];
  while(remaining.length>0||pages.length===0){
    const hdr=isFirst?HDR1:HDRN;
    const bodyH=PAGE_H-hdr-TH;
    // Check if remaining rows + footer fit on this page
    const rowsWithFooter=Math.floor((bodyH-FOOTER_H)/ROW_H);
    const rowsNoFooter=Math.floor(bodyH/ROW_H);
    const isLast=remaining.length<=rowsWithFooter;
    const take=isLast?Math.min(remaining.length,rowsWithFooter):Math.min(remaining.length,rowsNoFooter);
    const rowCount=Math.max(1,take);
    pages.push({rows:remaining.slice(0,rowCount),isFirst,isLast});
    remaining=remaining.slice(rowCount);
    if(isLast||remaining.length===0)break;
    isFirst=false;
  }
  if(pages.length===0)pages.push({rows:[],isFirst:true,isLast:true});
  // Mark last page
  pages[pages.length-1].isLast=true;
  const totalPages=pages.length;

  const qdoc=$('qdoc');qdoc.innerHTML='';
  pages.forEach((pg,pi)=>{
    const pageNum=pi+1;
    const div=document.createElement('div');
    div.className='dpage';
    let html='';

    if(pg.isFirst){
      if(currentTheme==='bold'){
        html+=`<div style="background:${docCol};margin:-36px -48px 18px;padding:22px 48px 18px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact">
          <div style="display:flex;align-items:center;gap:12px">${logoURL?`<img src="${logoURL}" style="max-height:40px;object-fit:contain;border-radius:3px;${logoBg?'background:#fff;padding:3px;':''}">`:''}<div><div style="font-family:Georgia,serif;font-size:1.15rem;font-weight:700;color:#fff">${esc(coName)}</div>${coLoc?`<div style="font-size:.7rem;color:rgba(255,255,255,.75);margin-top:1px">${esc(coLoc)}</div>`:''}</div></div>
          <div style="text-align:right"><div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#fff;letter-spacing:.04em">QUOTATION</div><div style="margin-top:4px">${chipHtml}</div><div style="font-size:.7rem;color:rgba(255,255,255,.8);margin-top:4px">No: ${esc(qno)} · ${dateStr}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc,coPhone,coEmail].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'),g('cl-addr'),g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      } else if(currentTheme==='minimal'){
        html+=`<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;padding-bottom:12px;border-bottom:2px solid #1a1d2e">
          <div>${logoURL?`<img src="${logoURL}" style="max-height:40px;object-fit:contain;margin-bottom:5px;display:block;${logoBg?'background:#fff;padding:3px;':''}">`:''}<div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88">${[coLoc,coPhone,coEmail].filter(Boolean).join(' · ')}</div></div>
          <div style="text-align:right"><div style="font-size:1.4rem;font-weight:800;letter-spacing:.03em;color:#0f1117">QUOTATION</div><div style="font-size:.75rem;color:#6a6f88;margin-top:3px">No: ${esc(qno)}</div><div style="font-size:.73rem;color:#6a6f88">Date: ${dateStr} · Valid: ${validStr}</div><div style="margin-top:4px">${chipHtml}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88">${nl([g('cl-person'),g('cl-addr'),g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Subject</div><div style="font-size:.76rem;color:#1a1d2e">${subj?esc(subj):'—'}</div></div>
        </div>`;
      } else if(currentTheme==='modern'){
        html+=`<div style="display:flex;margin:-36px -48px 18px;min-height:120px">
          <div style="width:52px;background:${docCol};flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
          <div style="flex:1;padding:20px 22px 16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between">
              <div>${logoURL?`<img src="${logoURL}" style="max-height:40px;object-fit:contain;margin-bottom:5px;display:block;${logoBg?'background:#fff;padding:3px;':''}">`:''}<div style="font-family:Georgia,serif;font-size:1.05rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88">${[coLoc,coPhone,coEmail].filter(Boolean).join(' · ')}</div></div>
              <div style="text-align:right"><div style="font-family:Georgia,serif;font-size:.95rem;font-weight:700;color:${docCol}">QUOTATION</div><div style="font-size:.73rem;color:#6a6f88;margin-top:3px">No: ${esc(qno)}</div><div style="font-size:.71rem;color:#6a6f88">${dateStr}</div><div style="margin-top:4px">${chipHtml}</div></div>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc,coPhone,coEmail].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'),g('cl-addr'),g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      } else {
        // Classic
        html+=`<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;flex-direction:column;gap:5px">
            ${logoHtml}
            <div><div style="font-family:Georgia,serif;font-size:1.1rem;font-weight:700;color:#0f1117;line-height:1.2">${esc(coName)}</div>${coLoc?`<div style="font-size:.71rem;color:#6a6f88;margin-top:1px">${esc(coLoc)}</div>`:''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-family:Georgia,serif;font-size:.98rem;font-weight:700;color:${docCol};letter-spacing:.02em">QUOTATION</div>
            <div style="margin-top:4px">${chipHtml}</div>
            <div style="margin-top:6px;display:flex;flex-direction:column;gap:2px;align-items:flex-end">
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Date:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${dateStr}</span></div>
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Valid Until:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${validStr}</span></div>
              <div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Quote No:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${esc(qno)}</span></div>
              ${subj?`<div style="display:flex;gap:8px"><span style="font-size:.67rem;color:#8a90a8">Subject:</span><span style="font-size:.73rem;color:#1a1d2e;font-weight:600">${esc(subj)}</span></div>`:''}
            </div>
          </div>
        </div>
        <div style="height:3px;background:${docCol};border-radius:2px;margin-bottom:14px;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;padding:10px 12px;background:#f8f9fc;border-radius:5px;border:1px solid #eef0f8">
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">From</div><div style="font-size:.84rem;font-weight:700;color:#0f1117">${esc(coName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([coLoc,coPhone,coEmail].filter(Boolean).join('\n'))}</div></div>
          <div><div style="font-size:.58rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a0a5be;margin-bottom:3px">Bill To</div><div style="font-size:.84rem;font-weight:700;color:#0f1117">${esc(clName)}</div><div style="font-size:.7rem;color:#6a6f88;margin-top:2px;line-height:1.6">${nl([g('cl-person'),g('cl-addr'),g('cl-phone')].filter(Boolean).join('\n'))}</div></div>
        </div>`;
      }
    } else {
      html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;margin-bottom:10px;border-bottom:2px solid ${docCol}">
        <div style="display:flex;align-items:center;gap:8px">${logoSmHtml}<div style="font-family:Georgia,serif;font-size:.85rem;font-weight:700">${esc(coName)}</div></div>
        <div style="text-align:right"><div style="font-size:.73rem;font-weight:700;color:${docCol}">Quote No: ${esc(qno)}</div><div style="font-size:.68rem;color:#8a90a8">Page ${pageNum} of ${totalPages}</div></div>
      </div>`;
    }

    html+=`<table style="width:100%;border-collapse:collapse;font-size:.77rem;border:1px solid #c8cce0;-webkit-print-color-adjust:exact;print-color-adjust:exact">${thHtml}<tbody>`;
    pg.rows.forEach((d,i)=>{html+=buildRow(d,i);});
    html+=`</tbody></table>`;

    if(pg.isLast){
      html+=totalsHtml;
      html+=footerHtml;
    }
    html+=`<div style="margin-top:auto;padding-top:10px;text-align:center"><span style="font-family:Montserrat,Georgia,serif;font-size:.72rem;font-weight:800;letter-spacing:.15em"><span style="color:#0041C2">Pro</span><span style="color:#B59410">Quote</span></span></div>`;

    div.innerHTML=html;
    qdoc.appendChild(div);
  });

  const pill=$('pg-pill');
  if(pill)pill.textContent=totalPages===1?'1 page':totalPages+' pages';
  if(window._scale)requestAnimationFrame(window._scale);

  // Autosave draft (debounced)
  clearTimeout(r._saveT);
  r._saveT=setTimeout(saveDraft,2000);
}

function trow(l,v,cls=''){
  const grand=cls==='grand',disc=cls==='disc-row',vat=cls==='vat-row';
  const docCol=getComputedStyle(document.documentElement).getPropertyValue('--doc').trim()||'#1e40af';
  const bg=grand?`background:${docCol};-webkit-print-color-adjust:exact;print-color-adjust:exact`:vat?'background:#f5f7ff':'';
  const lc=grand?'color:rgba(255,255,255,.82)':disc?'color:#b45309':'color:#5a5f78';
  const vc=grand?'color:#fff':disc?'color:#b45309':'color:#1a1d2e';
  const fw=grand?'font-weight:700;font-size:.82rem':'';
  return`<div style="display:grid;grid-template-columns:1fr auto;padding:5px 10px;border-bottom:1px solid #d8dce8;align-items:center;${bg};${fw}"><span style="${lc}">${l}</span><span style="${vc};text-align:right;font-weight:600;padding-left:14px;font-variant-numeric:tabular-nums">${v}</span></div>`;
}




/* ═══ WHATSAPP SHARE ═══ */
function shareWhatsApp(){
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
  const clName=g('cl-name')||'—';
  const qno=g('q-no')||'—';
  const validStr=fmtD(g('q-valid'));
  const lineItems=items.filter(x=>x.type!=='section'&&!x.optional)
    .map(it=>{
      const eff=it.useD?it.d:gd;
      const tot=round((it.qty||1)*(it.rate||0)*(1-eff/100));
      return'\u2022 '+(it.desc||'Item')+': '+curr()+' '+fmt(tot);
    }).join('\n');
  const nl='\n';
  const sep='\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';
  const msg='*QUOTATION \u2014 '+qno+'*'+nl+sep+nl+'*To:* '+clName+nl+'*Valid Until:* '+validStr+nl+nl+'*Items:*'+nl+lineItems+nl+sep+nl+'*Subtotal:* '+curr()+' '+fmt(sub)+(vp>0?nl+'*VAT ('+vp+'%):* '+curr()+' '+fmt(va):'')+(ship>0?nl+'*Shipping:* '+curr()+' '+fmt(ship):'')+nl+'*Total:* '+curr()+' '+fmt(grand)+nl+sep+nl+'_Sent via ProQuote_';
  const url='https://wa.me/?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
  toast('Opening WhatsApp…','ok');
}

/* ═══ DOWNLOAD AS PNG ═══ */
function doExportPNG(){
  const qdocEl=$('qdoc');
  if(!qdocEl||!qdocEl.children.length){toast('Add items first','err');return;}
  // Use html2canvas if available, otherwise dom-to-image fallback, else instruct
  if(typeof html2canvas!=='undefined'){
    toast('Generating image…');
    html2canvas(qdocEl,{scale:2,useCORS:true,backgroundColor:'#fff',logging:false}).then(canvas=>{
      const link=document.createElement('a');
      link.download=(g('q-no')||'quotation').replace(/[^a-z0-9_-]/gi,'_')+'.png';
      link.href=canvas.toDataURL('image/png');
      link.click();
      toast('PNG downloaded','ok');
    }).catch(e=>toast('PNG failed: '+e.message,'err'));
  } else {
    // Dynamically load html2canvas
    toast('Loading image engine…');
    const sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    sc.onload=()=>doExportPNG();
    sc.onerror=()=>toast('PNG requires internet connection','err');
    document.head.appendChild(sc);
  }
}

/* ═══ ITEM TEMPLATES ═══ */
const ITEM_TEMPLATES={
  'design':[
    {desc:'Logo Design',qty:1,rate:15000,note:'3 concepts, 2 revision rounds'},
    {desc:'Brand Identity Package',qty:1,rate:35000,note:'Logo, colors, typography, guidelines'},
    {desc:'Business Card Design',qty:1,rate:3500,note:'Front & back, print-ready'},
    {desc:'Social Media Kit',qty:1,rate:8000,note:'Profile, cover, 5 post templates'},
  ],
  'web':[
    {desc:'Website Design (UI/UX)',qty:1,rate:25000,note:'Up to 5 pages, responsive'},
    {desc:'Website Development',qty:1,rate:40000,note:'HTML/CSS/JS, responsive'},
    {desc:'WordPress Setup',qty:1,rate:18000,note:'Theme customization, plugins'},
    {desc:'Domain & Hosting Setup',qty:1,rate:5000,note:'1 year domain + hosting config'},
  ],
  'photo':[
    {desc:'Product Photography',qty:1,rate:12000,note:'Up to 20 products, edited'},
    {desc:'Corporate Headshots',qty:1,rate:8000,note:'Up to 5 people, edited'},
    {desc:'Event Coverage (half day)',qty:1,rate:15000,note:'4 hours, 100+ edited photos'},
  ],
  'print':[
    {desc:'Flyer Design (A5)',qty:1,rate:4500,note:'Both sides, print-ready'},
    {desc:'Brochure Design (tri-fold)',qty:1,rate:8000,note:'Print-ready, 300dpi'},
    {desc:'Banner Design',qty:1,rate:5000,note:'Any size, print-ready file'},
    {desc:'Printing (A4, 100 copies)',qty:100,rate:15,note:'Full color, glossy'},
  ],
  'it':[
    {desc:'IT Support (hourly)',qty:1,rate:2500,note:'On-site or remote'},
    {desc:'Network Setup',qty:1,rate:12000,note:'Router, switches, config'},
    {desc:'Computer Repair',qty:1,rate:3500,note:'Diagnosis + fix included'},
  ],
};

function openTemplatesModal(){
  const modal=$('ov-templates');
  if(modal)modal.classList.add('open');
}
function closeTemplatesModal(){
  const modal=$('ov-templates');
  if(modal)modal.classList.remove('open');
}
function insertTemplate(cat){
  const tmpl=ITEM_TEMPLATES[cat];
  if(!tmpl)return;
  pushUndo();
  // Add section header for the category
  const labels={'design':'Design','web':'Web / Dev','photo':'Photography','print':'Print & Media','it':'IT Services'};
  items.push({id:uid(),type:'section',desc:labels[cat]||cat});
  tmpl.forEach(t=>{
    items.push({id:uid(),type:'item',desc:t.desc,qty:t.qty,rate:t.rate,d:0,useD:false,sel:false,optional:false,note:t.note||''});
  });
  buildItems();r();
  closeTemplatesModal();
  toast(tmpl.length+' items added from template','ok');
}
function insertSingleTemplate(cat,idx){
  const t=ITEM_TEMPLATES[cat]&&ITEM_TEMPLATES[cat][idx];
  if(!t)return;
  pushUndo();
  items.push({id:uid(),type:'item',desc:t.desc,qty:t.qty,rate:t.rate,d:0,useD:false,sel:false,optional:false,note:t.note||''});
  buildItems();r();
  toast('Added: '+t.desc,'ok');
}

