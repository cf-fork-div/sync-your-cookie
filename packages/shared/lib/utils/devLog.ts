function getNodeEnv(): string | undefined {
  const g = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return g.process?.env?.NODE_ENV;
}

const isProduction = getNodeEnv() === 'production';

export function devLog(...args: unknown[]): void {
  if (!isProduction) {
    console.log(...args);
  }
}

export function devWarn(...args: unknown[]): void {
  if (!isProduction) {
    console.warn(...args);
  }
}
