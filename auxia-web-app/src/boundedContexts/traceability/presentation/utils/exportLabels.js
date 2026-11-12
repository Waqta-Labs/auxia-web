// Textos del Excel en el idioma de la interfaz.
export function buildExportLabels(t) {
  return {
    tableSheet: t('export.sheets.table'),
    summarySheet: t('export.sheets.summary'),
    itemsSheet: t('export.sheets.items'),
    evidenceSheet: t('export.sheets.evidence'),
    tableColumns: [
      t('export.columns.code'), t('export.columns.zone'), t('export.columns.status'),
      t('export.columns.delivered'), t('export.columns.transaction'), t('export.columns.verifyUrl'),
    ],
    status: (status) => t('ledger.status.' + status),
    fields: {
      field: t('export.fields.field'), value: t('export.fields.value'), code: t('export.columns.code'),
      zone: t('export.columns.zone'), status: t('export.columns.status'), delivered: t('export.fields.delivered'),
      received: t('export.fields.received'), anchored: t('export.fields.anchored'), recordHash: t('card.recordHash'),
      transaction: t('export.columns.transaction'), verifyUrl: t('export.columns.verifyUrl'),
      resource: t('export.fields.resource'), quantity: t('export.fields.quantity'), type: t('export.fields.type'),
      hash: t('export.fields.hash'), captured: t('export.fields.captured'), latitude: t('export.fields.latitude'),
      longitude: t('export.fields.longitude'),
    },
  };
}

const VALIDATION = ['rangeInvalid', 'noDeliveries', 'deliveryRequired', 'notRegistered'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function exportErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('export.errors.' + error.message);
  if (error.detail) return error.detail;
  return t('export.errors.generic');
}
