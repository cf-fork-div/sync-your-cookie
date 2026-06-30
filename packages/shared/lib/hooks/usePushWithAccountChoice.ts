import { createEntryKey } from '../domain/entryKey';
import { collectFolderOptionsFromDomainConfig, formatAccountOptionSubtitle } from '../domain/domainEntries';
import { listHostEntryOptions } from '../domain/hostEntries';
import { evaluatePushConflict, type PushConflictResult } from '../domain/pushConflict';
import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import type { CookieEntryType } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { useStorageSuspense } from './useStorageSuspense';

export type PushAccountDialogState = Extract<PushConflictResult, { needsDialog: true }> & {
  sourceUrl?: string;
  favIconUrl?: string;
};

type UsePushWithAccountChoiceOptions = {
  cookieMap: ICookiesMap | null | undefined;
  defaultNewLabel: string;
  onPush: (storageKey: string, sourceUrl?: string, favIconUrl?: string) => Promise<void>;
  onEntrySelected?: (host: string, storageKey: string) => void;
};

export const usePushWithAccountChoice = ({
  cookieMap,
  defaultNewLabel,
  onPush,
  onEntrySelected,
}: UsePushWithAccountChoiceOptions) => {
  const { t } = useI18n();
  const domainConfig = useStorageSuspense(domainConfigStorage);
  const [dialog, setDialog] = useState<PushAccountDialogState | null>(null);
  const [overwriteKey, setOverwriteKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [newType, setNewType] = useState<CookieEntryType | ''>('');
  const [step, setStep] = useState<'choose' | 'newLabel'>('choose');
  const [saving, setSaving] = useState(false);

  const folderOptions = useMemo(() => collectFolderOptionsFromDomainConfig(domainConfig), [domainConfig]);

  const overwriteOptionsWithMeta = useMemo(() => {
    if (!dialog?.overwriteOptions.length) {
      return [];
    }
    return dialog.overwriteOptions.map(entry => ({
      storageKey: entry.storageKey,
      label: entry.label,
      folder: entry.folder,
      type: entry.type,
      subtitle: formatAccountOptionSubtitle(entry, t),
    }));
  }, [dialog?.overwriteOptions, t]);

  const resetNewEntryFields = useCallback(() => {
    setNewLabel('');
    setNewFolder('');
    setNewType('');
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setStep('choose');
    setSaving(false);
    resetNewEntryFields();
  }, [resetNewEntryFields]);

  const requestPush = useCallback(
    async (params: {
      host: string;
      selectedStorageKey: string;
      sourceUrl?: string;
      favIconUrl?: string;
    }) => {
      const entryOptions = listHostEntryOptions(params.host, domainConfig, cookieMap, defaultNewLabel);
      const result = await evaluatePushConflict({
        host: params.host,
        sourceUrl: params.sourceUrl,
        cookieMap,
        entryOptions,
        selectedStorageKey: params.selectedStorageKey,
        defaultNewLabel,
        domainConfig,
      });

      if (!result.needsDialog) {
        await onPush(result.targetKey, params.sourceUrl, params.favIconUrl);
        onEntrySelected?.(params.host, result.targetKey);
        return;
      }

      setOverwriteKey(result.defaultOverwriteKey);
      setNewLabel(result.suggestedNewLabel);
      setNewFolder('');
      setNewType('');
      setStep(result.mode === 'firstPush' ? 'newLabel' : 'choose');
      setDialog({
        ...result,
        sourceUrl: params.sourceUrl,
        favIconUrl: params.favIconUrl,
      });
    },
    [cookieMap, defaultNewLabel, domainConfig, onEntrySelected, onPush],
  );

  const confirmOverwrite = useCallback(async () => {
    if (!dialog) {
      return;
    }
    setSaving(true);
    try {
      await domainConfigStorage.setLastSelectedEntry(dialog.host, overwriteKey);
      await onPush(overwriteKey, dialog.sourceUrl, dialog.favIconUrl);
      onEntrySelected?.(dialog.host, overwriteKey);
      closeDialog();
    } finally {
      setSaving(false);
    }
  }, [closeDialog, dialog, onEntrySelected, onPush, overwriteKey]);

  const confirmSaveNew = useCallback(async () => {
    if (!dialog) {
      return;
    }
    const label = newLabel.trim();
    if (dialog.mode === 'firstPush' && !label) {
      return;
    }
    setSaving(true);
    try {
      const entryKey =
        dialog.mode === 'firstPush' ? dialog.defaultOverwriteKey : createEntryKey(dialog.host);
      const resolvedLabel = label || dialog.suggestedNewLabel;
      const folder = newFolder.trim();
      if (folder) {
        await domainConfigStorage.ensureFolder(folder);
      }
      await domainConfigStorage.updateItem(entryKey, {
        label: resolvedLabel,
        ...(folder ? { folder } : {}),
        ...(newType ? { type: newType } : {}),
        sourceUrl: dialog.sourceUrl,
        favIconUrl: dialog.favIconUrl,
      });
      await domainConfigStorage.setLastSelectedEntry(dialog.host, entryKey);
      await onPush(entryKey, dialog.sourceUrl, dialog.favIconUrl);
      onEntrySelected?.(dialog.host, entryKey);
      closeDialog();
    } finally {
      setSaving(false);
    }
  }, [closeDialog, dialog, newFolder, newLabel, newType, onEntrySelected, onPush]);

  return {
    dialog,
    step,
    setStep,
    overwriteKey,
    setOverwriteKey,
    newLabel,
    setNewLabel,
    newFolder,
    setNewFolder,
    newType,
    setNewType,
    folderOptions,
    overwriteOptionsWithMeta,
    saving,
    requestPush,
    confirmOverwrite,
    confirmSaveNew,
    closeDialog,
  };
};
