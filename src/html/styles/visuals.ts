export const visualsCss = `
.semloom-visual{margin:var(--space) 0;min-width:0}
.semloom-visual figcaption{margin-bottom:1rem}
.semloom-visual h3,.semloom-visual h4,.semloom-visual h5,.semloom-visual h6{margin:0 0 .4rem}
.semloom-visual p{white-space:pre-wrap;overflow-wrap:anywhere;max-width:var(--measure)}
.semloom-plot{max-width:100%;overflow:auto;outline-offset:4px;scrollbar-color:var(--muted) var(--paper)}
.semloom-plot svg{display:block;max-width:none!important;flex-shrink:0;font-family:var(--font-body)!important}
.semloom-plot:focus-visible,.semloom-visual summary:focus-visible{outline:2px solid var(--accent)}
.semloom-visual-narrow,.semloom-print-panels,.semloom-print-table{display:none}
.semloom-visual-legend{display:flex;flex-wrap:wrap;gap:.5rem 1.25rem;padding:0;list-style:none;margin:1rem 0}
.semloom-visual-legend li{display:flex;align-items:baseline;gap:.5rem;overflow-wrap:anywhere;min-width:0}
.semloom-swatch{display:inline-block;align-self:center;width:1rem;height:.65rem;background:var(--semloom-chart-series-1);flex-shrink:0}
.semloom-swatch[data-color="2"]{background:var(--semloom-chart-series-2)}
.semloom-swatch[data-color="3"]{background:var(--semloom-chart-series-3)}
.semloom-swatch[data-color="4"]{background:var(--semloom-chart-series-4)}
.semloom-swatch[data-color="5"]{background:var(--semloom-chart-series-5)}
.semloom-swatch[data-color="6"]{background:var(--semloom-chart-series-6)}
.semloom-chart-table{font-variant-numeric:tabular-nums}
.semloom-chart-table td{white-space:pre-wrap}
.semloom-chart[data-chart-ready] .semloom-chart-screen{display:none}
.semloom-chart-enhanced{animation:semloom-chart-ready 160ms ease-out}
.semloom-visual-legend button{display:flex;align-items:center;gap:.5rem;font:inherit;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:4px;padding:.35rem .6rem;cursor:pointer;text-align:start;overflow-wrap:anywhere}
.semloom-visual-legend button:hover{background:var(--table-head)}
.semloom-visual-legend button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.semloom-visual-legend button[aria-pressed="false"]{color:var(--muted);text-decoration:line-through}
.semloom-visual-legend button:disabled{cursor:default}
.semloom-chart-tooltip{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}
@keyframes semloom-chart-ready{from{opacity:.85}to{opacity:1}}
@media(prefers-reduced-motion:reduce){.semloom-chart-enhanced{animation:none}}
.semloom-visual summary{cursor:pointer;color:var(--accent);padding:.5rem 0;text-underline-offset:.2em}
.semloom-visual pre{white-space:pre;overflow:auto;max-height:32rem;font-size:.9rem}
.semloom-diagram{--pele-bg:var(--paper);--pele-fg:var(--ink);--pele-muted:var(--muted);--pele-line:var(--ink);--pele-surface:var(--table-head);--pele-surface-alt:var(--surface);--pele-border:var(--muted);--pele-accent:var(--accent);--pele-font:var(--font-body);--pele-radius:3px}
@media screen and (max-width:760px){.semloom-visual-wide{display:none}.semloom-visual-narrow{display:block}}
@media print{
 .semloom-visual-wide,.semloom-visual-narrow,.semloom-chart-table-disclosure,.semloom-chart-enhanced{display:none!important}
 .semloom-chart>.semloom-visual-legend{display:none}
 .semloom-print-panels,.semloom-print-table{display:block}
 .semloom-print-panel{break-inside:avoid;margin:1rem 0;max-width:640px}
 .semloom-print-panel svg{width:100%;height:auto;max-width:680px;font-family:var(--font-body)!important}
 .semloom-print-panel p{margin:.5rem 0}
 .semloom-diagram .semloom-print-panel svg{width:auto;max-width:100%}
 .semloom-visual pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:none}
 .semloom-diagram-source{display:none}
 .semloom-visual-legend{font-size:9pt;break-inside:avoid}
 .semloom-visual th,.semloom-visual td{font-size:8pt}
 .semloom-diagram{--pele-bg:#fff;--pele-fg:#000;--pele-muted:#333;--pele-line:#000;--pele-surface:#eee;--pele-surface-alt:#fff;--pele-border:#555;--pele-accent:#000}
}
`;
