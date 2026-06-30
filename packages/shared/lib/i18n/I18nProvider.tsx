import { useStorageSuspense } from '@lib/hooks/useStorageSuspense';
import {
  localeStorage,
  resolveLocale,
  type LocalePreference,
  type ResolvedLocale,
} from '@sync-your-cookie/storage/lib/localeStorage';
import { createContext, useEffect, useMemo, useState } from 'react';
import type { MessageKey, MessageParams } from './messages';
import { translate } from './translate';

type I18nContextValue = {
  locale: ResolvedLocale;
  localePreference: LocalePreference;
  setLocale: (locale: LocalePreference) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
};

const initialState: I18nContextValue = {
  locale: 'en',
  localePreference: 'system',
  setLocale: () => null,
  t: (key: MessageKey) => key,
};

export const I18nContext = createContext<I18nContextValue>(initialState);

type I18nProviderProps = {
  children: React.ReactNode;
};

function useWebLocalePreference(): [LocalePreference, (locale: LocalePreference) => void] {
  const storageKey = 'locale-storage-key';
  const [preference, setPreferenceState] = useState<LocalePreference>(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'en' || stored === 'zh_CN' || stored === 'system') {
      return stored;
    }
    return 'system';
  });

  const setPreference = (locale: LocalePreference) => {
    localStorage.setItem(storageKey, locale);
    setPreferenceState(locale);
  };

  return [preference, setPreference];
}

function ExtensionI18nProvider({ children }: I18nProviderProps) {
  const localePreference = useStorageSuspense(localeStorage);
  const locale = resolveLocale(localePreference);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      localePreference,
      setLocale: (next: LocalePreference) => {
        localeStorage.setLocale(next);
      },
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
    }),
    [locale, localePreference],
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'zh_CN' ? 'zh-CN' : 'en';
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function WebI18nProvider({ children }: I18nProviderProps) {
  const [localePreference, setLocalePreference] = useWebLocalePreference();
  const locale = resolveLocale(localePreference);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      localePreference,
      setLocale: setLocalePreference,
      t: (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
    }),
    [locale, localePreference, setLocalePreference],
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'zh_CN' ? 'zh-CN' : 'en';
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;

  if (isExtension) {
    return <ExtensionI18nProvider>{children}</ExtensionI18nProvider>;
  }

  return <WebI18nProvider>{children}</WebI18nProvider>;
}
