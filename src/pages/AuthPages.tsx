import { useState, type FormEvent } from 'react';
import { api } from '@/services';
import { Link, useRouter } from '@/lib/router';
import { errorMessage } from '@/utils/errors';
import { browserTimeZone } from '@/utils/dates';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { EyeIcon, EyeOffIcon, MailIcon } from '@/components/icons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-sm border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

function PasswordInput(props: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) {
  const [visible, setVisible] = useState(false);
  const { onChange, ...rest } = props;
  return (
    <div className="relative">
      <Input {...rest} type={visible ? 'text' : 'password'} onChange={(e) => onChange(e.target.value)} className="pr-10" required />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xs p-1.5 text-ink-3 hover:text-ink"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError('Informe um e-mail válido.');
    if (!password) return setError('Informe sua senha.');
    setLoading(true);
    setError(null);
    try {
      await api.auth.signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível entrar.'));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Bom te ver de novo."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-accent hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="E-mail">
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
        </Field>
        <Field
          label="Senha"
          hint={
            <Link to="/recuperar-senha" className="text-accent hover:underline">
              Esqueci minha senha
            </Link>
          }
        >
          {(p) => <PasswordInput {...p} value={password} onChange={setPassword} autoComplete="current-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { navigate } = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Informe seu nome.');
    if (!EMAIL_RE.test(email.trim())) return setError('Informe um e-mail válido.');
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    setLoading(true);
    setError(null);
    try {
      const { needsConfirmation } = await api.auth.signUp({ email, password, fullName: name, timezone: browserTimeZone() });
      if (needsConfirmation) setSentTo(email.trim());
      else navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível criar sua conta.'));
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout title="Confirme seu e-mail" subtitle={<>Enviamos um link de confirmação para <strong className="font-semibold text-ink">{sentTo}</strong>.</>}>
        <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-4 text-base text-ink-2">
          <MailIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          Abra o e-mail e toque no link para ativar sua conta. Depois disso, você entra direto no app.
        </div>
        <Link to="/entrar" className="mt-6 inline-block text-base font-semibold text-accent hover:underline">
          Voltar para o login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-accent hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Nome">
          {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus />}
        </Field>
        <Field label="E-mail">
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Senha" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
          {(p) => <PasswordInput {...p} value={password} onChange={setPassword} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError('Informe um e-mail válido.');
    setLoading(true);
    setError(null);
    try {
      await api.auth.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível enviar o e-mail.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle={sent ? undefined : 'Enviaremos um link para você criar uma nova senha.'}
      footer={
        <Link to="/entrar" className="font-semibold text-accent hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="flex items-start gap-3 rounded-md border border-line bg-surface p-4 text-base text-ink-2">
          <MailIcon size={18} className="mt-0.5 shrink-0 text-accent" />
          Se existir uma conta com {email.trim()}, você vai receber o link em instantes. Confira também a caixa de spam.
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormError message={error} />
          <Field label="E-mail">
            {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { navigate } = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    if (password !== confirm) return setError('As senhas não são iguais.');
    setLoading(true);
    setError(null);
    try {
      await api.auth.updatePassword(password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível alterar a senha.'));
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha para entrar daqui em diante.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormError message={error} />
        <Field label="Nova senha" hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}>
          {(p) => <PasswordInput {...p} value={password} onChange={setPassword} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha">
          {(p) => <PasswordInput {...p} value={confirm} onChange={setConfirm} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  );
}
