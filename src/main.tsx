import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/global.css';
import { watchPageZoom } from './app/pageZoom';

// Приближенная браузером страница отдаёт щипок по карте браузеру — чтобы её можно было отдалить (#252).
watchPageZoom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
