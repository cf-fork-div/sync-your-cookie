/* eslint-disable jsx-a11y/click-events-have-key-events */
import { copyText, formatCookieHeader } from '@src/lib/cookies';
import { formatEntryTypeLabel } from '@src/lib/entryMeta';
import { getAccountsCountForHost, type DomainEntryRow, useI18n } from '@sync-your-cookie/shared';
import {
  Button,
  type ColumnDef,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Image,
} from '@sync-your-cookie/ui';
import { ArrowUpRight, ClipboardList, Copy, Ellipsis, Table as TableIcon } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';

type DomainTableProps = {
  entries: DomainEntryRow[];
  allEntries: DomainEntryRow[];
  onSelect: (storageKey: string) => void;
  getDomainData: (storageKey: string) => { cookies?: { name?: string | null; value?: string | null }[] | null } | undefined;
};

export function DomainTable({ entries, allEntries, onSelect, getDomainData }: DomainTableProps) {
  const { t } = useI18n();
  const defaultLabel = t('defaultAccount');

  const handleCopy = async (storageKey: string, asJson = false) => {
    const data = getDomainData(storageKey);
    const cookies = data?.cookies || [];
    if (!cookies.length) {
      toast.warning(t('noCookiesToCopy'));
      return;
    }
    const host = allEntries.find(entry => entry.storageKey === storageKey)?.host || storageKey;
    const text = asJson ? JSON.stringify(cookies, null, 2) : formatCookieHeader(host, cookies);
    try {
      await copyText(text);
      toast.success(asJson ? t('copiedJson') : t('copiedCookieHeader'));
    } catch {
      toast.error(t('copyFailedShort'));
    }
  };

  const columns: ColumnDef<DomainEntryRow>[] = useMemo(
    () => [
      {
        accessorKey: 'host',
        header: t('host'),
        id: 'host',
        cell: ({ row }) => {
          const entry = row.original;
          const sourceUrl = entry.sourceUrl;
          const protocol = sourceUrl ? new URL(sourceUrl).protocol : 'https:';
          const href = `${protocol}//${entry.host}`;
          const src = entry.favIconUrl ?? `https://${entry.host}/favicon.ico`;
          const accountCount = getAccountsCountForHost(allEntries, entry.host);

          return (
            <div className="relative group/item">
              <div className="flex items-center">
                <div
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-center cursor-pointer"
                  onClick={() => onSelect(entry.storageKey)}>
                  <Image key={entry.storageKey} index={row.index} src={src} value={entry.host} />
                  <div className="min-w-[100px]">
                    <p style={{ overflowWrap: 'anywhere' }} className="cursor-pointer hover:underline">
                      {entry.host}
                    </p>
                    {entry.label !== defaultLabel || accountCount > 1 ? (
                      <p className="text-xs text-muted-foreground">{entry.label}</p>
                    ) : null}
                    {accountCount > 1 ? (
                      <p className="text-[10px] text-primary">{t('accountsForHost', { count: accountCount })}</p>
                    ) : null}
                  </div>
                </div>
                <a
                  target="_blank"
                  title={href}
                  className="block ml-4"
                  href={href}
                  onClick={evt => evt.stopPropagation()}
                  rel="noreferrer">
                  <Button variant="ghost" className="text-sm">
                    <ArrowUpRight className="invisible group-hover/item:visible h-4 w-4 hover:inline cursor-pointer" />
                  </Button>
                </a>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'folder',
        header: t('folder'),
        id: 'folder',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.folder || t('noFolder')}</span>
        ),
      },
      {
        accessorKey: 'type',
        header: t('entryType'),
        id: 'type',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatEntryTypeLabel(t, row.original.type)}</span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('openMenu')}</span>
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('cookieActions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => onSelect(row.original.storageKey)}>
                <TableIcon size={16} className="mr-2 h-4 w-4" />
                {t('view')}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => void handleCopy(row.original.storageKey)}>
                <Copy size={16} className="mr-2 h-4 w-4" />
                {t('copy')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => void handleCopy(row.original.storageKey, true)}>
                <ClipboardList size={16} className="mr-2 h-4 w-4" />
                {t('copyWithJson')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [allEntries, defaultLabel, getDomainData, onSelect, t],
  );

  return <DataTable columns={columns} data={entries} />;
}
