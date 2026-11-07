# Postula

App web instalable (PWA) para postularse por WhatsApp sin guardar contactos:
detecta desde una captura el **número, la empresa y el puesto**, pide el nombre
de la postulante, arma el mensaje y comparte la hoja de vida. Pensada para
vacantes en **México** (+52).

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

1. **La primera vez te pregunta tu nombre.** Se usa para firmar el mensaje
   (“Soy María Pérez.”). Puedes cambiarlo en Ajustes.
2. **Sube tu hoja de vida una vez.** Queda guardada en el teléfono.
3. **Pega el número** o toca **Escanear** y elige una captura de la vacante.
   La app lee la imagen y muestra los números, la **empresa** y el **puesto**
   que encontró. Puedes corregirlos ahí mismo antes de continuar.
4. **Revisa el mensaje**: se arma solo, por ejemplo
   *“¡Hola! Buen día. Soy María Pérez. Me gustaría postularme al puesto de
   Recepcionista en Clínica San José…”*. Puedes editarlo o cambiar de plantilla.
5. Toca **Abrir chat en WhatsApp** o **Enviar mensaje + CV juntos**.
6. La aplicación queda registrada en **Historial**. Toca la etiqueta
   `ABIERTA` / `ENVIADA` para cambiar el estado.

### Qué detecta de la captura

- **Número** de WhatsApp (con lógica para México: 10 dígitos → +52).
- **Puesto** por etiquetas (`Puesto:`, `Vacante:`, `Cargo:`) o por un
  diccionario de cargos comunes (recepcionista, auxiliar administrativo,
  vendedor, chofer, contador, etc.).
- **Empresa** por etiquetas (`Empresa:`), frases (“Somos…”, “Únete a…”) o
  nombres con prefijos conocidos (Grupo, Clínica, Industrias, Tiendas…).

Si algo no lo detecta, se escribe a mano en el formulario y el mensaje se
rearma igual.

También puedes **compartir una captura desde la galería** directamente a
Postula (solo Android): Compartir → Postula → detecta el número solo.

---

## iPhone (iOS)

Funciona, pero iOS tiene reglas propias:

- **Instalar solo desde Safari.** Si abre el enlace en Chrome/Firefox del
  iPhone, la opción de instalar no aparece. Desde Safari: **Compartir ⤴ →
  Añadir a pantalla de inicio**.
- **La app instalada tiene sus propios datos.** Lo que subas en Safari no
  aparece dentro del icono de la pantalla de inicio (y viceversa). Sube el CV
  **después** de instalarla.
- **No existe “Compartir captura → Postula”** (eso es una función de Android).
  En iPhone usa el botón **Escanear**, que abre Fotos.
- **Safari puede liberar datos** de sitios que no se usan por semanas. La app
  pide almacenamiento persistente, pero conviene tener el CV también en
  Archivos/iCloud por si hay que volver a subirlo.
- **Enviar mensaje + CV** usa la hoja de compartir de iOS. Si WhatsApp adjunta
  el archivo sin el texto, el mensaje queda copiado al portapapeles para
  pegarlo.

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

1. Abre la URL **en Safari** (no en Chrome ni en Instagram/WhatsApp).
2. Botón **Compartir ⤴** → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono y **sube el CV ahí dentro** (los datos de la app
   instalada son independientes de los de Safari).

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
- **El OCR corre localmente** con [Tesseract.js](https://tesseract.projectnaptha.com/)
  usando el modelo de español (`spa`). La primera vez descarga el lector
  (~8 MB) desde un CDN; después queda cacheado y funciona sin internet.
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

- **País por defecto**: México (`52`) en `state.cc` y el arreglo `COUNTRIES` de `js/app.js`.
- **Plantillas**: desde *Ajustes → Plantillas* (se guardan en el teléfono).
  Admiten `{nombre}`, `{empresa}` y `{puesto}`.
- **Mensaje inicial**: edita `DEFAULT_TEMPLATES` en `js/app.js`. Los tokens
  `{presentacion}` y `{postulacion}` arman las frases solas según los datos
  detectados; `{nombre}`, `{empresa}` y `{puesto}` insertan el valor crudo.
- **Iconos**: `python3 tools/make_icons.py`.

### Notas técnicas

- Enlaces de WhatsApp: `https://wa.me/<numero>?text=<mensaje>`.
- Compartir archivo + texto: `navigator.share({ files, text })` con
  `navigator.canShare`, y descarga como respaldo si el navegador no lo soporta.
- El service worker recibe capturas con `share_target` (Android Chrome).
- Probado con capturas tipo chat de WhatsApp: detecta `55 1234 5678`, lo
  normaliza a `+52 55 1234 5678` y extrae “Vacante: Recepcionista” /
  “Empresa: Clínica San José” para armar el mensaje.

---

Hecho para aplicar sin enredos.
