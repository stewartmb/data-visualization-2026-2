// Estado compartido del explorador. Una sola fuente de verdad; cualquier cambio
// redibuja todas las vistas. Los capítulos de la narrativa escriben acá cuando
// mandan al lector al explorador ("ver estas estaciones").

export const estado = {
  modelo: null,
  geo: null,

  seleccion: null,      // id de la estación enfocada
  filtro: null,         // Set de ids que sobrevive al brush de la dispersión (null = todas)
  rango: null,          // [mesIni, mesFin] del brush temporal
  lente: 'tipo',        // tipo · rec · aplan · conf
  boroughs: null,       // Set de boroughs visibles (null = todos)
  tipos: null,          // Set de tipos visibles (null = todos)
  soloConfiables: false,
  origen: null,         // texto: qué capítulo dejó este estado, para la barra

  _subs: [],

  init(modelo, geo) {
    this.modelo = modelo; this.geo = geo;
    this._porId = new Map(modelo.estaciones.map(e => [e.id, e]));
    this._iMes = new Map(modelo.meta.meses.map((m, i) => [m, i]));
  },
  estacion(id) { return this._porId.get(id); },

  onChange(fn) { this._subs.push(fn); },
  _emit() { this._subs.forEach(fn => fn()); },

  seleccionar(id) { this.seleccion = (this.seleccion === id) ? null : id; this._emit(); },
  enfocar(id) { this.seleccion = id; this._emit(); },
  limpiarSeleccion() { if (this.seleccion === null) return; this.seleccion = null; this._emit(); },

  // Un brush que no encierra puntos deja el conjunto vacío a propósito: es información.
  fijarFiltro(ids) {
    this.filtro = ids || null;
    if (this.seleccion && this.filtro && !this.filtro.has(this.seleccion)) this.seleccion = null;
    this._emit();
  },
  fijarRango(r) { this.rango = r; this._emit(); },
  fijarLente(l) { if (this.lente === l) return; this.lente = l; this._emit(); },
  fijarBoroughs(s) { this.boroughs = s && s.size ? s : null; this._emit(); },
  fijarTipos(s) { this.tipos = s && s.size ? s : null; this._emit(); },
  fijarSoloConfiables(v) { this.soloConfiables = !!v; this._emit(); },

  /** Lo que un capítulo deja configurado al mandar al lector al explorador. */
  aplicarPreset(p) {
    this.seleccion = p.seleccion ?? null;
    this.filtro = p.filtro ?? null;
    this.rango = p.rango ?? null;
    this.lente = p.lente ?? 'tipo';
    this.boroughs = p.boroughs ? new Set(p.boroughs) : null;
    this.tipos = p.tipos ? new Set(p.tipos) : null;
    this.soloConfiables = !!p.soloConfiables;
    this.origen = p.origen ?? null;
    this._emit();
  },
  limpiarTodo() { this.aplicarPreset({}); },

  indicesRango() {
    const n = this.modelo.meta.meses.length;
    if (!this.rango) return [0, n - 1];
    return [this._iMes.get(this.rango[0]) ?? 0, this._iMes.get(this.rango[1]) ?? n - 1];
  },
  /** Entradas por día de una estación dentro del rango activo. */
  volumen(e) {
    const [a, b] = this.indicesRango();
    let s = 0;
    for (let i = a; i <= b; i++) s += e.ms[i];
    return s * this.modelo.meta.msEsc / ((b - a + 1) * 30.44);
  },

  esVisible(e) {
    if (this.filtro && !this.filtro.has(e.id)) return false;
    if (this.boroughs && !this.boroughs.has(e.b)) return false;
    if (this.tipos && !this.tipos.has(e.tipo)) return false;
    if (this.soloConfiables && e.conf.nivel !== 'solida') return false;
    return true;
  },
  visibles() { return this.modelo.estaciones.filter(e => this.esVisible(e)); },
  hayFiltro() { return !!(this.filtro || this.boroughs || this.tipos || this.soloConfiables || this.rango); },
};
