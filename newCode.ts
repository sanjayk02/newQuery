import { useEffect, useState } from 'react';

export type AssetPhaseSummary = {
  project: string;
  root: string;
  group_1: string;
  relation: string;

  // phase fields (nullable is fine)
  mdl_work_status?: string | null;
  mdl_approval_status?: string | null;
  mdl_submitted_at_utc?: string | null;

  rig_work_status?: string | null;
  rig_approval_status?: string | null;
  rig_submitted_at_utc?: string | null;

  bld_work_status?: string | null;
  bld_approval_status?: string | null;
  bld_submitted_at_utc?: string | null;

  dsn_work_status?: string | null;
  dsn_approval_status?: string | null;
  dsn_submitted_at_utc?: string | null;

  ldv_work_status?: string | null;
  ldv_approval_status?: string | null;
  ldv_submitted_at_utc?: string | null;
};

export function useFetchAssetsPivot(
  project: string | undefined,
  pageIndex: number,             // 0-based
  perPage: number,
  sortKey: string,               // e.g. "group_1" or "-mdl_work"
  root: string = 'assets',
  phase?: string                 // optional; only sent if you want backend "phase first"
) {
  const [assets, setAssets] = useState<AssetPhaseSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!project) return;

    const controller = new AbortController();
    const page = pageIndex + 1; // backend expects 1-based

    const qs = new URLSearchParams({
      root,
      page: String(page),
      per_page: String(perPage),
    });

    if (sortKey) {
      if (sortKey.startsWith('-')) {
        qs.set('sort', sortKey.slice(1));
        qs.set('dir', 'desc');
      } else {
        qs.set('sort', sortKey);
        qs.set('dir', 'asc');
      }
    }
    if (phase) {
      qs.set('phase', phase);
    }

    const url = `/api/assets/${encodeURIComponent(project)}/pivot?${qs.toString()}`;

    setLoading(true);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((json) => {
        setAssets(Array.isArray(json?.data) ? json.data : []);
        setTotal(Number(json?.total ?? 0));
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setError(e);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [project, pageIndex, perPage, sortKey, root, phase]);

  return { assets, total, loading, error };
}

//=======================================

import React, { useMemo, useState } from 'react';
import { useFetchAssetsPivot } from '../hooks';
import AssetsDataTable from './AssetsDataTable';

type SortDir = 'asc' | 'desc';
type PhaseHL = '' | 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv';

const phaseFromSort = (key: string): PhaseHL => {
  const k = key.replace(/^-/, '').toLowerCase();
  if (k.startsWith('mdl_')) return 'mdl';
  if (k.startsWith('rig_')) return 'rig';
  if (k.startsWith('bld_')) return 'bld';
  if (k.startsWith('dsn_')) return 'dsn';
  if (k.startsWith('ldv_')) return 'ldv';
  return '';
};

const AssetsDataTablePanel: React.FC<{ project?: string; root?: string }> = ({ project, root = 'assets' }) => {
  const [page, setPage] = useState(0);        // 0-based for MUI
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [sortKey, setSortKey] = useState<string>('group_1');

  const dir: SortDir = sortKey.startsWith('-') ? 'desc' : 'asc';
  const phase: PhaseHL = phaseFromSort(sortKey);

  const { assets, total, loading, error } = useFetchAssetsPivot(
    project,
    page,
    rowsPerPage,
    sortKey,
    root,
    phase || undefined   // send only when set
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / rowsPerPage)), [total, rowsPerPage]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <strong>Project:</strong> <code>{project ?? '-'}</code>
        <span>•</span> <strong>Root:</strong> <code>{root}</code>
        <span style={{ marginLeft: 'auto' }}>
          {loading ? 'Loading…' : error ? <span style={{ color: 'crimson' }}>Error</span> : `${total} assets`}
        </span>
      </div>

      <AssetsDataTable
        rows={assets}
        sortKey={sortKey}
        dir={dir}
        onSortChange={(next) => {
          setSortKey(next.sortKey);
          setPage(0);
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</button>
        <span>
          Page {page + 1} / {totalPages}
        </span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>

        <span style={{ marginLeft: 16 }}>Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        >
          {[15, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        {phase && <span style={{ marginLeft: 'auto' }}>Phase: <strong>{phase.toUpperCase()}</strong></span>}
      </div>
    </div>
  );
};

export default AssetsDataTablePanel;


//====================================================
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';
import { AssetPhaseSummary } from '../hooks';

// keep your UI; just wire sorting + tooltips + thumbnail
import MultilineToolTipTableCell from '../components/MultilineToolTipTableCell';
import ThumbnailCell from '../components/ThumbnailCell';

export type SortDir = 'asc' | 'desc';
export type PhaseHL = '' | 'mdl' | 'rig' | 'bld' | 'dsn' | 'ldv';

// your existing columns (IDs drive mapping & borders/colors)
const columns = [
  { id: 'thumbnail', label: 'THUMBNAIL', sortable: false },

  { id: 'group_1_name', label: 'NAME', sortable: true },

  { id: 'mdl_work_status', label: 'MDL WORK', sortable: true, colors: { backgroundColor: undefined, lineColor: '#337ab7' } },
  { id: 'mdl_approval_status', label: 'MDL APPR', sortable: true, colors: { backgroundColor: undefined, lineColor: '#337ab7' } },
  { id: 'mdl_submitted_at', label: 'MDL SUBMITTED AT', sortable: true, colors: { backgroundColor: undefined, lineColor: '#337ab7' } },

  { id: 'rig_work_status', label: 'RIG WORK', sortable: true, colors: { backgroundColor: undefined, lineColor: '#a855f7' } },
  { id: 'rig_approval_status', label: 'RIG APPR', sortable: true, colors: { backgroundColor: undefined, lineColor: '#a855f7' } },
  { id: 'rig_submitted_at', label: 'RIG SUBMITTED AT', sortable: true, colors: { backgroundColor: undefined, lineColor: '#a855f7' } },

  { id: 'bld_work_status', label: 'BLD WORK', sortable: true, colors: { backgroundColor: undefined, lineColor: '#ec4899' } },
  { id: 'bld_approval_status', label: 'BLD APPR', sortable: true, colors: { backgroundColor: undefined, lineColor: '#ec4899' } },
  { id: 'bld_submitted_at', label: 'BLD SUBMITTED AT', sortable: true, colors: { backgroundColor: undefined, lineColor: '#ec4899' } },

  { id: 'dsn_work_status', label: 'DSN WORK', sortable: true, colors: { backgroundColor: undefined, lineColor: '#2dd4bf' } },
  { id: 'dsn_approval_status', label: 'DSN APPR', sortable: true, colors: { backgroundColor: undefined, lineColor: '#2dd4bf' } },
  { id: 'dsn_submitted_at', label: 'DSN SUBMITTED AT', sortable: true, colors: { backgroundColor: undefined, lineColor: '#2dd4bf' } },

  { id: 'ldv_work_status', label: 'LDV WORK', sortable: true, colors: { backgroundColor: undefined, lineColor: '#c084fc' } },
  { id: 'ldv_approval_status', label: 'LDV APPR', sortable: true, colors: { backgroundColor: undefined, lineColor: '#c084fc' } },
  { id: 'ldv_submitted_at', label: 'LDV SUBMITTED AT', sortable: true, colors: { backgroundColor: undefined, lineColor: '#c084fc' } },

  { id: 'relation', label: 'RELATION', sortable: true },
] as const;

// map visible column ids -> backend sort keys (accept both *_submitted_at and *_submitted_at_utc backends)
const SORT_KEY: Record<string, string> = {
  group_1_name: 'group_1',
  relation: 'relation',

  mdl_work_status: 'mdl_work',
  mdl_approval_status: 'mdl_appr',
  mdl_submitted_at: 'mdl_submitted',                // the hook sends &dir, backend maps to *_utc internally

  rig_work_status: 'rig_work',
  rig_approval_status: 'rig_appr',
  rig_submitted_at: 'rig_submitted',

  bld_work_status: 'bld_work',
  bld_approval_status: 'bld_appr',
  bld_submitted_at: 'bld_submitted',

  dsn_work_status: 'dsn_work',
  dsn_approval_status: 'dsn_appr',
  dsn_submitted_at: 'dsn_submitted',

  ldv_work_status: 'ldv_work',
  ldv_approval_status: 'ldv_appr',
  ldv_submitted_at: 'ldv_submitted',
};

const phaseFromColId = (id: string): PhaseHL => {
  const x = id.toLowerCase();
  if (x.startsWith('mdl_')) return 'mdl';
  if (x.startsWith('rig_')) return 'rig';
  if (x.startsWith('bld_')) return 'bld';
  if (x.startsWith('dsn_')) return 'dsn';
  if (x.startsWith('ldv_')) return 'ldv';
  return '';
};

const phaseFromSortKey = (key: string): PhaseHL => {
  const k = key.replace(/^-/, '');
  return phaseFromColId(k);
};

const cell = (v?: string | null) => (v ?? '');

const arrow = (active: boolean, dir: SortDir) => (active ? (dir === 'asc' ? ' ▲' : ' ▼') : '');

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────
const RecordTableHead: React.FC<{
  sortKey: string;
  dir: SortDir;
  onSortChange: (next: { sortKey: string; dir: SortDir; phase: PhaseHL }) => void;
}> = ({ sortKey, dir, onSortChange }) => {
  const activePhase = phaseFromSortKey(sortKey);

  const isActive = (backendKey: string) =>
    sortKey === backendKey || sortKey === `-${backendKey}`;

  const nextDir = (backendKey: string): SortDir =>
    sortKey === backendKey ? (dir === 'asc' ? 'desc' : 'asc') : 'asc';

  const handleClick = (columnId: string) => {
    const backendSort = (SORT_KEY[columnId] ?? columnId).toLowerCase();
    const newDir = nextDir(backendSort);
    const phase = phaseFromColId(columnId);
    onSortChange({
      sortKey: newDir === 'desc' ? `-${backendSort}` : backendSort,
      dir: newDir,
      phase,
    });
  };

  return (
    <TableHead>
      <TableRow>
        {columns.map((column) => {
          const borderLineStyle = column.colors ? `solid 3px ${column.colors.lineColor}` : 'none';
          const borderTopStyle = column.colors ? borderLineStyle : 'none';
          const borderLeftStyle = column.id.includes('work_status') ? borderLineStyle : 'none';
          const borderRightStyle = column.id.includes('submitted_at') ? borderLineStyle : 'none';

          const backendKey = (SORT_KEY[column.id] ?? column.id).toLowerCase();
          const active = isActive(backendKey);

          return (
            <TableCell
              key={column.id}
              onClick={column.sortable ? () => handleClick(column.id) : undefined}
              style={{
                backgroundColor: column.colors ? column.colors.backgroundColor : 'inherit',
                borderTop: borderTopStyle,
                borderLeft: borderLeftStyle,
                borderRight: borderRightStyle,
                cursor: column.sortable ? 'pointer' : 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
              }}
              title={column.sortable ? 'Click to sort' : undefined}
            >
              {/* using TableSortLabel keeps your UI consistent */}
              <TableSortLabel
                active={active}
                direction={active ? (sortKey.startsWith('-') ? 'desc' : 'asc') : 'asc'}
                hideSortIcon={!active}
              >
                {column.label}{column.sortable && arrow(active, sortKey.startsWith('-') ? 'desc' : 'asc')}
              </TableSortLabel>
            </TableCell>
          );
        })}
      </TableRow>
    </TableHead>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────────
const AssetRow: React.FC<{ r: AssetPhaseSummary; sortKey: string }> = ({ r, sortKey }) => {
  return (
    <TableRow hover>
      {columns.map((column) => {
        const backendKey = (SORT_KEY[column.id] ?? column.id).toLowerCase();

        const borderLineStyle = column.colors ? `solid 3px ${column.colors.lineColor}` : 'none';
        const borderTopStyle = column.colors ? borderLineStyle : 'none';
        const borderLeftStyle = column.id.includes('work_status') ? borderLineStyle : 'none';
        const borderRightStyle = column.id.includes('submitted_at') ? borderLineStyle : 'none';

        switch (column.id) {
          case 'thumbnail':
            return (
              <ThumbnailCell
                key={column.id}
                project={r.project}
                group1={r.group_1}
                relation={r.relation}
                style={{
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'inherit',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                }}
              />
            );

          case 'group_1_name': {
            return (
              <MultilineToolTipTableCell
                key={column.id}
                value={cell(r.group_1)}
                style={{
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'inherit',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                  whiteSpace: 'nowrap',
                }}
              />
            );
          }

          case 'relation': {
            return (
              <MultilineToolTipTableCell
                key={column.id}
                value={cell(r.relation)}
                style={{
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'inherit',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                  whiteSpace: 'nowrap',
                }}
              />
            );
          }

          default: {
            // map phase cells; pivot already provides *_status/_utc fields
            const value = (r as any)[
              // accept either *_submitted_at or *_submitted_at_utc data keys
              backendKey.endsWith('_submitted')
                ? `${backendKey}_at_utc`
                : backendKey
            ];

            return (
              <MultilineToolTipTableCell
                key={column.id}
                value={cell(value)}
                style={{
                  backgroundColor: column.colors ? column.colors.backgroundColor : 'inherit',
                  borderTop: borderTopStyle,
                  borderLeft: borderLeftStyle,
                  borderRight: borderRightStyle,
                  whiteSpace: 'nowrap',
                }}
              />
            );
          }
        }
      })}
    </TableRow>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Table
// ─────────────────────────────────────────────────────────────────────────────
const AssetsDataTable: React.FC<{
  rows: AssetPhaseSummary[];
  sortKey: string; // e.g. "group_1" | "-mdl_work" | "-rig_submitted"
  dir: SortDir;    // derived for arrow only
  onSortChange: (next: { sortKey: string; dir: SortDir; phase: PhaseHL }) => void;
}> = ({ rows, sortKey, dir, onSortChange }) => {
  return (
    <div style={{ overflow: 'auto' }}>
      <Table stickyHeader size="small">
        <RecordTableHead sortKey={sortKey} dir={dir} onSortChange={onSortChange} />
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} style={{ padding: 16, color: '#888' }}>
                No data
              </TableCell>
            </TableRow>
          )}
          {rows.map((r, i) => (
            <AssetRow key={`${r.group_1}|${r.relation}|${i}`} r={r} sortKey={sortKey} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AssetsDataTable;


