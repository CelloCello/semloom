import { init, use, type EChartsCoreOption } from 'echarts/core.js';
import { BarChart, LineChart, PieChart } from 'echarts/charts.js';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components.js';
import { SVGRenderer } from 'echarts/renderers.js';
import { chartName } from '../core/chart.js';
import {
  chartGeometry,
  chartOption,
  textWidth,
} from '../core/chart-presentation.js';
import { reportMessages } from '../core/report-messages.js';
import type { ChartBlock } from '../core/types.js';

use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);

type ReaderChart = ChartBlock & { id: string };
function enhance(
  root: HTMLElement,
  block: ReaderChart,
  locale: string,
): () => void {
  const messages = reportMessages(locale);
  let canvas: CanvasRenderingContext2D | null = null;
  try {
    canvas = document.createElement('canvas').getContext('2d');
  } catch {
    /* SVG still has a deterministic text measurement fallback. */
  }
  const fontFamily = getComputedStyle(root).fontFamily;
  const measure = (text: string, size = 14) => {
    if (!canvas) return textWidth(text, size);
    canvas.font = `${size}px ${fontFamily}`;
    return canvas.measureText(text).width;
  };
  const screen = root.querySelector<HTMLElement>('.semloom-chart-screen')!;
  const legend = root.querySelector<HTMLUListElement>(
    ':scope > .semloom-visual-legend',
  )!;
  const originalLegend = [...legend.childNodes].map((node) =>
    node.cloneNode(true),
  );
  const view = document.createElement('div');
  view.className = 'semloom-plot semloom-chart-enhanced';
  view.setAttribute('role', 'region');
  view.setAttribute('aria-label', block.title);
  view.tabIndex = 0;
  const plot = document.createElement('div');
  plot.id = `semloom-chart-reader-${block.id}`;
  view.append(plot);
  const visible = new Set(block.series.map((series) => chartName(series.key)));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const owner = root.closest<HTMLElement>('[data-view-host]') ?? root;
  let chart: ReturnType<typeof init> | undefined;
  let observer: ResizeObserver | undefined;
  let raf = 0,
    released = false,
    lastSize = '';
  const buttons: HTMLButtonElement[] = [];
  const onMotion = () =>
    chart?.setOption({
      animation: !reduced.matches,
      animationDurationUpdate: reduced.matches ? 0 : 180,
    });
  function cleanup() {
    if (released) return;
    released = true;
    cancelAnimationFrame(raf);
    observer?.disconnect();
    owner.removeEventListener('semloom:releaseview', cleanup);
    reduced.removeEventListener('change', onMotion);
    try {
      chart?.dispose();
    } finally {
      view.remove();
      delete root.dataset.chartReady;
      legend.replaceChildren(...originalLegend);
    }
  }
  function dimensions() {
    const geometry = chartGeometry(
      block,
      matchMedia('(max-width:760px)').matches ? 'narrow' : 'wide',
      block.categories.length,
      measure,
    );
    return { ...geometry, width: Math.max(geometry.width, root.clientWidth) };
  }
  function tooltip(params: unknown): HTMLElement {
    const data = (Array.isArray(params) ? params[0] : params) as
      { dataIndex?: number } | undefined;
    const index = data?.dataIndex;
    const container = document.createElement('div');
    container.className = 'semloom-chart-tooltip';
    if (index === undefined || !block.categories[index]) return container;
    const title = document.createElement('strong');
    title.textContent = block.categories[index]!.label;
    container.append(title);
    const entries =
      block.chartType === 'donut'
        ? block.series
        : block.series.filter((s) => visible.has(chartName(s.key)));
    for (const series of entries) {
      const row = document.createElement('div');
      const value = series.values[index];
      const percentage =
        block.chartType === 'donut'
          ? ` (${(((value as number) / block.series[0]!.values.reduce<number>((sum, v) => sum + v!, 0)) * 100).toFixed(1)}%)`
          : '';
      row.textContent = `${series.label}${messages.separator}${value === null ? messages.notProvided : String(value) + (block.unit ? ` ${block.unit}` : '')}${percentage}`;
      container.append(row);
    }
    return container;
  }
  function options() {
    const geometry = dimensions();
    const style = getComputedStyle(root);
    const colors = Array.from({ length: 6 }, (_, i) =>
      style.getPropertyValue(`--semloom-chart-series-${i + 1}`).trim(),
    );
    const option = chartOption(
      block,
      geometry,
      colors,
      style.getPropertyValue('--ink').trim(),
      style.getPropertyValue('--line').trim(),
      undefined,
      measure,
    );
    option.textStyle.fontFamily = style.fontFamily;
    for (const series of option.series)
      if ('silent' in series) series.silent = false;
    return {
      ...option,
      animation: false,
      tooltip: {
        trigger: block.chartType === 'donut' ? 'item' : 'axis',
        triggerOn: 'mousemove|click',
        renderMode: 'html',
        confine: true,
        formatter: tooltip,
        backgroundColor: style.getPropertyValue('--surface').trim(),
        borderColor: style.getPropertyValue('--line').trim(),
        textStyle: {
          color: style.getPropertyValue('--ink').trim(),
          fontFamily: style.fontFamily,
          fontSize: 14,
        },
        extraCssText:
          'box-shadow:none;max-width:min(26rem,85vw);white-space:normal;',
      },
    } as EChartsCoreOption;
  }
  const schedule = () => {
    if (released || raf || matchMedia('print').matches) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (released || !root.isConnected || matchMedia('print').matches) return;
      const geometry = dimensions();
      const size = `${geometry.width}:${geometry.height}`;
      if (size === lastSize) return;
      try {
        plot.style.width = `${geometry.width}px`;
        plot.style.height = `${geometry.height}px`;
        chart!.resize({ width: geometry.width, height: geometry.height });
        chart!.setOption(options());
        onMotion();
        lastSize = size;
      } catch {
        cleanup();
      }
    });
  };
  try {
    const geometry = dimensions();
    plot.style.width = `${geometry.width}px`;
    plot.style.height = `${geometry.height}px`;
    chart = init(plot, undefined, {
      renderer: 'svg',
      width: geometry.width,
      height: geometry.height,
    });
    chart.setOption(options());
    if (!plot.querySelector('svg')) throw new Error('Chart did not render.');
    observer = new ResizeObserver(schedule);
    observer.observe(root);
    reduced.addEventListener('change', onMotion);
    owner.addEventListener('semloom:releaseview', cleanup, { once: true });
    if (block.chartType !== 'donut') {
      for (const [i, item] of [...legend.children].entries()) {
        const name = chartName(block.series[i]!.key);
        const button = document.createElement('button');
        button.type = 'button';
        button.append(
          ...[...item.childNodes].map((node) => node.cloneNode(true)),
        );
        button.setAttribute('aria-pressed', 'true');
        button.setAttribute('aria-controls', plot.id);
        button.setAttribute(
          'aria-label',
          `${messages.chartToggle}${messages.separator}${block.series[i]!.label}`,
        );
        button.addEventListener('click', () => {
          if (visible.has(name) && visible.size === 1) return;
          try {
            chart!.dispatchAction({ type: 'legendToggleSelect', name });
            if (visible.has(name)) visible.delete(name);
            else visible.add(name);
            buttons.forEach((b, j) => {
              const selected = visible.has(chartName(block.series[j]!.key));
              b.setAttribute('aria-pressed', String(selected));
              b.disabled = selected && visible.size === 1;
            });
          } catch {
            cleanup();
          }
        });
        buttons.push(button);
        item.replaceChildren(button);
      }
      if (buttons.length === 1) buttons[0]!.disabled = true;
    }
    screen.after(view);
    root.dataset.chartReady = '';
    lastSize = `${geometry.width}:${geometry.height}`;
    onMotion();
    void document.fonts.ready.then(() => {
      lastSize = '';
      schedule();
    });
    return cleanup;
  } catch {
    cleanup();
    return () => {};
  }
}

export function enhanceCharts() {
  let payload: { blocks: ReaderChart[]; locale: string };
  try {
    payload = JSON.parse(
      document.getElementById('semloom-chart-data')!.textContent!,
    );
    if (!Array.isArray(payload.blocks)) return;
  } catch {
    return;
  }
  const mounted = new Map<HTMLElement, () => void>();
  for (const block of payload.blocks) {
    const root = document
      .getElementById(block.id)
      ?.querySelector<HTMLElement>('[data-chart-host]');
    if (root) {
      const release = enhance(root, block, payload.locale);
      if (root.hasAttribute('data-chart-ready')) mounted.set(root, release);
    }
  }
  const observer = new MutationObserver(() => {
    for (const [root, release] of mounted)
      if (!root.isConnected) {
        try {
          release();
        } finally {
          mounted.delete(root);
        }
      }
    if (!mounted.size) observer.disconnect();
  });
  if (mounted.size)
    observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    observer.disconnect();
    for (const release of mounted.values()) release();
    mounted.clear();
  });
}
