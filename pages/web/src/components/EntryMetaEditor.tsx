import { ENTRY_TYPE_OPTIONS, type DomainEntryRow, useI18n } from '@sync-your-cookie/shared';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sync-your-cookie/ui';
import { useEffect, useState } from 'react';

type EntryMetaEditorProps = {
  label: string;
  folder?: string;
  type?: DomainEntryRow['type'];
  folders: string[];
  saving: boolean;
  onSave: (update: { label?: string; folder?: string; type?: DomainEntryRow['type'] }) => Promise<void>;
};

export function EntryMetaEditor({ label, folder, type, folders, saving, onSave }: EntryMetaEditorProps) {
  const { t } = useI18n();
  const [draftLabel, setDraftLabel] = useState(label);
  const [draftFolder, setDraftFolder] = useState(folder || '');
  const [draftType, setDraftType] = useState<DomainEntryRow['type'] | ''>(type || '');

  useEffect(() => {
    setDraftLabel(label);
    setDraftFolder(folder || '');
    setDraftType(type || '');
  }, [label, folder, type]);

  const handleSave = async () => {
    await onSave({
      label: draftLabel.trim() || undefined,
      folder: draftFolder.trim() || undefined,
      type: draftType || undefined,
    });
  };

  return (
    <div className="mx-4 mb-3 rounded-lg border bg-muted/20 p-3 space-y-3">
      <p className="text-sm font-medium">{t('editEntryMeta')}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="entry-label">{t('accountLabel')}</Label>
          <Input
            id="entry-label"
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            placeholder={t('defaultAccount')}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="entry-folder">{t('folder')}</Label>
          <Input
            id="entry-folder"
            value={draftFolder}
            onChange={e => setDraftFolder(e.target.value)}
            placeholder={t('noFolder')}
            list="web-entry-folder-suggestions"
          />
          <datalist id="web-entry-folder-suggestions">
            {folders.map(name => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label>{t('entryType')}</Label>
          <Select
            value={draftType || 'none'}
            onValueChange={val => setDraftType(val === 'none' ? '' : (val as DomainEntryRow['type']))}>
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
