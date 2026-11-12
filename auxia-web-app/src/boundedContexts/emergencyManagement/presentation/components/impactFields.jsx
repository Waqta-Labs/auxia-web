import { useTranslation } from 'react-i18next';
import { IMPACT_FIELDS } from '../../domain/services/populationImpact.js';

const EXAMPLES = { population: '600', familiesAffected: '35', peopleAffected: '140', children: '40', elderlyPeople: '15', disabledPeople: '0' };

// Los seis conteos del impacto en la población (todos opcionales). values: { campo: texto }.
export default function ImpactFields({ values, onChange }) {
  const { t } = useTranslation('emergencyManagement');
  return (
    <fieldset className="gm-impact">
      <legend>{t('gisMap.impact.title')}</legend>
      <div className="gm-impact__grid">
        {IMPACT_FIELDS.map((field) => (
          <label key={field} className="gm-field">{t('gisMap.impact.' + field)}
            <input inputMode="numeric" value={values[field]} placeholder={EXAMPLES[field]} onChange={(event) => onChange({ ...values, [field]: event.target.value })} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
