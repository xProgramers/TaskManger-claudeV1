# Prumo

Gerenciador de tarefas pessoal: poucas funcionalidades, todas bem executadas.
React + TypeScript + Vite + Tailwind CSS v4 + Supabase (Auth, Postgres, RLS, Realtime, Edge Functions, Cron).

## Começando

```bash
npm install
cp .env.example .env.local   # já vem apontando para o projeto Supabase "tarefas-app"
npm run dev                  # app conectado ao Supabase
npm run dev:demo             # app com dados demonstrativos locais (sem Supabase)
npm test                     # testes de datas/fuso e da criação rápida
npm run build
```

### Configuração única no painel do Supabase

O banco, as políticas, o cron e a Edge Function já estão aplicados no projeto `tarefas-app` (região São Paulo). Falta apenas o que só o painel faz:

1. **Authentication → URL Configuration**: defina *Site URL* com o domínio do app (ex.: `https://prumo.seudominio.com`) e adicione `http://localhost:5173/**` em *Redirect URLs*. Isso faz os e-mails de confirmação e de recuperação de senha voltarem para o app.
2. **Authentication → Providers → Email**: deixe "Confirm email" ligado (recomendado). O app já trata os dois casos.
3. **Authentication → Policies (senha)**: o app exige 8 caracteres; vale configurar o mesmo mínimo no servidor.

Para outro projeto Supabase: aplique `supabase/migrations/*` em ordem, faça deploy de `supabase/functions/send-reminders` com `--no-verify-jwt` e rode `supabase/setup_secrets.sql.example` com os seus valores.

## Arquitetura

```
src/
  types/         Task, Category, AppNotification, UserPreferences + tipos gerados do banco
  services/      contrato de dados (api.ts) com duas implementações:
    supabase/    produção
    mock/        DADOS DEMONSTRATIVOS (localStorage) — usados só com VITE_DEMO_MODE=true
  lib/           cache de consultas, roteador, env, notificações do navegador
  utils/         regras puras: datas/fuso, parser da criação rápida, regras de tarefa, erros
  contexts/      sessão, preferências (fuso, "hoje", tema), toasts, painéis de tarefa
  hooks/         consultas e mutações otimistas, notificações, atalhos
  components/    design system (ui/) + componentes de tarefa
  layouts/ pages/
supabase/
  migrations/    schema, RLS, triggers, lembretes, dispatcher, hardening
  functions/send-reminders/   Web Push (VAPID + aes128gcm, sem dependências)
  seed.sql       dados de exemplo para uma conta real (opcional)
```

Dependências de runtime: `react`, `react-dom`, `@supabase/supabase-js`. Roteador, cache, componentes acessíveis (diálogos, menus, popovers), ícones e datas são internos: o app tem 8 rotas e uma superfície pequena, e cada biblioteca a menos é uma superfície a menos para manter.

## Banco de dados

| Tabela | Papel |
|---|---|
| `profiles` | 1:1 com `auth.users`; guarda as preferências (fuso, tema, formato de hora, 1º dia da semana, lembrete padrão). Criado por trigger no cadastro. |
| `categories` | nome (único por usuário, sem diferenciar maiúsculas) + cor. |
| `tasks` | `due_date` + `due_time` + `timezone` são o que o usuário escolheu; `due_at` (instante absoluto) é derivado por trigger. |
| `notifications` | lembretes: `pending` → `sent` → `read`. No máximo um `pending` por tarefa (índice único parcial). |
| `push_subscriptions` | um registro por navegador/dispositivo para Web Push. |

**Segurança**: RLS em todas as tabelas; nenhum acesso para `anon`. A categoria de uma tarefa usa FK composta `(category_id, user_id)`, então é impossível ligar a categoria de outro usuário. `user_id` e `created_at` são imutáveis via trigger. Clientes não inserem nem alteram notificações (só via trigger/RPC). Validações (tamanhos, enums, fuso válido, offsets permitidos) existem como `CHECK` no banco, não só no front.

## Lembretes

```
tarefa salva ─► trigger sync_task_reminder ─► notifications (pending)
pg_cron (1/min) ─► dispatch_due_notifications()
                    ├─ marca como sent com FOR UPDATE SKIP LOCKED  (idempotente)
                    ├─ Realtime ─► abas abertas: toast + notificação do sistema
                    └─ pg_net ─► Edge Function send-reminders ─► Web Push (aba fechada)
```

- **Exemplo da especificação**: tarefa em 05/10/2026 às 14:00 com lembrete "15 minutos antes" → `scheduled_for` = 05/10/2026 13:45 em São Paulo (16:45 UTC). Coberto por teste.
- Editar data/hora/lembrete substitui o lembrete pendente; concluir, cancelar ou excluir remove; reabrir recria. Um lembrete já entregue não é reenviado se você só editar o título.
- Tarefas sem horário usam 09:00 do dia como referência do lembrete.
- Precisão: cerca de 1 minuto (intervalo do cron).

**Limitações do navegador (sem fingir)**: com a aba aberta, os lembretes chegam em tempo real em qualquer navegador moderno. Com a aba fechada, só via Web Push, que exige permissão do usuário; Chrome, Edge, Firefox e Safari 16.4+ suportam. No iPhone/iPad o Safari só permite depois de adicionar o app à Tela de Início (o app explica isso na tela). Sem permissão, o lembrete continua salvo e aparece no sino.

## Fuso horário

"Hoje", atrasos e lembretes usam o fuso do perfil (detectado no cadastro, ajustável em Configurações), nunca o fuso da máquina. A conversão hora local → instante acontece no banco (`AT TIME ZONE`) e é espelhada no front só para a atualização otimista. 18:00 em São Paulo é sempre 21:00 UTC. Testes cobrem São Paulo e um fuso com horário de verão.

## Design

- **Paleta**: neutros de pedra frios + um único acento verde-pinho. Cor só tem significado em três lugares: ação principal/progresso, ocre para "Atrasada" (calmo, nunca vermelho de alarme) e as cores das categorias. Prioridade é um glifo de barras + texto, nunca só cor.
- **Tipografia**: Schibsted Grotesk, uma família só; escala 11/12/13/14/15/17/20/26/34; números tabulares em horários e contagens.
- **Layout**: grade de 4px; coluna de conteúdo de 760px; sidebar 248px (64px em tablet; navegação inferior + botão flutuante no celular).
- **Raio**: 4 / 6 / 10 / 14 px por hierarquia. Sombras só em camadas flutuantes.
- **Movimento**: 120–200 ms, só em resposta a ações; `prefers-reduced-motion` respeitado.
- **Assinatura visual**: o progresso do dia desenhado como um fio de prumo.
- Tema escuro com tokens próprios (não é inversão).

## Atalhos

| Tecla | Ação |
|---|---|
| `N` | Nova tarefa |
| `Ctrl/⌘ K` ou `/` | Buscar |
| `Enter` | Criar/salvar no formulário |
| `Ctrl/⌘ Enter` | Salvar a partir da descrição |
| `Esc` | Fechar a camada do topo |

Os atalhos não disparam enquanto você digita em um campo.

## Criação rápida

Regras determinísticas em pt-BR (sem IA): `hoje`, `amanhã`, `depois de amanhã`, dias da semana, `dia 15`, `15/10`, `18h`, `18h30`, `18:30`, `às 9 da noite`, `meio-dia`, `!alta`, `#categoria`. Tudo o que é entendido aparece como etiqueta antes de salvar e pode ser desfeito com um clique.

## O que foi verificado

- Testes unitários (`npm test`): fuso/datas e parser da criação rápida.
- Banco: teste ponta a ponta no projeto real (lembrete criado/atualizado/cancelado/recriado, disparo idempotente, isolamento por RLS) com rollback; advisors de segurança revisados.
- Edge Function: autenticação por segredo (200/401) e criptografia Web Push validada contra um decodificador RFC 8291.
- Interface: fluxo completo em navegador real no modo demonstrativo (criar por linguagem natural, concluir/desfazer, detalhes, excluir com confirmação, busca, calendário, claro/escuro, desktop/celular).
- Não rodado no ambiente de desenvolvimento usado para construir: `npm install`/`vite build` com as dependências reais e o app conectado ao Supabase pelo navegador (a rede desse ambiente bloqueava o npm e o Supabase). Rode `npm run build` uma vez após instalar.
