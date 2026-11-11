import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes, routeRoles } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { BrigadeTab, countByTab, filterBrigades } from '../../domain/services/filterBrigades.js';
import { useBrigadeList } from '../hooks/useBrigadeList.js';
import { useBrigadeDetail } from '../hooks/useBrigadeDetail.js';
import BrigadeList from '../components/brigadeList.jsx';
import BrigadeMission from '../components/brigadeMission.jsx';
import BrigadeDetailPanel from '../components/brigadeDetailPanel.jsx';
import NewBrigadeDialog from '../components/newBrigadeDialog.jsx';
import '../styles/fieldLogistics.css';

export default function FieldLogisticsPage() {
  const { t } = useTranslation('resourceManagement');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, isAdmin } = usePermissions();
  const canOpenPrioritization = routeRoles.prioritization.includes(role);

  const list = useBrigadeList();
  const [tab, setTab] = useState(BrigadeTab.ALL);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const brigades = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => countByTab(brigades), [brigades]);
  const visible = useMemo(() => filterBrigades(brigades, { tab, search }), [brigades, tab, search]);

  // La brigada abierta vive en la URL (?brigade=); si no hay o ya no existe, se abre la primera de la lista.
  const requested = searchParams.get('brigade');
  const selectedId = brigades.some((brigade) => brigade.id === requested) ? requested : visible[0]?.id ?? null;
  const select = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('brigade', id);
    setSearchParams(next, { replace: true });
  };

  const detail = useBrigadeDetail(selectedId);

  return (
    <div className="fl">
      <header className="fl-head">
        <div>
          <h1>{t('brigades.title')}</h1>
          <p>{t('brigades.subtitle', { deployed: counts[BrigadeTab.ASSIGNED], total: counts[BrigadeTab.ALL] })}</p>
        </div>
        {isAdmin && (
          <button type="button" className="fl-btn-lime" onClick={() => setCreating(true)}>{t('brigades.new.open')}</button>
        )}
      </header>

      {list.isError && (
        <p className="fl-alert" role="alert">
          {t('brigades.loadError')}{' '}
          <button type="button" className="fl-link-btn" onClick={() => list.refetch()}>{t('brigades.retry')}</button>
        </p>
      )}

      <div className="fl-grid">
        <BrigadeList
          brigades={visible} counts={counts} tab={tab} onTab={setTab} search={search} onSearch={setSearch}
          selectedId={selectedId} onSelect={select} loading={list.isLoading}
        />
        {selectedId ? (
          <>
            <BrigadeMission
              detail={detail}
              onOpenZone={canOpenPrioritization ? (zoneId) => navigate(routes.prioritization + '?zone=' + zoneId) : undefined}
              onOpenPrioritization={canOpenPrioritization ? () => navigate(routes.prioritization) : undefined}
            />
            <BrigadeDetailPanel detail={detail} canManage={isAdmin} />
          </>
        ) : (
          !list.isLoading && <p className="fl-card fl-empty fl-grid__rest">{t('brigades.noSelection')}</p>
        )}
      </div>

      {creating && (
        <NewBrigadeDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setTab(BrigadeTab.ALL); setSearch(''); if (id) select(id); }}
        />
      )}
    </div>
  );
}
