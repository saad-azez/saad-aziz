import { LoaderScene } from './LoaderScene.js';

/**
 * The loader's own thread. Everything the page does to get ready happens on the
 * main thread; none of it can hold up a frame here.
 */
let scene = null;

self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    try {
      scene = new LoaderScene(data.canvas, message => self.postMessage(message), data.options);
      scene.start();
    } catch {
      self.postMessage({ type: 'failed' });
    }
  } else if (scene) {
    if (data.type === 'progress') scene.setProgress(data.value);
    else if (data.type === 'ready') scene.setReady();
    else if (data.type === 'resize') scene.resize(data.size);
  }
};
