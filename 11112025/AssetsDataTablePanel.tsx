/* Resolve UI key -> server sort + phase */
const resolveServerSort = (key: string): { sort: string; phase: string } => {
  // Fixed keys: map directly
  if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
  if (key === 'relation') return { sort: 'relation', phase: 'none' };

  // Phase-specific keys: map to the specific column ID for correct backend resolution
  const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted)$/i);
  if (!m) return { sort: 'group_1', phase: 'none' };

  const phase = m[1].toLowerCase();
  const field = m[2].toLowerCase();

  // CHANGE: Return the full, specific key (e.g., "mdl_submitted") instead of generic keys.
  // The backend will have to be updated to map these specific keys (see section 2).
  // The phase is still correctly extracted and returned.
  if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
  if (field === 'appr') return { sort: `${phase}_appr`, phase };
  return { sort: `${phase}_work`, phase };
};



// AssetsDataTablePanel.tsx

/* Immediate Sort Commit (Replacing 2s Debounced Sort) */
const handleSortChange = (newUiKey: string) => {
  const { sort: newServerSortKey, phase } = resolveServerSort(newUiKey);

  // 1. Determine the next direction (flip if clicking the currently active server key)
  const nextServerDir: SortDir =
    sortKey === newServerSortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';

  // 2. Commit the new sort to the server state immediately. This triggers useFetchAssetsPivot.
  setPhasePriority(phase);
  setSortKey(newServerSortKey);
  setSortDir(nextServerDir);

  // 3. Update the UI sort state immediately to reflect the arrow.
  setUiSortKey(newUiKey);
  setUiSortDir(nextServerDir);
  
  // Also reset page when sorting changes
  setPageProps(p => ({ ...p, page: 0 }));
};
// Remove useEffect cleanup logic for commitTimerRef as well
