export const formatNumber = (value, lng) => new Intl.NumberFormat(lng).format(value);

export const formatPercent = (value, lng) =>
  new Intl.NumberFormat(lng, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + '%';

export const truncateHash = (hash, head = 6, tail = 4) =>
  hash && hash.length > head + tail ? hash.slice(0, head) + '…' + hash.slice(-tail) : hash;
