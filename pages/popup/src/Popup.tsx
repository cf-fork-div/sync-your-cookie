import {
  ErrorFallback,
  extractDomainAndPort,
  GITHUB_REPO_URL,
  LoadingFallback,
  openExtensionOptionsPage,
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
import { Button, Image, Label, PushAccountDialog, DeleteAccountDialog, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Spinner, Toaster } from '@sync-your-cookie/ui';
import { CloudDownload, CloudUpload, Copyright, PanelRightOpen, RotateCw, Settings, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { AutoSwitch } from './components/AutoSwtich';
import { AccountLoginGate } from './components/AccountLoginGate';
import { useDomainConfig } from './hooks/useDomainConfig';

const Popup = () => {
  const { theme } = useTheme();
  const { t } = useI18n();
  useDocumentTitle('pageTitlePopup');
  const { isAuthenticated } = useAccountAuth();
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

  const activeEntryLabel = useMemo(
    () => entryOptions.find(entry => entry.storageKey === activeStorageKey)?.label || t('defaultAccount'),
    [entryOptions, activeStorageKey, t],
  );

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

  const handleAndReload = () => {
    handlePull(activeTabUrl, activeStorageKey, true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-w-[400px] bg-background">
        <AccountLoginGate compact />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-w-[400px] justify-center bg-background ">
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            openExtensionOptionsPage();
          }}
          className="cursor-pointer text-sm mr-[-8px] ">
          <Settings size={20} />
        </Button>
      </header>
      <main className="p-4 ">
        <Spinner show={false}>
          {domain ? (
            <div className="flex justify-center items-center mb-2  ">
              <Image src={favIconUrl} />
              <h3 className="text-center whitespace-nowrap text-xl text-primary font-bold">{domain}</h3>
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
                  {entryOptions.map(entry => (
                    <SelectItem key={entry.storageKey} value={entry.storageKey}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">{t('selectAccountHint')}</p>
            </div>
          ) : null}

          <div className=" flex flex-col">
            {/* <Button title={cloudflareAccountId} className="mb-2" onClick={handleUpdateToken}>
            Update Token
          </Button> */}
            <div className="flex items-center mb-2 ">
              <Button
                disabled={!activeTabUrl || isPushingOrPulling || pushing}
                className=" mr-2 w-[160px] justify-start"
                onClick={() => void requestPush(activeTabUrl, favIconUrl)}>
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
                disabled={!activeTabUrl || isPushingOrPulling}
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
              onClick={async () => {
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
              }}>
              <PanelRightOpen size={16} className="mr-2" />
              {t('openManager')}
            </Button>

            {hasKvEntry ? (
              <Button
                variant="destructive"
                className="mb-2 justify-start"
                disabled={isPushingOrPulling || pushing || deletingAccount}
                onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 size={16} className="mr-2" />
                {hasMultipleAccounts ? t('deleteAccount') : t('deleteDomain')}
              </Button>
            ) : null}
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
          cf-fork-div
        </a>
        <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={chrome.runtime.getURL('popup/github.svg')}
            className="h-4 w-4 overflow-hidden object-contain "
            alt="GitHub"
          />
        </a>
      </footer>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingFallback />), <ErrorFallback />);
