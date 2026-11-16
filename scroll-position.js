// Return null when the first result is already visible. Measure the full sticky
// workspace, including the select-all header, rather than assuming a fixed height.
export function firstResultScrollTarget({row,header,viewportHeight,scrollY,gap=8}) {
 const visibleTop=Math.max(0,header.bottom)+gap;
 const visibleBottom=viewportHeight-gap;
 const requiredBottom=Math.min(row.bottom,row.top+Math.max(1,visibleBottom-visibleTop));
 if(row.top>=visibleTop && requiredBottom<=visibleBottom)return null;
 return Math.max(0,scrollY+row.top-header.height-gap);
}
