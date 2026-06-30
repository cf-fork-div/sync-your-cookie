import Popup from '@src/Popup';
import '@src/index.css';
import { I18nProvider, ThemeProvider } from '@sync-your-cookie/shared';
import '@sync-your-cookie/ui/css';
import { createRoot } from 'react-dom/client';

function init() {
  const appContainer = document.querySelector('#app-container');
  if (!appContainer) {
    throw new Error('Can not find #app-container');
  }
  const root = createRoot(appContainer);

  root.render(
    <I18nProvider>
      <ThemeProvider>
        <Popup />
      </ThemeProvider>
    </I18nProvider>,
  );
}
init();
