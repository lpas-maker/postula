# Postula

App web instalable (PWA) para postularse por WhatsApp sin guardar contactos:
detecta el número desde una captura, abre el chat con el mensaje listo y
comparte la hoja de vida.

> Pensada para usarse desde el celular, con un icono en la pantalla de inicio.

---

## El límite de WhatsApp (léelo primero)

WhatsApp **no permite adjuntar un archivo desde un enlace** (`wa.me`). No existe
forma de abrir un chat, escribir el mensaje y pegar el PDF en un solo toque: es
una restricción de WhatsApp, no de la app.

Por eso Postula ofrece dos caminos:

| Botón | Qué hace | Cuándo usarlo |
|---|---|---|
| **Abrir chat en WhatsApp** | Abre exactamente el chat del número con el mensaje escrito. Solo falta tocar el clip 📎 y elegir el CV. | Cuando quieres asegurar el número exacto. |
| **Enviar mensaje + CV juntos** | Abre el menú de compartir del teléfono con el mensaje y el archivo. Eliges WhatsApp y el contacto, y sale todo junto. | Cuando prefieres mandar mensaje y CV de una. |

Todo lo demás sí es automático: detectar el número, el mensaje, guardar el CV,
el historial y no volver a guardar contactos.

---

## Cómo se usa

1. **Sube tu hoja de vida una vez.** Queda guardada en el teléfono.
2. **Pega el número** o toca **Escanear** y elige una captura de la vacante.
   La app lee la imagen y te muestra los números que encontró.
3. **Revisa el mensaje** (puedes elegir plantilla y editarlo).
4. Toca **Abrir chat en WhatsApp** o **Enviar mensaje + CV juntos**.
5. La aplicación queda registrada en **Historial**. Toca la etiqueta
   `ABIERTA` / `ENVIADA` para cambiar el estado.

También puedes **compartir una captura desde la galería** directamente a
Postula (Android): Compartir → Postula → detecta el número solo.

---

## Probarla en el computador

No abras `index.html` con doble clic: el service worker y el OCR necesitan
`http://` o `https://`.

```bash
cd postula
python3 -m http.server 8080
```

Luego abre <http://localhost:8080>.

---

## Instalarla en el celular

### Android (Chrome)

1. Abre la URL publicada.
2. Menú **⋮** → **Instalar aplicación** (o *Añadir a pantalla de inicio*).
3. Aparece como una app más, sin barra del navegador.

### iPhone (Safari)

1. Abre la URL **en Safari**.
2. Botón **Compartir ⤴** → **Añadir a pantalla de inicio**.

> En iPhone, compartir el CV usa el menú de compartir del sistema (iOS 15+).
> En Android funciona con Chrome/Edge.

---

## Publicarla gratis con GitHub Pages

1. En el repo: **Settings → Pages**.
2. *Source*: **Deploy from a branch** → branch `main` → carpeta `/ (root)`.
3. Guarda y espera un minuto.
4. La app queda en `https://TUUSUARIO.github.io/postula/`.

Ábrela en el celular y instálala. Como todos los enlaces son relativos, funciona
igual en la raíz o en un subdirectorio.

Alternativas sin repo público: arrastrar la carpeta a
[Netlify Drop](https://app.netlify.com/drop) o usar Cloudflare Pages.

---

## Privacidad

- **Nada sale del teléfono.** El CV, las plantillas y el historial viven en
  `IndexedDB` y `localStorage`.
- **El OCR corre localmente** con [Tesseract.js](https://tesseract.projectnaptha.com/).
  La primera vez descarga el lector (~5 MB) desde un CDN; después queda
  cacheado y funciona sin internet.
- No hay cuentas, servidores, analítica ni publicidad.

---

## Estructura

```
index.html              interfaz (3 pantallas: enviar, historial, ajustes)
css/styles.css          estilos, modo claro/oscuro automático
js/app.js               lógica: números, OCR, CV, historial, PWA
sw.js                   service worker (offline + recibir capturas compartidas)
manifest.webmanifest    instalación, iconos, atajos, share_target
icons/                  iconos generados (192, 512, maskable, apple-touch)
tools/make_icons.py     regenera los iconos sin dependencias
```

### Cambios rápidos

- **País por defecto**: `state.cc` y el arreglo `COUNTRIES` en `js/app.js`.
- **Plantillas**: desde *Ajustes → Plantillas* (se guardan en el teléfono).
  Admiten `{nombre}`, `{empresa}` y `{puesto}`.
- **Mensaje inicial**: edita `DEFAULT_TEMPLATES` en `js/app.js`.
- **Iconos**: `python3 tools/make_icons.py`.

### Notas técnicas

- Enlaces de WhatsApp: `https://wa.me/<numero>?text=<mensaje>`.
- Compartir archivo + texto: `navigator.share({ files, text })` con
  `navigator.canShare`, y descarga como respaldo si el navegador no lo soporta.
- El service worker recibe capturas con `share_target` (Android Chrome).
- Probado con capturas reales tipo chat de WhatsApp: detecta `300 123 4567`
  y lo normaliza a `+57 300 123 4567`.

---

Hecho para aplicar sin enredos.
