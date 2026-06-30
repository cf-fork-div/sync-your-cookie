import { useEffect } from 'react';
import type { MessageKey } from './messages';
import { useI18n } from './useI18n';

export function useDocumentTitle(titleKey: MessageKey) {
  const { t } = useI18n();

  useEffect(() => {
    document.title = t(titleKey);
  }, [t, titleKey]);
}
