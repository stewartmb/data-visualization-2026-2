import {monthlyContext} from './full-period-view.js';
import {state,esc,fmt,signed} from './model.js?v=20261027-4';
import {aggregateTransfers,aggregateFares} from './enrichment-metrics.mjs';
let isOpen=false;

export function renderEnrichments(host,app){
  const context=app.enrichments;if(!context)return;
  const station=app.station(state.selected),items=station?[station]:app.filtered();
  if(!items.length)return;
  const ids=new Set(items.map(s=>s.id));
  const territories=context.territories.filter(r=>ids.has(r.station_complex_id));
  const ntaCodes=new Set(territories.map(r=>r.nta2020).filter(Boolean));
  const nta=ntaCodes.size===1?territories[0]:null;
  const boroughs=new Set(items.map(s=>s.borough));
  // Multiple boroughs: show system context, never an apparent tariff estimate
  // for an arbitrary lasso or subset of complexes.
  const fareScope=boroughs.size===1?boroughs:new Set(app.data.stations.map(s=>s.borough));
  const scopeName=boroughs.size===1?[...boroughs][0]:'los cuatro boroughs con subway';
  const current=aggregateTransfers(context.transfers,ids,state.year),base=aggregateTransfers(context.transfers,ids,2020);
  const a=aggregateFares(context.fares,fareScope,2020),b=aggregateFares(context.fares,fareScope,state.year);
  const categories=[...new Set([...b.categories,...a.categories].map(r=>r.category))];
  categories.sort((x,y)=>(b.categories.find(r=>r.category===y)?.share||0)-(b.categories.find(r=>r.category===x)?.share||0));
  const percent=value=>value===null||value===undefined?'—':value>0&&value<.05?'<0.1 %':`${fmt(value)} %`;
  const dataBase='data/';
  host.insertAdjacentHTML('beforeend',`<details class="enrichment-context" ${isOpen?'open':''}>
    <summary>Afluencia 2019–2024, transbordos y territorio</summary>
    <h3>Entradas con transbordo gratuito</h3>
    <p><b>${percent(current.share)}</b> en ${state.year} · 2020: ${percent(base.share)}${current.share!==null&&base.share!==null?` · ${signed(current.share-base.share)} pp`:''}.<br><small>${items.length} ${station?'complejo':'complejos del grupo'} · enero–febrero, calendario estandarizado.</small></p>
    <table class="enrichment-table"><caption>Participación de entradas con transbordo gratuito</caption><thead><tr><th>Año</th><th>Participación</th></tr></thead><tbody>${[2020,2021,2022,2023,2024].map(year=>`<tr><td>${year}</td><td>${percent(aggregateTransfers(context.transfers,ids,year).share)}</td></tr>`).join('')}</tbody></table>
    <p class="sub">Son transbordos gratuitos registrados al entrar al subway e incluidos en sus entradas. No cuentan todos los cambios entre líneas. Se suman conteos antes de dividir; no se promedian porcentajes de estaciones. Los días sin registros no certifican demanda nula ni servicio disponible.</p>
    <h3>Territorio NTA2020</h3>
    <p>${nta?`${esc(nta.ntaname)} · ${esc(nta.nta2020)}`:`${ntaCodes.size} territorios con complejos del grupo`}</p>
    ${nta?'<button class="text-button" id="select-nta">Seleccionar los complejos de este territorio ↗</button>':''}
    <p class="sub">Territorio que contiene la coordenada del complejo; no indica dónde viven sus usuarios ni su área de captación.</p>
    <h3>Tarifas · borough completo</h3>
    <p class="sub">${esc(scopeName)} · todas las entradas de subway de ese territorio, no solo las estaciones seleccionadas. Porcentajes de conteos observados de enero–febrero, sin ajuste de calendario.</p>
    <table class="enrichment-table"><caption>Participación por categoría tarifaria</caption><thead><tr><th>Categoría registrada</th><th>2020</th><th>${state.year}</th></tr></thead><tbody>${categories.map(category=>`<tr><th scope="row">${esc(category)}</th><td>${percent(a.categories.find(r=>r.category===category)?.share)}</td><td>${percent(b.categories.find(r=>r.category===category)?.share)}</td></tr>`).join('')}</tbody></table>
    <p class="sub">— indica una categoría no registrada en ese período. Se conservan MetroCard y OMNY: cambios de producto o de registro no equivalen a cambios demográficos.</p>
    <p class="sub"><a href="${dataBase}enrichment_sources.json" target="_blank" rel="noopener">Consultas, fechas y SHA-256 ↗</a> · <a href="https://data.ny.gov/d/wujg-7c2s" target="_blank" rel="noopener">MTA ↗</a> · <a href="https://data.cityofnewyork.us/d/9nt8-h7nd" target="_blank" rel="noopener">NTA2020 ↗</a><br><a href="${dataBase}network_current.json" download>Descargar grafo GTFS actual (JSON)</a>. Representa servicios programados del snapshot descargado; no flujos de pasajeros ni la red histórica de 2020–2024.</p>
  </details>`);
  const details=host.querySelector('.enrichment-context');monthlyContext(details,app,items);details.ontoggle=()=>{isOpen=details.open;};
  host.querySelector('#select-nta')?.addEventListener('click',()=>app.set({cohort:new Set(context.territories.filter(r=>r.nta2020===nta.nta2020).map(r=>r.station_complex_id)),borough:'all',query:'',preset:null,tvMin:0,tvMax:100,ranges:{deltaAM:null,deltaWeekend:null,recovery:null},selected:null}));
}
