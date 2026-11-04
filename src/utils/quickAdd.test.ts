import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from './quickAdd.ts';

// Friday, 2 Oct 2026, 16:25 in São Paulo.
const ctx = {
  today: '2026-10-02',
  nowTime: '16:25',
  categories: [
    { id: 'c-work', name: 'Trabalho' },
    { id: 'c-fin', name: 'Finanças' },
  ],
};

test('spec example: "Comprar ração amanhã às 18h"', () => {
  const r = parseQuickAdd('Comprar ração amanhã às 18h', ctx);
  assert.equal(r.title, 'Comprar ração');
  assert.equal(r.date, '2026-10-03');
  assert.equal(r.time, '18:00');
  assert.equal(r.tokens.length, 2);
});

test('plain titles are untouched', () => {
  for (const t of ['Ligar para o banco', 'Estudar 3 capítulos', 'Revisar PR 1234', 'Hojeiro maluco']) {
    const r = parseQuickAdd(t, ctx);
    assert.equal(r.title, t);
    assert.equal(r.date, null, t);
    assert.equal(r.time, null, t);
  }
});

test('dates', () => {
  assert.equal(parseQuickAdd('Pagar conta hoje', ctx).date, '2026-10-02');
  assert.equal(parseQuickAdd('Pagar conta depois de amanhã', ctx).date, '2026-10-04');
  assert.equal(parseQuickAdd('Dentista na segunda', ctx).date, '2026-10-05');
  assert.equal(parseQuickAdd('Dentista segunda-feira', ctx).title, 'Dentista');
  assert.equal(parseQuickAdd('Reunião sexta', ctx).date, '2026-10-09'); // today is Friday
  assert.equal(parseQuickAdd('Reunião sábado', ctx).date, '2026-10-03');
  assert.equal(parseQuickAdd('Aniversário 15/11', ctx).date, '2026-11-15');
  assert.equal(parseQuickAdd('Prova 10/03/27', ctx).date, '2027-03-10');
  assert.equal(parseQuickAdd('Boleto dia 1', ctx).date, '2026-11-01'); // 1 Oct already passed
  assert.equal(parseQuickAdd('Boleto dia 10', ctx).date, '2026-10-10');
  assert.equal(parseQuickAdd('Data inválida 31/02', ctx).date, null);
});

test('times', () => {
  assert.equal(parseQuickAdd('Academia 18h30', ctx).time, '18:30');
  assert.equal(parseQuickAdd('Academia às 7 da noite', ctx).time, '19:00');
  assert.equal(parseQuickAdd('Almoço meio-dia', ctx).time, '12:00');
  assert.equal(parseQuickAdd('Call 09:15 amanhã', ctx).time, '09:15');
  assert.equal(parseQuickAdd('Call 09:15 amanhã', ctx).title, 'Call');
  // A bare time later today stays today; earlier rolls to tomorrow.
  assert.equal(parseQuickAdd('Ligar 17h', ctx).date, '2026-10-02');
  assert.equal(parseQuickAdd('Ligar 9h', ctx).date, '2026-10-03');
  assert.equal(parseQuickAdd('Erro 25h', ctx).time, null);
});

test('priority and category', () => {
  const r = parseQuickAdd('Enviar relatório #trabalho !alta amanhã', ctx);
  assert.equal(r.title, 'Enviar relatório');
  assert.equal(r.priority, 'high');
  assert.equal(r.categoryId, 'c-work');
  assert.equal(parseQuickAdd('Pagar #financas', ctx).categoryId, 'c-fin');
  assert.equal(parseQuickAdd('Ver #inexistente', ctx).title, 'Ver #inexistente');
});

test('dismissed token kinds stay in the title', () => {
  const r = parseQuickAdd('Assistir Amanhã Nunca Morre', { ...ctx, ignore: ['date'] });
  assert.equal(r.title, 'Assistir Amanhã Nunca Morre');
  assert.equal(r.date, null);
});

test('repeating tasks', () => {
  const daily = parseQuickAdd('Tomar remédio todo dia às 20h', ctx);
  assert.equal(daily.title, 'Tomar remédio');
  assert.equal(daily.recurrence, 'daily');
  assert.equal(daily.date, '2026-10-02');
  assert.equal(daily.time, '20:00');

  // 8h already passed today: the series starts tomorrow.
  assert.equal(parseQuickAdd('Caminhar todos os dias 8h', ctx).date, '2026-10-03');

  const monday = parseQuickAdd('Reunião de equipe toda segunda-feira', ctx);
  assert.equal(monday.title, 'Reunião de equipe');
  assert.equal(monday.recurrence, 'weekly');
  assert.equal(monday.date, '2026-10-05');
  assert.equal(parseQuickAdd('Feira todos os sábados', ctx).date, '2026-10-03');
  assert.equal(parseQuickAdd('Relatório toda sexta', ctx).date, '2026-10-02'); // today is Friday

  const rent = parseQuickAdd('Pagar aluguel todo dia 5', ctx);
  assert.equal(rent.title, 'Pagar aluguel');
  assert.equal(rent.recurrence, 'monthly');
  assert.equal(rent.date, '2026-10-05');
  assert.equal(parseQuickAdd('Fatura todo dia 1', ctx).date, '2026-11-01');

  const work = parseQuickAdd('Checar e-mails dias úteis', ctx);
  assert.equal(work.recurrence, 'weekdays');
  assert.equal(work.date, '2026-10-02');

  assert.equal(parseQuickAdd('Backup toda semana', ctx).recurrence, 'weekly');
  assert.equal(parseQuickAdd('Revisar metas todo mês', ctx).recurrence, 'monthly');
  assert.equal(parseQuickAdd('Renovar seguro todo ano 15/03', ctx).date, '2027-03-15');
  assert.equal(parseQuickAdd('Ligar para a Ana', ctx).recurrence, null);

  const ignored = parseQuickAdd('Pagar aluguel todo dia 5', { ...ctx, ignore: ['repeat'] });
  assert.equal(ignored.recurrence, null);
  assert.equal(ignored.date, '2026-10-05'); // "dia 5" is still a date
});
