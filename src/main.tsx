import {Buffer} from 'buffer';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// The Shelby SDK's browser build still reaches for Node globals — Buffer, and `process.env`
// while reading its erasure-coding defaults. Bundlers like Next supply these automatically;
// Vite does not, and without them importing the SDK throws "Buffer is not defined" and then
// "process is not defined".
if (!(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
if (!(globalThis as any).process) {
  (globalThis as any).process = { env: {}, platform: 'browser', version: '' };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
