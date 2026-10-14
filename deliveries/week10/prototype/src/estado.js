// Estado compartido por las cuatro vistas.
//
// Hay una sola fuente de verdad. Cualquier vista que cambie el estado dispara
// un redibujado de todas las demas: eso es el brushing & linking del proyecto.
//
//   seleccion  id de una estacion enfocada (clic en mapa, perfil o dispersion)
//   filtro     conjunto de ids que sobrevive al brush de la dispersion
//   rango      [mesIni, mesFin] elegido con el brush de la serie temporal

export const estado = {
  datos: null,
  seleccion: null,
  filtro: null,
  rango: null,
  _subs: [],

  init(datos){
    this.datos = datos;
    this._iMes = new Map(datos.meta.meses.map((m, i) => [m, i]));
  },

  onChange(fn){ this._subs.push(fn); },
  _emit(){ this._subs.forEach(fn => fn()); },

  // --- seleccion ------------------------------------------------------------
  seleccionar(id){
    this.seleccion = (this.seleccion === id) ? null : id;
    this._emit();
  },
  limpiarSeleccion(){
    if (this.seleccion === null) return;
    this.seleccion = null;
    this._emit();
  },

  // --- filtro de la dispersion ---------------------------------------------
  // Un brush que no encierra ningun punto deja el conjunto vacio a proposito:
  // es informacion ("ahi no hay estaciones"), no un error que haya que deshacer.
  fijarFiltro(ids){
    this.filtro = ids || null;
    if (this.seleccion && this.filtro && !this.filtro.has(this.seleccion))
      this.seleccion = null;
    this._emit();
  },

  // --- rango temporal -------------------------------------------------------
  fijarRango(r){
    this.rango = r;
    this._emit();
  },

  /** Indices [a, b] del rango activo dentro de meta.meses; por defecto, todo. */
  indicesRango(){
    const n = this.datos.meta.meses.length;
    if (!this.rango) return [0, n - 1];
    return [this._iMes.get(this.rango[0]) ?? 0, this._iMes.get(this.rango[1]) ?? n - 1];
  },

  /** Entradas por dia de una estacion dentro del rango activo. */
  volumen(e){
    const [a, b] = this.indicesRango();
    let s = 0;
    for (let i = a; i <= b; i++) s += e.ms[i];
    const dias = (b - a + 1) * 30.44;                 // meses -> dias
    return s * this.datos.meta.msEsc / dias;
  },

  /** Estaciones que pasan el filtro activo. */
  visibles(){
    const f = this.filtro;
    return f ? this.datos.estaciones.filter(e => f.has(e.id)) : this.datos.estaciones;
  },

  esVisible(e){ return !this.filtro || this.filtro.has(e.id); }
};
