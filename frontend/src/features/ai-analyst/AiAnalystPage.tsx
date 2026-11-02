import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, DemoNotice } from '../../components/feedback/Feedback'
import { PageHeader } from '../../components/feedback/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, ValidationBadge } from '../../components/ui/StatusBadge'
import { answerQuestion, SUGGESTED_QUESTIONS, type AiAnswer } from '../../mocks/ai'
import { periodMeta } from '../../mocks/data'
import { useReports } from '../../stores/reports'
import { useUi } from '../../stores/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">{title}</h4>{children}</div>
}

function AnswerCard({ a, onReport }: { a: AiAnswer; onReport: () => void }) {
  const [evidence, setEvidence] = useState(false)
  if (a.refusal) {
    return (
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-warning/30 bg-surface-1 p-5">
        <p className="font-medium">{a.summary}</p>
        <Alert tone="warning">{a.refusal}</Alert>
      </div>
    )
  }
  return (
    <article className="space-y-5 rounded-[var(--radius-lg)] border border-border bg-surface-1 p-5">
      <div>
        <p className="text-[15px] font-medium leading-snug">{a.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge>Период: {a.period}</Badge><Badge>{a.freshness}</Badge><ValidationBadge status={a.validation} />
        </div>
      </div>
      <Section title="Проверенные расчёты (детерминированные)">
        <dl className="grid gap-2 sm:grid-cols-2">
          {a.metrics.map((m) => (
            <div key={m.label} className="rounded-[var(--radius-md)] border border-border bg-black p-3">
              <dt className="text-xs text-muted">{m.label}</dt>
              <dd className="tabular mt-1 text-lg font-semibold">{m.value}</dd>
              <p className="mt-1 font-mono text-[10px] text-muted">{m.formula}</p>
            </div>
          ))}
        </dl>
      </Section>
      {a.findings.length > 0 && <Section title="Наблюдения"><ul className="list-disc space-y-1 pl-5 text-sm text-text-soft">{a.findings.map((f) => <li key={f}>{f}</li>)}</ul></Section>}
      {a.hypotheses.length > 0 && <Section title="Гипотезы (интерпретация AI, не факт)"><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{a.hypotheses.map((f) => <li key={f}>{f}</li>)}</ul></Section>}
      {a.recommendations.length > 0 && (
        <Section title="Рекомендации">
          <ul className="space-y-2">{a.recommendations.map((r) => <li key={r.text} className="rounded-[var(--radius-md)] border border-accent/20 p-3 text-sm"><p>{r.text}</p><p className="mt-1 text-xs text-warning">{r.effect}</p></li>)}</ul>
          <p className="mt-2 text-xs text-muted">Решение принимает собственник бизнеса.</p>
        </Section>
      )}
      <div>
        <button type="button" onClick={() => setEvidence((e) => !e)} aria-expanded={evidence} className="text-sm text-accent hover:underline">{evidence ? 'Скрыть' : 'Показать'} источники и допущения</button>
        {evidence && (
          <div className="mt-3 space-y-3 rounded-[var(--radius-md)] border border-border bg-black p-4">
            <Section title="Источники"><ul className="space-y-1">{a.sources.map((s) => <li key={s.id} className="text-sm"><span className="font-mono text-[11px] text-cyan">{s.id}</span> — {s.label}</li>)}</ul></Section>
            <Section title="Допущения и ограничения"><ul className="list-disc space-y-1 pl-5 text-sm text-muted">{a.assumptions.map((s) => <li key={s}>{s}</li>)}</ul></Section>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button size="sm" onClick={onReport}>Сформировать Excel-отчёт (демо)</Button>
        <Link to="/app/reports" className="inline-flex h-8 items-center px-2 text-[13px] text-muted hover:text-white">Открыть список отчётов</Link>
      </div>
    </article>
  )
}

export function AiAnalystPage() {
  const period = useUi((s) => s.period)
  const createReport = useReports((s) => s.create)
  const [thread, setThread] = useState<{ q: string; a: AiAnswer }[]>([])
  const [text, setText] = useState('')
  const [notice, setNotice] = useState('')
  const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [thread, thinking])

  const ask = (q: string) => {
    const question = q.trim()
    if (!question || thinking) return
    setText('')
    setThinking(true)
    setNotice('')
    setTimeout(() => { setThread((t) => [...t, { q: question, a: answerQuestion(question, period) }]); setThinking(false) }, 600)
  }

  const report = (a: AiAnswer) => {
    createReport('executive', periodMeta(period).long, `AI-отчёт: ${a.question.slice(0, 60)}`)
    setNotice('Отчёт добавлен в очередь (демо). Следите за статусом в разделе «Отчёты».')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="AI-аналитик" description="Вопрос на естественном языке — структурированный ответ с расчётами, источниками и ограничениями." />
      <DemoNotice>Это демонстрация формата ответов. Ответы — шаблоны на демо-данных: LLM, поиск по Qdrant и SQL-инструменты не подключены. Реальный AI-аналитик не будет выдумывать числа и откажется отвечать, если данных недостаточно.</DemoNotice>

      <div className="mt-6 space-y-6" aria-live="polite">
        {thread.length === 0 && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-border-strong p-6">
            <p className="text-sm text-muted">Попробуйте один из вопросов:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-border px-3 py-1.5 text-left text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent">{q}</button>)}
            </div>
          </div>
        )}
        {thread.map((m, i) => (
          <div key={i} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-[var(--radius-lg)] border border-border bg-surface-3 px-4 py-2.5 text-sm">{m.q}</p>
            <AnswerCard a={m.a} onReport={() => report(m.a)} />
          </div>
        ))}
        {thinking && <p role="status" className="font-mono text-xs text-muted">Считаю по витринам…</p>}
        {notice && <Alert tone="success">{notice}</Alert>}
        <div ref={end} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(text) }} className="sticky bottom-4 mt-6 flex gap-2 rounded-[var(--radius-lg)] border border-border-strong bg-surface-2/95 p-2 backdrop-blur">
        <label htmlFor="q" className="sr-only">Ваш вопрос</label>
        <input id="q" value={text} onChange={(e) => setText(e.target.value)} placeholder="Спросите о марже, запасах, логистике…" className="h-10 flex-1 bg-transparent px-3 text-sm placeholder:text-muted/70" />
        <Button type="submit" disabled={!text.trim() || thinking}><Send className="h-4 w-4" aria-hidden />Спросить</Button>
      </form>
      {thread.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{SUGGESTED_QUESTIONS.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent">{q}</button>)}</div>}
    </div>
  )
}
