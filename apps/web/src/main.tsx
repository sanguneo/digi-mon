import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import './styles.css';
import './worksheet-layout.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) {
  throw new Error('root element가 없다');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
