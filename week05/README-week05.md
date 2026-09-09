# Semana 5 — Team and Project Proposal

**DS5343 Data Visualization · UTEC · Semestre 2026-2**
Entrega: miércoles 9 de septiembre de 2026

## Contenido de esta entrega

| Archivo | Descripción |
|---|---|
| `ProjectProposal.pdf` | Propuesta de 2 páginas: problema, audiencia, dataset, preguntas de dominio y factibilidad |
| `ProjectProposal.md` | Fuente editable de la propuesta |
| `PresentationWeek05.pptx` | Presentación de 7 diapositivas con notas del orador |
| `README.md` | Este archivo |

## Preguntas de dominio

1. ¿Cómo evolucionó el volumen total de entradas entre 2020 y 2024, y a qué nivel se estabilizó respecto del inicio de la serie?
2. ¿Cómo es el perfil horario de un día laborable típico frente al de un fin de semana, y cómo cambió esa forma a lo largo del período?
3. ¿Es posible agrupar los complejos de estación por la forma de su perfil semanal? ¿Cuántos tipos distinguibles existen?
4. ¿Qué estaciones cambiaron de tipo entre 2020 y 2024, y en qué dirección?
5. ¿Cómo se distribuyen geográficamente esos tipos y esos cambios?
6. ¿Fue uniforme la recuperación? ¿Qué estaciones siguen por debajo de su nivel inicial y cuáles lo superaron?
7. ¿Qué revela la composición por clase tarifaria sobre quiénes sostuvieron la demanda en los años más bajos?

Las preguntas 1 a 5 constituyen el núcleo del proyecto; 6 y 7 son extensión si el tiempo lo permite.

## Estructura del repositorio

```text
data-visualization-2026-2/
├── README.md
├── .gitignore
├── data/sample/          muestra de 10 000 filas
├── docs/                 diccionario · adquisición · calidad · referencias
├── scripts/              adquisición · verificación
└── deliveries/
    ├── week04/           dataset seleccionado y documentado
    └── week05/           esta entrega
```

## Cambios respecto de la Semana 4

El dataset no cambió. Se reubicaron los archivos del paquete de datos dentro de `deliveries/week04/` con los nombres exactos que indica la guía del curso, tras el feedback recibido.

## Acknowledgments

- Datos: Metropolitan Transportation Authority (MTA), publicados en Open NY.
- Plataforma de acceso: Socrata / Tyler Data & Insights (API SODA).
- Parte del código y de la redacción se elaboró con asistencia de herramientas de IA, revisada y validada por el equipo.
