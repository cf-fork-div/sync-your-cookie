import { pullCookies, useI18n, useStorageSuspense } from '@sync-your-cookie/shared';
import { accountProfileStorage } from '@sync-your-cookie/storage/lib/accountProfileStorage';
import { cookieStorage } from '@sync-your-cookie/storage/lib/cookieStorage';
import { domainStatusStorage } from '@sync-your-cookie/storage/lib/domainStatusStorage';
import { settingsStorage } from '@sync-your-cookie/storage/lib/settingsStorage';
import { Input, Label, Popover, PopoverContent, PopoverTrigger, Switch, SyncTooltip, Alert, AlertDescription } from '@sync-your-cookie/ui';
import { Eye, EyeOff, Info, Lock, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { StorageSelect } from './StorageSelect';

interface SettingsPopover {
  trigger: React.ReactNode;
}

export function SettingsPopover({ trigger }: SettingsPopover) {
  const { t } = useI18n();
  const settingsInfo = useStorageSuspense(settingsStorage);
  const profileState = useStorageSuspense(accountProfileStorage);
  const [selectOpen, setSelectOpen] = useState(false);
  const [openEye, setOpenEye] = useState(false);

  const handleCheckChange = (
    checked: boolean,
    checkedKey: 'protobufEncoding' | 'includeLocalStorage' | 'contextMenu' | 'encryptionEnabled',
  ) => {
    settingsStorage.update({
      [checkedKey]: checked,
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    settingsStorage.update({
      encryptionPassword: e.target.value,
    });
  };

  const handleValueChange = (value: string) => {
    settingsStorage.update({
      storageKey: value,
    });
  };

  const reset = async () => {
    await domainStatusStorage.resetState();
    await cookieStorage.reset();
    await pullCookies();
    console.log('reset finished');
  };

  useEffect(() => {
    reset();
  }, [settingsInfo.storageKey, profileState.activeProfileId]);

  const handleToggleEye = () => {
    setOpenEye(!openEye);
  };

  const handleOpenChange = (open: boolean) => {
    if (selectOpen) return;
  };

  const handleSelectOpenChange = (open: boolean) => {
    console.log('select open', open);
    setSelectOpen(open);
  };

  const handleAddStorageKey = async (key: string) => {
    await settingsStorage.addStorageKey(key);
  };

  const handleRemoveStorageKey = async (key: string) => {
    await settingsStorage.removeStorageKey(key);
  };

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-[328px]">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h3 className="leading-none font-medium text-base">{t('saveSettings')}</h3>
            <p className="text-muted-foreground text-sm">{t('saveSettingsDesc')}</p>
          </div>
          <div className="gap-2">
            <div className="flex items-center gap-4 mb-4">
              <Label className="w-[136px] block text-right" htmlFor="storage-key">
                {t('storageKey')}
              </Label>
              <StorageSelect
                options={settingsInfo.storageKeyList}
                open={selectOpen}
                onOpenChange={handleSelectOpenChange}
                value={settingsInfo.storageKey || ''}
                onAdd={handleAddStorageKey}
                onRemove={handleRemoveStorageKey}
                onValueChange={handleValueChange}
              />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <Label className="whitespace-nowrap block w-[136px] justify-end text-right" htmlFor="encoding">
                {t('protobufEncoding')}
              </Label>
              <Switch
                onCheckedChange={checked => handleCheckChange(checked, 'protobufEncoding')}
                checked={settingsInfo.protobufEncoding}
                id="encoding"
              />
            </div>

            <div className="flex items-center gap-4 mb-4">
              <Label
                className="items-center  whitespace-nowrap flex w-[136px] justify-end text-right"
                htmlFor="include">
                {t('includeLocalStorage')}
              </Label>
              <div className="flex items-center gap-1">
                <Switch
                  onCheckedChange={checked => handleCheckChange(checked, 'includeLocalStorage')}
                  checked={settingsInfo.includeLocalStorage}
                  id="include"
                />
                <SyncTooltip title={t('includeLocalStorageNote')}>
                  <Info className="mx-2" size={18} />
                </SyncTooltip>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <Label
                className="items-center whitespace-nowrap flex w-[136px] justify-end text-right"
                htmlFor="contextMenu">
                {t('showContextMenu')}
              </Label>
              <div className="flex items-center gap-1">
                <Switch
                  onCheckedChange={checked => handleCheckChange(checked, 'contextMenu')}
                  checked={settingsInfo.contextMenu}
                  id="contextMenu"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              {settingsInfo.protobufEncoding && !settingsInfo.encryptionEnabled && (
                <Alert className="mb-4">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>{t('encryptionSecurityWarning')}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-4 mb-4">
                <Label
                  className="items-center whitespace-nowrap flex w-[136px] justify-end text-right"
                  htmlFor="encryption">
                  <Lock size={14} className="mr-1" />
                  {t('e2eEncryption')}
                </Label>
                <div className="flex items-center gap-1">
                  <Switch
                    onCheckedChange={checked => handleCheckChange(checked, 'encryptionEnabled')}
                    checked={settingsInfo.encryptionEnabled}
                    disabled={!settingsInfo.protobufEncoding}
                    id="encryption"
                  />
                  <SyncTooltip title={t('e2eEncryptionNote')}>
                    <Info className="mx-2" size={18} />
                  </SyncTooltip>
                </div>
              </div>

              {settingsInfo.encryptionEnabled && settingsInfo.protobufEncoding && (
                <div className="flex items-center gap-2">
                  <Label
                    className="items-center mr-2 whitespace-nowrap flex w-[136px] justify-end text-right"
                    htmlFor="encryptionPassword">
                    {t('password')}
                  </Label>
                  <Input
                    type={openEye ? 'text' : 'password'}
                    id="encryptionPassword"
                    value={settingsInfo.encryptionPassword || ''}
                    onChange={handlePasswordChange}
                    className="h-8 flex-1"
                    placeholder={t('encryptionPasswordPlaceholder')}
                  />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleEye()}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleToggleEye();
                      }
                    }}
                    className="cursor-pointer mr-4">
                    {openEye ? <EyeOff size={18} /> : <Eye size={18} />}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
