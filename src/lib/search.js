const normalizeText = (value) => String(value ?? "").toLowerCase();

export const normalizeQuery = (query) => String(query ?? "").trim().toLowerCase();

export const matchesQuery = (text, query) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return true;
  return normalizeText(text).includes(normalizedQuery);
};

export const filterItemsByQuery = (items, query, getText) => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) return items;
  return items.filter((item) => normalizeText(getText(item)).includes(normalizedQuery));
};
