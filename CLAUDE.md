# Prumo — contexto para o Claude

Gerenciador de tarefas pessoal em produção. Filosofia: poucas funcionalidades, todas bem executadas. Escolha sempre melhor experiência em vez de mais funcionalidades.

## Onde as coisas vivem
- **Código**: este repositório (`main` = produção).
- **Site**: https://task-manger-claude-v1.vercel.app — a Vercel publica automaticamente cada push no `main`.
- **Backend**: Supabase, projeto `tarefas-app` (ref `yiishlvvnklntrrbrdyt`, região São Paulo). Auth, Postgres com RLS, Realtime, pg_cron e a Edge Function `send-reminders`.
- Segredos (chaves VAPID, segredo do dispatcher) ficam no Supabase Vault, nunca no repositório.

## Stack e convenções
- React 19 + TypeScript + Vite + Tailwind CSS v4 (tokens em `src/styles/index.css`). Runtime: só `react`, `react-dom` e `@supabase/supabase-js`.
- Roteador, cache de consultas (`src/lib/query.ts`), componentes acessíveis (`src/components/ui/`) e ícones são internos. Não adicione dependências sem necessidade clara.
- UI só fala com `src/services/api.ts`. Há duas implementações: `services/supabase/` (produção) e `services/mock/` (dados demonstrativos, `npm run dev:demo`). Mudanças no contrato valem para as duas.
- Regras de negócio puras em `src/utils/` (datas/fuso, parser da criação rápida, regras de tarefa), com testes em `npm test`.
- Imports com alias `@/` no app; `src/utils` e `src/types` usam imports relativos com extensão `.ts`, para os testes rodarem com Node puro.
- Textos da interface em pt-BR, tom direto, sem jargão técnico. Erros para o usuário via `toAppError`; detalhes técnicos só no console.

## Banco de dados
- Toda mudança de schema vira um arquivo novo em `supabase/migrations/` (nunca edite migrations já aplicadas) e é aplicada no projeto Supabase.
- RLS em todas as tabelas; nada para `anon`. Validações importantes também como `CHECK` no banco.
- `tasks.due_at` e os lembretes são derivados por trigger a partir de `due_date` + `due_time` + `timezone`. Não calcule isso só no front.
- Lembretes: trigger cria/atualiza `notifications` (`pending`); pg_cron chama `dispatch_due_notifications()` a cada minuto (idempotente); Realtime avisa abas abertas; a Edge Function envia Web Push.
- Depois de alterar o schema, regenere `src/types/database.ts` e rode os advisors de segurança do Supabase.

## Antes de dar algo por pronto
1. `npm test` e `npm run build` (o build roda `tsc -b`; erro de tipo quebra o deploy da Vercel).
2. Testar o fluxo na interface (dá para usar `npm run dev:demo` sem backend).
3. Commit e push no `main`; acompanhar o deploy na Vercel.

## Quadro (notas adesivas)
Tela `/quadro`: quadro infinito com pan (arrastar o fundo, roda do mouse) e zoom 25–200% (Ctrl+roda, pinça, botões, teclas + - 0 F). Posição das notas em pixels do "mundo" a 100% (`notes.pos_x/pos_y`, expostas no app como `x/y`; as colunas antigas `x/y` são legado). `z` é a ordem de empilhamento; `w`/`h` o tamanho em pixels (null = padrão). A visão (pan/zoom) fica no localStorage de cada aparelho. No celular vira grade. Sem setas, formas ou desenhos.

## Fora do escopo (decisão de produto)
Colaboração, equipes, comentários, subtarefas complexas, kanban, pomodoro, gamificação, hábitos, anexos, IA desnecessária, recursos de whiteboard além das notas (setas, formas, desenho).
