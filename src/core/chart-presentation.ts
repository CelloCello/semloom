import { chartName } from './chart.js';
import type { ChartBlock } from './types.js';

export const chartRoles = [
  '#123401',
  '#123402',
  '#123403',
  '#123404',
  '#123405',
  '#123406',
] as const;
export const chartInk = '#123410';
export const chartLine = '#123411';
export interface ChartGeometry {
  width: number;
  height: number;
  labelWidth: number;
  rowHeight: number;
  left: number;
  bottom: number;
}

export function textWidth(text: string, size = 14): number {
  return [...text].reduce(
    (sum, char) =>
      sum +
      (/[MW@#%&]/u.test(char)
        ? size
        : /[\u0000-\u007f]/u.test(char)
          ? size * 0.62
          : size),
    0,
  );
}
export function wrapChartText(
  text: string,
  width: number,
  size = 14,
  measure = textWidth,
): string {
  let line = '',
    result = '';
  for (const char of text) {
    if (char === '\n' || (line && measure(line + char, size) > width)) {
      result += line + '\n';
      line = '';
      if (char === '\n') continue;
    }
    line += char;
  }
  return result + line;
}
export function chartGeometry(
  block: ChartBlock,
  mode: 'wide' | 'narrow' | 'print',
  count = block.categories.length,
  measure = textWidth,
): ChartGeometry {
  const baseWidth = mode === 'narrow' ? 320 : 680;
  if (block.chartType === 'donut')
    return {
      width: baseWidth,
      height: mode === 'narrow' ? 270 : 320,
      labelWidth: 0,
      rowHeight: 0,
      left: 0,
      bottom: 0,
    };
  const horizontal =
    block.chartType === 'bar' && block.orientation === 'horizontal';
  const labelWidth = horizontal
    ? mode === 'narrow'
      ? 128
      : 230
    : mode === 'narrow'
      ? 85
      : 110;
  const labels = block.categories.map((c) =>
    wrapChartText(c.label, labelWidth, 14, measure),
  );
  const labelHeight = Math.max(...labels.map((l) => l.split('\n').length)) * 19;
  const rowHeight = Math.max(
    34,
    block.series.length * 12 + 12,
    labelHeight + 12,
  );
  const width = horizontal
    ? baseWidth
    : block.chartType === 'line'
      ? baseWidth
      : Math.max(
          baseWidth,
          count *
            Math.max(
              mode === 'narrow' ? 106 : 134,
              block.series.length * 14 + 30,
            ) +
            100,
        );
  const bottom = horizontal ? 50 : labelHeight + 30;
  const left = horizontal
    ? Math.min(
        labelWidth,
        Math.max(...block.categories.map((c) => measure(c.label, 14))),
      ) + 20
    : 72;
  return {
    width,
    height: horizontal ? count * rowHeight + 100 : 265 + bottom,
    labelWidth,
    rowHeight,
    left,
    bottom,
  };
}

function chartScale(block: ChartBlock): number {
  const magnitude = Math.max(
    ...block.series.flatMap((s) => s.values).map((v) => Math.abs(v ?? 0)),
  );
  return magnitude === 0
    ? 1
    : 10 ** Math.max(-308, Math.min(308, Math.floor(Math.log10(magnitude))));
}

function tickStep(span: number) {
  const exponent = Math.floor(Math.log10(span / 5));
  const base = 10 ** exponent;
  const ratio = span / 5 / base;
  const factor = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10;
  return { value: factor * base, exponent, factor };
}

function chartAxis(block: ChartBlock): {
  domain: [number, number];
  interval: number;
} {
  const scale = chartScale(block);
  const values = block.series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null)
    .map((v) => v / scale);
  let low = Math.min(...values),
    high = Math.max(...values);
  if (block.chartType === 'bar') {
    low = Math.min(0, low);
    high = Math.max(0, high);
  }
  if (low === high) {
    if (low === 0) return { domain: [0, 1], interval: 0.2 };
    const pad = Math.abs(low) * 0.1;
    low -= pad;
    high += pad;
  }
  const span = high - low;
  const step = tickStep(span);
  const padding = block.chartType === 'line' ? span * 0.05 : 0;
  // Build decimal endpoints directly in engine coordinates. Multiplying by the
  // raw scale and dividing again can move a fixed bound inside ECharts' nice ticks.
  const min = Number(
    `${(Math.floor((low - padding) / step.value) * step.factor).toFixed(0)}e${step.exponent}`,
  );
  const max = Number(
    `${(Math.ceil((high + padding) / step.value) * step.factor).toFixed(0)}e${step.exponent}`,
  );
  // Keep the nice endpoints aligned with the interval (including zero). These
  // engine coordinates remain finite even beyond the raw Number range.
  return {
    domain: [Math.min(low, min), Math.max(high, max)],
    interval: step.value,
  };
}

export function chartDomain(block: ChartBlock): [number, number] {
  const {
    domain: [min, max],
  } = chartAxis(block);
  const scale = chartScale(block);
  return [
    Math.max(-Number.MAX_VALUE, min * scale),
    Math.min(Number.MAX_VALUE, max * scale),
  ];
}

function valueAxisLabels(
  domain: [number, number],
  scale: number,
  measure: typeof textWidth,
) {
  const [min, max] = domain;
  // Work in log space: raw-domain subtraction can overflow and very small tick
  // steps can underflow. One guard digit also covers ECharts' finer nice ticks.
  const stepExponent = Math.floor(Math.log10((max - min) / 5));
  const magnitude = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
  const precision = Math.max(
    1,
    Math.min(17, Math.floor(Math.log10(magnitude)) - stepExponent + 2),
  );
  const scaleExponent = Math.round(Math.log10(scale));
  const formatter = (value: number) => {
    if (value === 0) return '0';
    // Keep the normalized tick's decimal precision. Multiplication by scale (or
    // converting the shifted text back to Number) can merge distinct ticks near
    // subnormal boundaries, and rounding MAX_VALUE can overflow.
    const [coefficient, exponent] = value
      .toExponential(precision - 1)
      .split('e');
    const mantissa = coefficient!.replace(/\.?0+$/u, '');
    const power = Number(exponent) + scaleExponent;
    const scientific = `${mantissa}e${power >= 0 ? '+' : ''}${power}`;
    const sign = value < 0 ? '-' : '';
    const digits = mantissa.replace(/[-.]/gu, '');
    const point = power + 1;
    const decimal =
      point <= 0
        ? `${sign}0.${'0'.repeat(-point)}${digits}`
        : point >= digits.length
          ? sign + digits + '0'.repeat(point - digits.length)
          : `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
    return scientific.length < decimal.length ? scientific : decimal;
  };
  const width = Math.max(
    ...Array.from({ length: 6 }, (_, i) =>
      measure(formatter(min + (max - min) * (i / 5)), 12),
    ),
  );
  return { formatter, width };
}

export function chartOption(
  block: ChartBlock,
  geometry: ChartGeometry,
  colors: readonly string[] = chartRoles,
  ink = chartInk,
  line = chartLine,
  range: [number, number] = [0, block.categories.length],
  measure = textWidth,
) {
  const [start, end] = range;
  const categories = block.categories.slice(start, end);
  const { domain, interval } = chartAxis(block);
  const scale = chartScale(block);
  const common = {
    animation: false,
    color: colors,
    textStyle: { fontFamily: 'sans-serif', fontSize: 14, color: ink },
    legend: {
      show: false,
      data: block.series.map((s) => chartName(s.key)),
      selectedMode: block.chartType !== 'donut',
    },
  };
  if (block.chartType === 'donut')
    return {
      ...common,
      series: [
        {
          type: 'pie',
          radius: ['48%', '77%'],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          emphasis: { disabled: true },
          data: categories.map((c, i) => ({
            name: chartName(c.key),
            value: block.series[0]!.values[start + i],
            itemStyle: { color: colors[(start + i) % colors.length] },
          })),
        },
      ],
    };
  const horizontal =
    block.chartType === 'bar' && block.orientation === 'horizontal';
  const numericLabels = valueAxisLabels(domain, scale, measure);
  const grid = {
    left: Math.max(
      geometry.left,
      horizontal ? numericLabels.width / 2 + 8 : numericLabels.width + 12,
    ),
    right: horizontal ? Math.max(28, numericLabels.width / 2 + 8) : 28,
    top: 38,
    bottom: geometry.bottom,
  };
  const plotWidth = Math.max(1, geometry.width - grid.left - grid.right);
  const categoryLabelWidth = Math.max(
    ...categories.map((c) =>
      Math.max(
        ...wrapChartText(c.label, geometry.labelWidth, 14, measure)
          .split('\n')
          .map((line) => measure(line, 14)),
      ),
    ),
  );
  const category = {
    type: 'category',
    inverse: horizontal,
    data: categories.map((c) => chartName(c.key)),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: line } },
    axisLabel: {
      color: ink,
      fontSize: 14,
      lineHeight: 19,
      margin: 12,
      interval:
        block.chartType === 'bar'
          ? 0
          : Math.max(
              0,
              Math.ceil(
                (categoryLabelWidth + 12) / (plotWidth / categories.length),
              ) - 1,
            ),
      formatter: (name: string) =>
        wrapChartText(
          categories.find((c) => chartName(c.key) === name)!.label,
          geometry.labelWidth,
          14,
          measure,
        ),
    },
  };
  const value = {
    type: 'value',
    min: domain[0],
    max: domain[1],
    // Domain and spacing are one host-owned contract. Always use the public
    // interval option, so ECharts never recomputes a nice extent for fixed bounds.
    interval,
    axisLabel: {
      color: ink,
      fontSize: 12,
      hideOverlap: true,
      formatter: numericLabels.formatter,
    },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: line, width: 1 } },
  };
  return {
    ...common,
    grid,
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: block.series.map((s, index) => ({
      type: block.chartType,
      id: chartName(s.key),
      name: chartName(s.key),
      data: s.values
        .slice(start, end)
        .map((v) => (v === null ? null : v / scale)),
      connectNulls: false,
      symbol: ['circle', 'rect', 'triangle', 'diamond', 'pin', 'roundRect'][
        index
      ],
      symbolSize: 7,
      showSymbol: true,
      barMaxWidth: 32,
      emphasis: { disabled: true },
      lineStyle: { width: 2.5, type: index % 2 ? 'dashed' : 'solid' },
      itemStyle: { color: colors[index % colors.length] },
    })),
  };
}
