/**
 * User-facing error handling. Technical details go to the console; the user
 * only ever sees a short message that says what failed and what to do.
 */

export class AppError extends Error {
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = 'AppError';
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

interface ErrorLike {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
}

const AUTH_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'],
  [/user already registered/i, 'Já existe uma conta com este e-mail. Tente entrar.'],
  [/password should be at least/i, 'A senha precisa ter pelo menos 8 caracteres.'],
  [/new password should be different/i, 'A nova senha precisa ser diferente da atual.'],
  [/rate limit|too many requests/i, 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.'],
  [/unable to validate email|invalid email/i, 'Este e-mail não parece válido.'],
  [/weak password|pwned/i, 'Esta senha é fácil de adivinhar. Escolha outra.'],
];

/**
 * Converts anything thrown by Supabase/fetch into an AppError with a friendly
 * message. `fallback` describes the action, e.g. "Não foi possível salvar a tarefa."
 */
export function toAppError(error: unknown, fallback: string): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as ErrorLike;
  const raw = `${e.message ?? ''}`;

  console.error(`[prumo] ${fallback}`, error);

  for (const [re, msg] of AUTH_MESSAGES) {
    if (re.test(raw)) return new AppError(msg, error);
  }
  if (e.name === 'TypeError' && /fetch|network/i.test(raw)) {
    return new AppError('Sem conexão com o servidor. Verifique sua internet e tente novamente.', error);
  }
  switch (e.code) {
    case '23505':
      return new AppError(
        /categor/i.test(raw)
          ? 'Já existe uma categoria com esse nome.'
          : /boards/i.test(raw)
            ? 'Já existe um ambiente com esse nome.'
            : `${fallback} Esse item já existe.`,
        error,
      );
    case '23514':
    case '22P02':
    case '22007':
      return new AppError(`${fallback} Confira os dados informados.`, error);
    case '42501':
    case 'PGRST301':
      return new AppError('Sua sessão expirou. Entre novamente.', error);
    case 'PGRST116':
      return new AppError('Este item não existe mais.', error);
  }
  return new AppError(`${fallback} Tente novamente.`, error);
}

export function errorMessage(error: unknown, fallback = 'Algo deu errado.'): string {
  return error instanceof AppError ? error.userMessage : toAppError(error, fallback).userMessage;
}
