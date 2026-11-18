# Artículo final (5.2)

- `../FinalPaper.pdf`: el artículo que se entrega (4 páginas más las referencias, formato IEEE a dos columnas).
- `FinalPaper.tex`: la fuente editable.
- `figuras/`: las cuatro figuras tal como entran al PDF.
- `figuras/src/`: de dónde salen las figuras (HTML y capturas de la aplicación).

## Cómo compilar

Hace falta una instalación de LaTeX con la clase `IEEEtran` y `babel` en español (TeX Live o MacTeX las traen).

```bash
cd deliveries/week15/paper
pdflatex FinalPaper.tex
pdflatex FinalPaper.tex
cp FinalPaper.pdf ../FinalPaper.pdf
```

## Cómo regenerar las figuras

Solo es necesario si cambian las capturas.

```bash
# Figuras 1, 2 y 4 (HTML a PDF): necesita Node y Playwright con Chromium
node deliveries/week15/paper/figuras/src/build_figuras.cjs
# Figura 3 (recortes de la captura c_ritmo.png): necesita Python con Pillow
python3 deliveries/week15/paper/figuras/src/fig3_ritmo.py
```

Las capturas de `figuras/src/` se tomaron de la aplicación publicada (año 2025).
