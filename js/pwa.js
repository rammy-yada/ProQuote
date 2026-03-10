// ═══════════════════════════════════
// pwa.js — Install Banner, Menu, PWA Service Worker
// ═══════════════════════════════════
/* ═══ INSTALL BANNER ═══ */
function dismissInstallBanner(){
  ['install-banner','ios-banner'].forEach(id=>{
    const b=$(id);
    if(b&&b.style.display!=='none'){
      b.style.animation='slideUp .25s ease forwards';
      setTimeout(()=>{b.style.display='none';},240);
    }
  });
  try{localStorage.setItem('pq_banner_dismissed','1');}catch(e){}
}
function maybeShowBanner(){
  try{if(localStorage.getItem('pq_banner_dismissed'))return;}catch(e){return;}
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(isStandalone)return; // already installed
  const ua=navigator.userAgent;
  const isIOS=/iPhone|iPad|iPod/i.test(ua);
  const isAndroid=/Android/i.test(ua);
  if(isIOS){
    // iOS: always show step-by-step Safari instructions
    const b=$('ios-banner');
    if(b){b.style.display='flex';b.style.animation='slideDown .3s ease';}
  } else if(isAndroid){
    // Android: show only if beforeinstallprompt has fired (prompt available)
    // We show it immediately; if prompt not available the Install btn still educates
    const b=$('install-banner');
    if(b){b.style.display='flex';b.style.animation='slideDown .3s ease';}
  }
}


/* ═══ OVERFLOW MENU ═══ */
function toggleMenu(){
  const m=$('overflow-menu');
  if(!m)return;
  const open=m.style.display==='block';
  m.style.display=open?'none':'block';
  if(!open){
    // close on outside click
    setTimeout(()=>{
      document.addEventListener('click',function h(e){
        if(!$('menu-wrap').contains(e.target)){m.style.display='none';}
        document.removeEventListener('click',h);
      });
    },0);
  }
}
function closeMenu(){
  const m=$('overflow-menu');if(m)m.style.display='none';
}


/* ═══ PWA SETUP ═══ */
(function(){
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
      {src: icons192, sizes: "192x192", type: "image/png", purpose: "any maskable"},
      {src: icons512, sizes: "512x512", type: "image/png", purpose: "any maskable"}
    ]
  };
  const mBlob = new Blob([JSON.stringify(manifest)], {type:'application/manifest+json'});
  const mURL = URL.createObjectURL(mBlob);
  document.getElementById('pwa-manifest').href = mURL;

  // Service worker for offline use
  if('serviceWorker' in navigator){
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
    const swBlob = new Blob([swCode], {type:'text/javascript'});
    const swURL = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swURL, {scope:'./'})
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
    if(btn) btn.style.display = 'flex';
    const mbtn = document.getElementById('menu-install-btn');
    if(mbtn) mbtn.style.display = 'flex';
  });
  window.addEventListener('appinstalled', () => {
    const btn = document.getElementById('install-btn');
    if(btn) btn.style.display = 'none';
    const mbtn = document.getElementById('menu-install-btn');
    if(mbtn) mbtn.style.display = 'none';
    toast('ProQuote installed! ✓', 'ok');
  });
  window._installPWA = function(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(()=>{ deferredPrompt=null; });
    }
  };
})();
