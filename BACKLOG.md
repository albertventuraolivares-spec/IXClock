# Backlog de IXClock

Memoria entre tandas del trabajo automático. Cada tanda arranca en una sesión
nueva **sin recuerdos**, así que este archivo es la única continuidad: se lee al
empezar y se actualiza antes de subir.

**Reglas de cada tanda**
- Un solo ítem, el primero de Pendiente.
- Probarlo con Playwright + `syncheck` **antes** de subir.
- Si las pruebas fallan, **no subir**: anotarlo aquí y pasar al siguiente.
- Solo la rama `claude/ixclock-html-page-jhfqhc`. Nunca `main`.
- Anotar lo hecho en 🆕 Novedades (`IX_CHANGELOG` en `index.html`).

---

## Pendiente

### Bugs y deuda
1. **El emulador sigue sin poderse arrancar de punta a punta desde aquí**: la
   política de salida del entorno bloquea `cdn.emulatorjs.org` y
   `cdn.jsdelivr.net` (comprobado con `curl`: connect_rejected). Lo que sí se
   probó son los tres caminos de fallo, con espejos falsos locales, y ahí ya no
   se queda colgado. Si el usuario pasa el mensaje que le sale ahora, dirá
   exactamente qué espejo falló y por qué.

### Funciones nuevas
2. **Exportar a WAV** además de webm, para quien lo quiera abrir en un editor.
3. **Catálogo remoto de emisoras** (tipo radio-browser) en el buscador. Ojo: NO
   es que el buscador se deje emisoras — se comprobó que ya encuentra las 185
   de `STATIONS`, porque están todas pintadas desde el arranque. Sería una
   función nueva, no un arreglo.

---

## Hecho

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
