/**
 * Shared helpers for even-grid SVG sprite sheets (ART_SPEC).
 */
export const APPROVED = new Set([128, 256, 512, 1024, 2048]);

export function assertApproved(n, label) {
  if (!APPROVED.has(n)) {
    throw new Error(`${label}=${n} not in approved sizes`);
  }
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build an SVG sheet string.
 * cells: [{ row, col, id, bodySvg }]
 */
export function buildSvgSheet({
  width,
  height,
  cellWidth,
  cellHeight,
  columns,
  rows,
  cells,
  guideSvg = '',
}) {
  assertApproved(width, 'width');
  assertApproved(height, 'height');
  assertApproved(cellWidth, 'cellWidth');
  assertApproved(cellHeight, 'cellHeight');
  if (columns * cellWidth !== width || rows * cellHeight !== height) {
    throw new Error('Sheet size must equal columns*cellW by rows*cellH');
  }

  const clipDefs = cells
    .map(({ row, col }) => {
      const id = `clip_${row}_${col}`;
      return `    <clipPath id="${id}"><rect x="0" y="0" width="${cellWidth}" height="${cellHeight}"/></clipPath>`;
    })
    .join('\n');

  const cellGroups = cells
    .map(({ row, col, id, bodySvg }) => {
      const x = col * cellWidth;
      const y = row * cellHeight;
      return `  <g id="cell_${row}_${col}" transform="translate(${x},${y})" clip-path="url(#clip_${row}_${col})">
    <g id="${escapeXml(id)}">
${bodySvg}
    </g>
  </g>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
${clipDefs}
  </defs>
  <g id="layer-guides" data-export="false">
${guideSvg}
  </g>
  <g id="layer-art">
${cellGroups}
  </g>
</svg>
`;
}

export function guideGrid(cellWidth, cellHeight, columns, rows, pivot) {
  const lines = [];
  for (let c = 0; c <= columns; c++) {
    const x = c * cellWidth;
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${rows * cellHeight}" stroke="#4488ff" stroke-opacity="0.25" stroke-width="1"/>`,
    );
  }
  for (let r = 0; r <= rows; r++) {
    const y = r * cellHeight;
    lines.push(
      `<line x1="0" y1="${y}" x2="${columns * cellWidth}" y2="${y}" stroke="#4488ff" stroke-opacity="0.25" stroke-width="1"/>`,
    );
  }
  if (pivot) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const px = c * cellWidth + pivot.x;
        const py = r * cellHeight + pivot.y;
        lines.push(
          `<circle cx="${px}" cy="${py}" r="4" fill="none" stroke="#ff6688" stroke-opacity="0.5" stroke-width="1"/>`,
        );
      }
    }
  }
  return lines.join('\n    ');
}
