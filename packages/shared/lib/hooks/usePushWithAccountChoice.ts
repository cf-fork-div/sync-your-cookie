import { createEntryKey } from '../domain/entryKey';
import { listHostEntryOptions } from '../domain/hostEntries';
import { evaluatePushConflict, type PushConflictResult } from '../domain/pushConflict';
import type { ICookiesMap } from '@sync-your-cookie/protobuf';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { useCallback, useState } from 'react';
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
  const domainConfig = useStorageSuspense(domainConfigStorage);
  const [dialog, setDialog] = useState<PushAccountDialogState | null>(null);
  const [overwriteKey, setOverwriteKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [step, setStep] = useState<'choose' | 'newLabel'>('choose');
  const [saving, setSaving] = useState(false);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setStep('choose');
    setSaving(false);
  }, []);

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
      await domainConfigStorage.updateItem(entryKey, {
        label: resolvedLabel,
        sourceUrl: dialog.sourceUrl,
        favIconUrl: dialog.favIconUrl,
        type: 'login',
      });
      await domainConfigStorage.setLastSelectedEntry(dialog.host, entryKey);
      await onPush(entryKey, dialog.sourceUrl, dialog.favIconUrl);
      onEntrySelected?.(dialog.host, entryKey);
      closeDialog();
    } finally {
      setSaving(false);
    }
  }, [closeDialog, dialog, newLabel, onEntrySelected, onPush]);

  return {
    dialog,
    step,
    setStep,
    overwriteKey,
    setOverwriteKey,
    newLabel,
    setNewLabel,
    saving,
    requestPush,
    confirmOverwrite,
    confirmSaveNew,
    closeDialog,
  };
};
