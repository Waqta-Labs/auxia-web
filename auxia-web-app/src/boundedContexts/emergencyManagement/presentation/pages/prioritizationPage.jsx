import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { EMPTY_ZONE_FILTERS, ZoneTab, countByTab, filterZones } from '../../domain/services/filterZones.js';
import { useActiveEmergency } from '../hooks/useActiveEmergency.js';
import { useZoneRanking } from '../hooks/useZoneRanking.js';
import PrioritizationToolbar from '../components/prioritizationToolbar.jsx';
import ZoneTabs from '../components/zoneTabs.jsx';
import ZoneTable from '../components/zoneTable.jsx';
import ScoreDrawer from '../components/scoreDrawer.jsx';
import '../styles/prioritization.css';

const PAGE_SIZE = 8;

export default function PrioritizationPage() {
  const { t, i18n } = useTranslation('emergencyManagement');
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthority } = usePermissions();

  const emergency = useActiveEmergency();
  // La bandeja no necesita coordenadas ni explicaciones: se piden al abrir el detalle de una zona.
  const ranking = useZoneRanking(emergency.data?.id, { explainTop: 0, withPosition: false });

  const [tab, setTab] = useState(ZoneTab.ALL);
  const [filters, setFilters] = useState(EMPTY_ZONE_FILTERS);
  const [page, setPage] = useState(1);

  const zones = useMemo(() => ranking.data ?? [], [ranking.data]);
  const counts = useMemo(() => countByTab(zones), [zones]);
  const filtered = useMemo(() => filterZones(zones, { ...filters, tab }), [zones, filters, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE + 2);

  // La zona abierta vive en la URL (?zone=): el tablero enlaza aquí y la página se puede recargar.
  const selectedId = searchParams.get('zone');
  const selectedRow = zones.find((zone) => zone.id === selectedId) ?? null;
  const select = (id) => {
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    if (id) next.set('zone', id);
    else next.delete('zone');
    setSearchParams(next, { replace: true });
  };

  const noEmergency = emergency.isSuccess && !emergency.data;
  const loading = emergency.isPending || ranking.isLoading;
  const hasError = emergency.isError || ranking.isError;
  const retry = () => (emergency.isError ? emergency.refetch() : ranking.refetch());

  const changeTab = (next) => { setTab(next); setPage(1); };
  const changeFilters = (next) => { setFilters(next); setPage(1); };
  const lng = i18n.resolvedLanguage;
  const number = (value) => new Intl.NumberFormat(lng).format(value);

  return (
    <div className="pz">
      <header className="pz-head">
        <h1>{t('prioritization.title')}</h1>
        <p>{t('prioritization.subtitle')}</p>
      </header>

      {hasError && (
        <p className="pz-alert" role="alert">
          {t('prioritization.error')}{' '}
          <button type="button" className="pz-link-btn" onClick={retry}>{t('prioritization.retry')}</button>
        </p>
      )}

      {noEmergency && <p className="pz-alert">{t('prioritization.noEmergency')}</p>}

      <PrioritizationToolbar filters={filters} onChange={changeFilters} />

      <section className="pz-panel">
        <ZoneTabs value={tab} counts={counts} onChange={changeTab} />
        <ZoneTable zones={visible} loading={loading && !noEmergency} selectedId={selectedId} onSelect={select} />

        {!loading && filtered.length > 0 && (
          <footer className="pz-pagination">
            <span>
              {t('prioritization.pagination.range', {
                from: number(start + 1),
                to: number(start + visible.length),
                total: number(filtered.length),
              })}
            </span>
            <div className="pz-pager">
              <button type="button" className="pz-btn-outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                {t('prioritization.pagination.prev')}
              </button>
              <button type="button" className="pz-btn-outline" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                {t('prioritization.pagination.next')}
              </button>
            </div>
          </footer>
        )}
      </section>

      {selectedId && (
        <ScoreDrawer
          zoneId={selectedId}
          row={selectedRow}
          canManage={isAuthority}
          initialView={searchParams.get('view') === 'assign' ? 'assign' : 'detail'}
          onClose={() => select(null)}
        />
      )}
    </div>
  );
}
