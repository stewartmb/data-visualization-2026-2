# Semana 12 — Respuesta a críticas y decisiones posteriores

**Revisión del 28 de octubre de 2026** · Renzo Acervo Correa · Stewart Maquera Bobadilla · José Condori Palomino

Se conserva íntegro el registro anterior en `history/before-20261028-alignment/PeerCritiqueResponse.md` y `.pdf`. No se inventan evaluadores, sesiones, citas ni resultados de uso. Los dos primeros comentarios siguientes proceden del registro histórico; los demás son instrucciones posteriores del usuario documentadas en el desarrollo.

| Origen | Comentario o necesidad | Respuesta actual | Estado y justificación |
|---|---|---|---|
| Profesor, review del 14 octubre según registro previo | Dar más protagonismo a las gráficas y reducir texto que compite | Mapa dominante, dispersión y reloj en el mismo panel; textos extensos bajo demanda | Implementado en composición; validar lectura con usuarios |
| Profesor, mismo registro | Contexto geográfico para ubicar estaciones | Fondo gris, contornos, referencias y minimapa | Implementado; conservar orientación sin competir cromáticamente |
| Usuario, iteración posterior | Un panel, menos dependencia de filtros y mantener matriz radial | Reloj principal y selección directa enlazada | Implementado; reemplaza la decisión anterior de reloj solo alternativo |
| Usuario | Fidelidad 0 libre y recuperación gradual de caminos reales | Jerarquía de referencia y barras 0–1 | Implementado como adaptación RAEB; no equivale a trayectorias observadas |
| Usuario | Refinamiento lento | WebGPU con respaldo CPU/WebGL2 | Implementado; falta evaluación exhaustiva en otros equipos |
| Usuario | No solicitó reproducir automáticamente | No existe botón ni avance automático | Implementado; selección manual de las 168 horas |
| Usuario | No se puede quitar selección; sliders pequeños | Vista general, clic repetido/fondo, Escape; sliders apilados | Implementado |
| Usuario | Incluir 2019 y 2020 | Base histórica independiente, entradas equivalentes en ambos años | Implementado; no genera OD inexistente para esos años |
| Usuario | Preguntas distintas con valor territorial | Nuevas seis tareas y seis familias de tablas verificadas | Evidencia preparada; integración territorial y escenario interactivo pendientes |

## Qué se conserva y qué se aplaza

Las cifras e hipótesis del Atlas antiguo permanecen identificadas en historia; no se presentan como evidencia del panel nuevo. No se afirma retorno a forma prepandemia usando solo 2021 como base. Las tarifas, turismo y variables socioeconómicas quedan fuera del núcleo del panel, aunque algunos contextos estén adquiridos.

| Tarea | Evidencia preparada | Estado de interacción |
|---|---|---|
| T1 | CSV por borough/NTA, seis años | Contraste por complejo disponible; síntesis territorial por integrar al panel |
| T2 | Matrices territoriales y participaciones, cuatro años | Selección de origen disponible; detalle territorial por integrar |
| T3 | Ventanas de 3 h, 7 días y seis años | Reloj y selección horaria disponibles; detector automático por integrar |
| T4 | Cargas de los 549 enlaces para 2021/2024 | Geometría y haces disponibles; inspección exacta por tramo pendiente |
| T5 | Balance externo por borough/cohorte, cuatro años | CSV preparado; codificación interactiva pendiente |
| T6 | Seis escenarios reproducibles | Cálculo preparado; escenario interactivo pendiente |


## Verificación y próximos pasos

Pruebas de estructura y separación de fuentes históricas; controles de matrices/caminos y balance; escenarios que no acortan distancias al retirar aristas; comprobación visual de selección y contraste. La evaluación con personas y auditoría completa por teclado/lector no han concluido.

| Pendiente | Responsable propuesto, por ratificar con el equipo | Fecha objetivo |
|---|---|---|
| Integrar síntesis territorial T1/T2/T5 y detalle por tramo T4 | Stewart | 6 noviembre |
| Revisar agregaciones, denominadores, escenarios y contraste con oferta | Renzo | 6 noviembre |
| Evaluación formativa con tareas de dominio; registrar errores, aciertos y comentarios | Los tres | 10 noviembre |
| Figuras, narrativa y paper final con resultados de evaluación | José | 13 noviembre |
| Teaser, video de presentación y póster según §5 de la guía | Los tres; repartir producción | 16 noviembre |
| Revisión cruzada de accesibilidad, publicación y presentación final | Los tres | 17 noviembre |

Las responsabilidades son una propuesta de actualización, no acuerdos nuevos atribuidos al equipo. Semana 12 distingue lo implementado de las extensiones. No se inventa feedback ni resultados de evaluación.
