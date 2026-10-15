import { chromium } from 'playwright-core';
const [url, w='390', h='844'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--disable-webgl','--disable-3d-apis'] });
const ctx = await b.newContext({ viewport:{width:+w,height:+h}, isMobile:true, hasTouch:true });
await ctx.addInitScript(() => { try { localStorage.setItem('bg-adult','1'); } catch(e){} });
const p = await ctx.newPage(); await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const r = await p.evaluate((W) => {
  const out=[]; const inFixed=el=>{for(let e=el;e;e=e.parentElement){const cs=getComputedStyle(e); if(cs.position==='fixed') return true;} return false;};
  const clipped=el=>{for(let e=el.parentElement;e&&e!==document.body;e=e.parentElement){const cs=getComputedStyle(e); if(/(auto|scroll|hidden|clip)/.test(cs.overflowX)) return true;} return false;};
  document.querySelectorAll('body *').forEach(el=>{ const r=el.getBoundingClientRect(); if(r.right>W+1 && r.width>0 && !inFixed(el) && !clipped(el)) out.push(el.tagName+'#'+el.id+'.'+String(el.className).slice(0,40)+' right='+Math.round(r.right)+' w='+Math.round(r.width)); });
  return {sw:document.documentElement.scrollWidth, list:out.slice(0,25)};
}, +w);
console.log(JSON.stringify(r,null,1)); await b.close();
