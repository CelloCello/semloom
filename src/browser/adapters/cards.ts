import type { BrowserAdapter } from '../types.js';
import { renderCards } from '../../plugins/comparison.js';
import { htmlView } from '../index.js';

export const createView: BrowserAdapter = (data, context) =>
  htmlView(renderCards(data, context));
