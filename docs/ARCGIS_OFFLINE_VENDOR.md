# ArcGIS SDK local para modo offline

La app puede seguir usando el CDN de ArcGIS online, pero para que el arranque del mapa ArcGIS no dependa de internet debes copiar el SDK ESM localmente.

## Estructura esperada

Coloca el paquete `@arcgis/core` completo en:

```text
vendor/
  arcgis/
    @arcgis/
      core/
        assets/
        chunks/
        config.js
        Map.js
        WebMap.js
        ...
```

La forma mas simple es instalar `@arcgis/core@4.33` en una carpeta temporal y copiar `node_modules/@arcgis/core` a `vendor/arcgis/@arcgis/core`.

## Configuracion

En `js/config.js`, cambia:

```js
arcgis: {
  baseUrl: "./vendor/arcgis/@arcgis/core",
  assetsPath: "./vendor/arcgis/@arcgis/core/assets",
  cssUrl: "./vendor/arcgis/@arcgis/core/assets/esri/themes/light/main.css",
}
```

No copies tokens ni API keys en archivos publicos. El mapa offline de tiles raster no requiere API key con la capa publica configurada.
