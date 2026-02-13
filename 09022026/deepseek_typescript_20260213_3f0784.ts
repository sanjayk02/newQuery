// ============================================
// 4. UPDATE RESOLVE SERVER SORT FOR TAKE
// ============================================
const resolveServerSort = (key: string): { sort: string; phase: string } => {
  if (key === 'group_1') return { sort: 'group_1', phase: 'none' };
  if (key === 'relation') return { sort: 'relation', phase: 'none' };

  const m = key.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted|take)$/i);
  if (!m) return { sort: 'group_1', phase: 'none' };

  const phase = m[1].toLowerCase();
  const field = m[2].toLowerCase();

  if (field === 'submitted') return { sort: `${phase}_submitted`, phase };
  if (field === 'appr') return { sort: `${phase}_appr`, phase };
  if (field === 'take') return { sort: `${phase}_take`, phase };  // Already handled
  return { sort: `${phase}_work`, phase };
};

// ============================================
// 5. UPDATE CLIENT-SIDE SORTING FOR TAKE
// ============================================
// In the filteredAssets useMemo, update the comparator
const comparator = (a: any, b: any): number => {
  if (!uiSortKey || uiSortDir === 'none') return 0;

  if (uiSortKey === 'group_1') {
    return enhancedCompareStrings(a.group_1, b.group_1, uiSortDir);
  }
  if (uiSortKey === 'relation') {
    return enhancedCompareStrings(a.relation, b.relation, uiSortDir);
  }

  const m = uiSortKey.match(/^(mdl|rig|bld|dsn|ldv)_(work|appr|submitted|take)$/i);
  if (m) {
    const phase = m[1].toLowerCase();
    const field = m[2].toLowerCase();

    if (field === 'submitted') {
      const key = `${phase}_submitted_at_utc`;
      return enhancedCompareDates(a[key], b[key], uiSortDir);
    }
    
    if (field === 'take') {  // Special handling for TAKE columns
      const key = `${phase}_take`;
      return enhancedCompareTake(a[key], b[key], uiSortDir);  // Use numeric comparison
    }

    const key =
      field === 'appr'
        ? `${phase}_approval_status`
        : `${phase}_work_status`;

    return enhancedCompareStrings(a[key], b[key], uiSortDir);
  }

  return 0;
};

// ============================================
// 6. ADD THE ENHANCED TAKE COMPARATOR TO PANEL
// ============================================
// Add this function to the panel component
const enhancedCompareTake = (a: any, b: any, dir: SortDir): number => {
  const isAsc = dir === 'asc';
  
  const aEmpty = isEmptyValue(a);
  const bEmpty = isEmptyValue(b);
  
  // Empty values always go to the END
  if (aEmpty && bEmpty) return 0;
  if (aEmpty && !bEmpty) return 1;
  if (!aEmpty && bEmpty) return -1;
  
  // Parse as integers for numeric comparison
  const aNum = parseInt(String(a).trim(), 10);
  const bNum = parseInt(String(b).trim(), 10);
  
  // If both are valid numbers, compare numerically
  if (!isNaN(aNum) && !isNaN(bNum)) {
    if (aNum === bNum) return 0;
    
    if (isAsc) {
      return aNum < bNum ? -1 : 1;
    } else {
      return aNum > bNum ? -1 : 1;
    }
  }
  
  // Fallback to string comparison
  const compA = String(a).trim().toLowerCase();
  const compB = String(b).trim().toLowerCase();
  
  if (compA === compB) return 0;
  
  if (isAsc) {
    return compA < compB ? -1 : 1;
  } else {
    return compA > compB ? -1 : 1;
  }
};