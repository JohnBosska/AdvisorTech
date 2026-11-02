import { Database } from 'lucide-react'

const BLOCKS = [
  { label: '01 · Контекст', title: 'Понимайте свой бизнес', text: 'Tech Adviser собирает документы компании в базу знаний, а после подключения 1С добавит к ним учётные, складские и операционные данные.' },
  { label: '02 · Основание', title: 'У каждого ответа есть контекст', text: 'Перед ответом AI находит в вашей базе знаний нужные фрагменты и ссылается на них. Нет источников — нет догадок.' },
  { label: '03 · Решения', title: 'От данных — к решениям', text: 'Пояснения со ссылками, автоматическая проверка ссылок и чисел и выгрузка ответа в Excel для работы с командой.' },
]

export function LeftInfoColumn({ documents, onOpenKnowledge }: { documents: number | undefined; onOpenKnowledge: () => void }) {
  return (
    <aside aria-label="О возможностях" className="hidden flex-col justify-between gap-10 overflow-y-auto px-6 py-8 lg:flex">
      <div className="space-y-12">
        {BLOCKS.map((b, i) => (
          <div key={b.label} className="rise" style={{ animationDelay: `${i * 90}ms` }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{b.label}</p>
            <h2 className="mt-3 text-[22px] font-medium leading-tight tracking-[-0.02em] text-[#F4F5F4]">{b.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{b.text}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3 border-t border-border-subtle pt-5">
        <button type="button" onClick={onOpenKnowledge} className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-left text-[13px] text-text-soft transition-colors hover:border-accent hover:text-accent">
          <Database className="h-4 w-4" aria-hidden />База знаний{documents !== undefined ? ` · ${documents}` : ''}
        </button>
        <p className="font-mono text-[10px] leading-relaxed text-muted">Данные 1С: не подключены. Ответы строятся только по загруженным документам.</p>
      </div>
    </aside>
  )
}
