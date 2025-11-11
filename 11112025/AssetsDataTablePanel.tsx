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



/* 2s debounced sort */
  const handleSortChange = (newUiKey: string) => {
    const { sort: newServerSortKey, phase } = resolveServerSort(newUiKey);

    // Determine the next server direction: Flip only if the RESOLVED server key matches the current active server key.
    const nextServerDir: SortDir =
      sortKey === newServerSortKey ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    
    // UI update (immediate visual feedback)
    setUiSortKey(newUiKey);
    setUiSortDir(nextServerDir); // Immediately set UI direction based on the logic above

    if (commitTimerRef.current != null) {
      window.clearTimeout(commitTimerRef.current);
    }

    // Debounced server state update
    commitTimerRef.current = window.setTimeout(() => {
      setPhasePriority(phase);
      setSortKey(newServerSortKey); // Commit the new resolved server key
      setSortDir(nextServerDir);    // Commit the new direction

      commitTimerRef.current = null;
    }, 2000); // Keep debounce for performance
  };
