// AssetsDataTable.tsx, inside AssetRow component
// Original: if phase groups skip entirely in compact mode
/* {!compact &&
        (Object.entries(ASSET_PHASES) as Array<[string, { lineColor: string }]>).map(
// ...
*/

// Replacement: Always try to render phase groups, letting isHidden() handle visibility
      {(Object.entries(ASSET_PHASES) as Array<[string, { lineColor: string }]>).map(
          ([phase, { lineColor }]) => {
// ... (rest of the mapping function remains the same)
