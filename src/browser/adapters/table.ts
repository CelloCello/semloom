import type { BrowserAdapter } from '../types.js';
import { renderTable } from '../../plugins/comparison.js';
import { htmlView } from '../index.js';

export const createView: BrowserAdapter = (data, context) =>
  htmlView(renderTable(data, context));
