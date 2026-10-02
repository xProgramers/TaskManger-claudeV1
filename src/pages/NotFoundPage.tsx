import { Link } from '@/lib/router';

export function NotFoundPage() {
  return (
    <div className="max-w-[960px] pt-12">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-ink">Página não encontrada</h1>
      <p className="mt-2 text-base text-ink-2">O endereço pode ter mudado ou não existe.</p>
      <Link to="/" className="mt-4 inline-block text-base font-semibold text-accent hover:underline">
        Ir para Hoje
      </Link>
    </div>
  );
}
