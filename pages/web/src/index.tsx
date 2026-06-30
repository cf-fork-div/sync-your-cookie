import '@src/index.css';
import App from '@src/App';
import { I18nProvider } from '@sync-your-cookie/shared';
import '@sync-your-cookie/ui/css';
import { createRoot } from 'react-dom/client';

const appContainer = document.querySelector('#app-container');
if (!appContainer) {
  throw new Error('Can not find #app-container');
}

createRoot(appContainer).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
