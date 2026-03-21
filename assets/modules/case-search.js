function compareStrings(a = '', b = '') {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

export function filterAndSortCases(items = [], filters = {}) {
  const caseIdQuery = (filters.caseId || '').trim().toLowerCase();
  const patientLabelQuery = (filters.patientLabel || '').trim().toLowerCase();
  const sortBy = filters.sortBy || 'updatedDesc';

  const filtered = items.filter((item) => {
    const caseIdMatch = !caseIdQuery || item.caseId?.toLowerCase().includes(caseIdQuery);
    const patientLabelMatch = !patientLabelQuery || item.pseudonymizedPatientLabel?.toLowerCase().includes(patientLabelQuery);
    return caseIdMatch && patientLabelMatch;
  });

  const sorted = [...filtered].sort((left, right) => {
    switch (sortBy) {
      case 'updatedAsc':
        return compareStrings(left.updatedAt, right.updatedAt);
      case 'createdDesc':
        return compareStrings(right.createdAt, left.createdAt);
      case 'createdAsc':
        return compareStrings(left.createdAt, right.createdAt);
      case 'patientLabelAsc':
        return compareStrings(left.pseudonymizedPatientLabel, right.pseudonymizedPatientLabel);
      case 'patientLabelDesc':
        return compareStrings(right.pseudonymizedPatientLabel, left.pseudonymizedPatientLabel);
      case 'updatedDesc':
      default:
        return compareStrings(right.updatedAt, left.updatedAt);
    }
  });

  return sorted;
}
