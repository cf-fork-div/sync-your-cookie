import { useI18n } from '@sync-your-cookie/shared';
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
  Label,
} from '@sync-your-cookie/ui';
import { useState } from 'react';
import type { BrowserCookieItem } from '../../lib/browserCookies';

export type DeleteTarget = 'browser' | 'kv' | 'both';

type DeleteCookieDialogProps = {
  open: boolean;
  cookie: BrowserCookieItem | null;
  onClose: () => void;
  onConfirm: (target: DeleteTarget) => Promise<void>;
  hasKvEntry: boolean;
  saving?: boolean;
};

export function DeleteCookieDialog({
  open,
  cookie,
  onClose,
  onConfirm,
  hasKvEntry,
  saving = false,
}: DeleteCookieDialogProps) {
  const { t } = useI18n();
  const [target, setTarget] = useState<DeleteTarget>('browser');

  const handleOpenChange = (val: boolean) => {
    if (!val) onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteCookie')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteCookieConfirm', { name: cookie?.name ?? '' })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="deleteTarget"
              checked={target === 'browser'}
              onChange={() => setTarget('browser')}
            />
            <Label className="cursor-pointer font-normal">{t('deleteBrowserOnly')}</Label>
          </label>
          {hasKvEntry && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="deleteTarget" checked={target === 'kv'} onChange={() => setTarget('kv')} />
                <Label className="cursor-pointer font-normal">{t('deleteKvOnly')}</Label>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="deleteTarget"
                  checked={target === 'both'}
                  onChange={() => setTarget('both')}
                />
                <Label className="cursor-pointer font-normal">{t('deleteBoth')}</Label>
              </label>
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={saving}
              onClick={async e => {
                e.preventDefault();
                await onConfirm(target);
                onClose();
              }}>
              {t('delete')}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
