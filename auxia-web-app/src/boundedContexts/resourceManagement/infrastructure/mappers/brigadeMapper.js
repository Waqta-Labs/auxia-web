import { Brigade } from '../../domain/entities/Brigade.js';

export function toBrigade(dto) {
  return new Brigade({
    id: dto.id,
    name: dto.name,
    code: dto.code ?? null,
    status: dto.status,
    latitude: dto.baseLocation?.latitude ?? null,
    longitude: dto.baseLocation?.longitude ?? null,
  });
}
