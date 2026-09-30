// Normalize display text for matching, without changing the displayed original.
export const foldSearch = (value: string) => value.normalize('NFKC')
  .toLocaleLowerCase('fa-IR').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
  .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();

export const matchesSearch = (query: string, fields: string[]) => {
  const haystack = foldSearch(fields.join(' '));
  return foldSearch(query).split(' ').filter(Boolean).every(word => haystack.includes(word));
};
