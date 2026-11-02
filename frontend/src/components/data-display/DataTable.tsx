import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { EmptyState } from '../feedback/Feedback'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> { numeric?: boolean }
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, any>[] // eslint-disable-line @typescript-eslint/no-explicit-any
  caption: string
  searchPlaceholder?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyText?: string
}

export function DataTable<T>({ data, columns, caption, searchPlaceholder = 'Поиск…', pageSize = 8, onRowClick, emptyText = 'Нет данных по выбранным фильтрам' }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [filter, setFilter] = useState('')
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })
  const rows = table.getRowModel().rows

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Поиск: ${caption}`}
          className="h-9 w-full max-w-xs rounded-[var(--radius-md)] border border-border bg-surface-1 px-3 text-sm placeholder:text-muted/70"
        />
        <span className="font-mono text-[11px] text-muted">{table.getFilteredRowModel().rows.length} строк</span>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-1 text-[12px] text-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  const numeric = h.column.columnDef.meta?.numeric
                  return (
                    <th key={h.id} scope="col" aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-4 py-3 font-medium ${numeric ? 'text-right' : 'text-left'}`}>
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className={`inline-flex items-center gap-1 hover:text-white ${numeric ? 'flex-row-reverse' : ''}`}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="h-3 w-3 text-accent" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3 text-accent" /> : null}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(row.original) } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={`border-t border-border ${onRowClick ? 'cursor-pointer hover:bg-surface-2' : ''}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-4 py-3 ${cell.column.columnDef.meta?.numeric ? 'tabular text-right' : ''}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-4"><EmptyState title={emptyText} /></div>}
      </div>
      {table.getPageCount() > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
          <span className="tabular">Страница {table.getState().pagination.pageIndex + 1} из {table.getPageCount()}</span>
          <button type="button" aria-label="Предыдущая страница" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} className="rounded border border-border p-1.5 hover:bg-surface-3 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Следующая страница" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} className="rounded border border-border p-1.5 hover:bg-surface-3 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  )
}
