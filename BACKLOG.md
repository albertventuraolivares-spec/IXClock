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
- **Hay una Routine que arranca una tanda cada 5 horas**
  (`trig_0175wmjMF5HUqvMc5yiuLZQD`, cron `10 1,6,11,16,20` UTC = 4:10 p.m.,
  9:10 p.m., 2:10 a.m., 7:10 a.m. y 12:10 p.m. hora del usuario, que va en
  UTC-4). Es lo que hace que no se salte ninguna ventana: el usuario pidió
  expresamente que no se olvide ni un periodo.
  - **Ojo, esto costó descubrirlo.** La anterior (`trig_014k8Qar…`) estaba
    **atada a una sesión** (`persist_session:true`). Una Routine atada NO
    arranca nada: deja el mensaje en la cola de esa conversación y espera a
    que la sesión despierte, o sea a que el usuario abra la app. Disparó dos
    veces y las dos se quedaron en cola; el usuario lo notó y tenía razón. La
    señal en `list_triggers` es que **no tiene campo `last_run`**, mientras
    que las que sí corren solas lo tienen en `SUCCEEDED`. La nueva es de
    **sesión nueva en cada disparo** (`create_new_session_on_fire`), que es
    el único modo que corre de verdad sin nadie delante.
  - **Limitación conocida**: al crearla desde una sesión no se le pudieron
    pasar los conectores, así que sus sesiones **puede que no tengan
    `mcp__github__*` ni `mcp__Netlify__*`**: podrán programar, probar y hacer
    push, pero no abrir/fusionar la PR ni comprobar el despliegue. El prompt
    lleva un plan B que obliga a decirlo en voz alta en vez de callarse. Si
    pasa a menudo, la solución es que el usuario recree la Routine desde la
    pantalla de Routines de claude.ai, que ahí sí se le adjuntan conectores.
- Al empezar una tanda **se elige el siguiente pendiente sin preguntar**, y se
  comprueba en el código antes de tocar nada: muchas ideas de la lista **ya
  están hechas**, y varios informes de auditoría llegan repetidos.
- **Y justo después de fusionar, rehacer la rama sobre `main`**:
  `git fetch origin main && git checkout -B claude/ixclock-html-page-jhfqhc origin/main`.
  Al fusionar con *squash* GitHub reescribe la historia, así que la rama queda
  divergida y la PR siguiente da «merge conflicts» aunque no haya conflicto
  real. Si ya ha pasado: se rehace la rama sobre `main` y se hace `cherry-pick`
  de los commits nuevos, comprobando con `git diff --stat` que el árbol queda
  idéntico al que se probó.

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


### Lista del usuario (4 de septiembre) — SIN verificar todavia en el codigo
Las manda de dos tandas. **Antes de tocar nada hay que comprobar una por una
si ya existe**, como se hizo con la lista del 3.

15. **IA más lista: que cree imágenes.** Hay que mirar qué proveedor hay puesto
    (`ai_provider`) y si su API da imágenes.
18. **Modo mesita al girar en horizontal** (tipo StandBy del iPhone): reloj
    gigante con lo mínimo — hora, clima y siguiente alarma. La franja de
    resumen ya calcula esos tres datos.
### Lista del usuario (4 de septiembre, tanda de auditorias) — SIN verificar
Llegaron en varios mensajes seguidos, algunas repetidas. Aqui van juntas y sin
duplicados. **Comprobar en el codigo antes de tocar nada.**

**Unir cosas que ya existen pero no se hablan** (es el patron de casi todas):
23. **Alarma con la hora de otra ciudad** («despiértame a las 9h de Tokio»).
    Alarmas y reloj mundial no se cruzan. Pedida dos veces.
24. **Notas ancladas a una ciudad** del reloj mundial («qué llevar para Tokio»),
    que salgan al abrir esa ciudad, y convertibles en alarma de un toque.
    Pedida dos veces.
25. **Modo Viaje**: al elegir ciudad en el reloj mundial, que el conversor de
    divisas cambie solo a su moneda y se cargue su clima.
26. **Puente Mapas → Radio**: tocar un país en el mapa y «escuchar radio de
    aquí», filtrando Radio Mundial por ese país.
27. **Mapas → reloj mundial**: al guardar un lugar, botón «Añadir al reloj
    mundial».
31. **Mejor hora para una reunión**: que el comparador mire todas tus ciudades
    guardadas y diga la franja en que todas están en verde, en vez de que lo
    calcules a ojo.

**IXBand**:
32. **Exportar MIDI de verdad**, no solo audio grabado. Hoy exporta webm/mp4/wav
    «cocinado»; como IXBand ya modela cada nota con su tiempo exacto, seria
    serializar eso en vez de grabar el altavoz — y así se abriría en un DAW.
33. **Exportar pistas por separado**, no solo la mezcla.
34. **Sección como plantilla entre canciones**: hoy se duplica dentro de la
    misma canción; falta copiar un estribillo de una canción a otra.
35. **Pista de voz por micrófono** mezclada con los instrumentos.
36. **Capturar un clip de la radio al Sampler**: las dos apps ya graban audio
    por separado y nunca se cruzan.

**Mas pedidas (llegaron repetidas, aqui una sola vez)**:
41. **Alertas de cambio de divisa**: «avísame si EUR/USD baja de X», sonando
    como una alarma más.
42. **Historial de tipo de cambio** en la calculadora, con mini-gráfico de
    tendencia: hoy el conversor da el valor puntual, sin contexto.
43. **Mini-reproductor flotante de radio** que se vea al cambiar de app: el
    audio ya sigue sonando, pero no hay control fuera de la ventana de Radio.
44. **Centro de notificaciones** con historial de alarmas y descargas.
45. **Favoritos de radio con etiqueta** («para dormir», «para currar»).
46. **Descargar una zona del mapa** para usarla sin internet: hoy Mapas solo
    cachea 4 tiles de muestra, y la app entera se vende como «funciona sin
    internet».
47. **Notas con casillas** (checklist).
48. **Adjuntar una ubicación de Mapas a una nota**, y al tocarla abrir la ruta.
49. **Modo mesita de noche**: pantalla atenuada, hora grande y próxima alarma,
    para dejar el móvil cargando. (Parecido al 18, pero ese era al girar.)
50. **Exportar las tomas de IXBand** (`_gbTakes`) a WAV/MP3: hoy solo se oyen
    dentro del estudio.

**De los informes de auditoría del 5 de septiembre** (sin duplicados; varias
llegaron repetidas y algunas ya estaban hechas):
54. **Cuenta atrás propia** (viaje, examen, cumpleaños) además de las
    festividades automáticas, reusando el motor que ya existe.
55. **Divide la cuenta en la Calculadora**: reparto entre N personas + propina,
    con la conversión de divisas en vivo. Pedida dos veces.
56. **Notas de voz**, reusando el motor de audio de Radio e IXBand.
57. **Alertas del tiempo por ciudad guardada** (tormenta, calor extremo,
    helada), sonando como una alarma.
58. **Brújula que apunta a tus ciudades**: rumbo y distancia usando las
    coordenadas que el reloj mundial ya guarda.
59. **IXBench sugiere la calidad de los efectos**: el banco de pruebas mide la
    potencia y no hace nada con el resultado; podría ofrecer «aplicar
    Ahorro/Media/Alta» al terminar.
60. **Modo Enfoque silencia Radio Mundial** al empezar y la devuelve al acabar.
61. **Pista de IXBand como tono de alarma.**
62. **Bucle de práctica en IXBand**: repetir una sección a tempo reducido y
    subirlo poco a poco.
63. **Etiqueta de tarea en Modo Enfoque** + resumen diario combinado
    («Hoy en IXClocK»: enfoque + alarmas + radio).

**Otras**:
39. **Recordatorios por ubicación en Mapas**: avisar al llegar o salir de un
    sitio guardado, reaprovechando el GPS que ya usa la navegación en vivo.
40. **Modo Coche**: pantalla simplificada de alto contraste con el mapa en
    navegación, la radio y la hora grande. Reaprovecha Mapas y Radio.
    («Notas con recordatorio» se pidió aparte: es el punto 24, que ya incluye
    convertir una nota en alarma.)
38. **Tarjeta del día compartible**: imagen con hora, clima y próxima alarma
    para mandar por WhatsApp. Usa los mismos datos que la franja de resumen.

**Ya cubiertas, no repetir**:
- «Notificaciones reales en segundo plano» y «Modo Antes de salir» se pidieron
  otra vez. La primera está hecha (con su límite dicho en pantalla: con la app
  cerrada del todo no hay aviso posible sin servidor de push). La segunda es la
  franja de resumen, que ya junta clima + siguiente alarma + festividad + luna.

### Otras
11. **Catálogo remoto de emisoras** (tipo radio-browser) en el buscador. Ojo: NO
   es que el buscador se deje emisoras — se comprobó que ya encuentra las 185
   de `STATIONS`, porque están todas pintadas desde el arranque. Sería una
   función nueva, no un arreglo.

---

## Hecho

- **SINCRONIZACIÓN ENTRE APARATOS** (idea 19, la más grande de la lista). Lo
  pidió el usuario junto con «cuenta de Google y que lleguen correos»; esto es
  la base sobre la que se enchufan las otras dos.
  - **Qué era antes**: «Mi Nube» no era una nube — eran claves de
    `localStorage` de ESE aparato. Por eso lo del móvil no salía en la tablet.
  - **Cómo está hecho**: `netlify/functions/nube.mjs`, reaprovechando la misma
    tubería de `@netlify/blobs` que ya estaba montada y probada para las
    opiniones y solo se usaba para eso.
  - **Identidad sin registro**: un código de 20 caracteres que genera el
    navegador con `crypto` (100 bits). Sin correo, sin contraseña, y sin nada
    personal en el servidor que pueda filtrarse. Si no hay `crypto`, **no se
    genera**: un código con `Math.random` sería una llave adivinable, y es
    mejor no dar la función que darla floja.
  - **El código no se guarda**: lo que hace de nombre de caja es su SHA-256.
    Quien mirase el almacén vería hashes, no códigos.
  - **Alfabeto sin 0/O ni 1/I/L**, porque el usuario va a copiarlo a mano de
    una pantalla a otra.
  - **Lista explícita de lo que viaja**, no un volcado de `localStorage`: la
    sesión y el estado de la bienvenida son de cada aparato y no deben salir.
    Verificado revirtiendo al volcado completo: fallan justo esas 2.
  - **Al traer datos se recarga la página.** No es pereza: media app tiene los
    datos ya leídos en variables de memoria (`_icaAlarms`, `notes`,
    `calEvts`…), y escribir `localStorage` por debajo no las cambia.
  - **«Dejar de sincronizar» solo apaga ESTE aparato.** Si borrase el servidor,
    apagarlo en el móvil dejaría la tablet sin nada.
  - **Bug encontrado escribiendo la prueba**: `new Response('', {status:204})`
    lanza `TypeError` en Node 22 (un 204 no admite cuerpo), y ese runtime es el
    que usan estas funciones. Estaba en `nube.mjs` **y copiado en
    `opinions.mjs`**, o sea que la respuesta al preflight de CORS del muro de
    opiniones estaba mal desde siempre. Arreglado en los dos.
  - `pruebas/nube.js` (21) prueba el servidor **real**, poniéndole un doble de
    `@netlify/blobs` en un `node_modules` temporal, ya que npm está bloqueado
    aquí. `pruebas/sync.js` (24) levanta **dos navegadores separados** —dos
    aparatos de verdad, no dos pestañas— y comprueba que lo creado en uno
    aparece en el otro.

- **Pendiente del usuario, esperando a que él lo cree** (pedido el 5 de sept):
  - **Entrar con Google**: hace falta un ID de cliente de OAuth de Google Cloud
    Console con `https://ixclockplus.netlify.app` autorizado. Solo lo puede
    crear él. El ID es público y se puede pegar en el chat; el «secreto de
    cliente» NO hace falta y no debe salir de ahí.
  - **Correos**: una web estática no puede mandar correos. Hace falta un
    servicio (Resend tiene plan gratis) y su API key **en las variables de
    entorno de Netlify** (`RESEND_API_KEY`), nunca pegada en el chat.

- **El Calendario deja de estar aparte** (ideas 52 y 53, las dos pedidas dos
  veces).
  - **En el buscador**: era lo único que quedaba fuera de una función que
    promete «buscar en todo». Ahora salen con su fecha y su «Hoy / Mañana / en
    N días», y al elegirlos se abre el Calendario en ese día.
  - **Quinta ficha de la franja de resumen**, junto a clima, alarma,
    festividad y luna: el próximo evento de hoy en adelante.
  - **Una sola lectura para los dos**, `ixEventosCal()`, en vez de repetir el
    recorrido en cada sitio — que es exactamente como acabaron existiendo dos
    tablas de divisas que no coincidían.
  - **Detalle de scope que lo habría roto sin avisar**: `calEvts` es un `let`
    de su bloque de `<script>` y el buscador vive en OTRO bloque. Por eso
    `ixEventosCal()` se define junto a `calEvts` y se llama desde fuera: las
    declaraciones de función sí cruzan bloques, las de `let` no.
  - `pruebas/calendario.js` (21 comprobaciones), con fechas relativas a hoy
    para que no caduque. Incluye que un evento con `<img onerror>` dentro no se
    ejecuta en ninguno de los tres sitios nuevos por donde ahora pasa.
    Verificado revirtiendo: fallan 12.

- **XSS reflejado en el proxy del Navegador** (informe de auditoría,
  verificado). `netlify/functions/proxy.js` metía `targetUrl` y `msg` sin
  escapar en la página de error 502.
  - **Por qué era serio de verdad**: esa página se sirve desde el **mismo
    origen** que IXClocK, así que lo que se colara ahí corría con acceso al
    `localStorage` de la app — notas, alarmas y ajustes.
  - **Pasar el `new URL()` de validación no protegía nada**: una URL
    perfectamente válida puede llevar comillas y etiquetas en la ruta
    (`https://noexiste.invalid/"><script>…`). Y llegar a esa rama es trivial:
    basta un dominio que no resuelva.
  - `pruebas/proxy.js` (10 comprobaciones): llama a la función **de verdad**,
    sirve el HTML que devuelve en un navegador real y comprueba que no se
    ejecuta nada. Verificado revirtiendo: sin el escapado, `window.__xss`
    queda a `true` con los tres payloads.

- **Tres bugs de informes de auditoría + unidades en el buscador.** Los tres
  bugs llegaron de fuera y **los tres se verificaron en el código antes de
  tocar nada**, que es la regla:
  - **Buscador y emisoras**: se indexaban leyendo `#stations-container`, o sea
    lo que hubiera **pintado**. Con el filtro de países puesto —función que la
    propia app ofrece— las emisoras de fuera del filtro desaparecían del
    buscador sin decir nada. Medido: filtrando a España quedaban 10 pintadas de
    185, y buscar «z-101» daba **0 resultados**. Ahora recorre
    `ALL_RADIO_STATIONS` entero.
  - **Emulador**: «Cerrar todas las ventanas» escondía la ventana pero no
    llamaba a `emuTeardown()`, así que el motor seguía corriendo con audio y
    CPU. Mismo fallo que tuvo el Modo Enfoque. Añadido a la lista de paradas.
  - **Mapas**: `_amapHighlight` usaba `var(--txt-40)` —un color de TEXTO
    atenuado— como fondo de los pasos no activos. En modo claro es negro al
    50 %, o sea que la lista de indicaciones se ponía casi negra.
  - **Unidades en el buscador** (idea de dos informes): «5 km a millas»,
    «30 c en f», «70 kg a lb»… Las equivalencias salen de `UNIT_DATA`, la misma
    tabla del conversor, **sin copiarlas**, que fue justo el error que hubo con
    las divisas (dos tablas contradiciéndose hasta un 2,5 %).
  - `pruebas/cuatro.js` (26 comprobaciones). Verificado revirtiendo los tres:
    fallan 6.
  - **Límite conocido de esa prueba**, dicho sin adornos: la parte de Mapas
    **no** conduce `_amapHighlight` de punta a punta. `_amapSteps` es un `let`
    del bloque y solo se llena desde una ruta real, que necesita Leaflet (CDN)
    y OSRM, los dos bloqueados aquí. Se comprueba la regla leyendo el código de
    la función en ejecución. Es más débil que medir el color pintado, pero caza
    la reaparición del fallo.

- **Un informe que NO se reprodujo**: decía que `pruebas/control.js` fallaba y
  que el desenfoque no cambiaba en Media/Ahorro por transiciones de
  `backdrop-filter` no interpolables. Se ejecutó **tres veces seguidas: 24/24
  las tres**, con Media en 18 px y Ahorro en `none`. Lo más probable es que
  midieran antes de que acabase la transición de 300 ms; la propia prueba
  espera 600 ms por ese motivo, y está comentado ahí. No se tocó nada.

- **Calculadora: nombres de teclas, teclado duplicado y el «=»** (idea 51).
  - **Bug real encontrado tirando del hilo de la propia prueba**: decía «30
    teclas» donde solo hay 15. `renderCalcGrid()` se llama en CADA apertura del
    panel; vaciaba `#calc-basic` pero **no** `#calc-sci-top` ni
    `#calc-sci-bot`, así que el teclado científico crecía 15 y 16 botones por
    apertura (30, 45, 60…). Medido: abrir 4 veces daba 75 y 80 botones.
  - **Accesibilidad**: `CALC_NOMBRES` + `calcNombreTecla()` para las tres
    rejillas. Los números NO se renombran («7» ya se lee bien); solo los
    símbolos, que es donde falla el lector: «×» lo dice como «signo de
    multiplicación» o se lo salta, «−» (menos matemático, no guion) muchos no
    lo dicen, y «.» o «+/-» no significan nada sueltos.
  - **`calcEq` ya no ejecuta código**: pasaba la expresión entera por
    `Function()`. **No era explotable** —solo llegan dígitos y `+ - * /` del
    teclado fijo, y eso hay que decirlo sin inflarlo—, pero bastaba con que
    algo metiera texto en `calcVal` para convertirlo en ejecución de código.
    Ahora lo filtra `_mathSeguro`, el mismo que guarda las Notas Matemáticas.
    De regalo, dividir entre 0 ya da «Error» en vez de «Infinity».
  - `pruebas/teclas.js` (23 comprobaciones). Verificado revirtiendo: sin el
    filtro fallan 6 (y `window.__ixColado` se pone a `true`, o sea que el
    código SÍ se ejecutaba); sin los nombres y el vaciado, 10.
  - **Y de paso, `calidad.js` baja de 9 botones sin nombre a CERO.** Los tres
    últimos no estaban en la calculadora: cerrar pestaña y quitar favorito en
    el navegador (los crea el JS, así que no se veían al buscar en el HTML), y
    el de cerrar Notas, cuyo `✕` sale de un icono sustituido y por eso parecía
    tener texto. Se localizaron reproduciendo la comprobación de `calidad.js`
    e imprimiendo la cadena de padres, no a ojo.

- **Rendimiento y control** (ideas 12, 13 y 14). Las tres viven en la misma
  ficha nueva de Configuración → Más, y dos de ellas había que contarlas con
  honradez porque **el navegador no puede hacer lo que suena que hacen**:
  - **Calidad de los efectos** (idea 14): Alta / Media / Ahorro. Baja el
    `backdrop-filter` del cristal (54 px → 18 px → 0), las sombras y los
    fondos animados. **Los Hz del panel no se piden desde una página web**, y
    así se dice en la propia pantalla. En Ahorro el cristal pasa a fondo
    sólido: sin desenfoque quedaría transparente y el texto se perdería.
  - **Configuración a pantalla completa** (idea 13): el cajón de 340 px se
    ensancha a `min(96vw,1100px)`. Se recuerda entre recargas. Se ensancha el
    cajón que ya había en vez de abrir otra ventana, para no acabar con dos
    configuraciones distintas.
  - **Velocidad al arrastrar** (idea 12), de 0,5× a 2×. **La sensibilidad del
    ratón la manda el sistema operativo y una web no la toca**; lo que sí se
    multiplica es lo que la app mueve al arrastrar. Aplicado a los tres sitios
    donde hay arrastre por delta: cabecera de panel flotante, barra de título
    de ventana y asa de redimensionar. En el reordenar paneles **no**: ese va
    por posición contra puntos medios, y multiplicarlo sería un error.
  - `pruebas/control.js` (24 comprobaciones). Mide píxeles y estilos
    calculados, no si existe el botón. Dos avisos aprendidos ahí: el primer
    `.glass` del documento es el engranaje, que tiene su propio fondo y no
    representa a los paneles; y `.glass` transiciona el `backdrop-filter` en
    300 ms, así que hay que esperar 600 antes de medir o se lee un valor a
    medio camino. El arrastre se prueba con el ratón de verdad de Playwright:
    `setPointerCapture` rechaza los `PointerEvent` inventados a mano.
  - Verificado revirtiendo: sin el multiplicador fallan 2 comprobaciones; sin
    el CSS, 6.

- **Texto pálido**: de **12 sitios a 1**. Las etiquetas del panel del clima
  (SENSACIÓN, HUMEDAD, VIENTO, LLUVIA), los datos del catálogo de dispositivos,
  el estado vacío de las alarmas y el diagnóstico de miniaturas estaban a 10-12
  px con opacidad por debajo de 0,55, que a ese tamaño deja de leerse.
  - El que queda es un **falso positivo**: `📋 Copiar` con opacidad 0, que es el
    botón del traductor **cuando está escondido**, o sea justo lo que tiene que
    hacer. Se deja: `pruebas/calidad.js` mira la opacidad, no si el elemento se
    ve o no.

- **Accesibilidad** (idea 21). Ojo con el dato del informe: no había 3
  `aria-label`, había **61**. Lo que sí faltaba, y se arregló:
  - **Botones que solo son un icono y no decían nada**: los seis colores del
    Modo Fácil, los tres del mini-reproductor, los cinco de cerrar (✕), los dos
    de enviar (➤), el de nota nueva, el de perfil y las 128 casillas del
    secuenciador de IXBand (que ahora dicen «Bombo, paso 1»).
  - **`prefers-reduced-motion`**, que no estaba en ninguna parte. Si en tu
    sistema pediste menos movimiento, ahora la app te hace caso. No se quita a
    lo bruto con `animation:none` —eso deja cosas a medio dibujar—: se acorta a
    un suspiro, y los fondos animados, que son lo que más marea, se paran del
    todo. La prueba comprueba además que **la app sigue usándose**: los paneles
    se abren igual, no se quedan invisibles.
  - `pruebas/acceso.js` (11/11), con dos navegadores: uno normal y otro con la
    preferencia puesta.
  - **La primera versión de la prueba mentía**: `\p{Emoji}` incluye los dígitos
    ASCII, así que las teclas «7», «8», «9» de la calculadora salían como
    botones mudos. Un lector de pantalla las lee perfectamente. Ahora solo
    cuentan los que son **solo** un pictograma.

- **Botón de instalar nativo** (idea 20). En Android y en el ordenador abre el
  diálogo del sistema de un toque; antes solo salía un cartel con instrucciones.
  - El evento `beforeinstallprompt` el navegador lo lanza **una vez**, y hay que
    quedárselo (con `preventDefault`) antes de que el usuario pulse nada.
    Después de usarlo ya no vale, así que se suelta y se espera al siguiente.
  - **En iOS ese evento no existe**, así que ahí el cartel tiene que seguir
    saliendo: quitarlo dejaría a los iPhone sin forma de instalar. La prueba
    corre el caso entero con un iPhone simulado.
  - Si ya está instalada, el panel lo dice y no ofrece un botón que no haría
    nada.
  - Instalar **una app suelta** sigue con su cartel a propósito: el diálogo del
    navegador instalaría IXClocK entera, no esa app con su enlace.
  - `pruebas/instalar.js` (15/15).

- **Dormir con la radio recuerda la emisora** (idea 28). El temporizador ya
  existía, pero no memorizaba la fuente: al día siguiente había que volver a
  buscar la emisora en la lista antes de poder poner el temporizador otra vez.
  Ahora sale un botón «▶ Otra vez con \<emisora\> · 30 min» que la pone **y**
  arranca el temporizador de un tirón.
  - Se apunta al **empezar** el temporizador, no al apagarse: cuando se apaga,
    `stopAudio` ya ha limpiado la emisora y no habría nada que recordar.
  - Si esa emisora ya no existe (cambiaste de países, o filtraste la lista) no
    se ofrece un botón que no llevaría a ningún sitio.
  - `pruebas/dormir.js` (25/25).

- **Historial del Modo Enfoque** (idea 37). Sesiones de hoy, tiempo y racha de
  días seguidos, en la misma línea de debajo de los puntitos.
  - **Solo cuenta una sesión de trabajo terminada entera.** Saltar a mano no
    apunta nada: si saltas al minuto 3, apuntar 25 minutos sería mentir, y un
    historial que miente no sirve para saber si de verdad lo usas. Un descanso
    tampoco cuenta como trabajo.
  - **La racha no se rompe a las 00:01.** Si ayer hiciste y hoy aún no has
    empezado, sigue viva: cortarla sería castigarte por no haber empezado
    todavía. La prueba cubre los 7 bordes (solo hoy, hoy y dos antes, ayer pero
    hoy no, cortada, con hueco, varias el mismo día, y vacío).
  - Una racha de 1 día no se enseña: eso no es una racha, es haber empezado.
  - Se guardan las 60 últimas, y un guardado corrupto no rompe nada.
  - `pruebas/enfhist.js` (18/18). `enfoque.js` actualizado: el contador ya no
    sale de la configuración sino del historial real.

- **Una sola fuente para las divisas** (y la idea 30 **ya estaba hecha**).
  - El conversor de unidades ya existía con longitud, peso, temperatura,
    velocidad, área y volumen, así que la idea 30 no había que hacerla. Pero al
    comprobarlo salió algo peor: **había DOS conversores de divisas con tablas
    distintas**. El de Calculadora → Divisas baja las tasas del día; el de
    Calculadora → Conversión → Divisas tenía siete monedas escritas a mano y
    congeladas. Se contradecían hasta un **2,5 %**, y en cuanto llegaban las
    tasas reales la diferencia **crecía sin límite**, porque una se actualizaba
    y la otra no.
  - Ahora la tabla de unidades se rellena de `_ixRates`, que es de donde bebe el
    conversor de verdad. De 7 monedas a **50**, y dice si son del día o
    aproximadas, como ya hacía el otro.
  - La prueba comprueba que las **tres** puertas a lo mismo —unidades, divisas y
    el buscador— dan el mismo número, y que las unidades normales (metros,
    kilos, grados) siguen exactamente igual. Verificado devolviendo la tabla
    vieja: con tasas nuevas, unidades decía 60 DOP y divisas 75.
  - `pruebas/unidades.js` (12/12).

- **El buscador calcula y cambia divisas** (idea 29). Escribes `23*4` o
  `150 usd a eur` y el resultado sale **el primero**, sin abrir la calculadora.
  Al tocarlo se abre la calculadora ya en divisas con esos datos puestos.
  - Lo fácil es que salga el resultado. Lo difícil, y lo que prueba el test, es
    que **NO salga cuando no toca**: escribir «7» buscando una nota no puede
    soltarte «7 = 7» delante de lo que buscabas, así que hace falta un operador.
    Ni «150 xyz a abc», ni «150 usd a usd», ni «usd a eur».
  - Reusa el evaluador con lista blanca de Notas Matemáticas, así que **tampoco
    ejecuta código**: 7 intentos comprobados, incluidos `Function(...)()` y las
    plantillas con acento grave.
  - `1.500,50` y `1,500.50` son el mismo número: manda el último separador.
  - El resultado se calcula aparte y se pone delante al final. Si entrara en la
    puntuación normal quedaría el último, porque el título (el número) no se
    parece a lo que escribiste.
  - `pruebas/buscacalc.js` (19/19).

- **Despertar con la radio** (idea 22, la más pedida de todas las auditorías).
  En la hoja de alarma salen **tus emisoras favoritas** —no las 185: nadie
  elige despertador entre 185 en una hoja de móvil— y se guarda como
  `radio:<id>`. La lista dice con qué te despierta, no «Radial».
  - **Lo delicado no es que suene la radio: es que suene ALGO.** Un despertador
    mudo porque el stream no cargó, o porque a las 7 de la mañana no hay
    internet, no es un despertador. Así que **el tono arranca igual, siempre**,
    y solo se calla cuando la emisora ha empezado de verdad (`isPlaying`, que
    solo se pone cuando el `play()` del navegador salió bien). A los 20 s sin
    arrancar se abandona la radio y se queda el tono, para que no entre a
    destiempo encima.
  - La prueba cubre los tres finales: la radio entra, la radio tarda, y no hay
    red (con `setStation` reventando, que es lo peor que puede pasar).
  - Es tono **o** emisora: elegir uno desmarca el otro.
  - `pruebas/despertador.js` (24/24). Verificado quitando la garantía del tono:
    fallan 5 comprobaciones.

- **Dos fallos más de las auditorías** (`pruebas/dosbugs.js` 14/14).
  - **«Cerrar todas las ventanas» no cerraba el Modo Enfoque**, y no era solo
    que se quedara el overlay: seguían corriendo el temporizador, el bloqueo de
    pantalla y el sonido de ambiente. **Este me lo comí yo** al añadir el Modo
    Enfoque: el overlay se crea al vuelo, así que no estaba en las listas de ids
    que recorre esa función. Es el mismo patrón que el de las 6 apps del
    conmutador. `ixEnfoqueSalir` ya hacía la limpieza entera; solo faltaba
    llamarla.
  - **Traductor**: con el mismo idioma en «de» y «a», el resultado salía pero el
    botón de copiar se quedaba invisible encima de un texto que sí estaba. Ahora
    se ve, y además se dice por qué no traduce («Mismo idioma»).
  - **XSS en Mi Nube → Mis Datos**: `renderCloudData` metía valores de
    `localStorage` en `innerHTML` sin escapar, y uno de ellos es «Estado», que
    escribe el usuario a mano. Sin el arreglo se crean dos `<img>` de verdad y
    el `onerror` se dispara al abrir Mi Nube. De paso se escapa también la
    clave, que hoy sale de una lista fija pero era una trampa esperando a que
    alguien añada una nueva.
  - Y un tercero que **destapé al arreglar el segundo**: al vaciar el texto, el
    botón se quedaba visible sobre un resultado vacío. Sin texto no hay nada que
    copiar, así que se esconde.

- **Ejecución de JavaScript en Notas Matemáticas, y dos cosas más**
  (`pruebas/mates.js` 15/15). Lo reportó el usuario con la prueba hecha.
  - **No era un fallo de escapado: era que se ejecutaba.** `evalMathNote`
    pasaba lo de la derecha del igual a `new Function()` tal cual, y encima con
    cada tecla (`oninput`). Escribiendo `a=alert(document.cookie)` salía el
    alert de verdad, sin guardar ni pulsar nada. Y como las notas viven en
    `localStorage` y «Importar datos (JSON)» restaura `localStorage` entero,
    una nota así podía **venir escondida en una copia de seguridad compartida**
    y dispararse al abrirla.
  - Arreglado con lista blanca **antes** de sustituir nada: si queda cualquier
    palabra de dos letras o más que no sea una de las funciones que la app
    ofrece, la línea se trata como texto normal. Así caen `alert`, `fetch`,
    `document`, `eval`, `Function`, `constructor`… y los caracteres fuera de la
    lista (comillas, corchetes, backticks, `=`, `;`) tumban de paso
    `` a=`${...}` `` y `a=1;window.x=1`.
  - Lo difícil no era cortar la ejecución, era **no romper las matemáticas**:
    la prueba comprueba 13 ataques Y 9 cuentas (variables entre líneas,
    potencias, raíces, seno, logaritmo, módulo, negativos), la gráfica de
    `y = x^2` y que el texto suelto se conserva.
  - **XSS en los recientes del temporizador**: la etiqueta es texto libre del
    usuario, se guarda en `localStorage` y se pintaba sin escapar.
  - La tarjeta **«Buscador de canales»** decía «Busca emisoras de radio y TV»,
    pero la función solo consulta listas de iptv-org (TV). Corregido el texto:
    prometía algo que el código nunca hizo.

- **Cuatro bugs que reportó el usuario, verificados uno por uno**
  (`pruebas/mapas.js` 14/14, `pruebas/tresbugs.js` 25/25).
  1. **XSS en Mapas.** El nombre de un sitio (`display_name` de Nominatim) y el
     de una calle los escribe quien edita OpenStreetMap, e iban a `innerHTML`
     y a `bindPopup` de Leaflet —que mete la cadena como HTML— sin escapar.
     Mismo patrón que el del terremoto. Como la CDN de Leaflet está bloqueada
     aquí, la prueba sirve un Leaflet falso que **sí** ejecuta HTML en
     `bindPopup`, y lo primero que comprueba es justo eso: si el falso no
     ejecutara, la prueba pasaría sin probar nada. Verificado revirtiendo el
     arreglo: fallan 5 comprobaciones.
  2. **El conmutador de 3 dedos ignoraba 6 de las 14 apps.** No bastaba con
     añadirlas al array: el enganche corría **una sola vez, a mitad del
     archivo**, y las apps declaradas en un `<script>` posterior todavía no
     existían, así que se saltaban en silencio. Ahora se reintenta con la
     página entera, sin envolver dos veces.
  3. **Las estaciones daban por hecho el hemisferio norte.** En septiembre
     ponía OTOÑO, y en Argentina o Chile es primavera. Se mira la zona horaria
     del aparato, que es el único dato de sitio que hay sin pedir permiso de
     ubicación. Modo Fácil tenía además su propia cuenta duplicada; ahora sale
     de `getSeason`, que es la única que sabe de esto. Probado en dos husos.
  4. **«Cerrar todas las ventanas» y Esc** dejaban abiertas Radio Mundial, Apps
     de Música, VPN y el Buscador de canales: faltaban en `_HOME_DISPLAY_PANELS`.
  5. De paso: el botón **«Editar»** de Alarmas abría un `prompt()` del
     navegador pidiendo el *número* de la alarma a borrar — justo lo que la app
     ya se había quitado en todos los demás sitios, y de sobra porque cada
     alarma tiene su 🗑. Fuera el botón y su función muerta. **Cero `prompt()`
     de verdad en toda la app.**

- **Avisos del sistema y pantalla encendida** (ideas 16 y 17 del usuario).
  Confirmado antes de tocar nada: cero `Notification` en todo el archivo.
  - **El aviso por sí solo no arreglaba nada.** `checkAlarms` y `checkIcaAlarms`
    exigían que el tic cayera justo en el segundo 0, y con la pestaña de fondo
    el navegador frena ese temporizador de 1 s: el minuto de la alarma se
    saltaba y **la alarma no sonaba**. Ahora se mira el minuto, y se recuperan
    hasta 2 minutos perdidos — no más, que si el portátil ha dormido ocho horas
    no queremos ocho alarmas de golpe. Si el reloj va hacia atrás (lo cambiaste
    a mano) se empieza de cero desde ahí en vez de quedarse mudo.
  - El temporizador de la app de Reloj tenía el mismo fallo que tuvo el
    pomodoro: restaba un segundo por tic, así que de fondo se alargaba. Ahora va
    por reloj (`_icaTimerArrancar`), y eso vale para el de la app y para el que
    pone el asistente.
  - El aviso se manda por el service worker cuando lo hay: es lo único que
    funciona en una PWA instalada de iOS/Android.
  - **Lo que NO puede hacer, y la pantalla lo dice**: con IXClocK cerrado del
    todo no hay aviso posible sin un servidor de push. Y si los bloqueaste, se
    explica que hay que desbloquearlos en el navegador.
  - Pantalla encendida (Wake Lock) para dejarlo de reloj de mesa. El bloqueo se
    pierde solo al esconder la pestaña, así que se vuelve a pedir al volver.
  - `pruebas/avisos.js` (27/27).

- **Organizar las notas** (idea 10 del usuario). Carpetas y fijar arriba.
  - Las carpetas **no** se guardan en una lista aparte: son los nombres que
    llevan las notas. Así no puede quedar una carpeta fantasma que no apunta a
    nada, ni una nota metida en una carpeta que ya no existe. Al vaciar una
    carpeta desaparece sola y la vista vuelve a «Todas».
  - La fila de chips solo sale si hay carpetas: con dos notas sueltas, una fila
    vacía solo estorba.
  - Fijar **no** cuenta como editar: no se toca `updatedAt`, o fijar una nota
    vieja la haría parecer recién escrita.
  - Buscar dentro de una carpeta busca solo ahí, y lo dice cuando no hay nada.
  - `pruebas/notas.js` (26/26).

- **Recordatorios por fecha** (idea 9 del usuario). Una alarma puede llevar
  fecha: suena UNA vez ese día y se apaga sola.
  - Lo delicado son los bordes, y ahí está la prueba: que no suene los otros
    días, que suene el suyo, que se apague después (si no se queda armada para
    el año que viene), que una fecha pasada no cuente como «próxima» y que el
    31 de febrero no exista.
  - Una fechada que ya pasó se apaga sola al pintar la lista: dejarla con el
    interruptor verde dice que va a sonar, y no va a sonar.
  - **Bug encontrado de paso**: la franja de resumen leía `alarms`, la lista del
    panel viejo, y no `_icaAlarms`, la de la app de Reloj — o sea que las
    alarmas que pone el usuario **no salían en la franja**. Ahora mira las dos y
    se queda con la más cercana.
  - `pruebas/recordatorios.js` (33/33).

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
