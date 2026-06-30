import { UserCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface AccountProfileOption {
  id: string;
  name: string;
}

interface AccountProfileDropdownProps {
  profiles: AccountProfileOption[];
  activeProfileId?: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  labels: {
    accountProfile: string;
    addProfile: string;
    switchProfile: string;
  };
}

export function AccountProfileDropdown({
  profiles,
  activeProfileId,
  onSelect,
  onAdd,
  labels,
}: AccountProfileDropdownProps) {
  const activeProfile = profiles.find(profile => profile.id === activeProfileId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[200px]">
          <UserCircle className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{activeProfile?.name || labels.accountProfile}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {profiles.map(profile => (
          <DropdownMenuItem key={profile.id} onClick={() => onSelect(profile.id)}>
            {profile.name}
            {profile.id === activeProfileId ? ' ✓' : ''}
          </DropdownMenuItem>
        ))}
        {onAdd ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onAdd}>{labels.addProfile}</DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
