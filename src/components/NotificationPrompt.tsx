import { useState } from 'react';
import { api } from '@/services';
import {
  currentPermission,
  enableBrowserNotifications,
  isIOS,
  isStandalone,
  notificationsSupported,
  type PermissionState,
} from '@/lib/browserNotifications';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useToast } from '@/contexts/ToastContext';
import { BellIcon, XIcon } from './icons';
import { Button } from './ui/Button';

const DISMISS_KEY = 'prumo:notif-prompt-dismissed';

/**
 * Asks for browser notification permission at a calm moment (on the Today
 * screen, never on load as a popup), and only while it can still be granted.
 */
export function NotificationPrompt() {
  const { prefs } = usePreferences();
  const { toast } = useToast();
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);

  const iosNeedsInstall = isIOS() && !isStandalone() && !notificationsSupported();
  if (dismissed || !prefs?.notifications_enabled || (permission !== 'default' && !iosNeedsInstall)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <BellIcon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-ink">Ative as notificações para receber lembretes das suas tarefas.</p>
        <p className="mt-0.5 text-sm text-ink-2">
          {iosNeedsInstall
            ? 'No iPhone, adicione o Prumo à Tela de Início (Compartilhar → Adicionar à Tela de Início) para receber lembretes.'
            : 'Você recebe um aviso no horário que escolher, mesmo com outra aba aberta.'}
        </p>
        {!iosNeedsInstall && (
          <Button
            variant="primary"
            size="sm"
            className="mt-2.5"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const result = await enableBrowserNotifications(api.push);
              setPermission(result);
              setBusy(false);
              if (result === 'granted') toast({ message: 'Notificações ativadas' });
              else if (result === 'denied')
                toast({
                  tone: 'info',
                  message: 'Notificações bloqueadas pelo navegador',
                  description: 'Os lembretes continuam aparecendo no sino do app.',
                });
            }}
          >
            Ativar notificações
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar aviso de notificações"
        className="-mt-0.5 -mr-1 rounded-xs p-1 text-ink-3 hover:bg-hover hover:text-ink"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
