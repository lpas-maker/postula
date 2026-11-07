/* ==========================================================================
   Postula — tu CV por WhatsApp
   Todo funciona en el teléfono: números, plantillas, historial y CV.
   La lectura de capturas (OCR) corre localmente con Tesseract.js.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const LS = 'postula.';

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(LS + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(LS + key, JSON.stringify(value));
      } catch (err) { /* modo privado lleno */ }
    },
    remove(key) {
      try { localStorage.removeItem(LS + key); } catch (err) {}
    }
  };

  const esc = (value) =>
    String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const uid = () =>
    (window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ------------------------------------------------------------------ */
  /* Países                                                              */
  /* ------------------------------------------------------------------ */

  const COUNTRIES = [
    { code: '57', name: 'Colombia', flag: '🇨🇴' },
    { code: '52', name: 'México', flag: '🇲🇽' },
    { code: '54', name: 'Argentina', flag: '🇦🇷' },
    { code: '56', name: 'Chile', flag: '🇨🇱' },
    { code: '51', name: 'Perú', flag: '🇵🇪' },
    { code: '593', name: 'Ecuador', flag: '🇪🇨' },
    { code: '58', name: 'Venezuela', flag: '🇻🇪' },
    { code: '591', name: 'Bolivia', flag: '🇧🇴' },
    { code: '595', name: 'Paraguay', flag: '🇵🇾' },
    { code: '598', name: 'Uruguay', flag: '🇺🇾' },
    { code: '506', name: 'Costa Rica', flag: '🇨🇷' },
    { code: '507', name: 'Panamá', flag: '🇵🇦' },
    { code: '503', name: 'El Salvador', flag: '🇸🇻' },
    { code: '502', name: 'Guatemala', flag: '🇬🇹' },
    { code: '504', name: 'Honduras', flag: '🇭🇳' },
    { code: '505', name: 'Nicaragua', flag: '🇳🇮' },
    { code: '1809', name: 'Rep. Dominicana', flag: '🇩🇴' },
    { code: '1', name: 'EE.UU. / Canadá', flag: '🇺🇸' },
    { code: '34', name: 'España', flag: '🇪🇸' }
  ];

  const DEFAULT_TEMPLATES = [
    {
      id: 'general',
      name: 'Postulación general',
      body: '¡Hola! Buen día. Vi su publicación y me gustaría postularme. Adjunto mi hoja de vida. Quedo atenta a cualquier información adicional. ¡Gracias!'
    },
    {
      id: 'con-nombre',
      name: 'Con mi nombre',
      body: '¡Hola! Buen día, soy {nombre}. Vi su publicación y me gustaría postularme al cargo. Adjunto mi hoja de vida. Quedo atenta a cualquier información adicional. ¡Gracias!'
    },
    {
      id: 'vacante',
      name: 'Mencionando la vacante',
      body: '¡Hola! Buen día. Me gustaría postularme a la vacante de {puesto} en {empresa}. Adjunto mi hoja de vida para su consideración. Quedo atenta. ¡Gracias!'
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Estado                                                              */
  /* ------------------------------------------------------------------ */

  const state = {
    cc: store.get('cc', '57'),
    name: store.get('name', ''),
    templates: store.get('templates', null) || DEFAULT_TEMPLATES.slice(),
    activeTemplate: store.get('activeTemplate', 'general'),
    history: store.get('history', []) || [],
    cv: null,
    messageDirty: false
  };

  if (!Array.isArray(state.templates) || state.templates.length === 0) {
    state.templates = DEFAULT_TEMPLATES.slice();
  }

  /* ------------------------------------------------------------------ */
  /* Teléfonos                                                           */
  /* ------------------------------------------------------------------ */

  function normalizePhone(raw, cc) {
    if (raw == null) return null;
    const text = String(raw).trim();
    if (!text) return null;

    let digits = text.replace(/\D/g, '');
    if (!digits) return null;

    const startsPlus = /^\s*\+/.test(text);
    const startsZeroZero = !startsPlus && /^\s*00/.test(text);

    if (startsZeroZero) digits = digits.replace(/^00/, '');

    if (startsPlus || startsZeroZero) {
      if (digits.length < 8 || digits.length > 15) return null;
      return { e164: '+' + digits, digits: digits };
    }

    if (digits.length < 6 || digits.length > 15) return null;

    const ccDigits = String(cc || '57');

    // El número ya viene con el código de país.
    if (digits.length >= 11 && digits.indexOf(ccDigits) === 0) {
      return { e164: '+' + digits, digits: digits };
    }

    // Marcación nacional con 0 inicial.
    const national = digits.replace(/^0+/, '');
    if (national.length < 6) return null;

    if (national.length >= 7 && national.length <= 10) {
      return { e164: '+' + ccDigits + national, digits: ccDigits + national };
    }

    return { e164: '+' + national, digits: national };
  }

  function detectCountry(digits) {
    let best = null;
    for (let i = 0; i < COUNTRIES.length; i += 1) {
      const c = COUNTRIES[i];
      const rest = digits.length - c.code.length;
      if (rest >= 7 && rest <= 10 && digits.indexOf(c.code) === 0) {
        if (!best || c.code.length > best.length) best = c.code;
      }
    }
    return best;
  }

  function prettyPhone(e164) {
    const digits = String(e164 || '').replace(/\D/g, '');
    if (!digits) return '';
    const cc = detectCountry(digits);
    const national = cc ? digits.slice(cc.length) : digits;

    let grouped = national;
    if (national.length === 10) {
      grouped = national.slice(0, 3) + ' ' + national.slice(3, 6) + ' ' + national.slice(6);
    } else if (national.length === 9) {
      grouped = national.slice(0, 2) + ' ' + national.slice(2, 5) + ' ' + national.slice(5);
    } else if (national.length === 8) {
      grouped = national.slice(0, 4) + ' ' + national.slice(4);
    }
    return (cc ? '+' + cc + ' ' : '') + grouped;
  }

  function findNumbers(text, cc) {
    const src = String(text || '');
    const found = new Map();
    const re = /\+?\d(?:[ \t.\-()\u00A0]{0,2}\d){4,17}/g;

    let match;
    while ((match = re.exec(src)) !== null) {
      const raw = match[0];
      const before = src.charAt(match.index - 1);
      const after = src.charAt(match.index + raw.length);

      if (/\d/.test(before) || /\d/.test(after)) continue;

      const digits = raw.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) continue;

      const norm = normalizePhone(raw, cc);
      if (!norm) continue;

      const ccDetected = detectCountry(norm.digits);
      const nationalLen = norm.digits.length - (ccDetected ? ccDetected.length : 0);

      let score = 0;
      if (/^\s*\+/.test(raw)) score += 45;
      if (ccDetected) score += 20;
      if (nationalLen === 10) score += 25;
      else if (nationalLen === 9) score += 12;
      if (!/[ \t.\-()]/.test(raw) && digits.length <= 8) score -= 25;

      const prev = found.get(norm.e164);
      if (!prev || prev.score < score) {
        found.set(norm.e164, {
          e164: norm.e164,
          digits: norm.digits,
          cc: ccDetected,
          pretty: prettyPhone(norm.e164),
          score: score
        });
      }
    }

    return Array.from(found.values())
      .filter((c) => c.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }

  /* ------------------------------------------------------------------ */
  /* IndexedDB: guardar el CV                                            */
  /* ------------------------------------------------------------------ */

  const DB_NAME = 'postula-db';
  const DB_STORE = 'files';

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Sin IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Error de IndexedDB'));
    });
  }

  async function idbPut(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbGet(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  }

  async function idbDel(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */

  let toastTimer = null;

  function toast(message, options) {
    const el = $('#toast');
    if (!el) return;

    el.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);

    const opts = options || {};
    if (opts.action && typeof opts.action.fn === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opts.action.label;
      btn.addEventListener('click', () => {
        hideToast();
        opts.action.fn();
      });
      el.appendChild(btn);
    }

    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || (opts.action ? 8000 : 3400));
  }

  function hideToast() {
    const el = $('#toast');
    if (el) el.classList.remove('show');
  }

  /* ------------------------------------------------------------------ */
  /* Compartir / abrir WhatsApp                                          */
  /* ------------------------------------------------------------------ */

  function openWhatsApp(digits, message) {
    const url = 'https://wa.me/' + String(digits).replace(/\D/g, '') +
      '?text=' + encodeURIComponent(message);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'archivo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function guessType(name) {
    const ext = String(name || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'doc') return 'application/msword';
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    return 'application/octet-stream';
  }

  async function shareCVWithMessage(message) {
    if (!state.cv || !state.cv.blob) {
      toast('Primero sube tu hoja de vida');
      $('#file-cv').click();
      return false;
    }

    let file;
    try {
      file = new File([state.cv.blob], state.cv.name, {
        type: state.cv.type || guessType(state.cv.name)
      });
    } catch (err) {
      file = state.cv.blob;
    }

    const payload = { files: [file], text: message };

    if (navigator.canShare && navigator.share && navigator.canShare(payload)) {
      // Copia el mensaje por si WhatsApp adjunta solo el archivo.
      // Sin await: en iOS hay que conservar la activación del toque para share().
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message).catch(() => {});
        }
      } catch (err) { /* sin permiso de portapapeles */ }

      try {
        await navigator.share(payload);
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') return false;
        // Si falla, se intenta la descarga como respaldo.
      }
    }

    downloadBlob(state.cv.blob, state.cv.name);
    toast('CV descargado. Adjúntalo en el chat con el clip 📎');
    return false;
  }

  /* ------------------------------------------------------------------ */
  /* Mensajes y plantillas                                               */
  /* ------------------------------------------------------------------ */

  function templateValues() {
    return {
      nombre: state.name || '',
      empresa: ($('#company') && $('#company').value.trim()) || '',
      puesto: ($('#role') && $('#role').value.trim()) || ''
    };
  }

  function applyTokens(body) {
    const values = templateValues();
    let out = String(body || '').replace(/\{(nombre|empresa|puesto)\}/gi, (all, key) => {
      return values[key.toLowerCase()] || '';
    });
    out = out
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+([.,!?])/g, '$1')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }

  function getTemplate(id) {
    return state.templates.find((t) => t.id === id) || state.templates[0];
  }

  function renderTemplateSelect() {
    const select = $('#template');
    if (!select) return;

    select.innerHTML = state.templates
      .map((t) => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>')
      .join('');

    if (!state.templates.some((t) => t.id === state.activeTemplate)) {
      state.activeTemplate = state.templates[0].id;
    }
    select.value = state.activeTemplate;
  }

  function applyActiveTemplate() {
    const tpl = getTemplate(state.activeTemplate);
    const area = $('#message');
    if (!tpl || !area) return;
    area.value = applyTokens(tpl.body);
    state.messageDirty = false;
  }

  function refreshMessageFromTemplate() {
    if (state.messageDirty) return;
    applyActiveTemplate();
  }

  function renderTemplatesEditor() {
    const box = $('#tpl-list');
    if (!box) return;

    box.innerHTML = state.templates.map((t) => {
      return '' +
        '<details class="tpl" data-id="' + esc(t.id) + '">' +
          '<summary>' + esc(t.name) + '</summary>' +
          '<div class="tpl-body">' +
            '<input class="field tpl-title" value="' + esc(t.name) + '" aria-label="Nombre de la plantilla" maxlength="48">' +
            '<textarea class="field tpl-body-input" rows="4" aria-label="Texto de la plantilla">' + esc(t.body) + '</textarea>' +
            '<div class="tpl-foot">' +
              '<button class="btn soft sm" type="button" data-act="use-tpl">Usar esta</button>' +
              '<button class="btn soft sm danger-text" type="button" data-act="del-tpl">Eliminar</button>' +
            '</div>' +
          '</div>' +
        '</details>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Historial                                                           */
  /* ------------------------------------------------------------------ */

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return 'hace ' + minutes + ' min';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return 'hace ' + hours + ' h';
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ayer';
    if (days < 7) return 'hace ' + days + ' días';
    return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  function addHistory(data) {
    const entry = {
      id: uid(),
      phone: data.phone,
      message: data.message,
      company: data.company || '',
      role: data.role || '',
      ts: Date.now(),
      sent: false
    };
    state.history.unshift(entry);
    if (state.history.length > 400) state.history.length = 400;
    store.set('history', state.history);
    renderHistory();
    return entry;
  }

  function updateHistoryEntry(id, patch) {
    const entry = state.history.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    store.set('history', state.history);
    renderHistory();
  }

  function renderHistory() {
    const list = $('#hist-list');
    const empty = $('#hist-empty');
    const stats = $('#hist-stats');
    if (!list) return;

    const items = state.history;
    if (!items.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      if (stats) stats.textContent = '';
      return;
    }

    if (empty) empty.hidden = true;

    const sent = items.filter((e) => e.sent).length;
    if (stats) {
      const total = items.length === 1 ? '1 registrada' : items.length + ' registradas';
      const enviadas = sent === 1 ? '1 marcada como enviada' : sent + ' marcadas como enviadas';
      stats.textContent = total + ' · ' + enviadas + ' · toca la etiqueta para cambiarla';
    }

    list.innerHTML = items.map((entry) => {
      const title = entry.company || entry.role || prettyPhone(entry.phone);
      const sub = [entry.company ? entry.role : '', prettyPhone(entry.phone)]
        .filter(Boolean).join(' · ');
      return '' +
        '<li class="hist" data-id="' + esc(entry.id) + '">' +
          '<div class="hist-top">' +
            '<span class="hist-title">' + esc(title) + '</span>' +
            '<button type="button" class="badge ' + (entry.sent ? '' : 'pending') + '"' +
              ' data-act="toggle" title="Toca para cambiar el estado">' +
              (entry.sent ? 'Enviada' : 'Abierta') +
            '</button>' +
          '</div>' +
          '<div class="hist-phone">' + esc(sub) + ' · ' + esc(timeAgo(entry.ts)) + '</div>' +
          (entry.message
            ? '<div class="hist-note">' + esc(entry.message) + '</div>'
            : '') +
          '<div class="hist-actions">' +
            '<button class="btn soft" type="button" data-act="reopen">Reabrir chat</button>' +
            '<button class="btn soft" type="button" data-act="share-cv">Enviar CV</button>' +
            '<button class="icon-btn" type="button" data-act="delete" aria-label="Eliminar del historial">🗑</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* CV                                                                  */
  /* ------------------------------------------------------------------ */

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }

  function renderCV() {
    const badge = $('#cv-badge');
    const name = $('#cv-name');
    const meta = $('#cv-meta');
    const button = $('#btn-cv-upload');
    if (!badge || !name) return;

    if (state.cv) {
      const parts = String(state.cv.name || '').split('.');
      const ext = (parts.length > 1 ? parts.pop() : 'pdf').toUpperCase().slice(0, 4);
      badge.textContent = ext;
      badge.classList.remove('empty');
      name.textContent = state.cv.name;
      meta.textContent = formatSize(state.cv.size) + ' · guardado aquí';
      if (button) button.textContent = 'Cambiar';
    } else {
      badge.textContent = 'PDF';
      badge.classList.add('empty');
      name.textContent = 'Sin hoja de vida';
      meta.textContent = 'Súbela una vez y queda guardada';
      if (button) button.textContent = 'Subir';
    }
  }

  async function loadCV() {
    try {
      const cv = await idbGet('cv');
      state.cv = cv || null;
    } catch (err) {
      state.cv = null;
    }
    renderCV();
  }

  async function saveCV(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast('El archivo es muy grande (máximo 20 MB)');
      return;
    }
    const record = {
      blob: file,
      name: file.name || 'mi-hoja-de-vida.pdf',
      type: file.type || guessType(file.name),
      size: file.size || 0,
      ts: Date.now()
    };
    try {
      await idbPut('cv', record);
      state.cv = record;
      renderCV();
      // En iOS el sistema puede borrar datos de sitios poco usados:
      // pedimos almacenamiento persistente (si el navegador lo permite).
      try {
        if (navigator.storage && navigator.storage.persist) {
          navigator.storage.persist().catch(() => {});
        }
      } catch (err) { /* sin soporte */ }
      toast('Hoja de vida guardada ✅');
    } catch (err) {
      toast('No pude guardar el archivo. Revisa el espacio del teléfono.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* OCR                                                                 */
  /* ------------------------------------------------------------------ */

  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let tesseractPromise = null;
  let ocrToken = 0;
  let ocrWorker = null;

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;

    tesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = TESSERACT_URL;
      script.async = true;
      script.onload = () => resolve(window.Tesseract);
      script.onerror = () => reject(new Error('No se pudo cargar el lector'));
      document.head.appendChild(script);
    }).catch((err) => {
      tesseractPromise = null;
      throw err;
    });

    return tesseractPromise;
  }

  function preprocessImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        let scale = 1500 / img.width;
        scale = Math.min(2, Math.max(0.5, scale));

        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const px = imageData.data;
          for (let i = 0; i < px.length; i += 4) {
            let gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            gray = Math.max(0, Math.min(255, (gray - 128) * 1.28 + 128));
            px[i] = gray;
            px[i + 1] = gray;
            px[i + 2] = gray;
          }
          ctx.putImageData(imageData, 0, 0);
        } catch (err) { /* si falla, se usa la imagen original */ }

        URL.revokeObjectURL(url);
        resolve(canvas);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No pude abrir la imagen'));
      };

      img.src = url;
    });
  }

  const PROGRESS_RANGES = {
    'loading tesseract core': [0, 12],
    'initializing tesseract': [12, 18],
    'loading language traineddata': [18, 42],
    'initializing api': [42, 56],
    'recognizing text': [56, 100]
  };

  function setProgress(percent, label) {
    const bar = $('#ocr-bar');
    const status = $('#ocr-status');
    if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    if (status && label) status.textContent = label;
  }

  function onOcrLog(message) {
    const range = PROGRESS_RANGES[message.status];
    if (!range) return;
    const progress = typeof message.progress === 'number' ? message.progress : 0;
    const percent = range[0] + (range[1] - range[0]) * progress;

    let label = 'Leyendo la captura…';
    if (message.status === 'loading tesseract core') label = 'Cargando el lector (solo la primera vez)…';
    else if (message.status === 'loading language traineddata') label = 'Descargando el idioma…';
    else if (message.status === 'initializing api') label = 'Preparando el lector…';

    setProgress(percent, label);
  }

  function openSheet() {
    const modal = $('#ocr-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    const modal = $('#ocr-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    ocrToken += 1;
    if (ocrWorker) {
      try { ocrWorker.terminate(); } catch (err) {}
      ocrWorker = null;
    }
  }

  function resetSheet() {
    const results = $('#ocr-results');
    const preview = $('#ocr-preview-wrap');
    const raw = $('#ocr-raw-wrap');
    const progress = $('#ocr-progress');

    if (results) results.innerHTML = '';
    if (preview) { preview.hidden = true; $('#ocr-preview').removeAttribute('src'); }
    if (raw) raw.hidden = true;
    if (progress) progress.hidden = true;
    setProgress(0, 'Preparando el lector…');
  }

  async function handleImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      toast('Ese archivo no es una imagen');
      return;
    }

    const token = ++ocrToken;
    resetSheet();
    openSheet();

    const preview = $('#ocr-preview');
    if (preview) preview.src = URL.createObjectURL(file);
    if ($('#ocr-preview-wrap')) $('#ocr-preview-wrap').hidden = false;
    if ($('#ocr-progress')) $('#ocr-progress').hidden = false;
    setProgress(3, 'Preparando la imagen…');

    let text = '';

    try {
      const canvas = await preprocessImage(file);
      if (token !== ocrToken) return;

      setProgress(8, 'Cargando el lector…');
      const Tesseract = await loadTesseract();
      if (token !== ocrToken) return;

      setProgress(12, 'Iniciando el lector…');
      const worker = await Tesseract.createWorker('eng', 1, { logger: onOcrLog });
      ocrWorker = worker;

      if (token !== ocrToken) {
        try { await worker.terminate(); } catch (err) {}
        return;
      }

      await worker.setParameters({ tessedit_pageseg_mode: '11' });
      const result = await worker.recognize(canvas);
      text = (result && result.data && result.data.text) || '';

      try { await worker.terminate(); } catch (err) {}
      ocrWorker = null;
    } catch (err) {
      if (token !== ocrToken) return;
      if ($('#ocr-progress')) $('#ocr-progress').hidden = true;
      const results = $('#ocr-results');
      if (results) {
        results.innerHTML = '<p class="ocr-empty">No pude leer la imagen. La primera vez hay que estar conectada para descargar el lector. También puedes escribir el número a mano o pegarlo.</p>';
      }
      return;
    }

    if (token !== ocrToken) return;

    if ($('#ocr-progress')) $('#ocr-progress').hidden = true;
    showOcrResults(text);
  }

  function showOcrResults(text) {
    const results = $('#ocr-results');
    if (!results) return;

    const candidates = findNumbers(text, state.cc);
    results.innerHTML = '';

    if (!candidates.length) {
      results.innerHTML = '<p class="ocr-empty">No encontré un número claro en la captura. Revisa el texto detectado o escríbelo a mano.</p>';
    } else {
      const intro = document.createElement('p');
      intro.className = 'hint';
      intro.textContent = candidates.length === 1
        ? 'Encontré este número:'
        : 'Encontré estos números. Toca el correcto:';
      results.appendChild(intro);

      const list = document.createElement('div');
      list.className = 'cand-list';

      candidates.forEach((candidate) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cand';
        button.innerHTML =
          '<span class="cand-check">✓</span>' +
          '<span class="cand-body">' +
            '<span class="cand-num">' + esc(candidate.pretty) + '</span>' +
            '<span class="cand-sub">' + esc(candidate.e164) + '</span>' +
          '</span>';
        button.addEventListener('click', () => pickNumber(candidate));
        list.appendChild(button);
      });

      results.appendChild(list);
    }

    const rawWrap = $('#ocr-raw-wrap');
    const raw = $('#ocr-raw');
    if (raw) raw.value = text || '';
    if (rawWrap) rawWrap.hidden = !text;
  }

  function pickNumber(candidate) {
    const select = $('#cc');

    if (candidate.cc) {
      state.cc = candidate.cc;
      store.set('cc', candidate.cc);
      if (select) select.value = candidate.cc;
      const national = candidate.digits.indexOf(candidate.cc) === 0
        ? candidate.digits.slice(candidate.cc.length)
        : candidate.digits;
      $('#phone').value = national;
    } else {
      $('#phone').value = '+' + candidate.digits;
    }

    updatePhoneHint();
    closeSheet();
    toast('Número listo: ' + candidate.pretty);
  }

  function handleText(text) {
    const candidates = findNumbers(text, state.cc);
    resetSheet();
    openSheet();
    showOcrResults(text);

    if (!candidates.length) {
      toast('No encontré números en ese texto');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interfaz: envío                                                     */
  /* ------------------------------------------------------------------ */

  function updatePhoneHint() {
    const input = $('#phone');
    const hint = $('#phone-hint');
    if (!input || !hint) return;

    const value = input.value.trim();
    if (!value) {
      hint.textContent = 'Escribe el número o detéctalo desde una captura.';
      return;
    }

    const normalized = normalizePhone(value, state.cc);
    if (normalized) {
      hint.textContent = 'Se enviará a ' + prettyPhone(normalized.e164);
      hint.style.color = '';
    } else {
      hint.textContent = 'Ese número parece incompleto. Revisa los dígitos.';
      hint.style.color = 'var(--danger)';
    }
  }

  function currentMessage() {
    const area = $('#message');
    const raw = area ? area.value : '';
    return applyTokens(raw);
  }

  function collectForm() {
    const phone = normalizePhone($('#phone').value, state.cc);
    const message = currentMessage();
    return {
      phone: phone,
      message: message,
      company: ($('#company') && $('#company').value.trim()) || '',
      role: ($('#role') && $('#role').value.trim()) || ''
    };
  }

  function validateForm(form) {
    if (!form.phone) {
      toast('Escribe un número de WhatsApp válido');
      $('#phone').focus();
      return false;
    }
    if (!form.message) {
      toast('El mensaje está vacío');
      $('#message').focus();
      return false;
    }
    return true;
  }

  function onOpenChat() {
    const form = collectForm();
    if (!validateForm(form)) return;

    const entry = addHistory({
      phone: form.phone.e164,
      message: form.message,
      company: form.company,
      role: form.role
    });

    openWhatsApp(form.phone.digits, form.message);

    toast('Abriendo WhatsApp…', {
      action: { label: '¿Ya enviaste?', fn: () => {
        updateHistoryEntry(entry.id, { sent: true });
        toast('Guardada como enviada ✅');
      } }
    });
  }

  async function onShareBoth() {
    const form = collectForm();
    if (!validateForm(form)) return;

    if (!state.cv) {
      toast('Sube tu hoja de vida para enviarla');
      $('#file-cv').click();
      return;
    }

    const entry = addHistory({
      phone: form.phone.e164,
      message: form.message,
      company: form.company,
      role: form.role
    });

    const shared = await shareCVWithMessage(form.message);
    if (shared) {
      updateHistoryEntry(entry.id, { sent: true });
      toast('Elige el chat en WhatsApp y envía ✅');
    } else {
      // Si no se compartió, al menos se deja el chat listo.
      openWhatsApp(form.phone.digits, form.message);
      toast('Chat abierto. Adjunta el CV con el clip 📎');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Interfaz: ajustes e instalación                                     */
  /* ------------------------------------------------------------------ */

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function installHelp() {
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS) {
      const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
      if (!isSafari) {
        return 'En iPhone solo se puede instalar desde Safari. Abre esta página en Safari y toca Compartir ⤴ → “Añadir a pantalla de inicio”.';
      }
      return 'En Safari: toca Compartir ⤴ (abajo) y elige “Añadir a pantalla de inicio”.';
    }

    if (/Android/i.test(ua)) {
      return 'En Chrome: toca el menú ⋮ (arriba a la derecha) y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.';
    }
    return 'En Chrome o Edge: usa el icono de instalar que aparece en la barra de direcciones.';
  }

  let deferredPrompt = null;

  function showInstallUI() {
    if (isStandalone()) return;
    const banner = $('#install-banner');
    const mini = $('#btn-install-mini');
    if (mini) mini.hidden = false;
    if (banner && !store.get('bannerDismissed', false)) banner.hidden = false;
  }

  function hideInstallUI() {
    const banner = $('#install-banner');
    const mini = $('#btn-install-mini');
    if (banner) banner.hidden = true;
    if (mini) mini.hidden = true;
  }

  async function promptInstall() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice && choice.outcome === 'accepted') {
          hideInstallUI();
          toast('Instalada. Búscala en tu pantalla de inicio 🎉');
        }
      } catch (err) {
        toast(installHelp());
      }
      return;
    }
    toast(installHelp(), { duration: 7000 });
  }

  function renderSettings() {
    const name = $('#set-name');
    if (name && document.activeElement !== name) name.value = state.name;

    const help = $('#install-help');
    if (help) help.textContent = installHelp();

    renderTemplatesEditor();
  }

  /* ------------------------------------------------------------------ */
  /* Pestañas                                                            */
  /* ------------------------------------------------------------------ */

  function switchTab(name) {
    $$('.tab').forEach((tab) => {
      tab.setAttribute('aria-selected', tab.getAttribute('data-tab') === name ? 'true' : 'false');
    });
    $$('.view').forEach((view) => {
      view.hidden = view.id !== 'view-' + name;
    });
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ------------------------------------------------------------------ */
  /* Enlaces compartidos / atajos                                        */
  /* ------------------------------------------------------------------ */

  const SHARED_KEY_URL = () => new URL('/__shared', location.origin).href;

  async function handleSharedTarget() {
    const params = new URLSearchParams(location.search);

    if (params.get('shared') === '1' && 'caches' in window) {
      try {
        const cache = await caches.open('postula-shared');
        const response = await cache.match(SHARED_KEY_URL());
        if (response) {
          const blob = await response.blob();
          await cache.delete(SHARED_KEY_URL());
          const file = new File([blob], 'captura.png', { type: blob.type || 'image/png' });
          handleImage(file);
          return;
        }
      } catch (err) { /* sigue el flujo normal */ }
    }

    const phone = params.get('phone');
    if (phone) {
      $('#phone').value = phone;
      updatePhoneHint();
    }

    if (params.get('action') === 'scan') {
      toast('Toca “Escanear captura” para elegir la imagen', { duration: 5000 });
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    const secure = location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    if (!secure) return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  /* ------------------------------------------------------------------ */
  /* Eventos                                                             */
  /* ------------------------------------------------------------------ */

  function bindEvents() {
    // Pestañas
    $$('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    // País
    const cc = $('#cc');
    if (cc) {
      cc.addEventListener('change', () => {
        state.cc = cc.value;
        store.set('cc', cc.value);
        updatePhoneHint();
      });
    }

    // Número
    const phone = $('#phone');
    if (phone) {
      phone.addEventListener('input', updatePhoneHint);
      phone.addEventListener('blur', () => {
        const normalized = normalizePhone(phone.value, state.cc);
        if (normalized && !/^\s*\+/.test(phone.value)) {
          const national = normalized.digits.indexOf(state.cc) === 0
            ? normalized.digits.slice(state.cc.length)
            : normalized.digits;
          phone.value = national;
        }
        updatePhoneHint();
      });
      phone.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onOpenChat();
        }
      });
    }

    // Escanear
    const scan = $('#btn-scan');
    if (scan) scan.addEventListener('click', () => $('#file-image').click());

    const fileImage = $('#file-image');
    if (fileImage) {
      fileImage.addEventListener('change', () => {
        const file = fileImage.files && fileImage.files[0];
        fileImage.value = '';
        if (file) handleImage(file);
      });
    }

    // Pegar
    const paste = $('#btn-paste');
    if (paste) paste.addEventListener('click', onPaste);

    // Mensaje
    const message = $('#message');
    if (message) {
      message.addEventListener('input', () => { state.messageDirty = true; });
    }

    const templateSelect = $('#template');
    if (templateSelect) {
      templateSelect.addEventListener('change', () => {
        state.activeTemplate = templateSelect.value;
        store.set('activeTemplate', templateSelect.value);
        applyActiveTemplate();
      });
    }

    ['#company', '#role'].forEach((selector) => {
      const field = $(selector);
      if (field) {
        field.addEventListener('input', () => {
          if (!state.messageDirty) refreshMessageFromTemplate();
        });
      }
    });

    // Botones principales
    const open = $('#btn-open');
    if (open) open.addEventListener('click', onOpenChat);

    const share = $('#btn-share');
    if (share) share.addEventListener('click', onShareBoth);

    // CV
    const cvUpload = $('#btn-cv-upload');
    if (cvUpload) cvUpload.addEventListener('click', () => $('#file-cv').click());

    const fileCV = $('#file-cv');
    if (fileCV) {
      fileCV.addEventListener('change', () => {
        const file = fileCV.files && fileCV.files[0];
        fileCV.value = '';
        if (file) saveCV(file);
      });
    }

    const cvCard = $('#cv-card');
    if (cvCard) {
      cvCard.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        if (state.cv) {
          shareCVWithMessage(currentMessage());
        } else {
          $('#file-cv').click();
        }
      });
    }

    // Historial
    const histList = $('#hist-list');
    if (histList) {
      histList.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-act]');
        if (!button) return;
        const item = button.closest('.hist');
        if (!item) return;
        const entry = state.history.find((e) => e.id === item.getAttribute('data-id'));
        if (!entry) return;

        const action = button.getAttribute('data-act');

        if (action === 'reopen') {
          openWhatsApp(entry.phone, entry.message);
          toast('Abriendo el chat…');
        } else if (action === 'share-cv') {
          const shared = await shareCVWithMessage(entry.message);
          if (shared) updateHistoryEntry(entry.id, { sent: true });
        } else if (action === 'toggle') {
          updateHistoryEntry(entry.id, { sent: !entry.sent });
        } else if (action === 'delete') {
          state.history = state.history.filter((e) => e.id !== entry.id);
          store.set('history', state.history);
          renderHistory();
        }
      });
    }

    const clearHistory = $('#btn-clear-history');
    if (clearHistory) {
      clearHistory.addEventListener('click', () => {
        if (!state.history.length) return;
        if (window.confirm('¿Borrar todo el historial de aplicaciones?')) {
          state.history = [];
          store.set('history', state.history);
          renderHistory();
        }
      });
    }

    // Ajustes: nombre
    const setName = $('#set-name');
    if (setName) {
      setName.addEventListener('input', () => {
        state.name = setName.value.trim();
        store.set('name', state.name);
        if (!state.messageDirty) refreshMessageFromTemplate();
      });
    }

    // Ajustes: plantillas
    const newTpl = $('#btn-new-tpl');
    if (newTpl) {
      newTpl.addEventListener('click', () => {
        const tpl = {
          id: uid(),
          name: 'Plantilla ' + (state.templates.length + 1),
          body: '¡Hola! Buen día. Vi su publicación y me gustaría postularme. Adjunto mi hoja de vida. ¡Gracias!'
        };
        state.templates.push(tpl);
        store.set('templates', state.templates);
        renderTemplatesEditor();
        renderTemplateSelect();
        const node = $('#tpl-list details[data-id="' + tpl.id + '"]');
        if (node) {
          node.open = true;
          const input = node.querySelector('.tpl-title');
          if (input) input.focus();
        }
      });
    }

    const tplList = $('#tpl-list');
    if (tplList) {
      tplList.addEventListener('input', (event) => {
        const details = event.target.closest('details.tpl');
        if (!details) return;
        const tpl = state.templates.find((t) => t.id === details.getAttribute('data-id'));
        if (!tpl) return;

        if (event.target.classList.contains('tpl-title')) {
          tpl.name = event.target.value.slice(0, 48) || 'Sin nombre';
          const summary = details.querySelector('summary');
          if (summary) summary.textContent = tpl.name;
        } else if (event.target.classList.contains('tpl-body-input')) {
          tpl.body = event.target.value;
        } else {
          return;
        }
        store.set('templates', state.templates);
        renderTemplateSelect();
      });

      tplList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-act]');
        if (!button) return;
        const details = button.closest('details.tpl');
        if (!details) return;
        const id = details.getAttribute('data-id');
        const tpl = state.templates.find((t) => t.id === id);
        if (!tpl) return;

        const action = button.getAttribute('data-act');

        if (action === 'del-tpl') {
          if (state.templates.length <= 1) {
            toast('Deja al menos una plantilla');
            return;
          }
          if (!window.confirm('¿Eliminar la plantilla “' + tpl.name + '”?')) return;
          state.templates = state.templates.filter((t) => t.id !== id);
          if (state.activeTemplate === id) state.activeTemplate = state.templates[0].id;
          store.set('templates', state.templates);
          store.set('activeTemplate', state.activeTemplate);
          renderTemplatesEditor();
          renderTemplateSelect();
          applyActiveTemplate();
        } else if (action === 'use-tpl') {
          state.activeTemplate = id;
          store.set('activeTemplate', id);
          renderTemplateSelect();
          applyActiveTemplate();
          switchTab('send');
          toast('Plantilla aplicada');
        }
      });
    }

    // Instalar
    ['#btn-install', '#btn-install-banner', '#btn-install-mini'].forEach((selector) => {
      const button = $(selector);
      if (button) button.addEventListener('click', promptInstall);
    });

    const dismiss = $('#btn-dismiss-banner');
    if (dismiss) {
      dismiss.addEventListener('click', () => {
        store.set('bannerDismissed', true);
        $('#install-banner').hidden = true;
      });
    }

    // Reset
    const reset = $('#btn-reset');
    if (reset) {
      reset.addEventListener('click', async () => {
        if (!window.confirm('Se borrarán el CV, el historial y las plantillas de este teléfono. ¿Continuar?')) return;
        ['cc', 'name', 'templates', 'activeTemplate', 'history', 'bannerDismissed'].forEach(store.remove);
        try { await idbDel('cv'); } catch (err) {}
        state.name = '';
        state.templates = DEFAULT_TEMPLATES.slice();
        state.activeTemplate = 'general';
        state.history = [];
        state.cv = null;
        state.messageDirty = false;
        renderCV();
        renderTemplateSelect();
        applyActiveTemplate();
        renderHistory();
        renderSettings();
        updatePhoneHint();
        toast('Datos borrados');
      });
    }

    // Hoja de escaneo
    const close = $('#ocr-close');
    if (close) close.addEventListener('click', closeSheet);

    const modal = $('#ocr-modal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeSheet();
      });
    }

    const manual = $('#ocr-manual');
    if (manual) {
      manual.addEventListener('click', () => {
        closeSheet();
        $('#phone').focus();
      });
    }

    const rawExtract = $('#ocr-raw-extract');
    if (rawExtract) {
      rawExtract.addEventListener('click', () => {
        const text = $('#ocr-raw').value;
        showOcrResults(text);
      });
    }

    // Pegar imagen desde el teclado / escritorio
    document.addEventListener('paste', (event) => {
      const items = (event.clipboardData && event.clipboardData.items) || [];
      for (let i = 0; i < items.length; i += 1) {
        if (items[i].type && /^image\//.test(items[i].type)) {
          const file = items[i].getAsFile();
          if (file) {
            event.preventDefault();
            handleImage(file);
            return;
          }
        }
      }
    });

    // Instalación
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      showInstallUI();
    });

    window.addEventListener('appinstalled', () => {
      hideInstallUI();
      toast('App instalada 🎉');
    });

    // Escape cierra la hoja
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#ocr-modal').hidden) closeSheet();
    });
  }

  async function onPaste() {
    // 1) Intentar una imagen del portapapeles (no disponible en iOS).
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (let i = 0; i < items.length; i += 1) {
          const item = items[i];
          const imageType = (item.types || []).find((type) => /^image\//.test(type));
          if (imageType) {
            const blob = await item.getType(imageType);
            handleImage(new File([blob], 'pegado.' + imageType.split('/')[1], { type: imageType }));
            return;
          }
        }
      }
    } catch (err) { /* iOS no permite leer imágenes; seguimos con texto */ }

    // 2) Texto copiado (funciona en iPhone con Safari).
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const candidates = findNumbers(text, state.cc);
          if (candidates.length === 1) {
            pickNumber(candidates[0]);
          } else if (candidates.length > 1) {
            handleText(text);
          } else {
            toast('No encontré números en lo que copiaste');
          }
          return;
        }
      }
    } catch (err) {
      toast('iPhone no dejó leer el portapapeles. Usa “Escanear”.');
      return;
    }

    toast('No hay nada pegado. Copia un número o una captura primero.');
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  function buildCountrySelect() {
    const select = $('#cc');
    if (!select) return;

    select.innerHTML = COUNTRIES.map((c) => {
      return '<option value="' + esc(c.code) + '">' + c.flag + ' +' + esc(c.code) + '</option>';
    }).join('');

    if (!COUNTRIES.some((c) => c.code === state.cc)) state.cc = '57';
    select.value = state.cc;
  }

  function init() {
    buildCountrySelect();
    bindEvents();

    renderTemplateSelect();
    applyActiveTemplate();
    updatePhoneHint();

    renderHistory();
    renderSettings();
    loadCV();

    if (!store.get('bannerDismissed', false)) {
      setTimeout(() => {
        if (!isStandalone() && !deferredPrompt) showInstallUI();
        else if (!isStandalone()) showInstallUI();
      }, 1200);
    }

    if (isStandalone()) hideInstallUI();

    handleSharedTarget();
    registerServiceWorker();
    updatePhoneHint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
