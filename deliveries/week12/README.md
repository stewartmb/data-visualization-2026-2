# Semana 12 — Borrador refinado y crítica por pares

**DS5343 Data Visualization · UTEC · 2026-2** · entrega del 28 de octubre de 2026 · **en curso**

La aplicación refinada vive en [`/app`](../../app/) (raíz del repositorio) y se publica en <https://stewartmb.github.io/data-visualization-2026-2/app/>. En esta carpeta van los documentos de la entrega; la copia del código fuente de la aplicación se agrega el 28 de octubre, al cerrar.

| Archivo | Qué es | Estado |
|---|---|---|
| [`RefinedDraftReport.md`](RefinedDraftReport.md) | narrativa, diseño, hallazgos, limitaciones, lo que falta y quién lo hace | borrador |
| [`PeerCritiqueResponse.md`](PeerCritiqueResponse.md) | feedback del design review y la decisión sobre cada sugerencia | plantilla con las seis preguntas respondidas; falta el feedback recibido |
| [`paper/paper.tex`](paper/paper.tex) · [`paper.pdf`](paper/paper.pdf) | el paper en dos columnas: compila con IEEEtran si está instalado (Overleaf) y con `article` si no | borrador, 4 páginas |
| [`code/datos_nuevos.ipynb`](code/datos_nuevos.ipynb) | notebook de Colab: ventana comparable del perfil, perfiles por mes, capa ACS del Census | listo para correr |

## Correr la aplicación

```bash
cd app
python3 -m http.server 8000
```

## Compilar el paper

```bash
cd deliveries/week12/paper
latexmk -pdf paper.tex
```

En Overleaf basta subir la carpeta `paper/`; detecta `IEEEtran` y usa el formato de conferencia.
