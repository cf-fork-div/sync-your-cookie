import { useI18n } from '@sync-your-cookie/shared';
import type { CookieEntryType } from '@sync-your-cookie/storage/lib/domainConfigTypes';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@sync-your-cookie/ui';
import { useEffect, useState } from 'react';
import { ENTRY_TYPE_OPTIONS } from '../../lib/domainEntries';

type EntryMetaEditorProps = {
  storageKey: string;
  folders: string[];
};

export function EntryMetaEditor({ storageKey, folders }: EntryMetaEditorProps) {
  const { t } = useI18n();
  const snapshot = domainConfigStorage.getSnapshot();
  const config = snapshot?.domainMap[storageKey] || {};
  const [label, setLabel] = useState(config.label || '');
  const [folder, setFolder] = useState(config.folder || '');
  const [type, setType] = useState<CookieEntryType | ''>(config.type || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = domainConfigStorage.getSnapshot()?.domainMap[storageKey] || {};
    setLabel(next.label || '');
    setFolder(next.folder || '');
    setType(next.type || '');
  }, [storageKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (folder.trim()) {
        await domainConfigStorage.ensureFolder(folder.trim());
      }
      await domainConfigStorage.updateItem(storageKey, {
        label: label.trim() || undefined,
        folder: folder.trim() || undefined,
        type: type || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border bg-card p-3 space-y-3">
      <p className="text-sm font-medium">{t('editEntryMeta')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="entry-label">{t('accountLabel')}</Label>
          <Input id="entry-label" value={label} onChange={e => setLabel(e.target.value)} placeholder={t('defaultAccount')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="entry-folder">{t('folder')}</Label>
          <Input
            id="entry-folder"
            value={folder}
            onChange={e => setFolder(e.target.value)}
            placeholder={t('noFolder')}
            list="entry-folder-suggestions"
          />
          <datalist id="entry-folder-suggestions">
            {folders.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label>{t('entryType')}</Label>
          <Select value={type || 'none'} onValueChange={val => setType(val === 'none' ? '' : (val as CookieEntryType))}>
            <SelectTrigger>
              <SelectValue placeholder={t('allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('allTypes')}</SelectItem>
              {ENTRY_TYPE_OPTIONS.map(option => (
                <SelectItem key={option} value={option}>
                  {option === 'login' ? t('typeLogin') : option === 'session' ? t('typeSession') : t('typeOther')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {t('saveEntryMeta')}
      </Button>
    </div>
  );
}
