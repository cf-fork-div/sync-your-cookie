import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui';

type CookieEntryType = 'login' | 'session' | 'other';

const ENTRY_TYPE_OPTIONS: CookieEntryType[] = ['login', 'session', 'other'];

export type EntryMetaFieldLabels = {
  folder: string;
  entryType: string;
  noFolder: string;
  allTypes: string;
  typeLogin: string;
  typeSession: string;
  typeOther: string;
};

export type EntryMetaFieldsProps = {
  folder: string;
  type: CookieEntryType | '';
  folderOptions: string[];
  labels: EntryMetaFieldLabels;
  onFolderChange: (value: string) => void;
  onTypeChange: (value: CookieEntryType | '') => void;
  folderInputId?: string;
  typeSelectId?: string;
  datalistId?: string;
};

export function EntryMetaFields({
  folder,
  type,
  folderOptions,
  labels,
  onFolderChange,
  onTypeChange,
  folderInputId = 'entry-meta-folder',
  typeSelectId = 'entry-meta-type',
  datalistId = 'entry-meta-folder-suggestions',
}: EntryMetaFieldsProps) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={folderInputId}>{labels.folder}</Label>
        <Input
          id={folderInputId}
          value={folder}
          onChange={event => onFolderChange(event.target.value)}
          placeholder={labels.noFolder}
          list={datalistId}
        />
        <datalist id={datalistId}>
          {folderOptions.map(name => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div className="space-y-1">
        <Label htmlFor={typeSelectId}>{labels.entryType}</Label>
        <Select value={type || 'none'} onValueChange={val => onTypeChange(val === 'none' ? '' : (val as CookieEntryType))}>
          <SelectTrigger id={typeSelectId}>
            <SelectValue placeholder={labels.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{labels.allTypes}</SelectItem>
            {ENTRY_TYPE_OPTIONS.map(option => (
              <SelectItem key={option} value={option}>
                {option === 'login' ? labels.typeLogin : option === 'session' ? labels.typeSession : labels.typeOther}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
