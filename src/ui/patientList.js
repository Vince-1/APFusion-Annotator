export function sortPatients(patients, compareFn) {
  return [...(patients || [])].sort(compareFn);
}

export function filterPatients(patients, predicate) {
  return [...(patients || [])].filter(predicate);
}
