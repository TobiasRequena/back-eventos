const escapeHtml = require('./escapeHtml');

/**
 * Descripción del evento (texto con marcas del front) -> HTML seguro para mail.
 * Marcas que se activan/desactivan: **negrita**, *cursiva*, ~~tachado~~. `\` escapa
 * un caracter. `[texto](https://url)` es un link. Una línea que empieza con "- " es item de
 * lista. Las URLs http(s) sueltas también son links.
 * Mantener alineado con el parser de front-eventos (lib/descripcionFormato.js).
 * Se escapa el HTML ANTES de parsear, así ningún tag del usuario llega al mail.
 */
const ENLACE = /\[((?:\\.|[^\]\\])*)\]\((https?:\/\/[^\s)]+)\)/y;

function parsear(texto) {
  const runs = [];
  let f = { b: false, i: false, s: false };
  let enlace = null; // { href, fin }: fin = índice del "]" que cierra el texto del link
  let buf = '';
  const cortar = () => {
    if (buf) runs.push({ t: buf, ...f, href: enlace?.href });
    buf = '';
  };
  for (let k = 0; k < texto.length; k++) {
    if (enlace && k === enlace.fin) {
      cortar();
      k += 2 + enlace.href.length; // salta "](url)"; el for suma el último
      enlace = null;
      continue;
    }
    const c = texto[k];
    let m = null;
    if (c === '[' && !enlace) {
      ENLACE.lastIndex = k;
      m = ENLACE.exec(texto);
    }
    if (c === '\\' && k + 1 < texto.length) buf += texto[++k];
    else if (c === '*' && texto[k + 1] === '*') { cortar(); f = { ...f, b: !f.b }; k++; }
    else if (c === '~' && texto[k + 1] === '~') { cortar(); f = { ...f, s: !f.s }; k++; }
    else if (c === '*') { cortar(); f = { ...f, i: !f.i }; }
    else if (m) { cortar(); enlace = { href: m[2], fin: k + 1 + m[1].length }; }
    else buf += c;
  }
  cortar();
  return runs;
}

// `t` ya viene escapado: los &lt; &gt; &quot; cortan la URL para no arrastrar el cierre de un "<url>".
const URL_RE = /(https?:\/\/(?:(?!&(?:lt|gt|quot);)[^\s])+)/;

function conLinks(t) {
  return t
    .split(URL_RE)
    .map((parte, k) => {
      if (k % 2 === 0) return parte;
      const [, url, resto] = parte.match(/^(.*?)([.,;:!?)]*)$/);
      return `<a href="${url}" style="color: #1E3A5F;">${url}</a>${resto}`;
    })
    .join('');
}

function descripcionAHtml(texto) {
  if (!texto) return '';
  const lineas = [{ lista: false, html: '' }];
  for (const r of parsear(escapeHtml(texto))) {
    r.t.split('\n').forEach((t, k) => {
      if (k > 0) lineas.push({ lista: false, html: '' });
      if (!t) return;
      // r.href ya viene escapado (el texto entero se escapó antes de parsear).
      let h = r.href ? `<a href="${r.href}" style="color: #1E3A5F;">${t}</a>` : conLinks(t);
      if (r.s) h = `<s>${h}</s>`;
      if (r.i) h = `<em>${h}</em>`;
      if (r.b) h = `<strong>${h}</strong>`;
      lineas[lineas.length - 1].html += h;
    });
  }
  // "- " puede quedar dentro de un tag de formato (ej. `**- x**`): solo se detecta al inicio de la línea.
  for (const l of lineas) {
    if (l.html.startsWith('- ')) {
      l.lista = true;
      l.html = l.html.slice(2);
    }
  }
  return lineas
    .map((l, k) => {
      if (l.lista) {
        return (lineas[k - 1]?.lista ? '' : '<ul style="margin: 4px 0; padding-left: 20px;">')
          + `<li>${l.html}</li>`
          + (lineas[k + 1]?.lista ? '' : '</ul>');
      }
      return l.html + (lineas[k + 1] && !lineas[k + 1].lista ? '<br>' : '');
    })
    .join('');
}

module.exports = descripcionAHtml;
