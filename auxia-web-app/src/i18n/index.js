import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import commonEs from './locales/es/common.json';
import commonEn from './locales/en/common.json';
import emergencyManagementEs from '@bc/emergencyManagement/presentation/i18n/es.json';
import emergencyManagementEn from '@bc/emergencyManagement/presentation/i18n/en.json';
import resourceManagementEs from '@bc/resourceManagement/presentation/i18n/es.json';
import resourceManagementEn from '@bc/resourceManagement/presentation/i18n/en.json';
import traceabilityEs from '@bc/traceability/presentation/i18n/es.json';
import traceabilityEn from '@bc/traceability/presentation/i18n/en.json';
import citizenTransparencyEs from '@bc/citizenTransparency/presentation/i18n/es.json';
import citizenTransparencyEn from '@bc/citizenTransparency/presentation/i18n/en.json';
import identityAccessEs from '@bc/identityAccess/presentation/i18n/es.json';
import identityAccessEn from '@bc/identityAccess/presentation/i18n/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        common: commonEs,
    emergencyManagement: emergencyManagementEs,
    resourceManagement: resourceManagementEs,
    traceability: traceabilityEs,
    citizenTransparency: citizenTransparencyEs,
    identityAccess: identityAccessEs,
      },
      en: {
        common: commonEn,
    emergencyManagement: emergencyManagementEn,
    resourceManagement: resourceManagementEn,
    traceability: traceabilityEn,
    citizenTransparency: citizenTransparencyEn,
    identityAccess: identityAccessEn,
      },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
  });

export default i18n;
