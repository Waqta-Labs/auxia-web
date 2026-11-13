import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KpiCard from '@shared/presentation/components/kpiCard.jsx';
import { formatNumber, formatPercent } from '@shared/utils/formatters.js';
import { routes } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { useZoneRanking } from '@bc/emergencyManagement/presentation/hooks/useZoneRanking.js';
import { useFieldReportSummary } from '@bc/emergencyManagement/presentation/hooks/useFieldReportSummary.js';
import { useBrigadeOverview } from '@bc/resourceManagement/presentation/hooks/useBrigadeOverview.js';
import { useDeliveryOverview } from '@bc/traceability/presentation/hooks/useDeliveryOverview.js';
import UrgencyHeatMap from '@bc/emergencyManagement/presentation/components/urgencyHeatMap.jsx';
import PriorityList from '@bc/emergencyManagement/presentation/components/priorityList.jsx';
import DeliveriesTable from '@bc/traceability/presentation/components/deliveriesTable.jsx';
import './dashboard.css';

const TOP_PRIORITIES = 3;
const RECENT_DELIVERIES = 3;

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage;
  const navigate = useNavigate();
  const { isAuthority } = usePermissions(); // solo la autoridad asigna brigadas

  const emergency = useActiveEmergency();
  const emergencyId = emergency.data?.id;
  const ranking = useZoneRanking(emergencyId);
  const reports = useFieldReportSummary(emergencyId);
  const brigades = useBrigadeOverview();
  const deliveries = useDeliveryOverview({ zones: ranking.data, limit: RECENT_DELIVERIES });

  // Sin emergencia activa las consultas que dependen de ella nunca arrancan: no es "cargando".
  const noEmergency = emergency.isSuccess && !emergency.data;
  const loading = (query) => query.isPending && !noEmergency;

  const zones = ranking.data ?? [];
  const stats = deliveries.data?.stats;
  const hasError = [emergency, ranking, reports, brigades, deliveries].some((q) => q.isError);

  // La asignación de brigada pasa por un plan de distribución (recomendar -> aprobar): por ahora
  // se envía a la bandeja de priorización con la zona elegida.
  const handleAssign = (zone) => navigate(routes.prioritization + '?zone=' + zone.id);

  return (
    <div className="db">
      {hasError && <p className="db-alert" role="alert">{t('dashboard.error')}</p>}

      <section className="db-kpis" aria-label={t('dashboard.title')}>
        <KpiCard
          label={t('dashboard.kpi.activeRequests')}
          loading={loading(reports)}
          value={reports.data ? formatNumber(reports.data.total, lng) : null}
          hint={reports.data && t('dashboard.kpi.pendingZone', { count: reports.data.pendingZone })}
        />
        <KpiCard
          tone="lime"
          label={t('dashboard.kpi.criticalCases')}
          loading={loading(ranking)}
          value={ranking.data ? zones.filter((z) => z.isCritical).length : null}
          hint={t('dashboard.kpi.criticalHint')}
        />
        <KpiCard
          label={t('dashboard.kpi.deployedBrigades')}
          loading={loading(brigades)}
          value={brigades.data ? brigades.data.deployed + '/' + brigades.data.total : null}
          hint={brigades.data && t('dashboard.kpi.availableBrigades', { count: brigades.data.available })}
        />
        <KpiCard
          label={t('dashboard.kpi.verifiedSupplies')}
          loading={loading(deliveries)}
          value={stats?.percentage != null ? formatPercent(stats.percentage, lng) : null}
          hint={t('dashboard.kpi.verifiedHint')}
        />
      </section>

      <div className="db-grid">
        <UrgencyHeatMap
          zones={zones}
          brigades={brigades.data?.brigades}
          loading={loading(ranking) || loading(brigades)}
        />
        <PriorityList zones={zones.slice(0, TOP_PRIORITIES)} loading={loading(ranking)} onAssign={isAuthority ? handleAssign : undefined} />
      </div>

      <DeliveriesTable deliveries={deliveries.data?.recent} loading={loading(deliveries)} />
    </div>
  );
}
