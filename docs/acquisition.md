# Adquisicion, procedencia y condiciones de uso

## Identificacion

- **Nombre:** MTA Subway Hourly Ridership: 2020-2024.
- **Identificador Open NY:** `wujg-7c2s`.
- **Responsable:** Metropolitan Transportation Authority (MTA).
- **Organizaciones:** New York City Transit, Staten Island Railway y Roosevelt Island Operating Corporation.
- **Cobertura:** ciudad de Nueva York, 2020-2024.
- **Granularidad:** hora, modo, complejo de estacion, medio y clase de pago.
- **Frecuencia:** `Static - Not Updated`.
- **Contacto:** OpenData@mtahq.org.
- **Fecha de acceso:** 2026-09-02.

Ficha oficial:

<https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-2020-2024/wujg-7c2s/about_data>

Metadata API:

<https://data.ny.gov/api/views/wujg-7c2s>

## Metodo de recoleccion

El documento metodologico de MTA explica que el dataset captura entradas registradas en torniquetes mediante swipes de MetroCard y taps de OMNY. MetroCard se agrega desde servidores locales de MTA y OMNY es proporcionado por el proveedor Cubic.

Antes de la publicacion:

- las transacciones son limpiadas y deduplicadas;
- se retiran taps y swipes de agencias asociadas como PATH, Westchester Bee-Line Bus y NICE Bus;
- las clases tarifarias detalladas se consolidan en categorias comprensibles;
- transacciones tardias por fallas temporales de hardware se incorporan cuando llegan, por lo que el historico puede ajustarse.

El overview indica que las metricas se encuentran dentro de 1% de las cifras de ridership presentadas en reuniones publicas de MTA; las diferencias se deben, entre otros factores, a conciliaciones presupuestales posteriores.

## Modos de acceso reproducible

### Muestra

El endpoint Socrata devuelve 12 campos seleccionados explicitamente:

<https://data.ny.gov/resource/wujg-7c2s.csv>

El script construye 20 estratos de ano-trimestre. Dentro de cada estrato asigna 88% a subway, 6% a Staten Island Railway y 6% a tram, usando ventanas semanales y orden estable. Esto produce 10,000 filas y garantiza cobertura temporal y modal; no pretende conservar las proporciones poblacionales.

```bash
python scripts/acquisition/download_mta.py --mode sample
```

### Archivo completo

El modo completo utiliza el endpoint de exportacion oficial y escribe por streaming:

<https://data.ny.gov/api/views/wujg-7c2s/rows.csv?accessType=DOWNLOAD>

```bash
python scripts/acquisition/download_mta.py --mode full
```

El script usa un archivo `.partial`, valida el encabezado, calcula SHA-256 y solo renombra el archivo cuando la descarga termina. El dataset completo se excluye de Git por su volumen.

## Dependencias

- Python 3.10 o superior.
- Conexion HTTPS.
- Token Socrata opcional mediante `SOCRATA_APP_TOKEN`.
- No se requieren bibliotecas externas.

## Condiciones de uso

La ficha del dataset declara que la licencia especifica no esta indicada. El overview oficial afirma: **no existen limitaciones sobre los datos en este momento**. Adicionalmente, los terminos de OPEN-NY conceden una licencia no exclusiva y revocable para usar el contenido de forma consistente con sus terminos.

Por prudencia:

- atribuir siempre a MTA y Open NY;
- no utilizar logotipos o marcas como si formaran parte de la licencia de datos;
- conservar los enlaces a los terminos oficiales;
- describir las cifras como estimaciones publicadas por MTA.

Terminos oficiales:

<https://data.ny.gov/api/views/77gx-ii52/files/ef0c1840-ad54-4240-92fd-6397c49fde46?filename=OPEN-NY_20Terms_20of_20Use.pdf>

