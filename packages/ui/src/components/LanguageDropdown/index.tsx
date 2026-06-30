import { Languages } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type LocalePreference = 'system' | 'en' | 'zh_CN';

interface LanguageDropdownProps {
  locale: LocalePreference;
  setLocale: (locale: LocalePreference) => void;
  labels: {
    language: string;
    followSystem: string;
    english: string;
    chinese: string;
  };
}

export function LanguageDropdown({ locale, setLocale, labels }: LanguageDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">{labels.language}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLocale('system')}>
          {labels.followSystem}
          {locale === 'system' ? ' ✓' : ''}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('en')}>
          {labels.english}
          {locale === 'en' ? ' ✓' : ''}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocale('zh_CN')}>
          {labels.chinese}
          {locale === 'zh_CN' ? ' ✓' : ''}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
