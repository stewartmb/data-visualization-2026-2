import {state,esc,fmt,signed,profile,measures,cohortProfile,heading} from './model.js?v=20261027-4';

// Página del proyecto: título, introducción, datos, secuencia analítica, hallazgos y conclusión
// preliminar, para quien llega sin contexto. Las cifras se calculan desde atlas.json, no se escriben a mano.
export function renderProject(host,app){
  const y=2024,all=app.data.stations.filter(s=>profile(s)&&profile(s,2020));
  const m=all.map(s=>measures(s,y)).filter(Boolean);
  const sys20=cohortProfile(all,2020),sys24=cohortProfile(all,y);
  const n=all.length,medTV=d3.median(m,d=>d.change),lowerAM=m.filter(d=>d.deltaAM<0).length,higherWE=m.filter(d=>d.deltaWeekend>0).length;
  const decoupled=m.filter(d=>d.recovery>=80&&d.recovery<=120&&d.change>=10).length;
  const byB={};for(const s of all){const d=measures(s,y);(byB[s.borough]??=[]).push(d);}
  const boroughRows=Object.entries(byB).sort((a,b)=>b[1].length-a[1].length).map(([b,ds])=>`<tr><td>${esc(b)}</td><td>${ds.length}</td><td>${fmt(d3.median(ds,d=>d.change))} pp</td><td>${signed(d3.median(ds,d=>d.deltaAM))} pp</td><td>${signed(d3.median(ds,d=>d.deltaWeekend))} pp</td><td>${fmt(d3.median(ds,d=>d.recovery))} %</td></tr>`).join('');
  const top=[...all].sort((a,b)=>measures(b,y).change-measures(a,y).change).slice(0,3).map(s=>`${esc(s.name)} (${fmt(measures(s,y).change)} pp)`).join(', ');
  host.innerHTML=heading('EL PROYECTO','Volvió el metro. ¿Volvió su ritmo?','Qué pregunta responde el atlas, con qué datos, cómo se lee y qué se puede afirmar hasta ahora.','T1 · T6')+`
  <article class="project">
    <p class="project-lede">La recuperación del metro de Nueva York se cuenta casi siempre con un solo número: cuánta gente volvió. Ese número esconde <em>a qué horas</em> y <em>en qué estaciones</em> volvió. Fractal compara el ritmo semanal de cada complejo de estación —sus 168 horas— entre enero–febrero de 2020 y los mismos meses de 2021 a 2024.</p>

    <h3>Introducción</h3>
    <p>Un complejo puede recuperar su volumen y, aun así, repartir sus entradas en horarios distintos: menos mañana de lunes a viernes, más fin de semana. Comparar un período prepandemia con un año completo mezcla además estaciones del año y composición del calendario. El atlas separa tres cosas que suelen confundirse: la <b>distribución temporal</b> de las entradas, su <b>intensidad</b> y su <b>ubicación</b>, y deja consultar de dónde sale cada medida.</p>
    <p><b>Audiencia.</b> Analistas de transporte e investigadores urbanos que buscan estaciones o conjuntos para estudiar con más detalle; en segundo lugar, periodistas de datos que necesitan comunicar diferencias temporales y espaciales sin confundirlas con causas demostradas. La herramienta apoya la selección de casos y la generación de hipótesis; no recomienda frecuencias de trenes, porque esta fuente no contiene oferta, capacidad ni saturación.</p>

    <h3>Datos</h3>
    <p><b>Fuente.</b> <a href="https://data.ny.gov/d/wujg-7c2s" target="_blank" rel="noopener">MTA Subway Hourly Ridership: 2020–2024</a> (Open NY): entradas por hora, complejo de estación, modo, método de pago y clase tarifaria, registradas por torniquetes MetroCard y OMNY. Son entradas agregadas, sin pasajeros identificados ni viajes origen–destino. Se suman el <a href="https://data.ny.gov/d/5f5g-n3cz" target="_blank" rel="noopener">catálogo oficial de complejos</a> (unión exacta en ${n}/${n}) y los contornos de boroughs de NYC DCP.</p>
    <p><b>Volumen.</b> El dataset completo tiene <b>120 855 567 registros</b> (1 827 días). Se descarga íntegro con la API Socrata, un día por petición y reanudable (<code>scripts/acquisition/download_full.py</code>), y se agrega localmente con DuckDB (<code>scripts/preprocessing/build_from_full.py</code>). El insumo del atlas —enero–febrero de cada año, modo subway, por estación × día de la semana × hora— reproduce celda por celda el que antes se pedía a la API; <code>scripts/redesign/build_atlas.py</code> lo convierte en <code>atlas.json</code> sin dependencias externas.</p>
    <p><b>Universo.</b> ${n} complejos de subway en cuatro boroughs; los dos de Staten Island Railway y los dos del tranvía se excluyen para mantener un modo consistente.</p>
    <p><b>Transformaciones.</b> Cada hora se divide por el número de lunes, martes, etc. de su período (exposición de calendario), de modo que W(d,h) es un promedio por día de ese tipo; P = W / ΣW es la distribución de 168 valores que suma 1. Sobre P se calculan: la <b>distancia TV</b> entre años (½ Σ |P<sub>y</sub> − P<sub>2020</sub>|, en puntos porcentuales: cuánto del ritmo semanal se redistribuyó), el <b>peso AM</b> (06–09 h de lunes a viernes sobre el total de esos días), el <b>peso de fin de semana</b>, el <b>índice de volumen</b> (entradas diarias frente a 2020 = 100) y, para la búsqueda por ejemplo, la distancia de <b>Hellinger</b> entre perfiles.</p>

    <h3>Cómo se lee</h3>
    <ol class="project-steps">
      <li><b>Mapa.</b> Cada punto es un complejo de estación sobre el plano de la ciudad; el color es la medida elegida (cambio de forma, peso de la mañana, peso del fin de semana o volumen). Con la rueda aparecen nombres y valores; un rectángulo forma un grupo.</li>
      <li><b>Panel de la derecha.</b> La huella semanal del grupo activo o del complejo seleccionado: reloj de 168 sectores (lunes al centro, domingo al borde) o matriz con el perfil de 24 h; debajo, la trayectoria 2020 → 2024 en el espacio mañana × fin de semana y las cuatro medidas.</li>
      <li><b>Controles.</b> Año, zona y búsqueda arriba; color y entradas al análisis en el panel del mapa; guardar y exportar abajo.</li>
    </ol>

    <h3>Hallazgos preliminares (enero–febrero 2024 frente a 2020)</h3>
    <ol class="project-findings">
      <li><b>El sistema recuperó el ${fmt(100*sys24.daily/sys20.daily)} % de sus entradas diarias</b>, pero el peso de la mañana laboral bajó de ${fmt(sys20.am)} % a ${fmt(sys24.am)} % y el del fin de semana subió de ${fmt(sys20.weekend)} % a ${fmt(sys24.weekend)} %.</li>
      <li><b>${lowerAM} de ${n} complejos tienen menos peso AM que en 2020</b> y ${higherWE} tienen más peso de fin de semana: el cambio es general, no de unas pocas estaciones.</li>
      <li><b>La mediana del cambio de forma es ${fmt(medTV)} pp</b> (distancia TV): en el complejo típico, cerca del ${Math.round(medTV)} % del ritmo semanal se redistribuyó entre horas. Los mayores cambios: ${top}.</li>
      <li><b>Volumen y ritmo son dos cosas distintas.</b> ${decoupled} complejos están entre el 80 y el 120 % de su volumen de 2020 y, aun así, cambiaron de forma 10 pp o más.</li>
      <li><b>El cambio tiene geografía.</b> Mediana por borough (n, cambio de forma, Δ AM, Δ fin de semana, índice de volumen):
        <table class="project-table"><thead><tr><th>borough</th><th>n</th><th>TV</th><th>Δ AM</th><th>Δ fin de semana</th><th>volumen</th></tr></thead><tbody>${boroughRows}</tbody></table></li>
    </ol>

    <h3>Conclusión preliminar</h3>
    <p>El metro volvió en volumen a dos tercios de 2020, pero no volvió su ritmo: la mañana de lunes a viernes pesa menos y el fin de semana pesa más en la gran mayoría de los complejos, y el tamaño de ese cambio varía más entre estaciones de un mismo borough que entre boroughs. Recuperar pasajeros y recuperar la forma de la semana son procesos separados; por eso el atlas los muestra como medidas separadas y deja que el lector forme grupos para investigarlos. Lo que los datos no sostienen: una causa. Las entradas no distinguen menos demanda de menos servicio, y la asociación con el trabajo híbrido es una hipótesis para contrastar con datos externos.</p>

    <h3>Límites</h3>
    <p>Las horas sin registro se representan como cero entradas registradas y se declaran por celda; en enero–febrero de 2021 hubo cierres nocturnos. El catálogo de complejos es el actual y no reconstruye la oferta histórica. El plano de calles se carga de un servicio externo; sin red quedan los contornos de boroughs. La evaluación con personas de la audiencia está pendiente para la entrega final.</p>

    <h3>Equipo y materiales</h3>
    <p>Renzo Alfonso Acervo Correa · Diva Stewart Maquera Bobadilla · José Eduardo Condori Palomino. DS5343 Data Visualization, UTEC, 2026-2. Profesor: Germain Garcia-Zanabria.</p>
    <p><a href="https://github.com/stewartmb/data-visualization-2026-2" target="_blank" rel="noopener">Repositorio</a> · <a href="../redesign/03-datos-y-metodos.md">Datos y métodos ↗</a> · <a href="../deliveries/week06/referencias.md">Referencias ↗</a> · <a href="../deliveries/week12/">Entrega de la semana 12 ↗</a></p>
  </article>`;
}
