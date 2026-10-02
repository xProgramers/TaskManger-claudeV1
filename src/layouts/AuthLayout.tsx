import type { ReactNode } from 'react';
import { env } from '@/lib/env';
import { LogoMark } from '@/components/icons';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <main className="flex flex-1 items-start justify-center px-4 pt-[12vh] pb-12">
        <div className="w-full max-w-[380px]">
          <div className="flex items-center gap-2.5">
            <LogoMark size={30} />
            <span className="text-xl font-semibold tracking-[-0.01em] text-ink">Prumo</span>
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-base text-ink-2">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-base text-ink-2">{footer}</div>}
          {env.demoMode && (
            <p className="mt-8 rounded-sm border border-dashed border-line-strong px-3 py-2 text-sm text-ink-3">
              Modo demonstração: os dados ficam só neste navegador. Qualquer e-mail e senha funcionam.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
