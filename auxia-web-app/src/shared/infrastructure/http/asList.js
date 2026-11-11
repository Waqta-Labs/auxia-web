// Acepta tanto un arreglo como una página { content: [...] }.
export const asList = (data) => (Array.isArray(data) ? data : data?.content ?? []);
