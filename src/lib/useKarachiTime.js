import { useEffect, useState } from 'react';

/**
 * Karachi, ticking.
 *
 * The one live thing in the hero. It is here because it is true — there is a
 * person, in a place, and it is that time there right now — which is the only
 * reason to put a number on a page. A clock that is wrong, or a date that was
 * invented to look specific, is worse than no clock at all.
 */

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function useKarachiTime() {
  const [time, setTime] = useState(() => FORMAT.format(new Date()));

  useEffect(() => {
    // Ticked every fifteen seconds: the display is minute-resolution, so a
    // per-second interval would be four hundred wakeups an hour to change
    // nothing.
    const id = window.setInterval(() => setTime(FORMAT.format(new Date())), 15000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}
