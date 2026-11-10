import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade } from '../mappers/brigadeMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const NAMES = [
  'Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
];

// 24 brigadas: 18 desplegadas, 6 disponibles, repartidas alrededor de Chosica.
const dtos = NAMES.map((name, i) => ({
  id: 'br-' + String(i + 1).padStart(2, '0'),
  name: 'Brigada ' + name,
  code: 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
  status: i < 18 ? 'ASSIGNED' : 'AVAILABLE',
  baseLocation: {
    latitude: -11.94 + Math.sin(i * 2.4) * 0.024,
    longitude: -76.69 + Math.cos(i * 1.7) * 0.026,
  },
}));

export class BrigadeMockRepository extends BrigadeRepository {
  async findAll() {
    await delay(400);
    return dtos.map(toBrigade);
  }
}
