export const formatNumber = (value, lng) => new Intl.NumberFormat(lng).format(value);

export const formatPercent = (value, lng) =>
  new Intl.NumberFormat(lng, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + '%';

export const formatDateTime = (epochMs, lng) =>
  epochMs == null ? '—' : new Intl.DateTimeFormat(lng, { dateStyle: 'medium', timeStyle: 'short' }).format(epochMs);

export const truncateHash = (hash, head = 6, tail = 4) =>
  hash && hash.length > head + tail ? hash.slice(0, head) + '…' + hash.slice(-tail) : hash;

// "accessCut" / "access_cut" -> "Access cut"
export const humanize = (key) => {
  const text = String(key).replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// El backend manda fechas sin zona (LocalDateTime en UTC): se interpretan como UTC. Devuelve epoch ms o null.
export const parseUtc = (value) => {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const iso = hasZone || value.length <= 10 ? value : value + 'Z';
  const time = new Date(iso).getTime();
  return Number.isNaN(time) ? null : time;
};
