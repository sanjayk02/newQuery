// src/components/AssetsDataTablePanel.tsx
import React, { useMemo, useState } from 'react';
import { usePivotAssets } from '../hooks';
import { AssetsDataTable, DEFAULT_COLUMNS } from './AssetsDataTable';
import { nextSortForColumn } from '../utils/pivotSort';

export default function AssetsDataTablePanel({
  project,
  root = 'assets',
}: {
  project: string;
  root?: string;
}) {
  const [page, setPage] = useState(1);         // 1-based
  const [perPage, setPerPage] = useState(15);
  const [sort, setSort] = useState<string>('group_1');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [phase, setPhase] = useState<string>('');

  const { data, total, loading, error } = usePivotAssets({
    project, root, sort, dir, phase, page, per_page: perPage,
  });

  const onSortClick = (columnId: string) => {
    const next = nextSortForColumn(columnId, { sort, dir, phase });
    setSort(next.sort);
    setDir(next.dir);
    setPhase(next.phase ?? '');
    setPage(1); // reset to first page on sort change
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);

  return (
    <section>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <strong>Project:</strong> <code>{project}</code>
        <span>•</span> <strong>Root:</strong> <code>{root}</code>
        <span style={{ marginLeft: 'auto' }}>
          {loading ? 'Loading…' : error ? <span style={{ color: 'crimson' }}>Error</span> : `${total} assets`}
        </span>
      </header>

      <AssetsDataTable
        rows={data}
        columns={DEFAULT_COLUMNS}
        sort={sort}
        dir={dir}
        onSortClick={onSortClick}
      />

      <footer style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>

        <span style={{ marginLeft: 16 }}>Per page:</span>
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
          {[15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        {phase && <span style={{ marginLeft: 'auto' }}>
          Phase boosting: <strong>{phase.toUpperCase()}</strong> <button onClick={() => setPhase('')}>clear</button>
        </span>}
      </footer>
    </section>
  );
}
