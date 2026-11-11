import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade, toBrigadeDetail } from '../mappers/brigadeMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const NAMES = [
  'Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
];
const PEOPLE = ['M. Quispe', 'R. Torres', 'L. Vargas', 'J. Rojas', 'A. Salas', 'C. Huamán', 'P. Ccori', 'D. Mendoza'];
const ROLES = ['LEADER', 'MEDIC', 'VOLUNTEER', 'DRIVER', 'VOLUNTEER'];
const ZONES = [
  ['zn-01', 'Sector Santa Rosa', 94], ['zn-02', 'Villa Esperanza', 91], ['zn-03', 'Quebrada Carossio', 88],
  ['zn-04', 'Las Terrazas', 72], ['zn-05', 'Huaycán Bajo', 67], ['zn-06', 'Cerro Candela', 54],
];

const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

// 24 brigadas: 17 en misión, 5 disponibles y 2 fuera de servicio, repartidas alrededor de Chosica.
const buildDtos = () =>
  NAMES.map((name, i) => {
    const status = i < 17 ? 'ASSIGNED' : i < 22 ? 'AVAILABLE' : 'OFF_DUTY';
    const size = 3 + (i % 3);
    const members = Array.from({ length: size }, (_, k) => ({
      id: 'mb-' + i + '-' + k,
      fullName: PEOPLE[(i + k) % PEOPLE.length],
      phone: '9876' + String(10000 + i * 10 + k),
      role: i === 19 && k === 0 ? 'VOLUNTEER' : ROLES[k % ROLES.length], // br-20 sin líder
    }));
    const [zoneId, zoneName, score] = ZONES[i % ZONES.length];
    return {
      id: 'br-' + String(i + 1).padStart(2, '0'),
      name: 'Brigada ' + name,
      code: 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
      status,
      baseLocation: { latitude: -11.94 + Math.sin(i * 2.4) * 0.024, longitude: -76.69 + Math.cos(i * 1.7) * 0.026 },
      members,
      assignment: status !== 'ASSIGNED' ? null : {
        planId: 'pl-' + String(i + 1).padStart(4, '0'), zoneId, zoneName, score,
        etaMinutes: 12 + ((i * 7) % 30), distanceKm: Math.round((3 + ((i * 13) % 90) / 10) * 10) / 10,
        items: [
          { resourceName: 'Agua embotellada', quantity: 20 + i, unit: 'bidones' },
          { resourceName: 'Kits de alimentos', quantity: 40 + i * 2, unit: 'kits' },
        ],
        assignedAt: '2026-11-11T20:30:00',
      },
    };
  });

export class BrigadeMockRepository extends BrigadeRepository {
  constructor() {
    super();
    this.dtos = buildDtos(); // en memoria: los cambios duran hasta recargar la página
    this.sequence = 0;
  }

  find(brigadeId) {
    const dto = this.dtos.find((item) => item.id === brigadeId);
    if (!dto) throw problem(404, 'Brigada no encontrada');
    return dto;
  }

  async findAll() {
    await delay(400);
    return this.dtos.map(toBrigade);
  }

  async findById(brigadeId) {
    await delay(300);
    return toBrigadeDetail(this.find(brigadeId));
  }

  async create({ name, code, latitude, longitude }) {
    await delay(500);
    if (this.dtos.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw problem(409, 'Ya existe una brigada con ese nombre en tu organización.');
    }
    this.sequence += 1;
    const id = 'br-new-' + this.sequence;
    this.dtos.push({
      id, name, code: code ?? 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + (90 + this.sequence),
      status: 'AVAILABLE', baseLocation: { latitude, longitude }, members: [], assignment: null,
    });
    this.dtos.sort((a, b) => a.name.localeCompare(b.name));
    return id;
  }

  async addMember(brigadeId, { name, role, phone }) {
    await delay(400);
    const dto = this.find(brigadeId);
    this.sequence += 1;
    dto.members.push({ id: 'mb-new-' + this.sequence, fullName: name, role, phone });
  }

  async removeMember(brigadeId, memberId) {
    await delay(400);
    const dto = this.find(brigadeId);
    const member = dto.members.find((item) => item.id === memberId);
    if (!member) throw problem(404, 'Miembro no encontrado');
    const leaders = dto.members.filter((item) => item.role === 'LEADER');
    if (dto.status === 'ASSIGNED' && member.role === 'LEADER' && leaders.length === 1) {
      throw problem(422, 'No se puede quitar al último líder mientras la brigada está asignada.');
    }
    dto.members = dto.members.filter((item) => item.id !== memberId);
  }

  async setAvailability(brigadeId, status) {
    await delay(400);
    const dto = this.find(brigadeId);
    if (dto.status === 'ASSIGNED') throw problem(409, 'No se puede cambiar la disponibilidad mientras la brigada está asignada.');
    dto.status = status;
  }
}
