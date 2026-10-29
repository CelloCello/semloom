// markmap-view 0.18.12 ships extensionless declaration re-exports, which NodeNext
// cannot resolve. Declare only the pinned public API used by this enhancement.
declare module 'markmap-view' {
  interface InputNode {
    content: string;
    children: InputNode[];
  }
  interface ViewNode {
    content: string;
    children: ViewNode[];
    payload?: { fold?: number };
    state: { path: string };
  }
  export class Markmap {
    constructor(
      svg: SVGElement,
      options: {
        id: string;
        zoom: boolean;
        pan: boolean;
        autoFit: boolean;
        duration: number;
        initialExpandLevel: number;
        maxWidth: number;
        color: (node: ViewNode) => string;
      },
    );
    state: {
      data?: ViewNode;
      rect: { x1: number; x2: number; y1: number; y2: number };
    };
    setData(data: InputNode): Promise<void>;
    renderData(origin?: ViewNode): Promise<void>;
    destroy(): void;
  }
}
