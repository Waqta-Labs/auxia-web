// Filas de los informes en Excel. Los textos (columnas, estados) llegan ya traducidos en "labels".
const formatUtc = (epochMs) =>
  epochMs === null || epochMs === undefined ? '' : new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

// Informe de la tabla: una fila por entrega.
export function deliveriesSheet(deliveries, labels, verifyBaseUrl) {
  return {
    name: labels.tableSheet,
    rows: [
      labels.tableColumns,
      ...deliveries.map((delivery) => [
        delivery.id,
        delivery.zoneName ?? '',
        labels.status(delivery.status),
        formatUtc(delivery.deliveredAt),
        delivery.transactionHash ?? '',
        verifyBaseUrl + delivery.id,
      ]),
    ],
  };
}

// Informe de una entrega: resumen, recursos y evidencias.
export function deliverySheets(detail, zoneName, labels, verifyBaseUrl) {
  const f = labels.fields;
  return [
    {
      name: labels.summarySheet,
      rows: [
        [f.field, f.value],
        [f.code, detail.id],
        [f.zone, zoneName ?? detail.zoneId ?? ''],
        [f.status, labels.status(detail.status)],
        [f.delivered, formatUtc(detail.deliveredAt)],
        [f.received, formatUtc(detail.receivedAt)],
        [f.anchored, formatUtc(detail.anchoredAt)],
        [f.recordHash, detail.recordHash ?? ''],
        [f.transaction, detail.transactionHash ?? ''],
        [f.verifyUrl, verifyBaseUrl + detail.id],
      ],
    },
    {
      name: labels.itemsSheet,
      rows: [[f.resource, f.quantity], ...detail.items.map((item) => [item.name ?? item.resourceId ?? '', item.quantity])],
    },
    {
      name: labels.evidenceSheet,
      rows: [
        [f.type, f.hash, f.captured, f.latitude, f.longitude],
        ...detail.evidences.map((evidence) => [
          evidence.type ?? '', evidence.hash ?? '', formatUtc(evidence.capturedAt),
          evidence.location?.latitude ?? null, evidence.location?.longitude ?? null,
        ]),
      ],
    },
  ];
}
