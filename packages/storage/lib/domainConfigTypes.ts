export type DomainItemConfig = {
  autoPull?: boolean;
  autoPush?: boolean;
  favIconUrl?: string;
  sourceUrl?: string;
};

export interface DomainConfig {
  domainMap: {
    [host: string]: DomainItemConfig;
  };
}

export const defaultDomainConfig = (): DomainConfig => ({
  domainMap: {},
});
