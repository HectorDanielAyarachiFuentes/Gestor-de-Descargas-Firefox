/**
 * icons.js - Sistema centralizado de iconos vectoriales SVG de alta definición (Lucide Standard)
 * Reemplaza emojis con iconos vectoriales geométricamente coherentes (24x24 viewBox, stroke-width 2, round caps/joins).
 */

/**
 * Genera un SVG con atributos estándar de Lucide
 */
function createSvg(content, { size = 16, stroke = 'currentColor', fill = 'none', strokeWidth = 2, className = '' } = {}) {
  const cls = className ? ` class="${className}"` : '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${cls}>${content}</svg>`;
}

// ==========================================
// ICONOS DE TIPOS DE ARCHIVO (Coloridos y Nítidos)
// ==========================================

export const FILE_ICONS = {
  // Documentos de Texto y PDFs
  document: (size = 18) => createSvg(
    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`,
    { size, stroke: '#3b82f6', className: 'file-icon file-icon-document' }
  ),

  pdf: (size = 18) => createSvg(
    `<path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M5 12V5a2 2 0 0 1 2-2h7l5 5v4"></path><path d="M5 18h1.5a1.5 1.5 0 0 0 0-3H5v6"></path><path d="M17 18h2"></path><path d="M20 15h-3v6"></path><path d="M11 15v6h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-1z"></path>`,
    { size, stroke: '#ef4444', strokeWidth: 1.8, className: 'file-icon file-icon-pdf' }
  ),

  // Imágenes
  image: (size = 18) => createSvg(
    `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>`,
    { size, stroke: '#06b6d4', className: 'file-icon file-icon-image' }
  ),

  // Videos
  video: (size = 18) => createSvg(
    `<rect x="2" y="4" width="20" height="16" rx="2.18" ry="2.18"></rect><line x1="7" y1="4" x2="7" y2="20"></line><line x1="17" y1="4" x2="17" y2="20"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line>`,
    { size, stroke: '#8b5cf6', className: 'file-icon file-icon-video' }
  ),

  // Audio / Música
  audio: (size = 18) => createSvg(
    `<path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle>`,
    { size, stroke: '#ec4899', className: 'file-icon file-icon-audio' }
  ),

  // Archivos Comprimidos / Paquetes
  compressed: (size = 18) => createSvg(
    `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
    { size, stroke: '#f59e0b', className: 'file-icon file-icon-compressed' }
  ),

  // Hojas de Cálculo
  spreadsheet: (size = 18) => createSvg(
    `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h2"></path><path d="M8 17h2"></path><path d="M14 13h2"></path><path d="M14 17h2"></path>`,
    { size, stroke: '#10b981', className: 'file-icon file-icon-spreadsheet' }
  ),

  // Presentaciones
  presentation: (size = 18) => createSvg(
    `<path d="M2 3h20"></path><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"></path><path d="m7 21 5-5 5 5"></path>`,
    { size, stroke: '#f97316', className: 'file-icon file-icon-presentation' }
  ),

  // Programas y Ejecutables
  program: (size = 18) => createSvg(
    `<rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>`,
    { size, stroke: '#64748b', className: 'file-icon file-icon-program' }
  ),

  // Diseño Gráfico
  design: (size = 18) => createSvg(
    `<circle cx="13.5" cy="6.5" r=".5"></circle><circle cx="17.5" cy="10.5" r=".5"></circle><circle cx="8.5" cy="7.5" r=".5"></circle><circle cx="6.5" cy="12.5" r=".5"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>`,
    { size, stroke: '#d946ef', className: 'file-icon file-icon-design' }
  ),

  // Código
  code: (size = 18) => createSvg(
    `<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>`,
    { size, stroke: '#6366f1', className: 'file-icon file-icon-code' }
  ),

  // Libros / E-books
  book: (size = 18) => createSvg(
    `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>`,
    { size, stroke: '#a855f7', className: 'file-icon file-icon-book' }
  ),

  // Modelos 3D
  threed: (size = 18) => createSvg(
    `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline><polyline points="7.5 19.79 7.5 14.6 3 12"></polyline><polyline points="21 12 16.5 14.6 16.5 19.79"></polyline><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>`,
    { size, stroke: '#14b8a6', className: 'file-icon file-icon-3d' }
  ),

  // Fuentes Tipográficas
  font: (size = 18) => createSvg(
    `<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>`,
    { size, stroke: '#eab308', className: 'file-icon file-icon-font' }
  ),

  // Correos Electrónicos
  email: (size = 18) => createSvg(
    `<rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>`,
    { size, stroke: '#0ea5e9', className: 'file-icon file-icon-email' }
  ),

  // Diagramas
  diagram: (size = 18) => createSvg(
    `<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>`,
    { size, stroke: '#06b6d4', className: 'file-icon file-icon-diagram' }
  ),

  // Bases de Datos
  database: (size = 18) => createSvg(
    `<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>`,
    { size, stroke: '#3b82f6', className: 'file-icon file-icon-database' }
  ),

  // Certificados y Claves
  certificate: (size = 18) => createSvg(
    `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline>`,
    { size, stroke: '#10b981', className: 'file-icon file-icon-certificate' }
  ),

  // CAD
  cad: (size = 18) => createSvg(
    `<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>`,
    { size, stroke: '#f97316', className: 'file-icon file-icon-cad' }
  ),

  // Fallback Genérico
  file: (size = 18) => createSvg(
    `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>`,
    { size, stroke: '#94a3b8', className: 'file-icon file-icon-generic' }
  )
};

// ==========================================
// MAPEO DE EXTENSIONES -> ICONOS SVG
// ==========================================

const EXTENSION_MAP = {
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', txt: 'document', md: 'document', rtf: 'document', pages: 'document',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', tiff: 'image', heic: 'image', raw: 'image', bmp: 'image', ico: 'image', avif: 'image',
  mp4: 'video', mkv: 'video', avi: 'video', webm: 'video', mov: 'video', flv: 'video', ts: 'video', m3u8: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio', aac: 'audio',
  zip: 'compressed', rar: 'compressed', '7z': 'compressed', tar: 'compressed', gz: 'compressed', bz2: 'compressed', xz: 'compressed',
  xls: 'spreadsheet', xlsx: 'spreadsheet', csv: 'spreadsheet', ods: 'spreadsheet', tsv: 'spreadsheet', numbers: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
  exe: 'program', msi: 'program', apk: 'program', appx: 'program', bat: 'program', cmd: 'program', sh: 'program', dmg: 'program', pkg: 'program', iso: 'program', img: 'program',
  psd: 'design', ai: 'design', indd: 'design', blend: 'design', fig: 'design', cdr: 'design',
  html: 'code', css: 'code', js: 'code', ts: 'code', json: 'code', xml: 'code', py: 'code', java: 'code', cpp: 'code', php: 'code', sql: 'code',
  epub: 'book', mobi: 'book', azw3: 'book', cbz: 'book', cbr: 'book',
  stl: 'threed', obj: 'threed', fbx: 'threed', gcode: 'threed',
  ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
  eml: 'email', msg: 'email', pst: 'email', ost: 'email', vcf: 'email',
  vsd: 'diagram', vsdx: 'diagram', drawio: 'diagram', xmind: 'diagram', mm: 'diagram',
  sqlite: 'database', db: 'database', accdb: 'database', mdb: 'database', bak: 'database',
  crt: 'certificate', pem: 'certificate', pfx: 'certificate', p12: 'certificate', cer: 'certificate', key: 'certificate', ovpn: 'certificate',
  dwg: 'cad', dxf: 'cad'
};

/**
 * Retorna el SVG de alta resolución correspondiente al nombre de archivo
 */
export function getFileTypeSvg(filename, size = 18) {
  if (!filename) return FILE_ICONS.file(size);
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const iconKey = EXTENSION_MAP[ext] || 'file';
  const iconFn = FILE_ICONS[iconKey] || FILE_ICONS.file;
  return iconFn(size);
}

// ==========================================
// ICONOS DE INTERFAZ (UI Actions & Indicators)
// ==========================================

export function getFolderSvg(size = 14, color = 'currentColor', className = 'inline-icon-folder') {
  return createSvg(
    `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>`,
    { size, stroke: color, className }
  );
}

export function getFolderOpenSvg(size = 14, color = 'currentColor', className = 'inline-icon-folder-open') {
  return createSvg(
    `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="12 11 12 17 15 14"></polyline>`,
    { size, stroke: color, className }
  );
}

export function getRefreshSvg(size = 14, color = 'currentColor', className = 'inline-icon-refresh') {
  return createSvg(
    `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M3 21v-5h5"></path>`,
    { size, stroke: color, className }
  );
}

export function getHardDriveSvg(size = 13, color = 'currentColor', className = 'inline-icon-disk') {
  return createSvg(
    `<line x1="22" y1="12" x2="2" y2="12"></line><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path><line x1="6" y1="16" x2="6.01" y2="16"></line><line x1="10" y1="16" x2="10.01" y2="16"></line>`,
    { size, stroke: color, className }
  );
}

export function getMaximizeSvg(size = 13, color = 'currentColor', className = 'inline-icon-dims') {
  return createSvg(
    `<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>`,
    { size, stroke: color, className }
  );
}

export function getXSvg(size = 12, color = 'currentColor', className = 'inline-icon-x') {
  return createSvg(
    `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`,
    { size, stroke: color, className }
  );
}

export function getCopySvg(size = 13, color = 'currentColor', className = 'inline-icon-copy') {
  return createSvg(
    `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`,
    { size, stroke: color, className }
  );
}
