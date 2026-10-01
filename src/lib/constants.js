// src/lib/constants.js
export const CURRENT_YEAR_TH = 2569;
export const START_YEAR = 2556;
export const ALL_YEARS = Array.from({ length: 14 }, (_, i) => START_YEAR + i);
export const EDITABLE_YEARS = ALL_YEARS.filter(y => y < CURRENT_YEAR_TH);
export const baht = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 });
