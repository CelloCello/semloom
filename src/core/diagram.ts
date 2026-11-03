import { fail, type DiagramBlock, type JsonSchema } from './types.js';
import type { ParsedDiagramModel } from 'pele';
import { diagramEngine } from '../node/pele.js';

export const diagramLimits = {
  source: 10000,
  documentSource: 50000,
  entities: 100,
  relations: 200,
} as const;
export const diagramSchema: JsonSchema = {
  type: 'object',
  required: ['title', 'description', 'language', 'source'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 2000 },
    language: { const: 'mermaid' },
    source: {
      type: 'string',
      minLength: 1,
      maxLength: diagramLimits.source,
      pattern: '^[^\\u0000\\uD800-\\uDFFF]*$',
    },
    preserveDirection: { type: 'boolean' },
  },
};

// Synchronous lazy loading keeps ordinary documents free of parser initialization.
// Only the public package entry is used; no deep imports or retained model cache.
function sourceError(
  source: string,
  path: string,
  index: number,
  code: string,
  message: string,
): never {
  const prefix = source.slice(0, index);
  const line = prefix.split(/\r\n|\r|\n/u).length;
  const column =
    prefix.length -
    Math.max(prefix.lastIndexOf('\n'), prefix.lastIndexOf('\r'));
  fail(`${path}/source`, code, `${message} (line ${line}, column ${column})`);
}

function checkSource(source: string, path: string): void {
  const directive = source.indexOf('%%{');
  if (directive >= 0)
    sourceError(
      source,
      path,
      directive,
      'DIAGRAM_RESTRICTED',
      'Directives are not supported.',
    );
  const start = source.search(/\S/u);
  if (/^---(?:\r?\n|\r|$)/u.test(source.trimStart()))
    sourceError(
      source,
      path,
      Math.max(0, start),
      'DIAGRAM_RESTRICTED',
      'Frontmatter is not supported.',
    );
  let quote = '';
  let labelDepth = 0;
  let statement = true;
  let statementStart = 0;
  const memberScopes: boolean[] = [];
  let flowLabelClose = '';
  let flowInlineEdge = false;
  const flowLabels: Record<string, string> = {
    '[(': ')]',
    '([': '])',
    '[[': ']]',
    '((': '))',
    '{{': '}}',
    '[': ']',
    '(': ')',
    '{': '}',
  };
  // Detection scopes source-only statement checks; parse() below remains the
  // authority for syntax and the resulting model/type. Words used as identifiers
  // in another grammar, or as sequence senders before arrows, are not commands.
  const type = diagramEngine().detectType(source);
  const commands: Record<string, string> = {
    flowchart: 'style|classDef|linkStyle|click',
    sequence: 'link|links|properties|rect',
    class: 'style|classDef|cssClass|click|link',
    er: 'style|classDef',
    state: 'style|classDef|click',
  };
  const banned = new RegExp(
    `^(?:${commands[type ?? ''] ?? '(?!)'})\\s+${type === 'sequence' ? '(?![-<>=])' : ''}\\S`,
    'u',
  );
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (source.startsWith('%%', i)) {
      while (i < source.length && !/[\r\n]/u.test(source[i]!)) i++;
      statement = true;
      statementStart = i + 1;
      continue;
    }
    if (char === '"') {
      quote = char;
      statement = false;
      continue;
    }
    if (type === 'flowchart') {
      if (flowInlineEdge) {
        const end = /^(?:--+[>ox]?|==+>?|\.-+>?)/u.exec(source.slice(i));
        if (end) {
          i += end[0].length - 1;
          flowInlineEdge = false;
          statement = false;
        }
        continue;
      }
      if (flowLabelClose) {
        if (source.startsWith(flowLabelClose, i)) {
          i += flowLabelClose.length - 1;
          flowLabelClose = '';
        }
        continue;
      }
      if (char === '|') {
        flowLabelClose = '|';
        statement = false;
        continue;
      }
      // Inline labels start with --, == or -.; complete link operators do not.
      const inline =
        !/[.=-]/u.test(source[i - 1] ?? '') &&
        /^(?:--(?![->ox])|==(?![=>])|-\.(?!-))/u.exec(source.slice(i));
      if (inline) {
        flowInlineEdge = true;
        i += inline[0].length - 1;
        statement = false;
        continue;
      }
      const pair = source.slice(i, i + 2);
      // The asymmetric shape uses ID>label]; arrowheads end in - or = instead.
      const asymmetric =
        char === '>' && /[\p{L}\p{N}_]/u.test(source[i - 1] ?? '');
      const close =
        flowLabels[pair] ?? flowLabels[char] ?? (asymmetric ? ']' : '');
      if (close) {
        flowLabelClose = close;
        if (flowLabels[pair]) i++;
        statement = false;
        continue;
      }
    }
    if (type === 'class' || type === 'er') {
      if (char === '{' && !labelDepth) {
        const header = source.slice(statementStart, i).trim();
        // Class namespaces remain statement scopes. ER crow's-foot relation
        // braces are not entity bodies, including compact A||--o{B syntax.
        const member =
          memberScopes.at(-1) ||
          (type === 'class'
            ? /^class\s+\S/u.test(header)
            : /^(?:"(?:\\.|[^"\\])*"|[^\s{}:"[\]|]+)(?:\s*\[[^\]]*\])?$/u.test(
                header,
              ));
        if (type === 'class' || member) memberScopes.push(Boolean(member));
        statement = false;
        continue;
      }
      if (char === '}' && memberScopes.length && !labelDepth) {
        memberScopes.pop();
        statement = true;
        statementStart = i + 1;
        continue;
      }
    }
    if ('[('.includes(char)) labelDepth++;
    if ('])'.includes(char)) labelDepth = Math.max(0, labelDepth - 1);
    if (!labelDepth && (char === ';' || char === '\n' || char === '\r')) {
      statement = true;
      statementStart = i + 1;
      continue;
    }
    if (statement && !/\s/u.test(char)) {
      if (!memberScopes.at(-1) && banned.test(source.slice(i)))
        sourceError(
          source,
          path,
          i,
          'DIAGRAM_RESTRICTED',
          'Presentation overrides, links and callbacks are not supported.',
        );
      statement = false;
    }
  }
}

export function validateDiagram(block: DiagramBlock, path: string): void {
  checkSource(block.source, path);
  const pele = diagramEngine();
  let model: ParsedDiagramModel;
  try {
    model = pele.parse(block.source, {
      limit: diagramLimits.source,
      maxEdges: diagramLimits.relations,
    });
  } catch (error) {
    if (!(error instanceof pele.PeleError)) throw error;
    const line = Math.max(1, Math.min(10001, error.line ?? 1));
    const column = Math.max(1, Math.min(10001, error.column ?? 1));
    fail(
      `${path}/source`,
      error.code === 'limit' ? 'DIAGRAM_LIMIT' : 'DIAGRAM_SYNTAX',
      `Invalid Mermaid source (line ${line}, column ${column}). ${error.message.slice(0, 240)}`,
    );
  }
  let entities = 0;
  let relations = 0;
  let restricted = false;
  const any = (
    items: Iterable<unknown>,
    check: (v: Record<string, unknown>) => boolean,
  ) => [...items].some((v) => check(v as Record<string, unknown>));
  const filled = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value);
  switch (model.type) {
    case 'flowchart':
      entities = model.nodes.size;
      relations = model.edges.length;
      restricted =
        model.classes.size > 0 ||
        filled(model.defaultEdgeStyle) ||
        filled(model.defaultInterpolate) ||
        any(model.nodes.values(), (n) =>
          ['styles', 'classes', 'link', 'icon', 'img'].some((k) =>
            filled(n[k]),
          ),
        ) ||
        any(model.edges, (e) =>
          ['style', 'classes', 'interpolate', 'animate', 'animation'].some(
            (k) => filled(e[k]),
          ),
        ) ||
        model.subgraphs.some((s) => s.classes.length > 0);
      break;
    case 'sequence':
      entities = model.actors.size;
      // Pele messages already include note events (and structural events).
      // notes is a second representation, not another set of source events.
      relations = model.messages.length;
      restricted =
        [...model.actors.values()].some(
          (a) => a.links.size > 0 || a.properties.size > 0,
        ) ||
        model.boxes.some((b) => Boolean(b.fill) && b.fill !== 'transparent') ||
        model.messages.some((m) => m.type === 22);
      break;
    case 'class':
      entities = model.classes.size;
      relations = model.relations.length;
      restricted =
        model.styleClasses.size > 0 ||
        [...model.classes.values()].some(
          (c) =>
            c.styles.length > 0 ||
            c.cssClasses !== 'default' ||
            Boolean(c.link) ||
            c.haveCallback,
        );
      break;
    case 'er':
      entities = model.entities.size;
      relations = model.relationships.length;
      restricted =
        model.classes.size > 0 ||
        [...model.entities.values()].some(
          (e) => e.cssStyles.length > 0 || e.cssClasses !== 'default',
        ) ||
        model.subgraphs.some(
          (s) => s.cssStyles.length > 0 || s.classes.length > 0,
        );
      break;
    case 'state':
      restricted =
        model.classes.size > 0 ||
        model.links.size > 0 ||
        [...model.states.values()].some(
          (s) => filled(s.classes) || filled(s.styles) || filled(s.textStyles),
        );
      {
        const visit = (doc: typeof model.rootDoc) => {
          const ids = new Set<string>();
          for (const stmt of doc) {
            if (typeof stmt === 'string') {
              ids.add(stmt);
              continue;
            }
            if (stmt.stmt === 'state') {
              ids.add(stmt.id);
              if (stmt.doc) visit(stmt.doc);
              restricted ||=
                filled(stmt.classes) ||
                filled(stmt.styles) ||
                filled(stmt.textStyles);
            } else if (stmt.stmt === 'relation') {
              relations++;
              ids.add(stmt.state1.id);
              ids.add(stmt.state2.id);
            } else if (
              ['classDef', 'style', 'applyClass', 'click'].includes(stmt.stmt)
            )
              restricted = true;
          }
          entities += ids.size;
        };
        visit(model.rootDoc);
      }
      break;
    default:
      fail(
        `${path}/source`,
        'DIAGRAM_TYPE',
        'Supported types: flowchart, sequence, class, ER and state.',
      );
  }
  // Inspect public model text, including entity-decoded labels, without treating
  // ordinary words such as "style" inside labels as statements.
  const seen = new Set<object>();
  function checkText(value: unknown): void {
    if (
      typeof value === 'string' &&
      (/<\/?[a-z!][^>]*>/iu.test(value) ||
        value.includes('$$') ||
        /\bfa[brs]?:fa-[\w-]+/iu.test(value))
    )
      restricted = true;
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const child of value instanceof Map
      ? value.values()
      : Object.values(value))
      checkText(child);
  }
  checkText(model);
  if (restricted)
    fail(
      `${path}/source`,
      'DIAGRAM_RESTRICTED',
      'Styles, HTML labels, math, links, images and external icons are not supported (line 1, column 1).',
    );
  if (entities > diagramLimits.entities || relations > diagramLimits.relations)
    fail(
      `${path}/source`,
      'DIAGRAM_LIMIT',
      'Split the diagram: at most 100 entities and 200 relationships/messages per diagram (line 1, column 1).',
    );
}
