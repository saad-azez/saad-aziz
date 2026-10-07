// Which projects may run live on a card: a site can only be shown in a frame
// on another site if it allows it. X-Frame-Options (DENY / SAMEORIGIN) or a
// Content-Security-Policy frame-ancestors list without this site's address
// stops it, and the browser shows its own "refused to connect" page instead.
//
//   npm run check:frames                          checks every project's href
//   npm run check:frames -- https://your.site     also says whether that address is allowed
//
// A blocked site stays a scrollable picture. To make it live, its owner allows
// the portfolio's address, e.g. `Content-Security-Policy: frame-ancestors 'self'
// https://your.site` (and removes X-Frame-Options); then set `live: true` on
// the project in src/content/site.js.
import { WORK } from '../src/content/site.js';

const portfolio = process.argv[2] ? new URL(process.argv[2]) : null;

/** Whether a frame-ancestors source list lets `origin` frame the page ('unknown' when no portfolio address is given). */
function ancestorsAllow(list, origin) {
  const sources = list.trim().split(/\s+/);
  if (sources.includes("'none'")) return false;
  if (!origin) return 'unknown';
  return sources.some(source => {
    if (source === '*') return true;
    const match = source.match(/^(?:(https?):\/\/)?(\*\.)?([^/:]+)/i);
    if (!match || source.startsWith("'")) return false;
    const [, scheme, wildcard, host] = match;
    if (scheme && scheme !== origin.protocol.slice(0, -1) && !(scheme === 'http' && origin.protocol === 'https:')) return false;
    return wildcard ? origin.hostname.endsWith(`.${host}`) : origin.hostname === host;
  });
}

for (const project of WORK.projects.filter(p => p.embed || p.href)) {
  let verdict;
  try {
    const response = await fetch(project.embed || project.href, { redirect: 'follow' });
    const frameOptions = response.headers.get('x-frame-options');
    const ancestors = (response.headers.get('content-security-policy') ?? '')
      .split(';').map(d => d.trim()).find(d => d.toLowerCase().startsWith('frame-ancestors'));
    if (frameOptions && /deny|sameorigin/i.test(frameOptions)) verdict = `blocked (X-Frame-Options: ${frameOptions})`;
    else if (ancestors) {
      const allowed = ancestorsAllow(ancestors.slice('frame-ancestors'.length), portfolio);
      verdict = allowed === true ? 'allowed' : allowed === false ? `blocked (${ancestors})` : `only for: ${ancestors.slice(16)}`;
    } else verdict = 'allowed';
  } catch (error) {
    verdict = `unreachable (${error.message})`;
  }
  const mark = verdict.startsWith('allowed') ? '✓' : '✗';
  const flag = project.live ? 'live' : '    ';
  console.log(`${mark} ${flag}  ${project.id.padEnd(18)} ${verdict}`);
}
