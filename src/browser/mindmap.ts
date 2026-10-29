import { Markmap } from 'markmap-view';
import type { HierarchyNode } from '../core/types.js';
import { toMindmapNode } from './hierarchy.js';

interface Entry {
  id: string;
  root: HierarchyNode;
}
const svgNS = 'http://www.w3.org/2000/svg';

async function enhance(entry: Entry, index: number) {
  const block = document.getElementById(entry.id);
  const wrapper = block?.querySelector<HTMLElement>(
    '.semloom-hierarchy-mindmap',
  );
  const diagram = wrapper?.querySelector<HTMLElement>(
    '.semloom-mindmap-diagram',
  );
  if (!wrapper || !diagram) return;
  const controller = new AbortController();
  let map: Markmap | undefined;
  let failed = false;
  const restore = () => {
    if (failed) return;
    failed = true;
    controller.abort();
    wrapper.removeAttribute('data-mindmap-ready');
    diagram.hidden = true;
    diagram.style.removeProperty('visibility');
    try {
      map?.destroy();
    } catch {
      /* Restore the readable tree even if disposal fails. */
    }
    diagram.replaceChildren();
  };
  try {
    diagram.hidden = false;
    diagram.style.visibility = 'hidden';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', '心智圖');
    svg.setAttribute('width', String(Math.max(1, diagram.clientWidth)));
    svg.setAttribute('height', '300');
    diagram.append(svg);
    const css = getComputedStyle(wrapper);
    const colors = Array.from(
      { length: 6 },
      (_, i) =>
        css.getPropertyValue(`--semloom-mindmap-branch-${i + 1}`).trim() ||
        css.getPropertyValue('--accent').trim(),
    );
    const branches = new Map<string, number>();
    map = new Markmap(svg, {
      id: `semloom-mm-${index}`,
      zoom: false,
      pan: false,
      autoFit: false,
      duration: 0,
      initialExpandLevel: -1,
      maxWidth: 224,
      color: (node) => {
        const branch = node.state.path.split('.')[1];
        if (!branch) return css.getPropertyValue('--accent').trim();
        if (!branches.has(branch))
          branches.set(branch, branches.size % colors.length);
        return colors[branches.get(branch)!]!;
      },
    });
    const instance = map;
    const print = window.matchMedia('print');
    function sync() {
      const { x1, x2, y1, y2 } = instance.state.rect;
      const width = Math.ceil(x2 - x1 + 32),
        height = Math.ceil(y2 - y1 + 32);
      svg.setAttribute('viewBox', `${x1 - 16} ${y1 - 16} ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      const byPath = new Map<string, NonNullable<Markmap['state']['data']>>();
      function visit(node: NonNullable<Markmap['state']['data']>) {
        byPath.set(node.state.path, node);
        node.children.forEach(visit);
      }
      if (instance.state.data) visit(instance.state.data);
      const groups = [...svg.querySelectorAll<SVGGElement>('g.markmap-node')];
      const byGroupPath = new Map(
        groups.map((group) => [group.getAttribute('data-path'), group]),
      );
      const ordered = [...byPath.keys()].flatMap(
        (path) => byGroupPath.get(path) ?? [],
      );
      // Markmap draws node groups in postorder. Keep its geometry while exposing
      // the semantic parent-first order, preserving focus across DOM moves.
      if (ordered.some((group, i) => group !== groups[i])) {
        const active = document.activeElement;
        ordered[0]?.parentElement?.append(...ordered);
        if (active instanceof SVGElement && svg.contains(active))
          active.focus({ preventScroll: true });
      }
      for (const circle of svg.querySelectorAll<SVGCircleElement>(
        'g.markmap-node > circle',
      )) {
        const node = circle.parentElement!;
        const data = byPath.get(node.getAttribute('data-path')!)!;
        const label = node.querySelector('foreignObject')?.textContent ?? '';
        const expanded = !data.payload?.fold;
        circle.setAttribute('role', 'button');
        circle.setAttribute('tabindex', '0');
        circle.setAttribute(
          'aria-label',
          `${expanded ? '收合' : '展開'} ${label}`,
        );
        circle.setAttribute('aria-expanded', String(expanded));
        if (!circle.hasAttribute('data-semloom-toggle')) {
          circle.setAttribute('data-semloom-toggle', '');
          circle.addEventListener(
            'keydown',
            (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                circle.dispatchEvent(
                  new MouseEvent('click', { bubbles: true }),
                );
              }
            },
            { signal: controller.signal },
          );
        }
      }
    }
    const render = instance.renderData.bind(instance);
    instance.renderData = async (...args) => {
      if (failed || print.matches) return;
      try {
        await render(...args);
        sync();
      } catch {
        restore();
      }
    };
    await instance.setData(toMindmapNode(entry.root));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    if (failed) return;
    sync();
    wrapper.setAttribute('data-mindmap-ready', '');
    diagram.style.removeProperty('visibility');
    print.addEventListener(
      'change',
      (event) => {
        if (!event.matches) void instance.renderData();
      },
      { signal: controller.signal },
    );
    window.addEventListener(
      'semloom:viewchange',
      () => {
        if (!wrapper.isConnected) restore();
      },
      { signal: controller.signal },
    );
    window.addEventListener(
      'pagehide',
      (event) => {
        if (!event.persisted) restore();
      },
      { signal: controller.signal },
    );
  } catch {
    restore();
  }
}

export function enhanceMindmaps() {
  try {
    const payload = JSON.parse(
      document.getElementById('semloom-mindmap-data')!.textContent!,
    ) as { blocks: Entry[] };
    for (const [index, entry] of payload.blocks.entries())
      void enhance(entry, index);
  } catch {
    /* Keep the complete server-rendered tree on initialization failure. */
  }
}
