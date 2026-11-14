const params=new URLSearchParams(location.search);
// The pilot reads local files. Published links always open New York.
const bart=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&params.get('system')==='bart';
const nyYears=[2021,2022,2023,2024];
const bartYears=[2019,2020,2021,2022,2023,2024,2025];
const repository=new URL('../../',import.meta.url);
const root=repository.pathname.endsWith('/deliveries/week12/')?new URL('../../',repository):repository;

export const dataset=bart?{
  id:'bart',name:'Área de la Bahía · BART',stationLabel:'estaciones',territoryLabel:'Todos los condados',
  years:bartYears,contrastYears:bartYears,defaultYear:2025,defaultBase:2024,
  areas:['Alameda','Contra Costa','San Francisco','San Mateo','Santa Clara'],
  dataURL:new URL('data/raw/bart/atlas/',root),
  odLabel:'OD registrado BART',hourLabel:'Hora de salida',startsLabel:'Viajes por origen',
  credit:'OD BART vía bayarea.fyi · red de referencia BART GTFS 2026 · contornos U.S. Census 2024',
  comparison:'Promedio por día de la semana y hora de salida en BART. En 2020 faltan cuatro fechas.',
  evidence:'Los datos horarios indican cuándo termina el viaje. Se promedian las fechas disponibles de cada día de la semana. Los caminos se asignan sobre el GTFS de referencia de 2026. El año 2020 omite cuatro fechas ausentes. Los registros previos a la apertura de Milpitas y Berryessa se contabilizan aparte.',
  latitude:37.8
}:{
  id:'nyc',name:'Nueva York',stationLabel:'complejos',territoryLabel:'Todos los boroughs',
  years:nyYears,contrastYears:[2019,2020,...nyYears],defaultYear:2024,defaultBase:2021,
  areas:['Manhattan','Brooklyn','Queens','Bronx'],dataURL:new URL('../data/',import.meta.url),
  odLabel:'OD estimado MTA',hourLabel:'Hora de entrada',startsLabel:'Viajes OD iniciados',
  credit:'OD estimado MTA 2021–2024 · recorridos modelados · red de referencia GTFS 2026 · contornos NYC DCP',
  comparison:'Semana representativa del OD estimado de la MTA (los doce meses completos, ponderados por el calendario); viajes iniciados por complejo, día y hora.',
  latitude:40.7
};
