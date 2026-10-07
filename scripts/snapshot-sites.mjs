// Demo copies of the sites that do not allow framing.
//
// A site that sends X-Frame-Options or frame-ancestors cannot run inside a
// card on another site. A copy of its page, served from a host we control, can:
// only the HTML is copied — a <base> points every image, script, font and 3D
// scene back at the site's own servers, so the copy runs the real, current
// code and costs the demo host a few kilobytes a view.
//
//   npm run snapshot                  every project with an `embed` (src/content/site.js)
//   npm run snapshot -- <id> [<id>]   just those
//   npm run demos                     serves each copy at http://<id>.localhost:5300 for development
//
// Each copy is marked noindex with a canonical link to the original (so it
// never competes with the client in search), has the client's analytics taken
// out (so demo views never count as their visitors), and opens links to other
// pages in a new tab, on the real site.
//
// Publishing: each copy should be the root of its own domain, never under the
// portfolio's: its address is then the one it was written for, and the browser
// runs it in its own process, so it never shares a thread with the portfolio.
// demos/<id>/ is a static site: give each its own subdomain (e.g.
// <id>.demos.your.site) or its own Pages project, set PORTFOLIO=https://your.site
// when snapshotting so only the portfolio may frame the copies, and build the
// portfolio with VITE_DEMOS_URL=https://{id}.demos.your.site/. Tell the clients
// first: it is their site.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WORK } from '../src/content/site.js';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'demos');
const PORTFOLIO = process.env.PORTFOLIO ?? '';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** Analytics and trackers: taken out so demo views are never counted as the client's visitors. */
const TRACKERS = /googletagmanager|google-analytics|gtag\(|\bga\(|fbq\(|connect\.facebook\.net|hotjar|clarity\.ms|\bclarity\(|hs-scripts|hs-analytics|js\.hsforms|plausible|cdn\.segment|posthog|analytics\.tiktok|snap\.licdn|_linkedin_partner|px\.ads|bat\.bing|mouseflow|fullstory|heap-|mixpanel|vercel-insights|\/_vercel\/insights|speed-insights/i;

const escape = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The copy's own head: it runs before anything of the site's. */
function head(url) {
  const here = url.pathname + url.search;
  return [
    // On a card the site is shown at about a third of its size: its canvases
    // (WebGL, Spline, Unicorn Studio) need no more than one pixel per CSS pixel,
    // a quarter of what a retina screen would make them draw.
    `<script>try{if(window.top!==window){var r=Math.min(window.devicePixelRatio||1,1);Object.defineProperty(window,'devicePixelRatio',{get:function(){return r},configurable:true})}}catch(e){}</script>`,
    // The site's scripts see the path they were written for (a router reads it),
    // on this host; set before <base>, which would resolve it against the original.
    // A router that writes the address resolves it against <base>, i.e. the
    // original's domain, which a copy may not write: it is kept on this host.
    `<script>(function(){var o=${JSON.stringify(url.origin)},h=history;['pushState','replaceState'].forEach(function(m){var f=h[m];h[m]=function(s,t,u){if(u!=null){try{var x=new URL(u,document.baseURI);if(x.origin===o)u=location.origin+x.pathname+x.search+x.hash}catch(e){}}return f.call(h,s,t,u)}});try{h.replaceState(h.state,'',location.origin+${JSON.stringify(here)}+location.hash)}catch(e){}})();</script>`,
    `<base href="${escape(url.href)}">`,
    `<meta name="robots" content="noindex, nofollow">`,
    `<link rel="canonical" href="${escape(url.href)}">`,
  ].join('');
}

/** Links to other pages open the real site, in a new tab; links within the page still scroll it. */
const LINKS = `<script>(function(){var page=${'PAGE'};document.addEventListener('click',function(e){
if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');
if(!h||h.charAt(0)==='#'||/^(javascript|mailto|tel):/i.test(h))return;
var u;try{u=new URL(a.href)}catch(x){return}
if(u.origin+u.pathname+u.search===page&&u.hash)return;
e.preventDefault();window.open(u.href,'_blank','noopener');},true);})();</script>`;

function transform(html, url) {
  let out = html;
  // Trackers, whether a tag with a src or an inline snippet, and GTM's noscript frame.
  // Only a tracker's own tag or a short snippet goes: a framework's inline page data may mention one and must stay.
  out = out.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attributes, body) => {
    const src = attributes.match(/\bsrc=["']?([^"'\s>]+)/i)?.[1];
    if (src) return TRACKERS.test(src) ? '' : tag;
    return body.length < 6000 && TRACKERS.test(body) && !/__next_f|__NEXT_DATA__|__NUXT__/.test(body) ? '' : tag;
  });
  out = out.replace(/<noscript>\s*<iframe[^>]*googletagmanager[\s\S]*?<\/noscript>/gi, '');
  out = out.replace(/<link\b[^>]*rel=["']?(?:preconnect|dns-prefetch)["']?[^>]*(?:googletagmanager|google-analytics|clarity)[^>]*>/gi, '');
  // Its own canonical and robots rules give way to the copy's.
  out = out.replace(/<link\b[^>]*rel=["']?canonical["']?[^>]*>/gi, '');
  out = out.replace(/<meta\b[^>]*name=["']?robots["']?[^>]*>/gi, '');
  const hasBase = /<base\b[^>]*href=/i.test(out);
  let ours = head(url);
  if (hasBase) ours = ours.replace(/<base [^>]*>/, '');
  out = /<head\b[^>]*>/i.test(out) ? out.replace(/<head\b[^>]*>/i, m => m + ours) : ours + out;
  const links = LINKS.replace('PAGE', JSON.stringify(url.origin + url.pathname + url.search));
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>(?![\s\S]*<\/body>)/i, links + '</body>') : out + links;
  return out;
}

const ids = process.argv.slice(2);
const projects = WORK.projects.filter(p => p.embed && p.href && (!ids.length || ids.includes(p.id)));
if (!projects.length) throw new Error(ids.length ? `no project with an embed among: ${ids.join(', ')}` : 'no project in site.js has an embed');

mkdirSync(OUT, { recursive: true });
const done = [];
for (const project of projects) {
  try {
    const response = await fetch(project.href, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html' } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const url = new URL(response.url);
    const html = transform(await response.text(), url);
    mkdirSync(join(OUT, project.id), { recursive: true });
    writeFileSync(join(OUT, project.id, 'index.html'), html);
    done.push(project);
    console.log(`copied  ${project.id.padEnd(18)} ${url.href}  (${Math.round(html.length / 1024)} KB)`);
  } catch (error) {
    console.warn(`failed  ${project.id.padEnd(18)} ${error.message}`);
  }
}

// The host's rules (Cloudflare Pages and Netlify read _headers): never indexed,
// framed only by the portfolio (and the dev server).
const ancestors = ["'self'", 'http://localhost:5173', 'http://localhost:4173', PORTFOLIO].filter(Boolean).join(' ');
writeFileSync(join(OUT, '_headers'), `/*\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: frame-ancestors ${ancestors}\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
writeFileSync(join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Portfolio demos</title>
<p>Demo copies of client sites, shown in a portfolio. The originals:</p><ul>${WORK.projects.filter(p => p.embed && p.href).map(p => `<li><a href="${escape(p.href)}">${escape(p.title)}</a></li>`).join('')}</ul>\n`);
if (!PORTFOLIO) console.log('\nNote: set PORTFOLIO=https://your.site before publishing, so only the portfolio may frame the copies.');
