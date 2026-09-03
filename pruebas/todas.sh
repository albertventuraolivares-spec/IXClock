#!/bin/sh
# Ejecuta TODAS las pruebas y resume. Desde la raiz del repo: sh pruebas/todas.sh
#
# Reintenta UNA vez lo que falla. Lanzar 21 navegadores seguidos satura la
# maquina y de vez en cuando uno tarda mas de la cuenta al arrancar; eso no es
# un fallo de la app. Lo que falla DOS veces si hay que mirarlo.
cd "$(dirname "$0")/.." || exit 1
ok=0; mal=0; fallidas=''; reintentadas=''
node pruebas/syncheck.js || exit 1
for f in pruebas/*.js; do
  case "$f" in */syncheck.js|*/auditoria.js|*/interaccion.js|*/calidad.js) continue;; esac
  printf '%-28s ' "$f"
  if node "$f" >/tmp/ixprueba.txt 2>&1; then
    echo OK; ok=$((ok+1))
  elif node "$f" >/tmp/ixprueba.txt 2>&1; then
    echo "OK (al segundo intento)"; ok=$((ok+1)); reintentadas="$reintentadas $f"
  else
    echo FALLA; mal=$((mal+1)); fallidas="$fallidas $f"
    grep FALLA /tmp/ixprueba.txt | head -4
  fi
done
echo ""
echo "pasan: $ok   fallan: $mal"
[ -n "$reintentadas" ] && echo "necesitaron segundo intento (maquina cargada):$reintentadas"
[ -n "$fallidas" ] && echo "FALLAN DE VERDAD (dos intentos):$fallidas"
echo ""
echo "Las tres revisiones grandes van aparte porque tardan varios minutos:"
echo "  node pruebas/auditoria.js     (4 tamanos de pantalla, todas las apps)"
echo "  node pruebas/interaccion.js   (pulsa todos los botones)"
echo "  node pruebas/calidad.js       (rendimiento y accesibilidad)"
