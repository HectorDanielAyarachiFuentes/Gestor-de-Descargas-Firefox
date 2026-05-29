import { setThemePreference } from './theme-manager.js';
import { setHTML } from './utils.js';
const api = typeof browser !== 'undefined' ? browser : chrome;

export function setupTabs() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      tabLinks.forEach(item => item.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      link.classList.add('active');
      const targetId = link.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

export async function loadThemeSelector() {
  const themeButtons = document.querySelectorAll('.theme-btn');
  const data = await api.storage.sync.get({ theme: 'auto' });
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === data.theme);
  });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const newTheme = btn.dataset.theme;
      await setThemePreference(newTheme);
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showStatus(api.i18n.getMessage("statusThemeChanged"), "success");
    });
  });
}

export function showStatus(message, type = 'info') {
  const statusElement = document.getElementById("status");
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }
  setHTML(statusElement, `${iconSvg} <span>${message}</span>`);
  statusElement.className = `status ${type} visible`;
  if (statusElement.timeoutId) clearTimeout(statusElement.timeoutId);
  statusElement.timeoutId = setTimeout(() => {
    statusElement.classList.remove('visible');
  }, 3000);
}

export function initTearEffect() {
  const audio = document.querySelector('.about-audio');
  if (!audio) return;

  const overlay = document.createElement('div');
  overlay.id = 'tear-overlay';
  overlay.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9990;overflow:hidden;`;
  document.body.appendChild(overlay);

  let tears = [];
  let spawnInterval = null;
  let animFrameId = null;
  let mouseX = -9999;
  let mouseY = -9999;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
  });

  function createTear() {
    const size = 15 + Math.random() * 18;
    const x = Math.random() * window.innerWidth;
    const opacity = 0.7 + Math.random() * 0.3;
    const hue = 195 + Math.random() * 30;
    const dropId = Math.random().toString(36).substring(2, 9);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 30 40');
    svg.style.cssText = `position:absolute;left:${x}px;top:-50px;width:${size}px;height:${size * 1.33}px;opacity:${opacity};will-change:transform, left, top;filter:drop-shadow(0 4px 8px hsla(${hue}, 80%, 50%, 0.4));pointer-events:none;`;
    const svgContent = `
      <defs>
        <radialGradient id="dropGrad-${dropId}" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="hsla(${hue}, 100%, 95%, 0.9)"/>
          <stop offset="40%" stop-color="hsla(${hue}, 85%, 65%, 0.5)"/>
          <stop offset="100%" stop-color="hsla(${hue}, 80%, 45%, 0.8)"/>
        </radialGradient>
      </defs>
      <path d="M15 2 C15 2 3 18 3 26 C3 32.6 8.4 38 15 38 C21.6 38 27 32.6 27 26 C27 18 15 2 15 2Z" fill="url(#dropGrad-${dropId})"/>
      <path d="M8 25 C8 18 11 11 14 7 C10 13 6 20 8 25Z" fill="rgba(255,255,255,0.7)"/>
      <path d="M19 34 C22 31 24 27 24 24 C24 28 22 33 19 34Z" fill="rgba(255,255,255,0.4)"/>
      <ellipse cx="10" cy="18" rx="2" ry="3" fill="rgba(255,255,255,0.9)" transform="rotate(-30 10 18)"/>
    `;
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${svgContent}</svg>`, "image/svg+xml");
    while (doc.documentElement.firstChild) {
      svg.appendChild(doc.documentElement.firstChild);
    }
    overlay.appendChild(svg);
    tears.push({ el: svg, x, y: -40, vx: (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random() * 1.8, wobble: Math.random() * Math.PI * 2, size });
  }

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    tears.forEach((t, i) => {
      t.wobble += 0.025;
      t.vx += Math.sin(t.wobble) * 0.04;
      t.vx *= 0.96;
      const dx = t.x - mouseX, dy = t.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const force = ((180 - dist) / 180) * 4;
        t.vx += (dx / dist) * force; t.vy += (dy / dist) * force * 0.6;
      }
      t.vy += 0.08; t.vy *= 1.01;
      t.x += t.vx; t.y += t.vy;
      const angle = Math.atan2(t.vx, Math.max(t.vy, 0.5)) * (180 / Math.PI) * 0.5;
      const stretch = Math.min(1 + t.vy * 0.02, 1.8);
      t.el.style.left = `${t.x}px`; t.el.style.top = `${t.y}px`;
      t.el.style.transform = `rotate(${angle}deg) scale(${1 / stretch}, ${stretch})`;
      if (t.y > window.innerHeight + 60 || t.x < -60 || t.x > window.innerWidth + 60) {
        t.el.remove(); tears.splice(i, 1);
      }
    });
  }

  audio.addEventListener('play', () => {
    if (spawnInterval) return;
    spawnInterval = setInterval(createTear, 350);
    if (!animFrameId) animate();
  });

  audio.addEventListener('pause', () => {
    clearInterval(spawnInterval); spawnInterval = null;
    const checkEmpty = setInterval(() => {
      if (tears.length === 0) { cancelAnimationFrame(animFrameId); animFrameId = null; clearInterval(checkEmpty); }
    }, 500);
  });

  audio.addEventListener('ended', () => { clearInterval(spawnInterval); spawnInterval = null; });
}
