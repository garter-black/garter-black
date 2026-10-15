// usage: node tools/shot.mjs <url> <out.png> [w] [h] [full] [cookieName=value]
import { chromium } from 'playwright-core';
const [url, out, w = '1440', h = '900', full = '0', cookie] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--disable-webgl','--disable-3d-apis'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 600, hasTouch: +w < 600 });
if (cookie) { const [n, v] = cookie.split('='); const u = new URL(url); await ctx.addCookies([{ name: n, value: v, domain: u.hostname, path: '/' }]); }
await ctx.addInitScript(() => { try { localStorage.setItem('bg-adult', '1'); } catch (e) {} });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('requestfailed', r => { if (!/fonts.gstatic|analytics|convai/.test(r.url())) errs.push('REQFAIL ' + r.url() + ' ' + (r.failure() || {}).errorText); });
page.on('response', r => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errs.push('GOTO ' + e.message));
await page.waitForTimeout(2500);
if (+full) { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); document.querySelectorAll('.rv').forEach(e => e.classList.add('in')); }); await page.waitForTimeout(800); }
await page.screenshot({ path: out, fullPage: !!+full });
console.log(JSON.stringify({ out, errs: errs.slice(0, 15) }));
await browser.close();
