import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrigadeStatus } from '../../domain/enums/brigadeStatus.js';
import { MemberRole } from '../../domain/enums/memberRole.js';
import { useAddBrigadeMember } from '../hooks/useAddBrigadeMember.js';
import { useRemoveBrigadeMember } from '../hooks/useRemoveBrigadeMember.js';
import { useSetBrigadeAvailability } from '../hooks/useSetBrigadeAvailability.js';
import { brigadeErrorMessage, initials, roleLabel, statusLabel } from '../utils/brigadeFormat.js';

export default function BrigadeDetailPanel({ detail, canManage }) {
  const { t } = useTranslation('resourceManagement');
  const addMember = useAddBrigadeMember();
  const removeMember = useRemoveBrigadeMember();
  const setAvailability = useSetBrigadeAvailability();
  const [name, setName] = useState('');
  const [role, setRole] = useState(MemberRole.VOLUNTEER);
  const [failure, setFailure] = useState(null);
  const brigade = detail.data;

  const run = (mutation, values, onSuccess) => {
    setFailure(null);
    mutation.mutate(values, { onSuccess, onError: setFailure });
  };

  const submitMember = (event) => {
    event.preventDefault();
    run(addMember, { brigadeId: brigade.id, name, role }, () => setName(''));
  };

  const busy = addMember.isPending || removeMember.isPending || setAvailability.isPending;
  const error = brigadeErrorMessage(t, failure);

  return (
    <aside className="fl-card" aria-labelledby="fl-detail-title">
      {detail.isLoading && <span className="fl-skel fl-skel--block" />}
      {detail.isError && <p className="fl-error" role="alert">{detail.error?.detail ?? t('brigades.loadError')}</p>}

      {brigade && (
        <>
          <header className="fl-detail__head">
            <span className="fl-avatar" aria-hidden="true">{initials(brigade.name)}</span>
            <div>
              <h2 id="fl-detail-title" className="fl-h2 fl-h2--tight">{brigade.name}</h2>
              <span className={'fl-chip fl-chip--' + brigade.status.toLowerCase()}>{statusLabel(t, brigade.status)}</span>
            </div>
          </header>

          <dl className="fl-facts">
            {brigade.code && <div><dt>{t('brigades.detail.code')}</dt><dd>{brigade.code}</dd></div>}
            <div>
              <dt>{t('brigades.detail.base')}</dt>
              <dd>{brigade.hasPosition ? brigade.latitude.toFixed(4) + ', ' + brigade.longitude.toFixed(4) : '—'}</dd>
            </div>
          </dl>

          {!brigade.hasLeader && <p className="fl-warning">{t('brigades.detail.noLeader')}</p>}

          <div>
            <span className="fl-label">{t('brigades.detail.members')}</span>
            {brigade.members.length === 0 && <p className="fl-note">{t('brigades.detail.noMembers')}</p>}
            <ul className="fl-members">
              {brigade.members.map((member) => (
                <li key={member.id}>
                  <span className="fl-avatar fl-avatar--sm" aria-hidden="true">{initials(member.name)}</span>
                  <span className="fl-members__name">{member.name}</span>
                  <span className="fl-members__role">{roleLabel(t, member.role)}</span>
                  {canManage && (
                    <button
                      type="button" className="fl-icon-btn" disabled={busy}
                      aria-label={t('brigades.detail.remove', { name: member.name })}
                      onClick={() => run(removeMember, { brigadeId: brigade.id, memberId: member.id })}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {canManage && (
            <form className="fl-add" onSubmit={submitMember} noValidate>
              <span className="fl-label">{t('brigades.detail.addMember')}</span>
              <div className="fl-add__row">
                <input
                  value={name} onChange={(event) => setName(event.target.value)}
                  placeholder={t('brigades.detail.memberName')} aria-label={t('brigades.detail.memberName')}
                />
                <select value={role} onChange={(event) => setRole(event.target.value)} aria-label={t('brigades.detail.memberRole')}>
                  {Object.values(MemberRole).map((value) => (
                    <option key={value} value={value}>{roleLabel(t, value)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="fl-btn-outline" disabled={busy}>
                {addMember.isPending ? t('brigades.detail.adding') : t('brigades.detail.add')}
              </button>
            </form>
          )}

          {canManage && (
            <div className="fl-availability">
              {brigade.isDeployed ? (
                <p className="fl-note">{t('brigades.detail.lockedWhileAssigned')}</p>
              ) : (
                <button
                  type="button" className="fl-btn-lime" disabled={busy}
                  onClick={() => run(setAvailability, {
                    brigadeId: brigade.id,
                    status: brigade.isOffDuty ? BrigadeStatus.AVAILABLE : BrigadeStatus.OFF_DUTY,
                  })}
                >
                  {brigade.isOffDuty ? t('brigades.detail.putInService') : t('brigades.detail.putOffDuty')}
                </button>
              )}
            </div>
          )}

          {!canManage && <p className="fl-note">{t('brigades.detail.readOnly')}</p>}
          {error && <p className="fl-error" role="alert">{error}</p>}
        </>
      )}
    </aside>
  );
}
