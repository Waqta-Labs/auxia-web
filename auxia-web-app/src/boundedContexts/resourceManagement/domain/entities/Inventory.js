// El inventario de la organización (uno por organización) con el stock de cada recurso.
export class Inventory {
  constructor({ id, name = null, resources = [] }) {
    this.id = id;
    this.name = name;
    this.resources = resources;
    Object.freeze(this);
  }
}
