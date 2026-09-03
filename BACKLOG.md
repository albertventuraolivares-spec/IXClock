# Backlog de IXClock

Memoria entre tandas del trabajo automático. Cada tanda arranca en una sesión
nueva **sin recuerdos**, así que este archivo es la única continuidad: se lee al
empezar y se actualiza antes de subir.

**Lo primero de cada tanda**: `sh pruebas/todas.sh` — pasa `syncheck` y las 21
pruebas funcionales y dice cuáles fallan. Las tres revisiones grandes van
aparte: `node pruebas/auditoria.js`, `pruebas/interaccion.js`, `pruebas/calidad.js`.

**Reglas de cada tanda**
- Un solo ítem, el primero de Pendiente.
- Probarlo con Playwright + `syncheck` **antes** de subir.
- Si las pruebas fallan, **no subir**: anotarlo aquí y pasar al siguiente.
- Solo la rama `claude/ixclock-html-page-jhfqhc`. Nunca `main`.
- Anotar lo hecho en 🆕 Novedades (`IX_CHANGELOG` en `index.html`).
- **Al final de cada tanda, sin falta** (lo pidió el usuario expresamente, con
  capturas señalando los dos botones): abrir la PR, **fusionarla** a `main`
  (`mcp__github__merge_pull_request`) y **comprobar que el despliegue de
  producción de Netlify sale bien** (`mcp__Netlify__netlify-deploy-services-reader`).
  Fusionar a `main` es lo que dispara la publicación; el botón «Publish deploy»
  de Netlify es para las vistas previas de la PR. Una PR ya fusionada **no se
  reutiliza**: se abre una nueva.

---

## Pendiente

### Bugs y deuda
1. **El emulador sigue sin poderse arrancar de punta a punta desde aquí**: la
   política de salida del entorno bloquea `cdn.emulatorjs.org` y
   `cdn.jsdelivr.net` (comprobado con `curl`: connect_rejected). Lo que sí se
   probó son los tres caminos de fallo, con espejos falsos locales, y ahí ya no
   se queda colgado. Si el usuario pasa el mensaje que le sale ahora, dirá
   exactamente qué espejo falló y por qué.

### Lista del usuario (3 de septiembre)
Comprobada una por una antes de apuntarla. **La 8 ya estaba hecha** en esta
misma tanda (exportar en webm/mp4, en WAV y compartir), así que no se repite.

9. **Recordatorios por fecha.** Las alarmas son solo HH:MM diarias; falta «el 15
   a las 9». El calendario y la cuenta atrás de festividades ya tienen motor de
   fechas.
10. **Organizar las notas**: carpetas y fijar arriba. Hoy solo hay buscador de
    texto, y con muchas notas acaba siendo lo único que salva.

### Otras
11. **Catálogo remoto de emisoras** (tipo radio-browser) en el buscador. Ojo: NO
   es que el buscador se deje emisoras — se comprobó que ya encuentra las 185
   de `STATIONS`, porque están todas pintadas desde el arranque. Sería una
   función nueva, no un arreglo.

---

## Hecho

- **Modo Enfoque / pomodoro** (idea 7 del usuario). 25/5 con descanso largo cada
  4, también 50/10 y 15/3. A pantalla completa, con sonido de ambiente de los
  que ya trae la radio, contador de sesiones del día y el tiempo en la pestaña.
  - **La cuenta atrás va por reloj (`Date.now`), no restando un segundo por
    tic.** Los navegadores frenan los temporizadores de las pestañas que no
    miras, y un pomodoro se usa justo así: 25 minutos acabarían siendo 40. La
    prueba adelanta el reloj a mano y comprueba que la cuenta lo sigue.
  - Redondeo hacia arriba: recién empezado tiene que poner 25:00, no 24:59.
  - Esc sale del enfoque y **no** cierra lo que hubiera debajo (listener en
    fase de captura, antes que el atajo general).
  - Al salir se para el sonido, el temporizador, el bloqueo de pantalla y se
    devuelve el título de la pestaña.
  - De paso: `checkIcaAlarms` se protegía con `typeof _icaAlarms==='undefined'`,
    y `typeof` **no** protege de una `let` aún sin inicializar — también lanza.
    Con la carga cortada a medias reventaba cada minuto en punto.
  - `pruebas/enfoque.js` (28/28).

- **Copia de seguridad automática** (idea 6 del usuario). Una copia sola cada 3
  días, las 3 últimas, en Mi Nube → Respaldo, con botón para volver a cualquiera.
  - Va en **IndexedDB, no en localStorage**: si estuviera en localStorage se la
    llevaría por delante justo lo de lo que protege (el botón rojo de esa misma
    pantalla, o un `localStorage.clear()`). La prueba borra de verdad y luego
    restaura, en vez de comprobar que se guardó un JSON.
  - Las tres cosas que se llevan datos por delante —botón rojo, importar un
    archivo, volver a una copia— guardan antes una copia. Todas reversibles.
  - No apila copias idénticas (huella del contenido). Ojo con esto: la primera
    versión escribía `ix_copia_ultima` en localStorage, o sea que **cambiaba lo
    que estaba copiando** y nunca dos copias salían iguales.
  - **Lo que NO cubre, y se dice en pantalla**: borrar los datos del navegador
    o cambiar de móvil se lleva también IndexedDB. Para eso está el archivo, y
    el navegador no deja bajarlo solo (exige un gesto tuyo), así que lo que se
    hace es avisar si hace más de 30 días que no lo bajas.
  - De paso: `cloudTab()` reventaba si se llamaba con Mi Nube cerrada, e
    importar un archivo que no era un respaldo pisaba los datos sin avisar.
  - `pruebas/copia.js` (25/25). Suite completa 28/28, auditoría sin avisos.

- **Franja de resumen arriba** (idea 5 del usuario). Encima del reloj, en una
  sola línea: clima, siguiente alarma con lo que falta, próxima festividad con
  los días que quedan, y la fase lunar (que ya vivía ahí).
  - **No recalcula nada**: lee de `_lastWeatherRaw`, `alarms` y
    `obtenerFeriados`, o sea de donde ya vive cada dato. Así la franja no puede
    contradecir al panel que tiene al lado, y la prueba lo comprueba comparando
    los dos textos, no mirando solo que salga algo.
  - Si la alarma de hoy ya pasó, cuenta la de mañana en vez de dar horas en
    negativo. Una alarma apagada no cuenta.
  - Se recorta el **nombre** de la festividad, no la ficha entera: recortando
    por CSS lo primero que se pierde es «· 2 días», que es justo el dato útil.
    El globito (`title`) lo dice entero.
  - Las tres fichas nuevas están en Visibilidad una a una, y ocultar **manda**
    sobre el repintado de cada minuto (si no, volvían a salir solas).
  - `pruebas/franja.js` (25/25). Suite completa 27/27 y auditoría sin avisos.

- **Pantalla de inicio reordenable** (idea 4 del usuario). Los cuatro paneles de
  la barra derecha (clima, radio, festividades, pronóstico) llevan un asa y se
  arrastran para cambiar el orden, que se guarda en `ix_orden_paneles`.
  - Se usan **eventos de puntero** y no la API de arrastrar del navegador,
    porque esa no funciona con el dedo: así el ratón y la pantalla táctil van
    por el mismo camino. En táctil el asa se ve siempre, porque no hay «pasar
    el ratón por encima».
  - Un panel guardado que ya no exista se ignora, y uno nuevo se queda donde
    estaba en vez de desaparecer. Un guardado corrupto se ignora entero.
  - Ocultar ya existía (`VISIBILITY_ITEMS`) pero solo la barra entera; ahora los
    cuatro paneles están ahí uno a uno.
  - Probado con `pruebas/paneles.js`: 13/13, arrastrando con el ratón de verdad.

- **Favoritos en la radio** (idea 2 del usuario). Cada emisora lleva una
  estrella; las tuyas salen en «★ Tus favoritas», arriba del todo. Se guardan
  en `ix_radio_favorites`, igual que los del navegador.
  - La estrella va **dentro** del botón de la emisora, así que sin
    `stopPropagation` tocarla también la pondría a sonar. Probado.
  - Una favorita se **saca** de su país en vez de salir dos veces: si saliera
    en los dos sitios habría dos elementos con el mismo `id` y `setStation`
    (que usa `getElementById`) solo encontraría uno, dejando la emisora activa
    marcada a medias.
  - Un país que se queda sin emisoras ya no deja su título suelto.
  - Probado con `pruebas/radiofavs.js`: 17/17.

- **IXA ya hace cosas, no solo habla** (idea 1 del usuario). La tubería de
  `[[ALARM]]` se generalizó a una tabla `IXA_ACCIONES`: añadir una acción nueva
  es añadir una fila, no tocar el analizador.
  - Seis etiquetas nuevas: `[[TIMER min label]]`, `[[NOTA texto]]`,
    `[[CIUDAD nombre]]`, `[[ABRIR app]]`, `[[FONDO nombre]]`, `[[RADIO nombre]]`.
    Funcionan «ponme 10 minutos», «apúntame que compre pan», «añade Tokio»,
    «abre IXBand», «pon jazz».
  - Cada acción se confirma en el chat, para que se vea que ha pasado de verdad.
  - Lo que **no** debe pasar también está probado: una hora imposible, una
    ciudad o una app inventadas no hacen nada ni rompen nada.
  - `extractAlarmTags` conserva su nombre y su forma, así que lo que ya lo
    usaba sigue igual.
  - Probado con `pruebas/ixa.js`: 21/21, dándole al analizador la respuesta ya
    escrita en vez de llamar al modelo.

- **Tema claro de verdad, y los colores unificados** (idea 8 del usuario; es la
  continuación natural de la escala `--r-*` / `--sh-*` que ya se había hecho).
  - Había un «modo claro» que no lo era: solo aclaraba los paneles. Medido,
    **el 98 % del texto visible seguía siendo casi blanco** (1567 de 1599), así
    que sobre fondo claro no se leía nada. Ahora es el **2 %**.
  - Se añadieron fichas de color (`--txt`, `--txt-2`, `--txt-40`…`--txt-70`) y
    se convirtieron **410 colores escritos a mano**, en el HTML y dentro de las
    cadenas que genera el JavaScript. Los acentos (azul, verde, rojo) se quedan
    igual: funcionan en los dos temas.
  - El fondo: en claro se pone un velo blanco **por encima del fondo y por
    debajo del contenido**, así el fondo se sigue reconociendo, apagado, y todo
    lo de encima se lee.
  - **Bug: el modo no se guardaba.** Elegías claro, recargabas y volvía a
    oscuro. Ahora se guarda en `ix_modo`.
  - Dos modos nuevos: **«Como el sistema»** (`prefers-color-scheme`, y reacciona
    si lo cambias sobre la marcha) y **«Con el sol»** (claro de día, oscuro de
    noche, usando el amanecer y el atardecer que la app ya calcula).
  - Se avisa al navegador con `color-scheme` y se cambia el `theme-color` de la
    barra del móvil.
  - Comprobado que el tema **oscuro no cambia**: comparación de píxeles antes y
    después en cuatro pantallas. IXBand 0,00 %, reloj 0,08 %, inicio 0,56 %
    (el suelo de ruido entre dos capturas iguales es 0,33 %). Configuración
    cambia un 10,85 % y es lo esperado: son los dos botones nuevos.
  - Probado con `pruebas/tema.js`: 16/16.
  - **Lo que queda**: los fondos de pantalla siguen siendo fotos oscuras. En
    claro se ven apagadas bajo el velo. Un juego de fondos claros sería el
    siguiente paso, pero es trabajo de diseño, no de código.

- **«Todas las apps»: la mitad de la app era inalcanzable en un móvil.** El
  dock esconde 10 de sus 18 botones en modo compacto y el conmutador solo
  lista lo que ya has abierto, así que alguien que entra por primera vez en un
  teléfono no podía llegar a IXBand, Mapas, Notas ni a la mayoría: existían,
  pero no había forma de verlas.
  - `ixAbrirLanzador()` pinta las 13 de `IX_APPS` en una rejilla. Se llega por
    el botón ⊞ del dock (sin `.dock-secondary`, para que no se oculte
    justamente él), por Ctrl/⌘+⇧+A y desde el conmutador vacío.
  - Probado con `pruebas/lanzador.js`: 15/15.

- **Dos bugs de toque descubiertos al probarlo**: el engranaje de Configuración
  (fijo en la esquina, `z-index:9700`) quedaba **encima** del primer botón del
  dock en pantallas de 320-430px, y ese botón no se podía pulsar — los toques
  se los quedaba el engranaje. Antes le pasaba al botón de buscar y nadie lo
  había visto.
  - No basta con dar relleno: la barra se desplaza en horizontal y el relleno
    no reserva sitio en el lado que queda fuera de vista. Lo que funciona es
    estrechar la barra (`max-width:calc(100vw - 150px)`) para que quede
    centrada entre los dos botones fijos de las esquinas.
  - Medido en 320/390/430/768/1280px: 0 botones tapados en los cinco.
  - Cuidado al medir esto: un botón desplazado fuera de la barra **no está
    tapado, está escondido**, y contarlo daba falsos positivos.

- **Accesibilidad y legibilidad para las tiendas** (`pruebas/calidad.js`).
  - **56 botones de solo icono** no decían qué hacían: un lector de pantalla
    solo podía anunciar «botón». Ahora llevan `aria-label`, y la etiqueta sale
    de lo que **hace** cada uno (su `onclick`), no del dibujo: «Emisora
    anterior», «Mes siguiente», «Bajar el tempo»… Quedan 18 sin nombre, los del
    teclado numérico de la calculadora (÷ × = …), que se leen solos.
  - **201 textos** de 12px o menos estaban al 28-50 % de opacidad, ilegibles
    sobre fondo oscuro. Subidos a un mínimo del 55 %. Comprobado con capturas
    que el diseño no se descoloca.
  - Rendimiento en un móvil simulado con el procesador 4× más lento: primer
    pintado 260 ms, primer contenido 380 ms. No hacía falta tocar nada.

- **Barrido profundo pulsando botones** (`pruebas/interaccion.js`): 234 botones
  en 21 pantallas, **0 errores**. `auditoria.js` solo comprobaba que las apps
  abrieran; lo que falla es lo de dentro.

- **Fallos intermitentes de las pruebas: resueltos de raíz.** Esperaban una
  cifra fija de segundos a que la página cargara; con la máquina cargada se
  quedaba corta, la prueba empezaba a medias y salían errores de
  «before initialization» que **no eran de la app**. Las 45 pruebas esperan
  ahora a hechos (que exista una función del último bloque `<script>`, que la
  pantalla de entrada haya desaparecido) y no a relojes. 17 pruebas seguidas
  sin un solo fallo.

- **Exportar en WAV** además de webm/mp4 (`_gbBufferAWav`). Se graba igual y
  después se descomprime con `decodeAudioData` y se reescribe como PCM de 16
  bits. Hacerlo así evita reescribir todos los instrumentos para que sepan
  sonar fuera de la tarjeta de sonido, que es donde se sintetizan.
  - Si el navegador no sabe descomprimir lo que él mismo acaba de grabar, se
    entrega el original en vez de no entregar nada.
  - Probado en `pruebas/exportar.js` (32/32) comprobando la cabecera del
    archivo de verdad: RIFF/WAVE, PCM, 16 bits y que el tamaño declarado cuadra
    con el real. 455 KB de WAV frente a 39 KB de webm.

- **Dormir con la radio** (idea del usuario), en la pestaña Timers del reloj:
  15/30/45/60/90 minutos, cuenta atrás y cancelar. Un temporizador normal te
  despierta; este hace lo contrario, así que **no suena ninguna alarma**.
  - El volumen baja poco a poco durante el último medio minuto, para no cortar
    la música de golpe cuando ya estás dormido.
  - Al apagar **devuelve el volumen** que había: si no, la próxima vez que le
    dieras al play la radio arrancaría muda y parecería rota.
  - Pedir otro reemplaza al anterior; no se acumulan temporizadores.
  - Añadido a la lista de `ixCerrarTodasLasVentanas()` (junto con
    `gbAfinadorParar`, que faltaba desde que se hizo el afinador).
  - Probado con `pruebas/dormir.js`: 18/18.

- **Comparador de horas en el reloj mundial** (idea del usuario): eliges una
  hora tuya en una tira de 00 a 23 y sale qué hora sería en cada ciudad
  guardada, con el día de la semana y un color — verde 9-18, ámbar 7-9 y 18-22,
  rojo el resto — para ver de un vistazo con quién se puede quedar.
  - El botón solo aparece si hay alguna ciudad guardada.
  - Probado con `pruebas/comparador.js`: 19/19, con la zona horaria del
    navegador fijada y las horas calculadas aparte, no supuestas.

- **Bug encontrado de paso**: una zona horaria que el navegador no conozca
  hacía que `Intl` lanzara y dejara el reloj mundial **entero** en blanco (basta
  un `ica_world_clocks` corrupto o una zona que se renombre). Ahora se
  descartan, se olvidan del disco y los demás relojes siguen saliendo.

- **Clima de cada ciudad en el reloj mundial** (idea del usuario). Junto a
  «Hoy» sale el emoji del tiempo y la temperatura de esa ciudad.
  - Se pide en segundo plano: la hora aparece al instante, sin esperar la red.
  - Las coordenadas se preguntan **una vez por ciudad** (geocoding de
    open-meteo) y se guardan para siempre en `ica_geo_v1`; la temperatura se
    guarda 30 minutos en `ica_clima_v1`. Lo guardado se pinta aunque esté
    caducado, que es mejor que un hueco vacío mientras llega el dato nuevo.
  - Sin internet, o si una ciudad no tiene coordenadas, simplemente no se
    enseña el clima: la hora sigue saliendo igual.
  - De paso, el nombre de la ciudad sale en español («Tokio», no «Tokyo»),
    porque ya estaba en `ICA_CITIES`, y va escapado.
  - Probado con `pruebas/clima.js`: 15/15, con las respuestas simuladas.

- **Cuarto XSS encontrado y arreglado: los eventos del calendario.**
  `renderCalEvts` metía el texto que escribe el usuario en `innerHTML` sin
  escapar, así que un evento con `<img src=x onerror=...>` ejecutaba código de
  verdad cada vez que se abría ese día. Comprobado revirtiendo el arreglo: la
  prueba falla con el código viejo y pasa con el nuevo.
  - De paso, el sitio del terremoto (`showEarthquakeAlert`) también se escapa:
    ese texto viene de un servidor de fuera.
  - Barrido completo de los 68 `innerHTML` que interpolan algo: el resto solo
    mete datos de la propia app (iconos, nombres de ciudad, etiquetas fijas) o
    ya usaba `escapeHtml`. El chat de la IA usa `innerText`, que es seguro.
  - `gbBuildSongs` reventaba si se llamaba con IXBand cerrado; ahora sale sin
    hacer nada, como el resto de funciones que pintan.
  - **Quinto y sexto, avisados por el usuario y confirmados**: las notas de
    «Notas Matemáticas» (`mathRenderSaved`) y la etiqueta del historial de
    alarmas (`icaRenderHistory`). Los dos se me habían escapado en el primer
    barrido porque mi patrón solo miraba la línea de la asignación, y ahí el
    texto se monta en un `.map()` de varias líneas. El barrido se rehízo por
    bloques y ya no tiene ese punto ciego.
  - En las notas matemáticas el título se corta a 25 caracteres: con un payload
    largo la etiqueta queda partida y **no** se ejecuta, así que la primera
    prueba pasaba aunque el fallo estuviera. Con uno de 25 justos sí entra, y
    ahí se ve que era explotable de verdad.
  - Probado con `pruebas/xss.js`: 16/16, con un caso de control y revirtiendo
    cada arreglo para comprobar que la prueba lo detecta.

- **Emulador: el fallo silencioso arreglado.** Que `loader.js` se descargara se
  daba por bueno, pero el loader baja después los núcleos del mismo espejo; si
  esos están bloqueados, la pantalla se quedaba negra para siempre, sin mensaje
  y sin probar otro espejo. Ahora, 9 s después de la descarga, se comprueba que
  el motor arrancó de verdad (`window.EJS_emulator` o un canvas dentro de
  `#game`) y, si no, se pasa al siguiente espejo.
  - Si se cierra el emulador mientras carga, deja de insistir.
  - Probado con `pruebas/emulador.js` (13/13) usando espejos falsos locales:
    uno caído, uno que se descarga pero no arranca y uno que sí arranca.

- **Revisión general antes de publicar** (`pruebas/auditoria.js`, guardado en el
  repo para poder repetirla). Abre las 13 apps y las 4 pestañas de
  Configuración en 320, 390, 820 y 1440 px, los dos primeros con pantalla
  táctil simulada. Resultado: **0 errores de JavaScript y 0 desbordes de
  ancho** en los cuatro tamaños.
  - Lo único que salió: 83 botones por debajo del mínimo táctil, uno de 13×15.
    Arreglado con una regla `@media (pointer:coarse)` de 40×40 mínimo más
    `touch-action:manipulation` (quita el retardo de 300 ms al tocar).
  - IXBand queda excluido a propósito: sus cabeceras de pista son de 192px con
    tres botones dentro y el mínimo los sacaría de la pantalla.
  - `pruebas/syncheck.js` también se guardó en el repo. Nada de esa carpeta lo
    carga `index.html`.

- **Comprobado que funciona sin internet de verdad** (`pruebas/offline.js`,
  12/12): se instala el service worker, se **apaga el servidor** y la app
  vuelve a abrir con sus estilos, su código, IXBand entero y el buscador.
  Guarda 13 archivos del armazón. Es la prueba de la promesa de «guardar para
  usar sin internet» que se le enseña al usuario en Configuración.

- Exportar la canción a un archivo de audio (`gbExportarCancion`). Se graba la
  salida del maestro (`_gbBusOut`, la salida del compresor) con `MediaRecorder`
  mientras suena `gbPlayCancion()`, así el archivo lleva la reverb y la mezcla.
  - Va en tiempo real a propósito: los instrumentos se sintetizan sobre la
    marcha, no hay una mezcla ya hecha que copiar. Cuenta atrás en pantalla.
  - Formato: el primero que soporte el navegador de webm/opus, mp4 o ogg.
  - `_gbBusOut.disconnect(dest)` se hace **siempre** en `onstop`, también si
    algo falla; si no, el maestro se queda mandando audio a un destino muerto.
  - El aviso de «ya se está grabando» va por toast, no por la línea de estado,
    porque ahí la cuenta atrás escribe cada medio segundo.
  - Botón «Compartir» al lado (`gbCompartirCancion`), solo si el dispositivo
    puede compartir archivos. Es un botón aparte y no automático porque
    `navigator.share` exige salir de un toque, y la exportación termina medio
    minuto después del toque que la lanzó.
  - Probado con `exportar_test.js`: 24/24, incluida una descarga real de 41 KB
    con el nombre de la canción.

- «Mis canciones» pasa a ser una lista de verdad (`_gbCanciones`, clave
  `ixband_canciones_v1`), encima de las plantillas de género que ya estaban.
  Guardar como, abrir, renombrar en línea, duplicar y borrar.
  - `_gbCancionActual` marca la canción abierta: mientras lo esté, cada cambio
    se escribe también en ella (`_gbSincronizarCancion`), como un documento.
  - Todo se clona con `_gbClonar` al guardar, abrir y duplicar. Sin eso, seguir
    tocando modificaría la canción ya guardada, porque sería la misma lista.
  - «Empezar de cero» vacía lo que tienes ahora y **no** toca la lista.
  - Tope conjunto de 3,5 MB con aviso; lista corrupta se ignora.
  - Probado con `canciones_test.js`: 33/33.

- Atajos de teclado (`IX_ATAJOS`): Ctrl/⌘+K buscar, Ctrl/⌘+, Configuración,
  Esc cerrar la de encima, Ctrl/⌘+⇧+X cerrar todas, Ctrl/⌘+/ ver la lista.
  Hay un botón «Ver atajos» en ❓ Ayuda.
  - `ixCerrarVentanaDeArriba()` elige por `z-index`, que es lo que decide de
    verdad cuál se ve encima; no se guarda el orden de apertura.
  - `login-overlay` está excluido: Esc no puede echarte de la sesión.
  - `_ixEscribiendo()` calla los atajos dentro de campos de texto.
  - **X y no W** para cerrar todas: Ctrl+⇧+W cierra la ventana del navegador y
    ninguna página puede impedirlo, así que ese atajo nunca llegaría.
  - Probado con `atajos_test.js`: 14/14.

- La canción de IXBand ya no se pierde al recargar. `gbGuardarCancion()` /
  `gbCargarCancion()` guardan pistas, secciones, tempo y compás en
  `localStorage` bajo `ixband_cancion_v1`; `gbInit()` la recupera al abrir.
  - Guardado con retardo de 600 ms (`_gbGuardarPronto`): arrastrar un mando de
    volumen dispara muchísimos cambios y no hay que escribir en cada píxel.
  - Tope de 2 MB: por encima avisa en vez de reventar el `localStorage` del
    resto de la app. Un guardado corrupto o sin tomas se ignora sin romper.
  - Si la sección activa guardada ya no existe, cae en la primera en vez de
    dejar Pistas en blanco.
  - Botón «Empezar de cero» y un aviso de que se guarda solo en el dispositivo.
  - Probado con `guardado_test.js`: 28/28, con dos sesiones en el **mismo
    contexto** del navegador (`browser.newPage()` crea uno nuevo cada vez y
    vacía el `localStorage`, que era justo lo que había que probar).

- Buscador global (`ixBuscarTodo`), con la lupa del dock, `?app=buscar` y
  Ctrl+K / ⌘K. Busca a la vez en apps, Configuración, notas, ciudades, alarmas,
  fondos, estilos de reloj y emisoras, y al elegir **ejecuta la acción**.
  - Fondos, relojes y emisoras se leen del DOM que ya los pinta
    (`_ixDeDom`), no de una copia: así no se quedan viejos nunca.
  - Configuración se indexa recorriendo las tarjetas del panel lateral
    (`_ixIndiceAjustes`), así los ajustes futuros entran solos. Al elegir uno
    abre el panel, cambia de pestaña y lo señala con un destello.
  - Sin tildes (`_ixNorm`): «cancun» encuentra «Cancún».
  - Máximo 6 por grupo y los de un grupo siempre juntos: si no, la misma
    cabecera salía dos veces porque mandaba la puntuación y no el grupo.
  - Navegación con flechas y Enter; el texto de las notas va escapado.
  - Probado con `buscador_test.js`: 34/34.

- Secciones de canción en Pistas (`_gbSecciones`, `_gbSecActiva`). Cada toma
  lleva `sec`; la vista filtra por la sección activa pero sigue pasando el
  índice global a los botones, así que mute/solo/volumen/borrar no cambiaron.
  - Crear, renombrar (campo en línea, sin `prompt()`), reordenar y borrar.
  - Duplicar hace **copia profunda** de los eventos: retocar el estribillo
    repetido no toca el primero.
  - `gbPlayCancion()` encadena las secciones en orden con `gbPlayTake(i,off)`.
  - El solo se acotó a su sección (`_gbHaySolo(sec)`): aislar el estribillo ya
    no calla la estrofa durante la canción entera.
  - Las tomas de antes, sin `sec`, caen en la primera sección (`_gbSecDe`).
  - Probado con `secciones_test.js`: 41/41.

- **Bug encontrado de paso**: la regla de compases y el cabezal rojo empezaban
  en 192px, pero el carril arranca en 324px desde que el mezclador metió su
  columna de 132px. Ahora sale de `GB_LANE_X = GB_HDR_W + GB_MIX_W` y el test
  lo mide en pantalla, no en el código, para que no se vuelva a descuadrar.

- Afinador con micrófono en IXBand (`gbBuildAfinador`). Detecta el tono por
  autocorrelación (`_gbFrecuenciaDe`) con recorte de silencios e interpolación
  parabólica del pico, para no confundir la fundamental con un armónico, y lo
  pasa a nota con `_gbNotaDe` (MIDI 69 = La4 = 440 Hz). Nota grande, Hz, y aguja
  que se pone verde dentro de ±5 centésimas.
  - El bucle se limita a 20 lecturas/segundo: la autocorrelación es O(n²) sobre
    2048 muestras y a 60 fps calentaba el móvil sin ganar precisión.
  - Suelta el micrófono al parar, al cambiar de instrumento **y si el montaje
    del audio falla a medias** (ese último caso dejaba el micrófono abierto).
  - Probado con `afinador_test.js`: 29/29, incluyendo leer un MediaStream real
    de 440 Hz generado por la tarjeta de sonido.

- Cuenta atrás antes de grabar (un compás de claqueta con el número en pantalla,
  reutilizando `_gbTick`) y compás configurable 4/4, 3/4, 6/8, 2/4 en `_gbCompas`,
  que alimenta el LCD y la claqueta.

- Mezclador en Pistas: volumen y paneo por pista con nodos propios colgando del
  bus maestro (`_gbCanalPista`), más botón Solo. `_gbSalidaPista` desvía la
  salida de `_gbOut()` mientras se reproduce esa pista.

- Escala de diseño (`--r-xs`…`--r-2xl`, `--sh-1`…`--sh-3`) junto a las variables
  que ya existían, y 52 radios casi-duplicados (7/9/11/13/18/22/26 px) alineados
  a la escala. Sin tocar los 3px de las cuerdas ni los 999px de las píldoras.
  Verificado con comparación de píxeles antes/después: máx. 1% de cambio.

- Bienvenida de 3 pasos la primera vez (qué es, gesto de 3 dedos, instalar),
  con `ix_onboarding_v1` en localStorage y botón para repetirla en la Ayuda.

- Estados vacíos con gracia mediante `ixVacio(icono,titulo,texto)`, un
  componente reutilizable: Notas, Pistas de IXBand, buscador de canales y Mi
  Nube (su galería no decía nada). Definido junto a `escapeHtml` para que esté
  disponible desde los bloques `<script>` que lo usan.

- Crear/editar alarma y el tono del temporizador: pantalla propia con selector
  de hora, etiqueta y los 8 tonos audibles. Fuera los `prompt()` del navegador
  (`icaPromptTone` era ya código muerto y se eliminó).
- **Tercer XSS encontrado y arreglado**: `icaRenderAlarms` tampoco escapaba la
  etiqueta. Lo cazó la prueba nueva de alarmas.

- Atajo `/?app=browser` del manifest corregido a `/?app=navegador` (no abría nada).
- Tarjeta «Buscador» renombrada a «Buscador de canales» (prometía búsqueda global).
- **XSS arreglado** en `renderNotesList` y `renderAlarms`: el texto del usuario
  se pasa por `escapeHtml`. Una nota con `<img src=x onerror=…>` ejecutaba código.
- `stopAudio` añadido a `ixCerrarTodasLasVentanas()` (la radio seguía sonando).
- Gesto de 3 dedos solo en zona vacía + botón «Cerrar todas las ventanas».
- Un solo Reloj; las alarmas del reloj ahora suenan; buscador de ciudades;
  cronómetro legible; alarma fantasma de las 7:39 eliminada.
- Conversor de divisas implementado de cero (estaba muerto).
- Mapas paso a paso con navegación en vivo y voz.
- Instalable como app, funciona sin internet, Tailwind compilado local.
- IXBand: batería física, Drummer, Beat Sequencer, amplificador con pedalera,
  grabadora de voz, sampler, arpegiador, autoplay, Remix FX.

## Ideas sin priorizar

- Widgets de la pantalla de inicio reordenables arrastrando.
- Modo claro además del oscuro.
- Exportar lo grabado en IXBand como archivo de audio.
- Compartir un fondo o una canción por enlace.
