// Los mismos alias de vite.config.js, resueltos contra la carpeta src.
const SRC = new URL('../../src/', import.meta.url);

const ALIASES = {
  '@app/': 'app/',
  '@bc/': 'boundedContexts/',
  '@shared/': 'shared/',
  '@i18n/': 'i18n/',
  '@assets/': 'assets/',
};

export async function resolve(specifier, context, nextResolve) {
  for (const [alias, folder] of Object.entries(ALIASES)) {
    if (specifier.startsWith(alias)) {
      return nextResolve(new URL(folder + specifier.slice(alias.length), SRC).href, context);
    }
  }
  return nextResolve(specifier, context);
}
