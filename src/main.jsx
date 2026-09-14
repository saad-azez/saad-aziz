import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { startSchemeClock } from './brand/scheme.js';
import './styles/global.css';

// Day or night, by the clock at home (Islamabad) — set before the first paint.
startSchemeClock();

createRoot(document.getElementById('root')).render(<App />);
