/* eslint-disable react/no-unescaped-entities */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { getTabsByHost, useI18n, usePushWithAccountChoice, useStorageSuspense, useAccountAuth } from '@sync-your-cookie/shared';
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Image,
  Input,
  Label,
  PushAccountDialog,
  DeleteAccountDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  SyncTooltip,
  Toggle,
} from '@sync-your-cookie/ui';
import {
  ArrowUpRight,
  ChevronLeft,
  ClipboardList,
  CloudDownload,
  CloudUpload,
  Copy,
  Database,
  Ellipsis,
  Info,
  RotateCw,
  Table as TableIcon,
  Trash,
} from 'lucide-react';

import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { domainConfigStorage } from '@sync-your-cookie/storage/lib/domainConfigStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';
import { settingsStorage } from '@sync-your-cookie/storage/lib/settingsStorage';

import type { ColumnDef } from '@sync-your-cookie/ui';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { buildDomainEntryList, countUniqueHosts, getAccountsCountForHost, ENTRY_TYPE_OPTIONS } from '../../lib/domainEntries';
import { createEntryKey, getHostFromStorageKey, listHostEntryOptions } from '@sync-your-cookie/shared';
import { EntryMetaEditor } from './EntryMetaEditor';
import { CookieDetailPanel } from './CookieDetailPanel';
import { AccountLoginGate } from '../AccountLoginGate';
import { useAction } from './hooks/useAction';
import { LiveBrowserTab } from './LiveBrowserTab';
import { SearchInput } from './SearchInput';

type CookieViewTab = 'live' | 'kv';
export type CookieItem = {
  id: string;
  storageKey: string;
  host: string;
  label: string;
  folder?: string;
  type?: string;
  sourceUrl?: string;
  favIconUrl?: string;
  autoPush: boolean;
  autoPull: boolean;
  createTime: number;
  cookieCount: number;
};

const CookieTable = () => {
  const { t } = useI18n();
  const { isAuthenticated } = useAccountAuth();
  const [cookieViewTab, setCookieViewTab] = useState<CookieViewTab>('live');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CookieItem | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const domainConfig = useStorageSuspense(domainConfigStorage);
  const domainStatus = useStorageSuspense(domainStatusStorage);

  const cookieMap = useStorageSuspense(cookieStorage);

  const {
    showCookiesColumns,
    cookieList,
    handleBack,
    setSelectedDomain,
    selectedDomain,
    loading,
    cookieAction,
    handleDelete,
    handlePush,
    handlePull,
    handleCopy,
    handleViewCookies,
    handleSearch,
    currentSearchStr,
    hasLocalStorage,
    localStorageMode,
    setLocalStorageMode,
    showLocalStorageColumns,
    localStorageItems,
    detailCookie,
    setDetailCookie,
  } = useAction(cookieMap);

  const pushChoice = usePushWithAccountChoice({
    cookieMap,
    defaultNewLabel: t('newProfile'),
    onPush: async (storageKey, sourceUrl, favIconUrl) => {
      await handlePush(
        {
          id: storageKey,
          storageKey,
          host: getHostFromStorageKey(storageKey),
          label: domainConfig.domainMap[storageKey]?.label || t('defaultAccount'),
          sourceUrl,
          favIconUrl,
          autoPush: domainConfig.domainMap[storageKey]?.autoPush ?? false,
          autoPull: domainConfig.domainMap[storageKey]?.autoPull ?? false,
          createTime: 0,
          cookieCount: cookieMap?.domainCookieMap?.[storageKey]?.cookies?.length || 0,
        },
        sourceUrl,
      );
    },
    onEntrySelected: (host, storageKey) => {
      if (selectedDomain && getHostFromStorageKey(selectedDomain) === host) {
        setSelectedDomain(storageKey);
      }
    },
  });

  const requestPushForRow = async (row: CookieItem, href: string) => {
    await pushChoice.requestPush({
      host: row.host,
      selectedStorageKey: row.storageKey,
      sourceUrl: href,
      favIconUrl: row.favIconUrl,
    });
  };

  const allEntries = useMemo(
    () => buildDomainEntryList(cookieMap, domainConfig, t('defaultAccount')),
    [cookieMap, domainConfig, t],
  );

  const folderOptions = useMemo(() => {
    const fromConfig = domainConfig.folders || [];
    const fromEntries = allEntries.map(e => e.folder).filter(Boolean) as string[];
    return [...new Set([...fromConfig, ...fromEntries])].sort();
  }, [allEntries, domainConfig.folders]);

  let domainList: CookieItem[] = allEntries
    .filter(entry => {
      if (!selectedDomain && currentSearchStr.trim()) {
        const q = currentSearchStr.trim().toLowerCase();
        if (
          !entry.host.toLowerCase().includes(q) &&
          !entry.label.toLowerCase().includes(q) &&
          !(entry.folder || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (folderFilter !== 'all') {
        if (folderFilter === '__none__' && entry.folder) return false;
        if (folderFilter !== '__none__' && entry.folder !== folderFilter) return false;
      }
      if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
      return true;
    })
    .map(entry => ({
      id: entry.storageKey,
      storageKey: entry.storageKey,
      host: entry.host,
      label: entry.label,
      folder: entry.folder,
      type: entry.type,
      sourceUrl: entry.sourceUrl,
      favIconUrl: entry.favIconUrl,
      autoPush: entry.autoPush,
      autoPull: entry.autoPull,
      createTime: entry.createTime,
      cookieCount: entry.cookieCount,
    }));

  let totalCookieItem = 0;
  let totalLocalStorageItem = 0;
  for (const entry of allEntries) {
    const value = cookieMap?.domainCookieMap?.[entry.storageKey];
    if (value?.cookies?.length) {
      totalCookieItem += value.cookies.length;
    }
    if (value?.localStorageItems?.length) {
      totalLocalStorageItem += value.localStorageItems.length;
    }
  }

  const handleAndCheckPushCookie = async (row: CookieItem) => {
    const protocol = row.sourceUrl ? new URL(row.sourceUrl).protocol : 'https:';
    const href = `${protocol}//${row.host}`;
    const includeLocalStorage = settingsStorage.getSnapshot()?.includeLocalStorage;
    const runPush = () => requestPushForRow(row, href);
    if (includeLocalStorage) {
      const matchedTabs = await getTabsByHost(row.host);
      if (matchedTabs.length === 0) {
        window.open(href, '_blank');
        setTimeout(async () => {
          await runPush();
        }, 500);
      } else {
        await runPush();
      }
    } else {
      await runPush();
    }
  };

  const handleAddAccount = async () => {
    if (!selectedDomain) return;
    const host = getHostFromStorageKey(selectedDomain);
    const entryKey = createEntryKey(host);
    const selectedConfig = domainConfig.domainMap[selectedDomain];
    const label = newAccountLabel.trim() || t('newProfile');
    await domainConfigStorage.updateItem(entryKey, {
      label,
      sourceUrl: selectedConfig?.sourceUrl,
      favIconUrl: selectedConfig?.favIconUrl,
      type: 'login',
    });
    setAddAccountOpen(false);
    setNewAccountLabel('');
    setSelectedDomain(entryKey);
    await domainConfigStorage.setLastSelectedEntry(host, entryKey);
    const protocol = selectedConfig?.sourceUrl ? new URL(selectedConfig.sourceUrl).protocol : 'https:';
    await requestPushForRow(
      {
        id: entryKey,
        storageKey: entryKey,
        host,
        label,
        sourceUrl: selectedConfig?.sourceUrl,
        favIconUrl: selectedConfig?.favIconUrl,
        autoPush: false,
        autoPull: false,
        createTime: Date.now(),
        cookieCount: 0,
      },
      `${protocol}//${host}`,
    );
    toast.success(t('profileAdded'));
  };

  const accountsOnHost = selectedDomain ? getAccountsCountForHost(allEntries, getHostFromStorageKey(selectedDomain)) : 0;

  const handleSelectAccountEntry = async (storageKey: string) => {
    setSelectedDomain(storageKey);
    await domainConfigStorage.setLastSelectedEntry(getHostFromStorageKey(storageKey), storageKey);
  };

  const confirmDeleteAccount = async (): Promise<boolean> => {
    if (!deleteTarget) {
      return false;
    }
    setDeletingAccount(true);
    try {
      const deletedKey = deleteTarget.storageKey;
      const deletedHost = deleteTarget.host;
      const wasViewingDeleted = selectedDomain === deletedKey;
      const ok = await handleDelete(deleteTarget);
      if (!ok) {
        return false;
      }
      setDeleteTarget(null);
      if (wasViewingDeleted) {
        const remaining = allEntries.filter(entry => entry.storageKey !== deletedKey);
        const sameHostEntries = remaining.filter(entry => entry.host === deletedHost);
        if (sameHostEntries.length > 0) {
          const nextKey = sameHostEntries[0]!.storageKey;
          setSelectedDomain(nextKey);
          await domainConfigStorage.setLastSelectedEntry(deletedHost, nextKey);
        } else {
          handleBack();
        }
      }
      return true;
    } finally {
      setDeletingAccount(false);
    }
  };

  const getDeleteAccountLabel = (row: CookieItem) =>
    row.label !== t('defaultAccount') ? row.label : row.host;

  const openDeleteAccountDialog = (row: CookieItem) => {
    setDeleteTarget(row);
  };

  const columns: ColumnDef<CookieItem>[] = [
    {
      accessorKey: 'host',
      header: t('host'),
      cell: ({ row, getValue }) => {
        const value = getValue<string>() || '';
        const sourceUrl = row.original.sourceUrl;
        const protocol = sourceUrl ? new URL(sourceUrl).protocol : 'https:';
        const href = `${protocol}//${row.original.host}`;
        const src = row.original.favIconUrl ?? `https://${row.original.host}/favicon.ico`;
        const accountCount = getAccountsCountForHost(allEntries, row.original.host);
        return (
          <div className="relative group/item ">
            <div className="block w-[100%] h-[120%] ">
              <div className="flex items-center">
                <div
                  role="button"
                  className="flex items-center justify-center cursor-pointer "
                  tabIndex={0}
                  onClick={() => {
                    setSelectedDomain(row.original.storageKey);
                    void domainConfigStorage.setLastSelectedEntry(row.original.host, row.original.storageKey);
                  }}>
                  <Image key={row.original.storageKey} index={row.index} src={src} value={value} />
                  <div className="min-w-[100px]">
                    <p
                      style={{
                        overflowWrap: 'anywhere',
                      }}
                      className=" cursor-pointer hover:underline ">
                      {value}
                    </p>
                    {row.original.label !== t('defaultAccount') || accountCount > 1 ? (
                      <p className="text-xs text-muted-foreground">{row.original.label}</p>
                    ) : null}
                    {accountCount > 1 ? (
                      <p className="text-[10px] text-primary">{t('accountsForHost', { count: accountCount })}</p>
                    ) : null}
                  </div>
                </div>
                <a
                  key={row.original.host}
                  target="_blank"
                  title={href}
                  className="block ml-4 "
                  href={href}
                  onClick={evt => {
                    // evt.preventDefault();
                    evt.stopPropagation();
                  }}
                  rel="noreferrer">
                  <Button variant="ghost" className="text-sm ">
                    <ArrowUpRight className="invisible group-hover/item:visible h-4 w-4 hover:inline cursor-pointer " />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        );
      },
      id: 'host',
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
      cell: ({ row }) => {
        const type = row.original.type;
        if (type === 'login') return t('typeLogin');
        if (type === 'session') return t('typeSession');
        if (type === 'other') return t('typeOther');
        return '-';
      },
    },
    {
      accessorKey: 'autoPush',
      header: t('autoPush'),
      id: 'autoPush',
      cell: record => {
        return (
          <p className="w-[60px]">
            <Switch
              className="scale-75"
              id={`autoPush-${record.row.original.host}`}
              checked={record.row.original.autoPush}
              onCheckedChange={async () => {
                await domainConfigStorage.updateItem(record.row.original.storageKey, {
                  autoPush: !record.row.original.autoPush,
                });
              }}
            />
          </p>
        );
      },
    },
    {
      accessorKey: 'autoPull',
      header: t('autoPull'),
      id: 'autoPull',
      cell: record => {
        return (
          <p className="w-[60px]">
            <Switch
              className="scale-75"
              id={`autoPull-${record.row.original.host}`}
              checked={record.row.original.autoPull}
              onCheckedChange={async () => {
                await domainConfigStorage.updateItem(record.row.original.storageKey, {
                  autoPull: !record.row.original.autoPull,
                });
              }}
            />
          </p>
        );
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const itemStatus = cookieAction.getDomainItemStatus(row.original.storageKey) || {};
        const sourceUrl = row.original.sourceUrl;
        const protocol = sourceUrl ? new URL(sourceUrl).protocol : 'http:';
        const href = `${protocol}//${row.original.host}`;
        const disabled = itemStatus.pushing || cookieAction.pushing;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">{t('openMenu')}</span>
                <Ellipsis className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('cookieActions')}</DropdownMenuLabel>
              {/* <DropdownMenuItem onClick={() => navigator.clipboard.writeText(.id)}>
                Copy payment ID
              </DropdownMenuItem> */}
              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer flex items-center"
                disabled={disabled}
                onClick={() => {
                  handleAndCheckPushCookie(row.original);
                }}>
                {itemStatus.pushing ? (
                  <RotateCw size={16} className=" h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudUpload size={16} className="mr-2 h-4 w-4" />
                )}
                {t('push')}
                <SyncTooltip
                  align="start"
                  alignOffset={80}
                  title={<p>{t('pushLocalStorageNote')}</p>}>
                  <p className="text-base flex items-center font-medium">
                    <Info className="ml-14" size={16} />
                  </p>
                </SyncTooltip>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={itemStatus.pulling}
                onClick={() => {
                  handlePull(href, row.original);
                }}>
                {itemStatus.pulling ? (
                  <RotateCw size={16} className=" h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudDownload size={16} className="mr-2 h-4 w-4" />
                )}
                {t('pull')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  handleViewCookies(row.original.storageKey);
                }}>
                <TableIcon size={16} className="mr-2 h-4 w-4" />
                {t('view')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  handleCopy(row.original.storageKey);
                }}>
                <Copy size={16} className="mr-2 h-4 w-4" />
                {t('copy')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  handleCopy(row.original.storageKey, true);
                }}>
                <ClipboardList size={16} className="mr-2 h-4 w-4" />
                {t('copyWithJson')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={domainStatus.pushing}
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => openDeleteAccountDialog(row.original)}>
                {itemStatus.pulling ? (
                  <RotateCw size={16} className=" h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash size={16} className="mr-2 h-4 w-4" />
                )}
                {getAccountsCountForHost(allEntries, row.original.host) > 1 ? t('deleteAccount') : t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  const selectedRow = domainConfig.domainMap[selectedDomain];
  const selectedHost = selectedDomain ? getHostFromStorageKey(selectedDomain) : '';
  const hostEntryOptions = useMemo(() => {
    if (!selectedHost) {
      return [];
    }
    return listHostEntryOptions(selectedHost, domainConfig, cookieMap, t('defaultAccount'));
  }, [selectedHost, domainConfig, cookieMap, t]);
  const selectedLabel = selectedRow?.label || t('defaultAccount');
  const sourceUrl = selectedRow?.sourceUrl;
  const protocol = sourceUrl ? new URL(sourceUrl).protocol : 'https:';
  const href = `${protocol}//${selectedHost}`;
  const handlePressChange = (pressed: boolean) => {
    setLocalStorageMode(pressed);
  };
  const kvCookies = cookieMap?.domainCookieMap?.[selectedDomain]?.cookies || [];
  const handleDomainPush = async () => {
    await requestPushForRow(
      {
        id: selectedDomain,
        storageKey: selectedDomain,
        host: selectedHost,
        label: selectedLabel,
        sourceUrl: selectedRow?.sourceUrl,
        favIconUrl: selectedRow?.favIconUrl,
        autoPush: selectedRow?.autoPush ?? false,
        autoPull: selectedRow?.autoPull ?? false,
        createTime: 0,
        cookieCount: kvCookies.length,
      },
      href,
    );
  };
  const renderTable = () => {
    return (
      <div className="flex flex-col h-full ">
        <div className="flex justify-between px-4 mb-2 ">
          <div className="flex items-center ">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 mr-2"
              onClick={() => {
                handleBack();
              }}>
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('back')}</span>
            </Button>
            <a
              href={href}
              target="_blank"
              className=" flex text-xl items-center font-semibold hover:underline "
              rel="noreferrer">
              {selectedRow?.favIconUrl ? <Image src={selectedRow?.favIconUrl} /> : null}
              <span>
                {selectedHost}
                {selectedLabel !== t('defaultAccount') ? (
                  <span className="text-sm font-normal text-muted-foreground ml-2">· {selectedLabel}</span>
                ) : null}
              </span>
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddAccountOpen(true)}>
              {t('addAccount')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={domainStatus.pushing || deletingAccount}
              onClick={() =>
                openDeleteAccountDialog({
                  id: selectedDomain,
                  storageKey: selectedDomain,
                  host: selectedHost,
                  label: selectedLabel,
                  sourceUrl: selectedRow?.sourceUrl,
                  favIconUrl: selectedRow?.favIconUrl,
                  autoPush: selectedRow?.autoPush ?? false,
                  autoPull: selectedRow?.autoPull ?? false,
                  createTime: 0,
                  cookieCount: kvCookies.length,
                })
              }>
              <Trash size={14} className="mr-1.5" />
              {accountsOnHost > 1 ? t('deleteAccount') : t('deleteDomain')}
            </Button>
            {cookieViewTab === 'kv' && hasLocalStorage ? (
              <SyncTooltip title={t('toggleLocalStorageView')}>
                <Toggle pressed={localStorageMode} onPressedChange={handlePressChange} className="ml-6" variant="outline">
                  <Database size={16} className="h-4 w-4" />
                </Toggle>
              </SyncTooltip>
            ) : null}
          </div>
        </div>
        {accountsOnHost > 1 ? (
          <div className="px-4 mb-2">
            <Label htmlFor="sidepanel-account-select" className="text-xs text-muted-foreground mb-1 block">
              {t('selectAccount')}
            </Label>
            <Select value={selectedDomain} onValueChange={value => void handleSelectAccountEntry(value)}>
              <SelectTrigger id="sidepanel-account-select" className="w-full max-w-md">
                <SelectValue placeholder={t('selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {hostEntryOptions.map(entry => (
                  <SelectItem key={entry.storageKey} value={entry.storageKey}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">{t('autoSyncMultiAccountNote')}</p>
          </div>
        ) : accountsOnHost > 0 ? (
          <p className="px-4 text-xs text-muted-foreground mb-2">{t('accountsForHost', { count: accountsOnHost })}</p>
        ) : null}
        <EntryMetaEditor storageKey={selectedDomain} folders={folderOptions} />
        <div className="px-4 mb-2 flex gap-2 border-b pb-2">
          <Button
            variant={cookieViewTab === 'live' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCookieViewTab('live')}>
            {t('liveBrowser')}
          </Button>
          <Button
            variant={cookieViewTab === 'kv' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCookieViewTab('kv')}>
            {t('syncedKv')} ({kvCookies.length})
          </Button>
        </div>
        <div className="mb-1 px-4">
          <SearchInput onEnter={handleSearch} />
        </div>
        <div className="flex-1 pl-4 pr-2 mt-2 overflow-auto">
          {cookieViewTab === 'live' ? (
            <LiveBrowserTab
              host={selectedHost}
              storageKey={selectedDomain}
              kvCookies={kvCookies}
              onPush={handleDomainPush}
              searchStr={currentSearchStr}
            />
          ) : localStorageMode ? (
            <DataTable columns={showLocalStorageColumns as any} data={localStorageItems} />
          ) : (
            <DataTable columns={showCookiesColumns} data={cookieList} />
          )}
        </div>
        {detailCookie ? (
          <CookieDetailPanel cookie={detailCookie} onClose={() => setDetailCookie(null)} />
        ) : null}
      </div>
    );
  };

  if (!isAuthenticated) {
    return <AccountLoginGate compact />;
  }

  return (
    <div className="h-screen flex flex-col">
      <PushAccountDialog
        open={Boolean(pushChoice.dialog)}
        step={pushChoice.step}
        variant={pushChoice.dialog?.mode === 'firstPush' ? 'firstPush' : 'conflict'}
        labels={{
          title:
            pushChoice.dialog?.mode === 'firstPush'
              ? t('pushFirstTimeTitle')
              : t('pushExistingAccountTitle'),
          description:
            pushChoice.dialog?.mode === 'firstPush'
              ? t('pushFirstTimeDesc', { host: pushChoice.dialog.host })
              : t('pushExistingAccountDesc'),
          overwriteAccount: t('overwriteAccount', { label: '{{label}}' }),
          saveAsNewAccount: t('saveAsNewAccount'),
          accountLabel: t('accountLabel'),
          newAccountLabelPlaceholder: t('newAccountLabelPlaceholder'),
          cancel: t('cancel'),
          confirm: t('add'),
          back: t('back'),
        }}
        overwriteOptions={pushChoice.dialog?.overwriteOptions || []}
        overwriteKey={pushChoice.overwriteKey}
        newLabel={pushChoice.newLabel}
        saving={pushChoice.saving}
        onOverwriteKeyChange={pushChoice.setOverwriteKey}
        onNewLabelChange={pushChoice.setNewLabel}
        onOverwrite={() => void pushChoice.confirmOverwrite()}
        onConfirmNew={() => void pushChoice.confirmSaveNew()}
        onSaveAsNew={() => pushChoice.setStep('newLabel')}
        onBack={() => pushChoice.setStep('choose')}
        onClose={pushChoice.closeDialog}
      />
      <DeleteAccountDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        labels={{
          title: deleteTarget && getAccountsCountForHost(allEntries, deleteTarget.host) > 1 ? t('deleteAccount') : t('deleteDomain'),
          description: deleteTarget
            ? getAccountsCountForHost(allEntries, deleteTarget.host) > 1
              ? t('deleteAccountConfirm', {
                  host: deleteTarget.host,
                  label: getDeleteAccountLabel(deleteTarget),
                })
              : t('deleteDomainConfirm', { host: deleteTarget.host })
            : '',
          cancel: t('cancel'),
          confirm: t('delete'),
        }}
        saving={deletingAccount}
        onConfirm={confirmDeleteAccount}
      />
      <div className="space-y-4 p-4 ">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t('welcomeBack')}</h2>
          <p className="text-muted-foreground text-sm">
            {t('pushedList', { type: localStorageMode ? t('localStorageItems') : t('cookies') })}{' '}
          </p>
        </div>
      </div>
      <div className="h-0 flex-1 overflow-auto">
        <Spinner show={loading}>
          {selectedDomain ? (
            <>
              {renderTable()}
              {addAccountOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg space-y-3">
                    <p className="font-medium">{t('addAccount')}</p>
                    <div className="space-y-2">
                      <Label htmlFor="new-account-label">{t('addAccountPrompt')}</Label>
                      <Input
                        id="new-account-label"
                        value={newAccountLabel}
                        onChange={e => setNewAccountLabel(e.target.value)}
                        placeholder={t('accountLabel')}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddAccountOpen(false)}>
                        {t('cancel')}
                      </Button>
                      <Button onClick={handleAddAccount}>{t('add')}</Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div>
                <div className=" mx-4 w-1/3 min-w-[328px] bg-primary/10 mb-4 rounded-xl border text-card-foreground shadow">
                  <div className="p-3">
                    <div className="flex flex-row items-center justify-between">
                      <p className="tracking-tight text-sm font-normal">{t('totalCookieAndLocalStorage')}</p>
                    </div>
                    <div className="">
                      <p className="text-2xl font-bold">
                        {countUniqueHosts(allEntries)} <span className="text-xl">{t('sites')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span>{t('cookieItems', { count: totalCookieItem })}</span>
                        <span className="mx-1">{t('and')}</span>
                        <span>{t('localStorageItemsCount', { count: totalLocalStorageItem })}</span>
                      </p>
                      {allEntries.length > countUniqueHosts(allEntries) ? (
                        <p className="text-xs text-primary mt-1">
                          {allEntries.length} {t('accountLabel').toLowerCase()} entries
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-4 flex flex-wrap gap-2 mb-2">
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder={t('folder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allFolders')}</SelectItem>
                    <SelectItem value="__none__">{t('noFolder')}</SelectItem>
                    {folderOptions.map(folder => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder={t('entryType')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allTypes')}</SelectItem>
                    {ENTRY_TYPE_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>
                        {option === 'login' ? t('typeLogin') : option === 'session' ? t('typeSession') : t('typeOther')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="px-4">
                <SearchInput onEnter={handleSearch} />
              </div>
              <div className="flex-1 overflow-auto my-4 pl-4 pr-1">
                <DataTable columns={columns} data={domainList} />
              </div>
            </div>
          )}
        </Spinner>
      </div>
    </div>
  );
};

export default CookieTable;
