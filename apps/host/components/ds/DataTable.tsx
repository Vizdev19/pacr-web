"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Checkbox } from "./Checkbox";

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  num?: boolean;
  sortable?: boolean;
  sortValue?: (r: T) => string | number;
  render?: (r: T, i: number) => ReactNode;
}

export interface DataTableSort {
  key: string;
  dir: "asc" | "desc";
}

export interface DataTableProps<T> {
  columns?: Column<T>[];
  rows?: T[];
  rowKey?: keyof T | ((r: T) => string | number);
  onRowClick?: (r: T) => void;
  selectable?: boolean;
  selected?: (string | number)[];
  onSelectionChange?: (selected: (string | number)[]) => void;
  defaultSort?: DataTableSort | null;
  empty?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function DataTable<T>({ columns = [], rows = [], rowKey = "id" as keyof T, onRowClick, selectable = false, selected, onSelectionChange, defaultSort, empty = "Nothing here yet.", className = "", style }: DataTableProps<T>) {
  const [sort, setSort] = useState<DataTableSort | null>(defaultSort || null);
  const [innerSel, setInnerSel] = useState<(string | number)[]>([]);
  const sel = selected || innerSel;
  const setSel = (s: (string | number)[]) => { if (!selected) setInnerSel(s); if (onSelectionChange) onSelectionChange(s); };
  const keyOf = (r: T, i: number): string | number => {
    const k = typeof rowKey === "function" ? rowKey(r) : (r[rowKey] as unknown as string | number | null | undefined);
    return k ?? i;
  };

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    const get: (r: T) => unknown = col && col.sortValue ? col.sortValue : r => (r as Record<string, unknown>)[sort.key];
    return [...rows].sort((a, b) => { const x = get(a), y = get(b); const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)); return sort.dir === "asc" ? c : -c; });
  }, [rows, sort, columns]);

  const toggleSort = (k: string) => setSort(s => !s || s.key !== k ? { key: k, dir: "desc" } : s.dir === "desc" ? { key: k, dir: "asc" } : null);
  const allKeys = sorted.map(keyOf);
  const allOn = allKeys.length > 0 && allKeys.every(k => sel.includes(k));
  const someOn = !allOn && allKeys.some(k => sel.includes(k));

  return (
    <div className={"pc-table-wrap " + className} style={style}>
      <table className="pc-table">
        <thead>
          <tr>
            {selectable ? <th className="pc-table__check"><Checkbox checked={allOn} indeterminate={someOn} onChange={() => setSel(allOn || someOn ? [] : allKeys)} /></th> : null}
            {columns.map(c => {
              const on = !!sort && sort.key === c.key;
              return (
                <th key={c.key} style={{ width: c.width, textAlign: c.align || (c.num ? "right" : "left") }}
                  className={(c.sortable ? "is-sortable" : "") + (on ? " is-sorted" : "")} onClick={c.sortable ? () => toggleSort(c.key) : undefined}>
                  {c.header}
                  {c.sortable ? <span className="pc-table__sort" style={{ opacity: on ? 1 : 0.35, transform: on && sort && sort.dir === "asc" ? "rotate(180deg)" : "none" }}><Icon name="arrow-down" size={12} strokeWidth={2.5} /></span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td className="pc-table__empty" colSpan={columns.length + (selectable ? 1 : 0)}>{empty}</td></tr>
          ) : sorted.map((r, i) => {
            const k = keyOf(r, i), on = sel.includes(k);
            return (
              <tr key={k} className={(onRowClick ? "is-clickable" : "") + (on ? " is-selected" : "")} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {selectable ? <td className="pc-table__check" onClick={e => e.stopPropagation()}><Checkbox checked={on} onChange={v => setSel(v ? [...sel, k] : sel.filter(x => x !== k))} /></td> : null}
                {columns.map(c => (
                  <td key={c.key} className={c.num ? "is-num" : ""} style={{ textAlign: c.align || (c.num ? "right" : "left") }}>{c.render ? c.render(r, i) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
