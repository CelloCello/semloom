export const interactiveCss = `
[data-switcher] { margin-bottom: 1rem; padding-bottom: .75rem; border-bottom: 1px solid var(--line); }
[data-switcher] label { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; color: var(--muted); font-size: .875rem; }
[data-switcher] select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: .4rem .65rem; min-width: 0; max-width: 100%; }
[data-switcher] select:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
[data-switch-error] { color: var(--ink); font-size: .875rem; overflow-wrap: anywhere; }
@media print { [data-switcher], [data-switch-error] { display: none !important; } }
`;
