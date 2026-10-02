import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { ReminderOffset, ThemePreference } from '@/types';
import { REMINDER_OFFSETS } from '@/types';
import { api } from '@/services';
import { env } from '@/lib/env';
import {
  currentPermission,
  disablePushOnThisDevice,
  enableBrowserNotifications,
  isIOS,
  isStandalone,
  type PermissionState,
} from '@/lib/browserNotifications';
import { availableTimeZones, formatReminderOffset } from '@/utils/dates';
import { errorMessage } from '@/utils/errors';
import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useTaskUI } from '@/contexts/TaskUIContext';
import { useToast } from '@/contexts/ToastContext';
import { useCategories } from '@/hooks/useCategories';
import { PageTitle } from '@/components/PageParts';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input, Segmented, Select, Switch } from '@/components/ui/Form';
import { Skeleton } from '@/components/ui/Spinner';
import { LogOutIcon, MonitorIcon, MoonIcon, SunIcon, TagIcon } from '@/components/icons';

function Card({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line py-7 md:grid md:grid-cols-[220px_1fr] md:gap-10">
      <div className="mb-4 md:mb-0">
        <h2 id={`${id}-title`} className="text-md font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className="text-base font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { prefs, update } = usePreferences();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const save = async (patch: Parameters<typeof update>[0], message = 'Preferência salva') => {
    try {
      await update(patch);
      toast({ message });
    } catch (e) {
      toast({ tone: 'error', message: errorMessage(e, 'Não foi possível salvar.') });
    }
  };

  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
  }, []);

  if (!prefs) {
    return (
      <div className="flex max-w-[960px] flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[960px]">
      <PageTitle title="Configurações" />
      <div className="mt-6">
        <AccountSection name={prefs.full_name ?? ''} email={user?.email ?? ''} onSave={(full_name) => save({ full_name }, 'Nome atualizado')} />

        <Card id="aparencia" title="Aparência" description="O tema escuro foi desenhado para uso prolongado, não é só uma inversão.">
          <Row label="Tema">
            <Segmented<ThemePreference>
              label="Tema"
              value={prefs.theme}
              onChange={(theme) => void save({ theme }, 'Tema alterado')}
              options={[
                { value: 'light', label: 'Claro', icon: <SunIcon size={14} /> },
                { value: 'dark', label: 'Escuro', icon: <MoonIcon size={14} /> },
                { value: 'system', label: 'Sistema', icon: <MonitorIcon size={14} /> },
              ]}
            />
          </Row>
        </Card>

        <NotificationsSection
          enabled={prefs.notifications_enabled}
          defaultReminder={prefs.default_reminder_minutes}
          onToggle={(v) => save({ notifications_enabled: v }, v ? 'Notificações ativadas' : 'Notificações desativadas')}
          onDefault={(v) => save({ default_reminder_minutes: v }, 'Lembrete padrão atualizado')}
        />

        <Card id="preferencias" title="Preferências" description="Como datas e horários aparecem para você.">
          <Row label="Primeiro dia da semana">
            <Segmented<'0' | '1'>
              label="Primeiro dia da semana"
              value={String(prefs.week_starts_on) as '0' | '1'}
              onChange={(v) => void save({ week_starts_on: Number(v) as 0 | 1 })}
              options={[
                { value: '0', label: 'Domingo' },
                { value: '1', label: 'Segunda' },
              ]}
            />
          </Row>
          <Row label="Formato de horário">
            <Segmented<'24h' | '12h'>
              label="Formato de horário"
              value={prefs.time_format}
              onChange={(v) => void save({ time_format: v })}
              options={[
                { value: '24h', label: '18:00' },
                { value: '12h', label: '6:00 PM' },
              ]}
            />
          </Row>
          <Row label="Fuso horário" description="Usado para datas, atrasos e para disparar lembretes na hora certa.">
            <Select
              aria-label="Fuso horário"
              value={prefs.timezone}
              onChange={(e) => void save({ timezone: e.target.value }, 'Fuso horário atualizado')}
              className="w-full sm:w-64"
            >
              {availableTimeZones().map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </Row>
          <CategoriesRow />
        </Card>

        <PasswordSection />

        <Card id="sessao" title="Sessão">
          <Row label="Sair da conta" description={user?.email}>
            <Button leading={<LogOutIcon size={15} />} onClick={() => void signOut()}>
              Sair
            </Button>
          </Row>
          {api.mode === 'demo' && <DemoReset />}
        </Card>
      </div>
    </div>
  );
}

function AccountSection({ name, email, onSave }: { name: string; email: string; onSave: (name: string | null) => Promise<void> }) {
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(name), [name]);
  const dirty = value.trim() !== name;

  return (
    <Card id="conta" title="Conta" description="Como você aparece no Prumo.">
      <div className="flex items-center gap-4">
        <Avatar name={value || name} email={email} size={48} />
        <div className="min-w-0">
          <p className="truncate text-md font-semibold text-ink">{name || 'Sem nome'}</p>
          <p className="truncate text-sm text-ink-3">{email}</p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          await onSave(value.trim() || null);
          setSaving(false);
        }}
      >
        <Field label="Nome" className="min-w-[220px] flex-1">
          {(p) => <Input {...p} value={value} maxLength={120} autoComplete="name" onChange={(e) => setValue(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={!dirty} loading={saving}>
          Salvar nome
        </Button>
      </form>
      <Field label="E-mail" hint="O e-mail é usado para entrar e não pode ser alterado aqui.">
        {(p) => <Input {...p} value={email} readOnly disabled />}
      </Field>
    </Card>
  );
}

function NotificationsSection({
  enabled,
  defaultReminder,
  onToggle,
  onDefault,
}: {
  enabled: boolean;
  defaultReminder: ReminderOffset | null;
  onToggle: (v: boolean) => Promise<void>;
  onDefault: (v: ReminderOffset | null) => Promise<void>;
}) {
  const { toast } = useToast();
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const [busy, setBusy] = useState(false);

  const permissionText: Record<PermissionState, string> = {
    granted: 'Permitidas neste navegador. Você recebe avisos mesmo com a aba em segundo plano.',
    default: 'Ainda não autorizadas neste navegador.',
    denied: 'Bloqueadas neste navegador. Para liberar, use o ícone de cadeado ao lado do endereço do site.',
    unsupported:
      isIOS() && !isStandalone()
        ? 'No iPhone/iPad, adicione o Prumo à Tela de Início para receber notificações.'
        : 'Este navegador não suporta notificações do sistema.',
  };

  return (
    <Card id="notificacoes" title="Notificações" description="Lembretes ficam sempre salvos no sino do app; aqui você decide se também quer avisos do sistema.">
      <Switch
        label="Receber lembretes"
        description="Avisos no app e, quando permitido, notificações do navegador."
        checked={enabled}
        onChange={async (v) => {
          await onToggle(v);
          if (!v) await disablePushOnThisDevice(api.push).catch(() => undefined);
          else if (permission === 'granted') await enableBrowserNotifications(api.push);
        }}
      />
      <Row label="Notificações do navegador" description={permissionText[permission]}>
        {permission === 'default' && enabled && (
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const r = await enableBrowserNotifications(api.push);
              setPermission(r);
              setBusy(false);
              if (r === 'granted') toast({ message: 'Notificações ativadas' });
            }}
          >
            Permitir
          </Button>
        )}
      </Row>
      <Row label="Lembrete padrão" description="Aplicado ao criar tarefas com horário. Você pode mudar em cada tarefa.">
        <Select
          aria-label="Lembrete padrão"
          value={defaultReminder === null ? 'none' : String(defaultReminder)}
          onChange={(e) => void onDefault(e.target.value === 'none' ? null : (Number(e.target.value) as ReminderOffset))}
          className="w-full sm:w-56"
        >
          <option value="none">Sem lembrete</option>
          {REMINDER_OFFSETS.map((m) => (
            <option key={m} value={m}>
              {formatReminderOffset(m)}
            </option>
          ))}
        </Select>
      </Row>
      {!env.vapidPublicKey && api.mode === 'supabase' && (
        <p className="text-sm text-ink-3">Web Push não configurado (VITE_VAPID_PUBLIC_KEY ausente): avisos só com o app aberto.</p>
      )}
    </Card>
  );
}

function CategoriesRow() {
  const { openCategories } = useTaskUI();
  const { categories } = useCategories();
  return (
    <Row label="Categorias" description={categories.length ? `${categories.length} criadas` : 'Nenhuma ainda'}>
      <Button leading={<TagIcon size={15} />} onClick={openCategories}>
        Gerenciar categorias
      </Button>
    </Row>
  );
}

function PasswordSection() {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não são iguais.');
    setSaving(true);
    setError(null);
    try {
      await api.auth.updatePassword(password);
      setPassword('');
      setConfirm('');
      toast({ message: 'Senha alterada' });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível alterar a senha.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="seguranca" title="Segurança" description="Use pelo menos 8 caracteres.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha" error={error}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Confirmar nova senha">
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
        </div>
        <div>
          <Button type="submit" loading={saving} disabled={!password}>
            Alterar senha
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DemoReset() {
  return (
    <Row label="Dados demonstrativos" description="Restaura as tarefas de exemplo deste navegador.">
      <Button
        onClick={async () => {
          const { resetDemoDb } = await import('@/services/mock/db');
          resetDemoDb();
          window.location.assign('/');
        }}
      >
        Restaurar exemplos
      </Button>
    </Row>
  );
}
