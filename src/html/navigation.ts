import { createHash } from 'node:crypto';

// Serialized as one static script: never interpolate document data into JavaScript.
function enhanceNavigation() {
  const root = document.documentElement;
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  if (!nav) return;
  try {
    const mobile = window.matchMedia('(max-width: 800px)');
    const links = [
      ...nav.querySelectorAll<HTMLAnchorElement>('[data-section]'),
    ];
    const entries = links.flatMap((link) => {
      const heading = document.getElementById(link.dataset.section!);
      return heading ? [{ link, heading }] : [];
    });
    let open = false;
    function sync() {
      if (!toggle) return;
      const visible = !mobile.matches || open;
      if (!mobile.matches && document.activeElement === toggle)
        entries[0]?.link.focus();
      toggle.hidden = !mobile.matches;
      if (!visible && nav!.contains(document.activeElement)) toggle.focus();
      nav!.dataset.open = String(visible);
      toggle.setAttribute('aria-expanded', String(visible));
      toggle.textContent = visible ? '關閉目錄' : '開啟目錄';
    }
    toggle?.addEventListener('click', () => {
      open = !open;
      sync();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !toggle || !mobile.matches || !open) return;
      if (
        nav.contains(document.activeElement) ||
        document.activeElement === toggle
      ) {
        open = false;
        sync();
        toggle.focus();
      }
    });
    for (const { link, heading } of entries) {
      link.addEventListener('click', (event) => {
        if (
          event.button ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        open = false;
        sync();
      });
    }
    let scheduled = false;
    function update() {
      scheduled = false;
      let current = entries[0];
      for (const entry of entries) {
        if (entry.heading.getBoundingClientRect().top <= 120) current = entry;
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
      ) {
        current = entries.at(-1);
      }
      for (const entry of entries) {
        if (entry === current)
          entry.link.setAttribute('aria-current', 'location');
        else entry.link.removeAttribute('aria-current');
      }
    }
    function schedule() {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    }
    mobile.addEventListener('change', () => {
      open = false;
      sync();
      schedule();
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', schedule);
    window.addEventListener('pageshow', schedule);
    window.addEventListener('semloom:viewchange', schedule);
    sync();
    root.dataset.navReady = 'true';
    update();
  } catch {
    // Progressive enhancement failure must leave the static TOC reachable.
    delete root.dataset.navReady;
    if (toggle) toggle.hidden = true;
    nav.dataset.open = 'true';
  }
}

export const navigationScript = `(${enhanceNavigation.toString()})();`;
export const navigationHash = createHash('sha256')
  .update(navigationScript)
  .digest('base64');
