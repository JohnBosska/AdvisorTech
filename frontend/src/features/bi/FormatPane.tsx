import { categorySeries } from './compute'
import { ColorInput, NumberInput, Row, Section, Select, Toggle, inputCls } from './controls'
import type { Theme } from './theme'
import type { Dataset, Format, Visual } from './types'

const NF = [
  { id: 'auto', label: 'Авто' }, { id: 'int', label: 'Целое' }, { id: 'dec2', label: '2 знака' },
  { id: 'thousands', label: 'Тысячи' }, { id: 'millions', label: 'Миллионы' }, { id: 'percent', label: 'Проценты' },
] as const
const SORT = [{ id: 'value-desc', label: 'По значению ↓' }, { id: 'value-asc', label: 'По значению ↑' }, { id: 'cat-asc', label: 'По оси А→Я' }, { id: 'cat-desc', label: 'По оси Я→А' }] as const
const LEGEND = [{ id: 'none', label: 'Скрыта' }, { id: 'top', label: 'Сверху' }, { id: 'bottom', label: 'Снизу' }, { id: 'right', label: 'Справа' }] as const
const ALIGN = [{ id: 'left', label: 'Слева' }, { id: 'center', label: 'По центру' }, { id: 'right', label: 'Справа' }] as const

export function FormatPane({ visual, theme, data, types, onFormat }: { visual: Visual; theme: Theme; data: Dataset | null; types: Record<string, string>; onFormat: (f: Partial<Format>) => void }) {
  const f = visual.format
  const t = visual.type
  const chart = ['bar', 'stacked', 'barh', 'line', 'area', 'pie', 'donut', 'scatter'].includes(t)
  const cartesian = ['bar', 'stacked', 'barh', 'line', 'area', 'scatter'].includes(t)
  const numeric = !['text', 'slicer'].includes(t)
  // keys that can be recoloured: series if there is a legend field, else categories (bars/pies)
  const keys = data && visual.fields.category && chart && t !== 'scatter'
    ? (() => { const sd = categorySeries(data.rows, visual.fields, f, types); return visual.fields.series ? sd.series : sd.categories.slice(0, 12) })()
    : []

  return (
    <div>
      <Section title="Заголовок">
        <Toggle label="Показывать" checked={f.showTitle} onChange={(showTitle) => onFormat({ showTitle })} />
        <Row label="Текст"><input aria-label="Текст заголовка" value={f.title} maxLength={120} onChange={(e) => onFormat({ title: e.target.value })} className={inputCls} /></Row>
        <NumberInput label="Размер" value={f.titleSize} min={10} max={32} onChange={(titleSize) => onFormat({ titleSize })} />
        <ColorInput label="Цвет" value={f.titleColor} fallback={theme.text} onChange={(titleColor) => onFormat({ titleColor })} />
        <Select label="Выравнивание" value={f.align} options={[...ALIGN]} onChange={(align) => onFormat({ align })} />
      </Section>
      {t === 'text' && (
        <Section title="Текст">
          <textarea aria-label="Содержимое текста" rows={5} value={f.text} maxLength={2000} onChange={(e) => onFormat({ text: e.target.value })} className={`${inputCls} h-auto py-1.5`} />
        </Section>
      )}
      <Section title="Оформление">
        <ColorInput label="Фон" value={f.background} fallback={theme.id === 'light' ? '#ffffff' : '#0c100f'} onChange={(background) => onFormat({ background })} />
        {f.background && <NumberInput label="Прозрачность фона" value={f.bgOpacity} min={0} max={100} onChange={(bgOpacity) => onFormat({ bgOpacity })} />}
        <Toggle label="Рамка" checked={f.border} onChange={(border) => onFormat({ border })} />
        {f.border && <ColorInput label="Цвет рамки" value={f.borderColor} fallback="#3a3e44" onChange={(borderColor) => onFormat({ borderColor })} />}
        <NumberInput label="Скругление" value={f.radius} min={0} max={32} onChange={(radius) => onFormat({ radius })} />
        <NumberInput label="Размер шрифта" value={f.fontSize} min={8} max={22} onChange={(fontSize) => onFormat({ fontSize })} />
        <ColorInput label="Цвет текста" value={f.textColor} fallback={theme.text} onChange={(textColor) => onFormat({ textColor })} />
      </Section>
      {numeric && t !== 'text' && (
        <Section title="Значения">
          <Select label="Формат чисел" value={f.numberFormat} options={[...NF]} onChange={(numberFormat) => onFormat({ numberFormat })} />
          <Row label="Префикс / суффикс">
            <span className="grid grid-cols-2 gap-1.5">
              <input aria-label="Префикс" placeholder="$" value={f.prefix} maxLength={8} onChange={(e) => onFormat({ prefix: e.target.value })} className={inputCls} />
              <input aria-label="Суффикс" placeholder=" ₽" value={f.suffix} maxLength={8} onChange={(e) => onFormat({ suffix: e.target.value })} className={inputCls} />
            </span>
          </Row>
          {chart && <Toggle label="Подписи данных" checked={f.dataLabels} onChange={(dataLabels) => onFormat({ dataLabels })} />}
          {t !== 'card' && t !== 'scatter' && <Select label="Сортировка" value={f.sort} options={[...SORT]} onChange={(sort) => onFormat({ sort })} />}
          {t !== 'card' && t !== 'scatter' && t !== 'matrix' && <NumberInput label="Топ-N (0 = все)" value={f.topN} min={0} max={50} onChange={(topN) => onFormat({ topN })} />}
        </Section>
      )}
      {(chart || t === 'card') && (
        <Section title="Цвета">
          <ColorInput label={t === 'card' ? 'Цвет значения' : 'Основной цвет'} value={f.color} fallback={theme.palette[0]} onChange={(color) => onFormat({ color })} />
          {keys.map((k, i) => (
            <ColorInput key={k} label={k} value={f.colors[k] ?? ''} fallback={theme.palette[i % theme.palette.length]} onChange={(c) => { const colors = { ...f.colors }; if (c) colors[k] = c; else delete colors[k]; onFormat({ colors }) }} />
          ))}
        </Section>
      )}
      {cartesian && (
        <Section title="Оси и сетка">
          <Toggle label="Ось X" checked={f.axisX} onChange={(axisX) => onFormat({ axisX })} />
          <Toggle label="Ось Y" checked={f.axisY} onChange={(axisY) => onFormat({ axisY })} />
          <Toggle label="Линии сетки" checked={f.grid} onChange={(grid) => onFormat({ grid })} />
          {(t === 'line' || t === 'area') && <Toggle label="Сглаживание" checked={f.smooth} onChange={(smooth) => onFormat({ smooth })} />}
        </Section>
      )}
      {chart && t !== 'scatter' && (
        <Section title="Легенда">
          <Select label="Положение" value={f.legend} options={[...LEGEND]} onChange={(legend) => onFormat({ legend })} />
        </Section>
      )}
    </div>
  )
}
