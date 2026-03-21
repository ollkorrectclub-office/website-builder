export interface CodeDiffLine {
  kind: "context" | "added" | "removed";
  leftNumber: number | null;
  rightNumber: number | null;
  content: string;
}

export function buildCodeDiff(before: string, after: string): CodeDiffLine[] {
  const left = before.split("\n");
  const right = after.split("\n");
  const rows = left.length;
  const cols = right.length;
  const lcs = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      lcs[i][j] = left[i] === right[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const lines: CodeDiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < rows && j < cols) {
    if (left[i] === right[j]) {
      lines.push({
        kind: "context",
        leftNumber: i + 1,
        rightNumber: j + 1,
        content: left[i],
      });
      i += 1;
      j += 1;
      continue;
    }

    if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({
        kind: "removed",
        leftNumber: i + 1,
        rightNumber: null,
        content: left[i],
      });
      i += 1;
      continue;
    }

    lines.push({
      kind: "added",
      leftNumber: null,
      rightNumber: j + 1,
      content: right[j],
    });
    j += 1;
  }

  while (i < rows) {
    lines.push({
      kind: "removed",
      leftNumber: i + 1,
      rightNumber: null,
      content: left[i],
    });
    i += 1;
  }

  while (j < cols) {
    lines.push({
      kind: "added",
      leftNumber: null,
      rightNumber: j + 1,
      content: right[j],
    });
    j += 1;
  }

  return lines;
}
