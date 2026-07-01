import {
  ErrorFallback,
  extractDomainAndPort,
  formatAccountMetaLine,
  formatAccountOptionSubtitle,
  GITHUB_REPO_URL,
  getExtensionVersion,
  LoadingFallback,
  openExtensionOptionsPage,
  shouldShowAccountMeta,
  useDocumentTitle,
  useI18n,
  useStorageSuspense,
  useTheme,
  useAccountAuth,
  withErrorBoundary,
  withSuspense,
} from '@sync-your-cookie/shared';

import { accountProfileStorage, getActiveProfile } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { Button, Image, Label, PushAccountDialog, DeleteAccountDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, Switch, SyncTooltip, Toaster } from '@sync-your-cookie/ui';
import { CloudDownload, CloudUpload, Copyright, PanelRightOpen, RotateCw, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AutoSwitch } from './components/AutoSwtich';
import { AccountLoginGate } from './components/AccountLoginGate';
import { CookieEditorSection } from './components/CookieEditorSection';
import { useDomainConfig } from './hooks/useDomainConfig';

const Popup = () => {
  const { theme } = useTheme();
  const { t } = useI18n();
  useDocumentTitle('pageTitlePopup');
  const { isAuthenticated, refreshConnection, refreshing } = useAccountAuth();
  const profileState = useStorageSuspense(accountProfileStorage);
  const cookieMap = useStorageSuspense(cookieStorage);
  const activeProfile = getActiveProfile(profileState);
  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [favIconUrl, setFavIconUrl] = useState('');

  const {
    pushing,
    toggleAutoPushState,
    toggleAutoPullState,
    domain,
    setDomain,
    activeStorageKey,
    activeEntry,
    entryOptions,
    hasMultipleAccounts,
    setSelectedStorageKey,
    requestPush,
    pushChoice,
    domainItemConfig,
    domainItemStatus,
    handlePull,
    handleRemove,
  } = useDomainConfig();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [cookieEditorEnabled, setCookieEditorEnabled] = useState(false);

  const activeEntryLabel = useMemo(
    () => activeEntry?.label || t('defaultAccount'),
    [activeEntry, t],
  );

  const defaultAccountLabel = t('defaultAccount');
  const showAccountMeta = Boolean(
    activeEntry && shouldShowAccountMeta(activeEntry, entryOptions, defaultAccountLabel),
  );
  const activeAccountMetaLine = activeEntry
    ? formatAccountMetaLine(activeEntry, t, defaultAccountLabel)
    : '';
  const activeAccountSubtitle = activeEntry ? formatAccountOptionSubtitle(activeEntry, t) : undefined;

  const hasKvEntry = Boolean(cookieMap?.domainCookieMap?.[activeStorageKey]);

  const confirmDeleteAccount = async (): Promise<boolean> => {
    if (!activeStorageKey || !hasKvEntry) {
      return false;
    }
    setDeletingAccount(true);
    try {
      const ok = await handleRemove(activeStorageKey);
      if (ok && hasMultipleAccounts) {
        const remaining = entryOptions.filter(entry => entry.storageKey !== activeStorageKey);
        if (remaining.length > 0) {
          await setSelectedStorageKey(remaining[0]!.storageKey);
        }
      }
      return ok;
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async function (tabs) {
      if (tabs.length > 0) {
        const activeTab = tabs[0];
        if (activeTab.url && activeTab.url.startsWith('http')) {
          setFavIconUrl(activeTab?.favIconUrl || '');
          setActiveTabUrl(activeTab.url);
          const [domain, tempPort] = await extractDomainAndPort(activeTab.url);
          setDomain(domain + `${tempPort ? ':' + tempPort : ''}`);
        }
      }
    });
  }, []);

  const isPushingOrPulling = domainItemStatus.pushing || domainItemStatus.pulling;
  const isBusy = isPushingOrPulling || pushing || refreshing;

  const handleRefreshError = (err: unknown) => {
    const code = err instanceof Error ? err.message : 'verify_failed';
    if (code === 'missing_credentials') {
      toast.warning(t('serverUrlPasswordRequired'));
    } else if (code === 'wrong_password') {
      toast.error(t('wrongPassword'));
    } else if (code === 'datasource_not_configured') {
      toast.error(t('datasourceNotConfigured'));
    } else {
      toast.error(t('verifyFailed', { message: code }));
    }
  };

  const runWithRefresh = async (action?: () => void | Promise<void>, showSuccessOnRefreshOnly = false) => {
    try {
      await refreshConnection();
      if (showSuccessOnRefreshOnly && !action) {
        toast.success(t('refreshConnectionSuccess'));
      }
      if (action) {
        await action();
      }
    } catch (err) {
      handleRefreshError(err);
    }
  };

  const handleAndReload = () => {
    void runWithRefresh(() => handlePull(activeTabUrl, activeStorageKey, true));
  };

  if (!isAuthenticated) {
    return (
      <div className="w-[400px] min-w-[400px] max-w-[400px] overflow-hidden bg-background">
        <AccountLoginGate compact />
      </div>
    );
  }

  return (
    <div className="flex w-[400px] min-w-[400px] max-w-[400px] flex-col items-center justify-center overflow-hidden bg-background">
      <header className=" p-2 flex w-full justify-between items-center bg-card/50 shadow-md border-b border-border ">
        <div className="flex items-center">
          <img
            src={chrome.runtime.getURL('options/logo.png')}
            className="h-10 w-10 overflow-hidden object-contain "
            alt="logo"
          />
          <div className="flex flex-col">
            <h2 className="text-base text-foreground	font-bold">{t('appName')}</h2>
            {activeProfile ? (
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                {t('currentProfile', { name: activeProfile.name })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SyncTooltip title={t('refreshConnectionTooltip')}>
            <Button
              type="button"
              variant="ghost"
              disabled={isBusy}
              aria-label={t('refreshConnection')}
              onClick={() => void runWithRefresh(undefined, true)}
              className="cursor-pointer text-sm">
              <RotateCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </Button>
          </SyncTooltip>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              openExtensionOptionsPage();
            }}
            className="cursor-pointer text-sm mr-[-8px] ">
            <Settings size={20} />
          </Button>
        </div>
      </header>
      <main className="w-full min-w-0 overflow-hidden p-4">
        <Spinner show={false}>
          {domain ? (
            <div className="flex flex-col items-center mb-2">
              <div className="flex justify-center items-center">
                <Image src={favIconUrl} />
                <h3 className="text-center whitespace-nowrap text-xl text-primary font-bold">{domain}</h3>
              </div>
              {showAccountMeta ? (
                <p className="text-center text-xs text-muted-foreground mt-1 px-2">{activeAccountMetaLine}</p>
              ) : null}
            </div>
          ) : null}

          {hasMultipleAccounts ? (
            <div className="mb-3 w-full">
              <Label htmlFor="popup-account-select" className="text-xs text-muted-foreground mb-1 block">
                {t('selectAccount')}
              </Label>
              <Select
                value={activeStorageKey}
                onValueChange={value => {
                  void setSelectedStorageKey(value);
                }}>
                <SelectTrigger id="popup-account-select" className="w-full">
                  <SelectValue placeholder={t('selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {entryOptions.map(entry => {
                    const subtitle = formatAccountOptionSubtitle(entry, t);
                    return (
                      <SelectItem key={entry.storageKey} value={entry.storageKey}>
                        <div className="flex flex-col items-start py-0.5">
                          <span>{entry.label}</span>
                          {subtitle ? (
                            <span className="text-xs text-muted-foreground font-normal">{subtitle}</span>
                          ) : null}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <SyncTooltip title={t('switchAndPullHint')}>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full mt-2 justify-start"
                  disabled={!activeTabUrl || isBusy}
                  onClick={() => handleAndReload()}>
                  {domainItemStatus?.pulling ? (
                    <RotateCw size={16} className="mr-2 animate-spin" />
                  ) : (
                    <CloudDownload size={16} className="mr-2" />
                  )}
                  {t('switchAndPull')}
                </Button>
              </SyncTooltip>
              <p className="text-[11px] text-muted-foreground mt-1">
                {activeAccountSubtitle || t('selectAccountHint')}
              </p>
            </div>
          ) : null}

          <div className=" flex flex-col">
            {/* <Button title={cloudflareAccountId} className="mb-2" onClick={handleUpdateToken}>
            Update Token
          </Button> */}
            <div className="flex items-center mb-2 ">
              <Button
                disabled={!activeTabUrl || isBusy}
                className=" mr-2 w-[160px] justify-start"
                onClick={() => void runWithRefresh(() => requestPush(activeTabUrl, favIconUrl))}>
                {domainItemStatus.pushing ? (
                  <RotateCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <CloudUpload size={16} className="mr-2" />
                )}
                {t('pushCookie')}
              </Button>
              <AutoSwitch
                disabled={!activeTabUrl}
                onChange={() => toggleAutoPushState(activeStorageKey)}
                id="autoPush"
                value={!!domainItemConfig.autoPush}
              />
            </div>

            <div className="flex items-center mb-2 ">
              <Button
                disabled={!activeTabUrl || isBusy}
                className=" w-[160px] mr-2 justify-start"
                onClick={() => handleAndReload()}>
                {domainItemStatus?.pulling ? (
                  <RotateCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <CloudDownload size={16} className="mr-2" />
                )}
                {t('pullCookie')}
              </Button>

              <AutoSwitch
                disabled={!activeTabUrl}
                onChange={() => toggleAutoPullState(activeStorageKey)}
                id="autoPull"
                value={!!domainItemConfig.autoPull}
              />
            </div>

            <Button
              className="mb-2 justify-start"
              disabled={isBusy}
              onClick={() =>
                void runWithRefresh(async () => {
                  chrome.windows.getCurrent(async currentWindow => {
                    chrome.sidePanel
                      .open({ windowId: currentWindow.id! })
                      .then(() => {
                        console.log('Side panel opened successfully');
                      })
                      .catch(error => {
                        console.error('Error opening side panel:', error);
                      });
                  });
                })
              }>
              <PanelRightOpen size={16} className="mr-2" />
              {t('openManager')}
            </Button>

            {hasKvEntry ? (
              <Button
                variant="destructive"
                className="mb-2 justify-start"
                disabled={isBusy || deletingAccount}
                onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 size={16} className="mr-2" />
                {hasMultipleAccounts ? t('deleteAccount') : t('deleteDomain')}
              </Button>
            ) : null}

            <div className="mt-2 w-full min-w-0 overflow-hidden border-t border-border pt-3">
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="cookie-editor-toggle" className="text-sm">
                  {t('viewEditCookies')}
                </Label>
                <Switch
                  id="cookie-editor-toggle"
                  checked={cookieEditorEnabled}
                  disabled={!activeTabUrl}
                  onCheckedChange={setCookieEditorEnabled}
                />
              </div>
              {cookieEditorEnabled && domain ? (
                <CookieEditorSection host={domain} tabUrl={activeTabUrl} enabled={cookieEditorEnabled} />
              ) : null}
            </div>
          </div>
          <DeleteAccountDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            labels={{
              title: hasMultipleAccounts ? t('deleteAccount') : t('deleteDomain'),
              description: hasMultipleAccounts
                ? t('deleteAccountConfirm', { host: domain, label: activeEntryLabel })
                : t('deleteDomainConfirm', { host: domain }),
              cancel: t('cancel'),
              confirm: t('delete'),
            }}
            saving={deletingAccount}
            onConfirm={confirmDeleteAccount}
          />
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
              entryMeta: {
                folder: t('folder'),
                entryType: t('entryType'),
                noFolder: t('noFolder'),
                allTypes: t('allTypes'),
                typeLogin: t('typeLogin'),
                typeSession: t('typeSession'),
                typeOther: t('typeOther'),
              },
            }}
            overwriteOptions={pushChoice.overwriteOptionsWithMeta}
            overwriteKey={pushChoice.overwriteKey}
            newLabel={pushChoice.newLabel}
            newFolder={pushChoice.newFolder}
            newType={pushChoice.newType}
            folderOptions={pushChoice.folderOptions}
            saving={pushChoice.saving}
            onOverwriteKeyChange={pushChoice.setOverwriteKey}
            onNewLabelChange={pushChoice.setNewLabel}
            onNewFolderChange={pushChoice.setNewFolder}
            onNewTypeChange={pushChoice.setNewType}
            onOverwrite={() => void pushChoice.confirmOverwrite()}
            onConfirmNew={() => void pushChoice.confirmSaveNew()}
            onSaveAsNew={() => pushChoice.setStep('newLabel')}
            onBack={() => pushChoice.setStep('choose')}
            onClose={pushChoice.closeDialog}
          />
          <Toaster
            theme={theme}
            closeButton
            toastOptions={{
              duration: 1500,
              style: {
                // width: 'max-content',
                // margin: '0 auto',
              },
              // className: 'w-[240px]',
            }}
            visibleToasts={1}
            richColors
            position="top-center"
          />
        </Spinner>
      </main>
      <footer className="w-full text-center justify-center p-4 flex items-center border-t border-border/90 ">
        <span>
          <Copyright size={16} />
        </span>
        <a
          className="inline-flex items-center mx-1 text-sm underline"
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer">
          sync-your-cookie
        </a>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={chrome.runtime.getURL('popup/github.svg')}
            className="h-4 w-4 overflow-hidden object-contain "
            alt="GitHub"
          />
        </a>
        <span className="ml-2 text-xs text-muted-foreground">v{getExtensionVersion()}</span>
      </footer>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingFallback />), <ErrorFallback />);
