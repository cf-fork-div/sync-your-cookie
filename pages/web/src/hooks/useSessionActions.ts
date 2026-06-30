import { saveCookiesMap, serializeCookiesMap, type ViewerSession } from '@src/lib/cookies';
import {
  editCookie,
  editLocalStorageItem,
  removeCookie,
  removeDomain,
  removeLocalStorageItem,
} from '@src/lib/mutations';
import type { ICookie, ICookiesMap } from '@sync-your-cookie/protobuf';
import { useI18n } from '@sync-your-cookie/shared';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

type UseSessionActionsOptions = {
  session: ViewerSession;
  onSessionChange: (session: ViewerSession) => void;
};

export function useSessionActions({ session, onSessionChange }: UseSessionActionsOptions) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);

  const persist = useCallback(
    async (nextMap: ICookiesMap) => {
      if (!session.canWrite) {
        onSessionChange({ ...session, cookieMap: nextMap });
        toast.success(t('updatedLocally'));
        return;
      }

      setSaving(true);
      try {
        await saveCookiesMap(session, nextMap);
        onSessionChange({ ...session, cookieMap: nextMap });
        toast.success(t('savedToCloud'));
      } catch (error) {
        const message = error instanceof Error ? error.message : t('saveFailed');
        toast.error(message);
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [onSessionChange, session, t],
  );

  const exportToClipboard = useCallback(async () => {
    try {
      const content = await serializeCookiesMap(session.cookieMap, session.format);
      await navigator.clipboard.writeText(content);
      toast.success(t('copiedUpdatedContent'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('exportFailed');
      toast.error(message);
    }
  }, [session, t]);

  const handleEditCookie = useCallback(
    async (domain: string, oldItem: ICookie, newItem: ICookie) => {
      const nextMap = editCookie(session.cookieMap, domain, oldItem, newItem);
      await persist(nextMap);
    },
    [persist, session.cookieMap],
  );

  const handleDeleteCookie = useCallback(
    async (domain: string, cookie: ICookie) => {
      const nextMap = removeCookie(session.cookieMap, domain, cookie);
      await persist(nextMap);
    },
    [persist, session.cookieMap],
  );

  const handleEditLocalStorage = useCallback(
    async (domain: string, key: string, value: string) => {
      const nextMap = editLocalStorageItem(session.cookieMap, domain, key, value);
      await persist(nextMap);
    },
    [persist, session.cookieMap],
  );

  const handleDeleteLocalStorage = useCallback(
    async (domain: string, key: string) => {
      const nextMap = removeLocalStorageItem(session.cookieMap, domain, key);
      await persist(nextMap);
    },
    [persist, session.cookieMap],
  );

  const handleDeleteDomain = useCallback(
    async (domain: string) => {
      const nextMap = removeDomain(session.cookieMap, domain);
      await persist(nextMap);
    },
    [persist, session.cookieMap],
  );

  return {
    saving,
    exportToClipboard,
    handleEditCookie,
    handleDeleteCookie,
    handleEditLocalStorage,
    handleDeleteLocalStorage,
    handleDeleteDomain,
  };
}
