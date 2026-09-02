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
1. **Estilos incoherentes.** Los paneles nuevos (descargas, ciudades, divisas) y
   los viejos usan radios, sombras y espaciados distintos. Unificar con
   variables CSS partiendo del `glass` que ya existe.
2. **El emulador sigue sin confirmarse.** Ya usa `cdn.emulatorjs.org` + 3
   espejos y avisa cuál falló, pero no se ha podido probar con red real. Si el
   usuario pasa el mensaje de error, actuar en consecuencia.

### Funciones nuevas
3. **Mezclador de IXBand**: volumen, paneo, silencio y solo por pista de
   `_gbTakes` (ya existe `muted`, falta el resto).
4. **Cuenta atrás antes de grabar** en IXBand, reutilizando `_gbTick`.
5. **Compás y tonalidad** en IXBand (4/4, 3/4, 6/8); el compás alimenta el LCD.
6. **Afinador** con micrófono (autocorrelación), reutilizando el permiso que ya
   piden Grabadora y Sampler.
7. **Secciones de canción** A/B/C en IXBand: crear, duplicar y reordenar.
8. **Buscador global de verdad**, que busque en ajustes, apps, notas, ciudades
    y emisoras a la vez (hoy «Buscador de canales» solo busca emisoras).
9. **Atajos de teclado** para quien lo use con teclado: cerrar ventanas, abrir
    apps, control del reproductor.

---

## Hecho

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
