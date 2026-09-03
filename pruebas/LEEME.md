# Pruebas de IXClocK

Scripts que se ejecutan a mano con Node. **No forman parte de la app**: no se
cargan desde `index.html` ni los usa el navegador, solo están aquí para que
cualquier tanda de trabajo posterior pueda volver a comprobar lo mismo sin
tener que reescribirlos.

Necesitan Playwright y el Chromium que ya viene en el entorno.

## Ejecutarlas todas de golpe

```
sh pruebas/todas.sh
```

Pasa `syncheck` y después las 21 pruebas funcionales, una a una, y resume
cuáles fallan. Las tres revisiones grandes (`auditoria`, `interaccion`,
`calidad`) quedan fuera porque tardan varios minutos cada una; se lanzan a mano.

Última pasada: **21 pasan, 0 fallan.**

---

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

## `emulador.js`
El motor del emulador se descarga de servidores de fuera y en este entorno no
se puede llegar a ellos, así que no se puede probar «de verdad». Lo que sí se
puede probar, y es lo que decide lo que ve el usuario, es cómo reacciona la app
a cada caso. Levanta un servidor local que hace de espejo y se porta de tres
maneras: no responder, servir un motor que se descarga pero no arranca, y
servir uno que arranca.

```
node pruebas/emulador.js
```

Última pasada: **13/13**.

## `xss.js`
El texto que escribe el usuario (notas, eventos del calendario, nombres de
secciones y canciones) y el que llega de servidores de fuera (el sitio de un
terremoto) no puede ejecutar código al pintarse en pantalla.

Cada caso comprueba **dos** cosas: que el código no se ejecuta y que el texto
**sí se ve**, para que no se pueda aprobar la prueba simplemente no pintando
nada. Y antes de todo hay un caso de control que mete el mismo código sin
escapar: si ese no se ejecuta, la prueba no vale y avisa.

```
node pruebas/xss.js
```

Última pasada: **16/16**.

> Cuidado con la longitud del payload: en las notas matemáticas el título se
> corta a 25 caracteres, y con un payload largo la etiqueta quedaba partida y
> **no se ejecutaba**, así que la prueba pasaba aunque el fallo siguiera ahí.
> Cada caso se verifica revirtiendo el arreglo y comprobando que falla.

## `clima.js`
El clima de cada ciudad del reloj mundial. Los servidores de open-meteo están
bloqueados en este entorno, así que las respuestas se sirven desde la propia
prueba: así se comprueba que la app pide lo correcto, pinta lo que recibe,
guarda las coordenadas para no volver a preguntar, y aguanta que la red falle
o que una ciudad no exista en el buscador de coordenadas.

```
node pruebas/clima.js
```

Última pasada: **15/15**.

> Al interceptar peticiones con Playwright, el `route` que lo bloquea todo va
> **primero**: las rutas se prueban de la última registrada a la primera, así
> que puesto al final se traga también los simulacros.

## `comparador.js`
El comparador de horas del reloj mundial. Fija la zona horaria del navegador a
`Europe/Madrid` para que el resultado no dependa de dónde se ejecute, y **la
hora de cada ciudad se calcula aparte** con `Intl` en vez de darla por sabida:
así la prueba sigue valiendo cuando cambie el horario de verano.

```
node pruebas/comparador.js
```

Última pasada: **19/19**.

## `dormir.js`
El temporizador para dormir con la radio. En vez de esperar 30 minutos, mueve
la hora de fin a mano y llama al tic: así se comprueba que el volumen **solo**
baja en el último medio minuto, que al llegar a cero apaga la radio y **no**
suena ninguna alarma, y que devuelve el volumen para que la próxima vez no
arranque muda.

```
node pruebas/dormir.js
```

Última pasada: **18/18**.

## `interaccion.js`
Barrido profundo. `auditoria.js` comprueba que cada app **abre**; esta pulsa
todos los botones que hay dentro, uno a uno, en 21 pantallas (las 13 apps, las
4 pestañas del reloj y las 4 de Configuración), y apunta cualquier error de
JavaScript. Abrir una pantalla casi nunca falla; lo que falla es lo de dentro.

Se pulsa llamando al `click()` del elemento y no con el ratón, para que no
importe que algo quede tapado por otra capa. Se saltan los botones que borran
o descargan, por su nombre.

```
node pruebas/interaccion.js
```

Última pasada: **234 botones pulsados, 0 errores.**

## `calidad.js`
Rendimiento y accesibilidad: lo que miran las tiendas. Carga la app en un móvil
simulado con el procesador **4 veces más lento** y mide el tiempo hasta el
primer pintado, cuenta los botones que solo tienen un icono y no dicen qué
hacen (un lector de pantalla no puede describirlos) y busca texto pequeño y
demasiado pálido.

```
node pruebas/calidad.js
```

Última pasada: primer pintado **260 ms**, primer contenido **380 ms**,
18 botones sin nombre (los del teclado numérico de la calculadora, que se leen
solos), 12 textos flojos que vienen de reglas de la hoja de estilos.

---

## Fallos intermitentes: resuelto

Antes, ejecutar toda la carpeta seguida hacía fallar alguna prueba por tiempo
de espera. La causa era esperar **una cifra fija de segundos** a que la página
estuviera lista: con la máquina cargada esa cifra se quedaba corta, la prueba
empezaba a medias y salían errores de «before initialization» que no eran de la
app. Las 45 pruebas esperan ahora a **hechos** y no a relojes:

- a que exista `ixBuscarTodo` (está en el último bloque `<script>`, así que si
  existe es que ya se ejecutaron todos);
- a que la pantalla de entrada haya desaparecido de verdad.

Con eso, las 17 pruebas seguidas pasan sin un solo fallo.

