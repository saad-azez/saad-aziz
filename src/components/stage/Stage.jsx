import { useLayoutEffect, useRef } from 'react';
import { stage } from '../../webgl/stage/DotStage.js';
import './Stage.css';

/**
 * The stage's canvas: fixed over the whole page, transparent, never in the
 * way of the pointer. What it draws (the coin on its way into the work, and
 * the rope as the scrollbar) is in webgl/stage/DotStage.js. `html.has-stage`
 * tells the stylesheet the stage is up.
 */
export default function Stage() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const up = stage.mount(ref.current);
    document.documentElement.classList.toggle('has-stage', up);
    return () => {
      stage.unmount();
      document.documentElement.classList.remove('has-stage');
    };
  }, []);
  return <canvas className="stage" ref={ref} aria-hidden="true" />;
}
