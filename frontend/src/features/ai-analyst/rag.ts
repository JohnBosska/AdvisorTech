import type { Stage, StageStatus } from '../../lib/api/ai'

export type NodeStatus = StageStatus | 'queued'

export interface StageDef {
  id: string
  label: string
  /** What this stage really does, shown in the details panel. */
  description: string
  x: number
  y: number
  w: number
}

/** Fixed pipeline layout (SVG user units). Ids match the backend `Trace` stages. */
export const STAGE_DEFS: StageDef[] = [
  { id: 'user_query', label: 'ВОПРОС', description: 'Собственник задаёт вопрос на обычном языке.', x: 230, y: 34, w: 130 },
  { id: 'query_analysis', label: 'АНАЛИЗ ЗАПРОСА', description: 'Из вопроса выделяются ключевые слова для поиска по документам.', x: 230, y: 112, w: 150 },
  { id: 'access_control', label: 'КОНТРОЛЬ ДОСТУПА', description: 'Подтверждается, что вы участник организации. Поиск и данные ограничены ею.', x: 230, y: 190, w: 160 },
  { id: 'fulltext_retrieval', label: 'ПОЛНОТЕКСТ', description: 'Поиск по словам в документах организации (PostgreSQL, русская морфология).', x: 78, y: 292, w: 126 },
  { id: 'vector_retrieval', label: 'ВЕКТОРЫ · PGVECTOR', description: 'Поиск по смыслу: эмбеддинг вопроса сравнивается с фрагментами в pgvector. Включается при настроенных эмбеддингах.', x: 230, y: 292, w: 150 },
  { id: 'sql_analytics', label: 'SQL-АНАЛИТИКА', description: 'Утверждённые расчёты по данным 1С. Недоступны, пока хранилище данных не подключено.', x: 382, y: 292, w: 126 },
  { id: 'reranking', label: 'РАНЖИРОВАНИЕ', description: 'Результаты поиска объединяются и ранжируются, отбираются лучшие фрагменты.', x: 230, y: 394, w: 140 },
  { id: 'context_assembly', label: 'СБОРКА КОНТЕКСТА', description: 'Фрагменты оформляются как пронумерованные источники для модели.', x: 230, y: 472, w: 160 },
  { id: 'llm_generation', label: 'ГЕНЕРАЦИЯ ОТВЕТА', description: 'Модель формулирует ответ только по источникам и ставит ссылки [N].', x: 230, y: 550, w: 160 },
  { id: 'validation', label: 'ПРОВЕРКА', description: 'Код проверяет ссылки и что числа из ответа есть в источниках.', x: 230, y: 628, w: 130 },
  { id: 'final_answer', label: 'ОТВЕТ', description: 'Ответ сохраняется вместе с источниками и трассой выполнения.', x: 230, y: 706, w: 120 },
]

export const EDGES: [string, string][] = [
  ['user_query', 'query_analysis'], ['query_analysis', 'access_control'],
  ['access_control', 'fulltext_retrieval'], ['access_control', 'vector_retrieval'], ['access_control', 'sql_analytics'],
  ['fulltext_retrieval', 'reranking'], ['vector_retrieval', 'reranking'], ['sql_analytics', 'reranking'],
  ['reranking', 'context_assembly'], ['context_assembly', 'llm_generation'],
  ['llm_generation', 'validation'], ['validation', 'final_answer'],
]

export const STATUS_LABEL: Record<NodeStatus, string> = {
  idle: 'Ожидает', queued: 'В очереди', running: 'Выполняется', completed: 'Готово',
  warning: 'Предупреждение', failed: 'Ошибка', skipped: 'Пропущено',
}

/** Friendly progress line while a stage runs (shown in the chat). */
export const RUNNING_TEXT: Record<string, string> = {
  query_analysis: 'Разбираю вопрос…',
  access_control: 'Проверяю права доступа к данным организации…',
  fulltext_retrieval: 'Ищу по словам в документах…',
  vector_retrieval: 'Ищу по смыслу (pgvector)…',
  reranking: 'Ранжирую найденное…',
  context_assembly: 'Собираю контекст из источников…',
  llm_generation: 'Модель формулирует ответ…',
  validation: 'Проверяю ссылки и числа…',
  final_answer: 'Сохраняю ответ…',
}

const DONE: NodeStatus[] = ['completed', 'warning']

export function statusMap(stages: Stage[] | undefined, started: boolean): Record<string, NodeStatus> {
  const map: Record<string, NodeStatus> = { user_query: started ? 'completed' : 'idle' }
  for (const def of STAGE_DEFS) map[def.id] ??= 'idle'
  for (const s of stages ?? []) map[s.id] = s.status
  return map
}

export type EdgeState = 'idle' | 'active' | 'done' | 'muted'

export function edgeState(from: NodeStatus, to: NodeStatus): EdgeState {
  if (to === 'running' && (DONE.includes(from) || from === 'running')) return 'active'
  if (from === 'skipped' || to === 'skipped') return 'muted'
  if (DONE.includes(from) && DONE.includes(to)) return 'done'
  if (to === 'failed' && DONE.includes(from)) return 'done'
  return 'idle'
}

/** Splits answer text into plain parts and `[N]` citation numbers. */
export function splitCitations(text: string): ({ text: string } | { ref: number })[] {
  const parts: ({ text: string } | { ref: number })[] = []
  let last = 0
  for (const m of text.matchAll(/\[(\d{1,3})\]/g)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ ref: Number(m[1]) })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/** Splits text on **bold** markers; only this one marker is supported (no raw HTML is ever rendered). */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((p) => p.text !== '')
}
