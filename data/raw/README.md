# Datos completos

El archivo completo contiene aproximadamente 120.9 millones de registros y no se almacena en GitHub.

Para descargarlo por streaming desde la API oficial:

```bash
python scripts/acquisition/download_mta.py --mode full
```

Para probar el endpoint sin descargar todo:

```bash
python scripts/acquisition/download_mta.py --mode full --max-bytes 1048576 --output work/full_test.csv
```

Los archivos `*.partial`, `*_full.csv` y fragmentos masivos estan excluidos por `.gitignore`.

