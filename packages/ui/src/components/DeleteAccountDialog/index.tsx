import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from '../ui';

export type DeleteAccountDialogLabels = {
  title: string;
  description: string;
  cancel: string;
  confirm: string;
};

export type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: DeleteAccountDialogLabels;
  onConfirm: () => Promise<boolean | void>;
  saving?: boolean;
};

export function DeleteAccountDialog({
  open,
  onOpenChange,
  labels,
  onConfirm,
  saving = false,
}: DeleteAccountDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>{labels.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{labels.cancel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async e => {
                e.preventDefault();
                const result = await onConfirm();
                if (result !== false) {
                  onOpenChange(false);
                }
              }}>
              {labels.confirm}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
