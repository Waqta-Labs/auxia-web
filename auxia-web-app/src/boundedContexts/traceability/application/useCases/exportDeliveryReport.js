import { deliveriesSheet, deliverySheets } from '../../domain/services/deliveryReportRows.js';
import { filterByRange, isRangeValid } from '../../domain/services/filterDeliveries.js';

// Informe de auditoría en PDF (lo genera el backend) o Excel (se arma aquí con los datos ya cargados).
//   scope 'table'    → todas las entregas, con rango de fechas opcional
//   scope 'delivery' → una entrega (el PDF del backend filtra por zona y día; el Excel es exacto)
// Errores de validación: rangeInvalid, noDeliveries, deliveryRequired, notRegistered.
export class ExportDeliveryReport {
  constructor({ deliveryRepository, workbookWriter }) {
    this.deliveryRepository = deliveryRepository;
    this.workbookWriter = workbookWriter;
  }

  async execute({ scope, format, from = null, to = null, deliveries = [], detail = null, zoneName = null, labels, verifyBaseUrl = '' }) {
    if (!isRangeValid(from, to)) throw new Error('rangeInvalid');
    const stamp = new Date().toISOString().slice(0, 10);

    if (scope === 'delivery') {
      if (!detail) throw new Error('deliveryRequired');
      const base = 'entrega-' + detail.id.slice(0, 8) + '-' + stamp;
      if (format === 'xlsx') {
        return { blob: this.workbookWriter(deliverySheets(detail, zoneName, labels, verifyBaseUrl)), filename: base + '.xlsx' };
      }
      if (detail.deliveredAt === null) throw new Error('notRegistered');
      const day = new Date(detail.deliveredAt).toISOString().slice(0, 10);
      const blob = await this.deliveryRepository.downloadReport({ zoneId: detail.zoneId, from: day, to: day });
      return { blob, filename: base + '.pdf' };
    }

    const base = 'informe-auditoria-' + stamp;
    if (format === 'xlsx') {
      const rows = filterByRange(deliveries, from, to);
      if (rows.length === 0) throw new Error('noDeliveries');
      return { blob: this.workbookWriter([deliveriesSheet(rows, labels, verifyBaseUrl)]), filename: base + '.xlsx' };
    }
    const blob = await this.deliveryRepository.downloadReport({ from, to });
    return { blob, filename: base + '.pdf' };
  }
}
