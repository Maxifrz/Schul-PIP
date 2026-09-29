// Small DOM helpers: elements, sheets, toasts.

/** h('button.pill', { onclick }, 'Text', child…) */
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'html') el.innerHTML = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

let toastTimer = null;

export function toast(text) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = h('div.toast', {}, text);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

/** A modal sheet; `build(close)` returns its content. Resolves when closed. */
export function sheet(build) {
  return new Promise((resolve) => {
    const scrim = h('div.scrim');
    const close = (value) => {
      scrim.remove();
      resolve(value);
    };
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) close(null);
    });
    scrim.append(h('div.sheet', {}, build(close)));
    document.body.append(scrim);
  });
}

/** Asks for a line of text. */
export function prompt(title, value = '', confirm = 'OK') {
  return sheet((close) => {
    const input = h('input', { type: 'text', value });
    setTimeout(() => input.focus(), 50);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value.trim() || null);
    });
    return [
      h('h2', {}, title),
      input,
      h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Abbrechen'), h('button.pill.primary', { onclick: () => close(input.value.trim() || null) }, confirm)),
    ];
  });
}

export function confirmSheet(title, text, confirm = 'OK') {
  return sheet((close) => [
    h('h2', {}, title),
    h('p', { style: { color: 'var(--muted)', margin: '0 0 6px', lineHeight: '1.45' } }, text),
    h('div.actions', {}, h('button.pill', { onclick: () => close(false) }, 'Abbrechen'), h('button.pill.primary', { onclick: () => close(true) }, confirm)),
  ]);
}

/** A segmented two- or more-way switch. */
export function toggle(options, current, onChange) {
  const el = h('div.toggle');
  const render = (value) => {
    el.replaceChildren(...options.map(([key, label]) => h('button', { 'aria-pressed': String(key === value), onclick: () => { render(key); onChange(key); } }, label)));
  };
  render(current);
  return el;
}
