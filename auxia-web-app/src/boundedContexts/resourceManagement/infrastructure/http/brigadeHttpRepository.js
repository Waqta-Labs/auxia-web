import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade, toBrigadeDetail } from '../mappers/brigadeMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error);
  }
};

export class BrigadeHttpRepository extends BrigadeRepository {
  async findAll() {
    const { data } = await call(() => httpClient.get('/brigades'));
    return asList(data).map(toBrigade);
  }

  async findById(brigadeId) {
    const { data } = await call(() => httpClient.get('/brigades/' + brigadeId));
    return toBrigadeDetail(data);
  }

  async create({ name, code, latitude, longitude }) {
    const body = { name, baseLocation: { latitude, longitude } };
    if (code) body.code = code;
    const { data } = await call(() => httpClient.post('/brigades', body));
    return data?.id ?? null;
  }

  // Body del Swagger: { fullName, role, phone, userId }. El userId (cuenta de la App de Campo) aún no se pide.
  async addMember(brigadeId, { name, role, phone }) {
    const body = { fullName: name, role };
    if (phone) body.phone = phone;
    await call(() => httpClient.post('/brigades/' + brigadeId + '/members', body));
  }

  async removeMember(brigadeId, memberId) {
    await call(() => httpClient.delete('/brigades/' + brigadeId + '/members/' + memberId));
  }

  async setAvailability(brigadeId, status) {
    await call(() => httpClient.patch('/brigades/' + brigadeId + '/availability', { status }));
  }
}
