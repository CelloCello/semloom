import { createRequire } from 'node:module';
import {
  chartOption,
  chartRoles,
  chartInk,
  chartLine,
  type ChartGeometry,
} from '../core/chart-presentation.js';
import type { ChartBlock } from '../core/types.js';
import { svgFragment } from './svg.js';

const require = createRequire(import.meta.url);
let engine: typeof import('echarts') | undefined;
export function renderChart(
  block: ChartBlock,
  geometry: ChartGeometry,
  prefix: string,
  range?: [number, number],
) {
  const echarts = (engine ??= require('echarts') as typeof import('echarts'));
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: geometry.width,
    height: geometry.height,
  });
  try {
    chart.setOption(
      chartOption(
        block,
        geometry,
        chartRoles,
        chartInk,
        chartLine,
        range,
      ) as import('echarts').EChartsOption,
    );
    const roles = new Map<string, string>(
      chartRoles.map((color, i) => [
        color,
        `var(--semloom-chart-series-${i + 1})`,
      ]),
    );
    roles.set(chartInk, 'var(--ink)');
    roles.set(chartLine, 'var(--line)');
    return svgFragment(chart.renderToSVGString(), prefix, roles);
  } finally {
    chart.dispose();
  }
}
