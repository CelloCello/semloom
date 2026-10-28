import { htmlView } from 'semloom/browser';
import { renderRows } from './templates.mjs';

export function createView(data, context) {
  return htmlView(renderRows(data, context));
}
