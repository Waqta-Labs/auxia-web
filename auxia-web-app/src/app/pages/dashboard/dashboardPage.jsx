import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KpiCard from '@shared/presentation/components/kpiCard.jsx';
import { formatNumber, formatPercent } from '@shared/utils/formatters.js';
import { routes } from '@app/router/routes.js';
import { CRITICAL_SCORE } from '@bc/emergencyManagement/domain/entities/Zone.js';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { useZoneRanking } from '@bc/emergencyManagement/presentation/hooks/useZoneRanking.js';
import { useFieldReportSummary } from '@bc/emergencyManagement/presentation/hooks/useFieldReportSummary.js';
import { useBrigadeOverview } from '@bc/resourceManagement/presentation/hooks/useBrigadeOverview.js';
import { useRecentDeliveries } from '@bc/traceability/presentation/hooks/useRecentDeliveries.js';
import { useVerificationStats } from '@bc/traceability/presentation/hooks/useVerificationStats.js';
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

  const emergency = useActiveEmergency();
  const emergencyId = emergency.data?.id;
  const ranking = useZoneRanking(emergencyId);
  const reports = useFieldReportSummary(emergencyId);
  const brigades = useBrigadeOverview();
  const deliveries = useRecentDeliveries({ limit: RECENT_DELIVERIES });
  const verification = useVerificationStats();

  const zones = ranking.data ?? [];
  const criticalCount = zones.filter((z) => z.isCritical).length;
  const verifiedPct = verification.data?.percentage;

  // La asignación de brigada pasa por un plan de distribución (recomendar -> aprobar): por ahora
  // se envía a la bandeja de priorización con la zona elegida.
  const handleAssign = (zone) => navigate(routes.prioritization + '?zone=' + zone.id);

  return (
    <div className="db">
      <section className="db-kpis" aria-label={t('dashboard.title')}>
        <KpiCard
          label={t('dashboard.kpi.activeRequests')}
          loading={reports.isPending}
          value={reports.data ? formatNumber(reports.data.total, lng) : null}
          hint={reports.data && t('dashboard.kpi.offlineShare', { percent: Math.round(reports.data.relayedShare * 100) })}
        />
        <KpiCard
          tone="lime"
          label={t('dashboard.kpi.criticalCases')}
          loading={ranking.isPending}
          value={ranking.data ? criticalCount : null}
          hint={t('dashboard.kpi.criticalHint', { threshold: CRITICAL_SCORE })}
        />
        <KpiCard
          label={t('dashboard.kpi.deployedBrigades')}
          loading={brigades.isPending}
          value={brigades.data ? brigades.data.deployed + '/' + brigades.data.total : null}
          hint={brigades.data && t('dashboard.kpi.availableBrigades', { count: brigades.data.available })}
        />
        <KpiCard
          label={t('dashboard.kpi.verifiedSupplies')}
          loading={verification.isPending}
          value={verifiedPct != null ? formatPercent(verifiedPct, lng) : null}
          hint={t('dashboard.kpi.verifiedHint')}
        />
      </section>

      <div className="db-grid">
        <UrgencyHeatMap zones={zones} brigades={brigades.data?.brigades} loading={ranking.isPending || brigades.isPending} />
        <PriorityList zones={zones.slice(0, TOP_PRIORITIES)} loading={ranking.isPending} onAssign={handleAssign} />
      </div>

      <DeliveriesTable deliveries={deliveries.data} loading={deliveries.isPending} />
    </div>
  );
}
