import type { ICookie } from '@sync-your-cookie/protobuf';
import { useI18n } from '@sync-your-cookie/shared';
import { Button, Label } from '@sync-your-cookie/ui';
import { Check, Copy, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type CookieDetailPanelProps = {
  cookie: ICookie & { id?: string };
  onClose: () => void;
};

const formatExpiration = (expirationDate?: number | null, session?: boolean | null) => {
  if (session) {
    return 'Session';
  }
  if (expirationDate == null) {
    return '-';
  }
  return new Date(expirationDate * 1000).toLocaleString();
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/60 last:border-0">
    <Label className="text-muted-foreground col-span-1">{label}</Label>
    <p
      className="col-span-2 text-sm break-all font-mono bg-muted/50 rounded px-2 py-1 max-h-32 overflow-auto"
      style={{ overflowWrap: 'anywhere' }}>
      {value || '-'}
    </p>
  </div>
);

export function CookieDetailPanel({ cookie, onClose }: CookieDetailPanelProps) {
  const { t } = useI18n();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyValue = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t('copiedValue'));
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const boolLabel = (val?: boolean | null) => (val ? t('yes') : t('no'));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-md h-full bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold">{t('cookieDetails')}</h3>
            <p className="text-xs text-muted-foreground truncate">{cookie.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-1">
          <DetailRow label={t('cookieName')} value={cookie.name || ''} />
          <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/60">
            <Label className="text-muted-foreground">{t('cookieValue')}</Label>
            <div className="col-span-2 flex gap-1">
              <p
                className="flex-1 text-sm break-all font-mono bg-muted/50 rounded px-2 py-1 max-h-32 overflow-auto"
                style={{ overflowWrap: 'anywhere' }}>
                {cookie.value || '-'}
              </p>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={() => copyValue('value', cookie.value || '')}>
                {copiedField === 'value' ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
          <DetailRow label={t('domain')} value={cookie.domain || ''} />
          <DetailRow label={t('cookiePath')} value={cookie.path || ''} />
          <DetailRow label={t('cookieExpires')} value={formatExpiration(cookie.expirationDate, cookie.session)} />
          <DetailRow label={t('cookieSameSite')} value={cookie.sameSite || '-'} />
          <DetailRow label={t('cookieSecure')} value={boolLabel(cookie.secure)} />
          <DetailRow label={t('cookieHttpOnly')} value={boolLabel(cookie.httpOnly)} />
          <DetailRow label={t('hostOnly')} value={boolLabel(cookie.hostOnly)} />
          <DetailRow label={t('sessionCookie')} value={boolLabel(cookie.session)} />
          <DetailRow label={t('storeId')} value={cookie.storeId || '-'} />
        </div>
      </div>
    </div>
  );
}
