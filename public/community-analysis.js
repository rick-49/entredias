export function summarizeGroups(groups, mood) {
  const levels = [0, 0, 0, 0];
  for (const group of groups) group.moods[mood].forEach((count, index) => { levels[index] += count; });
  const total = levels.reduce((sum, count) => sum + count, 0);
  return { levels, total, felt: total ? (total - levels[0]) / total * 100 : null, intense: total ? levels[3] / total * 100 : null };
}
export function groupSeries(groups, key, mood) {
  const buckets = new Map();
  for (const group of groups) { const id = key(group); if (!buckets.has(id)) buckets.set(id, []); buckets.get(id).push(group); }
  return [...buckets].map(([label, rows]) => ({ label, ...summarizeGroups(rows, mood), days: new Set(rows.map(row => row.day)).size }));
}
