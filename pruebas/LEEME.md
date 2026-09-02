# Pruebas de IXClocK

Scripts que se ejecutan a mano con Node. **No forman parte de la app**: no se
cargan desde `index.html` ni los usa el navegador, solo están aquí para que
cualquier tanda de trabajo posterior pueda volver a comprobar lo mismo sin
tener que reescribirlos.

Necesitan Playwright y el Chromium que ya viene en el entorno.

## `syncheck.js`
Extrae los cinco bloques `<script>` de `index.html` y los pasa por el
analizador de JavaScript. Detecta un paréntesis o una comilla mal puestos
antes de que rompan la página. Se ejecuta **después de cada cambio**.

```
node pruebas/syncheck.js
```

## `auditoria.js`
Revisión general antes de publicar. Abre la app en cuatro tamaños de pantalla
(320, 390, 820 y 1440 px de ancho; los dos primeros con pantalla táctil
simulada) y en cada uno:

1. Abre **todas** las apps de `IX_APPS`, una por una.
2. Recorre las cuatro pestañas de Configuración.
3. Apunta cualquier error de JavaScript o de consola.
4. Comprueba que **nada se sale de ancho** (el desborde horizontal es el fallo
   más común en móvil y el que peor se ve).
5. En táctil, busca botones por debajo de 34 px, que son los que Apple y Google
   marcan como demasiado pequeños al revisar una app.

```
node pruebas/auditoria.js
```

Última pasada: **0 avisos** en los cuatro tamaños.

> El punto 5 solo mide los botones visibles al terminar el recorrido, es decir
> los de la pantalla de inicio y Configuración. Los de dentro de IXBand quedan
> fuera a propósito: es un estudio con la pantalla muy apretada y allí el
> mínimo de 40 px sacaría los controles fuera de la pantalla.

## `offline.js`
Comprueba que la promesa de «funciona sin internet» es cierta. Abre la app una
vez con red para que se instale el service worker, **apaga el servidor** y
vuelve a abrirla. Con el servidor apagado no hay forma de que llegue nada de
fuera: si la página se pinta, sale del almacén del navegador.

```
node pruebas/offline.js
```

Última pasada: **12/12**. Sin red abren el armazón, los estilos, el código,
IXBand entero y el buscador.

> Se apaga el servidor en vez de contar peticiones: el service worker refresca
> en segundo plano lo que ya tiene guardado, y ese conteo daba falsos avisos.

