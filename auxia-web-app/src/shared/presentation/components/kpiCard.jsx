export default function KpiCard({ label, value, hint, tone, loading = false }) {
  return (
    <article className="kpi">
      <h3 className="kpi__label">{label}</h3>
      {loading ? (
        <span className="skeleton" style={{ height: 40, width: '60%' }} />
      ) : (
        <p className={'kpi__value' + (tone ? ' kpi__value--' + tone : '')}>{value ?? '—'}</p>
      )}
      <p className="kpi__hint">
        {loading ? <span className="skeleton" style={{ height: 14, width: '45%' }} /> : hint}
      </p>
    </article>
  );
}
