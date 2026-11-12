import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { useZoneRanking } from '@bc/emergencyManagement/presentation/hooks/useZoneRanking.js';
import { DeliveryTab, Period, countByTab, filterDeliveries } from '../../domain/services/filterDeliveries.js';
import { useDeliveryLedger } from '../hooks/useDeliveryLedger.js';
import { useDeliveryDetail } from '../hooks/useDeliveryDetail.js';
import LedgerToolbar from '../components/ledgerToolbar.jsx';
import LedgerTable from '../components/ledgerTable.jsx';
import TraceabilityCard from '../components/traceabilityCard.jsx';
import DownloadReportDialog from '../components/downloadReportDialog.jsx';
import '../styles/auditLedger.css';

const PAGE_SIZE = 10;

export default function AuditLedgerPage() {
  const { t } = useTranslation('traceability');
  const [searchParams, setSearchParams] = useSearchParams();

  const emergency = useActiveEmergency();
  const ranking = useZoneRanking(emergency.data?.id, { explainTop: 0, withPosition: false });
  const ledger = useDeliveryLedger({ zones: ranking.data });

  const [tab, setTab] = useState(DeliveryTab.ALL);
  const [period, setPeriod] = useState(Period.ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null); // null | 'table' | 'delivery'

  const deliveries = useMemo(() => ledger.data ?? [], [ledger.data]);
  const counts = useMemo(() => countByTab(deliveries), [deliveries]);
  const filtered = useMemo(() => filterDeliveries(deliveries, { tab, search, period }), [deliveries, tab, search, period]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  // La entrega abierta vive en la URL (?delivery=): se puede recargar o compartir el enlace.
  const selectedId = searchParams.get('delivery');
  const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;
  const detail = useDeliveryDetail(selectedId);
  const select = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('delivery', id);
    else next.delete('delivery');
    setSearchParams(next, { replace: true });
  };

  const loading = emergency.isPending || ranking.isLoading || ledger.isLoading;
  const hasError = emergency.isError || ranking.isError || ledger.isError;
  const retry = () => (emergency.isError ? emergency.refetch() : ranking.isError ? ranking.refetch() : ledger.refetch());
  const change = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="tl">
      <header className="tl-head">
        <div>
          <h1>{t('page.title')}</h1>
          <p>{t('page.subtitle')}</p>
        </div>
        <button type="button" className="tl-btn-lime" disabled={loading || deliveries.length === 0} onClick={() => setExporting('table')}>
          {t('page.export')}
        </button>
      </header>

      {hasError && (
        <p className="tl-alert" role="alert">
          {t('page.loadError')} <button type="button" className="tl-link-btn" onClick={retry}>{t('page.retry')}</button>
        </p>
      )}

      <div className={'tl-layout' + (selectedId ? ' has-card' : '')}>
        <section className="tl-panel" aria-labelledby="tl-ledger-title">
          <header className="tl-panel__head">
            <h2 id="tl-ledger-title" className="tl-h2">{t('page.ledger')}</h2>
            {!loading && <span className="tl-sync">{t('page.count', { count: filtered.length })}</span>}
          </header>
          <LedgerToolbar
            search={search} onSearch={change(setSearch)} period={period} onPeriod={change(setPeriod)}
            tab={tab} onTab={change(setTab)} counts={counts}
          />
          <LedgerTable deliveries={visible} loading={loading} selectedId={selectedId} onSelect={select} />
          {!loading && filtered.length > 0 && (
            <footer className="tl-pagination">
              <span>{t('page.range', { from: start + 1, to: start + visible.length, total: filtered.length })}</span>
              <div>
                <button type="button" className="tl-btn-outline tl-btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t('page.prev')}</button>
                <button type="button" className="tl-btn-outline tl-btn-sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>{t('page.next')}</button>
              </div>
            </footer>
          )}
        </section>

        {selectedId && (
          <TraceabilityCard
            key={selectedId} detail={detail} zoneName={selected?.zoneName}
            onClose={() => select(null)} onDownload={() => setExporting('delivery')}
          />
        )}
      </div>

      {exporting && (
        <DownloadReportDialog
          scope={exporting} deliveries={deliveries} detail={detail.data ?? null} zoneName={selected?.zoneName ?? null}
          onClose={() => setExporting(null)}
        />
      )}
    </div>
  );
}
