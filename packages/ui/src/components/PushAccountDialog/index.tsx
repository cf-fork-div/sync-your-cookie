import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui';

export type PushAccountDialogLabels = {
  title: string;
  description: string;
  overwriteAccount: string;
  saveAsNewAccount: string;
  accountLabel: string;
  newAccountLabelPlaceholder: string;
  cancel: string;
  confirm: string;
  back: string;
};

export type PushAccountDialogEntry = {
  storageKey: string;
  label: string;
};

export type PushAccountDialogProps = {
  open: boolean;
  step: 'choose' | 'newLabel';
  variant?: 'conflict' | 'firstPush';
  labels: PushAccountDialogLabels;
  overwriteOptions: PushAccountDialogEntry[];
  overwriteKey: string;
  newLabel: string;
  saving?: boolean;
  onOverwriteKeyChange: (storageKey: string) => void;
  onNewLabelChange: (label: string) => void;
  onOverwrite: () => void;
  onConfirmNew: () => void;
  onSaveAsNew: () => void;
  onBack: () => void;
  onClose: () => void;
};

export function PushAccountDialog({
  open,
  step,
  variant = 'conflict',
  labels,
  overwriteOptions,
  overwriteKey,
  newLabel,
  saving = false,
  onOverwriteKeyChange,
  onNewLabelChange,
  onOverwrite,
  onConfirmNew,
  onSaveAsNew,
  onBack,
  onClose,
}: PushAccountDialogProps) {
  const overwriteLabel =
    overwriteOptions.find(entry => entry.storageKey === overwriteKey)?.label || overwriteOptions[0]?.label || '';
  const isFirstPush = variant === 'firstPush';
  const showNewLabelStep = isFirstPush || step === 'newLabel';
  const canConfirmNew = Boolean(newLabel.trim());

  return (
    <AlertDialog open={open} onOpenChange={value => !value && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>{labels.description}</AlertDialogDescription>
        </AlertDialogHeader>

        {showNewLabelStep ? (
          <div className="space-y-2 py-2">
            <Label htmlFor="push-new-account-label">{labels.accountLabel}</Label>
            <Input
              id="push-new-account-label"
              value={newLabel}
              onChange={event => onNewLabelChange(event.target.value)}
              placeholder={labels.newAccountLabelPlaceholder}
            />
          </div>
        ) : (
          <div className="space-y-3 py-2">
            {overwriteOptions.length > 1 ? (
              <div className="space-y-2">
                <Label htmlFor="push-overwrite-target">{labels.accountLabel}</Label>
                <Select value={overwriteKey} onValueChange={onOverwriteKeyChange}>
                  <SelectTrigger id="push-overwrite-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {overwriteOptions.map(entry => (
                      <SelectItem key={entry.storageKey} value={entry.storageKey}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button className="w-full justify-start" disabled={saving} onClick={onOverwrite}>
              {labels.overwriteAccount.replace('{{label}}', overwriteLabel)}
            </Button>
            <Button className="w-full justify-start" variant="outline" disabled={saving} onClick={onSaveAsNew}>
              {labels.saveAsNewAccount}
            </Button>
          </div>
        )}

        <AlertDialogFooter>
          {showNewLabelStep && !isFirstPush ? (
            <Button variant="outline" disabled={saving} onClick={onBack}>
              {labels.back}
            </Button>
          ) : (
            <AlertDialogCancel disabled={saving}>{labels.cancel}</AlertDialogCancel>
          )}
          {showNewLabelStep ? (
            <Button disabled={saving || (isFirstPush && !canConfirmNew)} onClick={onConfirmNew}>
              {labels.confirm}
            </Button>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
