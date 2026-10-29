export const hierarchyCss = `
.semloom-hierarchy { min-width:0;max-width:100%; }
.semloom-hierarchy-root,.semloom-hierarchy-children { list-style:none;margin:0;padding:0; }
.semloom-hierarchy-label { white-space:pre-wrap;overflow-wrap:anywhere;padding:.6rem .8rem;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--ink);line-height:var(--body-leading);max-width:var(--measure); }
.semloom-hierarchy-tree .semloom-hierarchy-children { margin:.6rem 0 0 .5rem;padding-left:1rem;border-left:1px solid var(--line); }
.semloom-hierarchy-tree .semloom-hierarchy-node + .semloom-hierarchy-node { margin-top:.6rem; }
.semloom-mindmap-diagram { max-width:100%;overflow:auto;scrollbar-color:var(--accent) var(--paper);scrollbar-width:thin; }
.semloom-hierarchy-mindmap svg.markmap { display:block;max-width:none;--markmap-font:400 1em/var(--body-leading) var(--font-body);--markmap-text-color:var(--ink);--markmap-circle-open-bg:var(--paper); }
.semloom-hierarchy-mindmap .markmap-foreign > div > div { white-space:pre-wrap;overflow-wrap:anywhere; }
.semloom-hierarchy-mindmap circle[role=button]:focus-visible { outline:2px solid var(--accent);outline-offset:3px; }
@media screen {
  .semloom-hierarchy-mindmap[data-mindmap-ready] > [data-mindmap-fallback] { display:none; }
}
@media (max-width:800px), print {
  .semloom-hierarchy-tree .semloom-hierarchy-children { margin:.6rem 0 0 .25rem;padding-left:.65rem; }
}
@media print {
  .semloom-mindmap-diagram { display:none; }
  .semloom-hierarchy-mindmap > [data-mindmap-fallback] { display:block; }
}
`;
