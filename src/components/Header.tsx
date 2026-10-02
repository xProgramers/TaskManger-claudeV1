import { useRouter } from '@/lib/router';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import { LogOutIcon, LogoMark, PlusIcon, SearchIcon, SettingsIcon, TagIcon } from './icons';
import { Button, IconButton } from './ui/Button';
import { Kbd } from './ui/Form';
import { Menu, MenuItem, MenuSeparator } from './ui/Layer';

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
export const MOD_LABEL = isMac ? '⌘' : 'Ctrl';

export function Header() {
  const { openSearch, openCreate, openCategories } = useTaskUI();
  const { user, signOut } = useAuth();
  const { prefs } = usePreferences();
  const { navigate } = useRouter();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-2 md:hidden">
        <LogoMark size={24} />
        <span className="text-md font-semibold text-ink">Prumo</span>
      </div>

      <button
        type="button"
        onClick={openSearch}
        className="hidden h-8 w-full max-w-[340px] items-center gap-2 rounded-sm border border-line bg-surface px-2.5 text-left text-base text-ink-3 transition-colors hover:border-line-strong md:flex"
        aria-label="Buscar tarefas"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <SearchIcon />
        <span className="flex-1">Buscar tarefas</span>
        <Kbd>{MOD_LABEL} K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label="Buscar tarefas" onClick={openSearch} className="md:hidden">
          <SearchIcon size={18} />
        </IconButton>
        {/* On phones the floating button takes this role. */}
        <div className="mr-1.5 hidden md:block">
          <Button
            variant="primary"
            onClick={() => openCreate()}
            leading={<PlusIcon size={15} />}
            aria-keyshortcuts="N"
          >
            Nova tarefa
            <Kbd inverse className="ml-0.5">
              N
            </Kbd>
          </Button>
        </div>
        <NotificationBell />
        <Menu
          label="Conta"
          trigger={(t) => (
            <button
              ref={t.ref}
              type="button"
              onClick={t.onClick}
              aria-haspopup={t['aria-haspopup']}
              aria-expanded={t['aria-expanded']}
              aria-label="Menu da conta"
              className="ml-1 rounded-full"
            >
              <Avatar name={prefs?.full_name} email={user?.email} size={28} />
            </button>
          )}
        >
          <div className="px-2.5 pt-1.5 pb-2">
            <p className="truncate text-base font-medium text-ink">{prefs?.full_name || 'Sua conta'}</p>
            <p className="truncate text-sm text-ink-3">{user?.email}</p>
          </div>
          <MenuSeparator />
          <MenuItem icon={<SettingsIcon />} onSelect={() => navigate('/configuracoes')}>
            Configurações
          </MenuItem>
          <MenuItem icon={<TagIcon />} onSelect={openCategories}>
            Categorias
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOutIcon />} onSelect={() => void signOut()}>
            Sair
          </MenuItem>
        </Menu>
      </div>
    </header>
  );
}
