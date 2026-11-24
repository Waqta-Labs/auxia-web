// Una función t() de i18next para las pruebas: devuelve la clave con sus valores, así cada prueba
// comprueba qué texto se eligió y con qué cifras, sin depender de la redacción.
export function fakeT(key, values) {
  if (!values) return key;
  const params = Object.entries(values).map(([name, value]) => name + '=' + value).join(',');
  return key + '(' + params + ')';
}
