import { useI18n } from './useI18n';

export function LoadingFallback() {
  const { t } = useI18n();
  return <div>{t('loading')}</div>;
}

export function ErrorFallback() {
  const { t } = useI18n();
  return <div>{t('errorOccur')}</div>;
}
