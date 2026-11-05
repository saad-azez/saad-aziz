import { Component } from 'react';
import HeroRoute from '../routes/HeroRoute.jsx';

/**
 * If the site cannot start at all (a device with no WebGL, for one), say so, and
 * let go of the loader and the scroll, instead of leaving a blank locked page.
 */
class SiteBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    const { loader } = this.props;
    loader.onFinish(() => document.documentElement.classList.remove('is-loading'));
    loader.ready();
  }

  render() {
    if (this.state.failed) {
      return <p className="load-failed">This site is built in 3D, and this browser could not start it. Please try a newer browser or another device.</p>;
    }
    return this.props.children;
  }
}

export default function App({ loader }) {
  return (
    <SiteBoundary loader={loader}>
      <HeroRoute loader={loader} />
    </SiteBoundary>
  );
}
