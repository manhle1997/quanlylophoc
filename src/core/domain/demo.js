import { createDocument, uid } from './schema.js';

// Synthetic fixture. These characters are invented, never imported from a school roster.
export function createDemo() {
  const doc = createDocument();
  doc.schoolName = 'Không gian trải nghiệm';
  const surnames = ['Mây', 'Nắng', 'Sao', 'Gió', 'Mầm', 'Biển', 'Trăng', 'Suối'];
  const names = ['An Nhiên', 'Ban Mai', 'Bình Minh', 'Lam Ngọc', 'Thanh Trúc'];
  doc.classes = ['7A1', '7A2', '8A1'].map((name, c) => ({
    id: uid(), name, schoolYear: '2026–2027', archived: false,
    students: Array.from({ length: c ? 32 + c : 40 }, (_, i) => ({ id: uid(), fullName: `${surnames[i % 8]} ${names[Math.floor(i / 8)]}`, labelSuffix: '', active: true })),
  }));
  doc.rounds = doc.classes.map(c => ({ classId: c.id, roundId: uid(), calledStudentIds: [] }));
  return doc;
}
