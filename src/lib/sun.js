/**
 * Where the sun is, over Islamabad and Rawalpindi.
 *
 * The page's day and night follow the sun in the place the work is made, not
 * the reader's device. This is the standard sunrise equation (the one on the
 * back of every almanac), good to a couple of minutes — plenty for deciding
 * whether it is day, and how far through the day or the night it is.
 */

const DAY = 86400000;
const rad = Math.PI / 180;

/** The place. Change this and the whole site's day moves with it. */
export const PLACE = { lat: 33.6844, lon: 73.0479 };

/** Julian day → epoch ms. */
const toMs = j => (j - 2440587.5) * DAY;

/** Sunrise and sunset (epoch ms) for the day `index` days after J2000. */
function sunTimes(index, { lat, lon }) {
  const n = index + 0.0008;
  const Js = n - lon / 360;                                          // mean solar noon
  const M = (((357.5291 + 0.98560028 * Js) % 360) + 360) % 360;      // solar mean anomaly
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;                          // ecliptic longitude
  const transit = 2451545 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const decl = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  const w = Math.acos(Math.max(-1, Math.min(1, cosW))) / rad;        // half the day, in degrees
  return { rise: toMs(transit - w / 360), set: toMs(transit + w / 360) };
}

/**
 * Day or night at `now`, and how far along: `progress` runs 0 → 1 from
 * sunrise to sunset by day, and from sunset to the next sunrise by night.
 */
export function sunState(now = Date.now(), place = PLACE) {
  const index = Math.round(now / DAY + 2440587.5 - 2451545);
  const days = [index - 1, index, index + 1].map(i => sunTimes(i, place));
  const today = days.find(d => now >= d.rise && now < d.set);
  if (today) return { night: false, progress: (now - today.rise) / (today.set - today.rise), rise: today.rise, set: today.set };
  const set = Math.max(...days.map(d => d.set).filter(t => t <= now));
  const rise = Math.min(...days.map(d => d.rise).filter(t => t > now));
  return { night: true, progress: (now - set) / (rise - set), rise, set };
}
