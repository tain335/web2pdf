import { PipelineContext } from './pipeline';
import { PageBounds, SplitPagesResult } from './types';
import { WorkerContext } from './worker';

export interface PageBreakOptions {
  avoidBreakStyle?: boolean;
  avoidBreakBlockElements?: string[];
  avoidBreakTextElements?: string[];
  computeAvoidRegions?: (el: Element, containerEl: Element) => [number, number][] | false;
}
// size in pt
export const PageFormats = {
  a0: [2383.94, 3370.39],
  a1: [1683.78, 2383.94],
  a2: [1190.55, 1683.78],
  a3: [841.89, 1190.55],
  a4: [595.28, 841.89],
  a5: [419.53, 595.28],
  a6: [297.64, 419.53],
  a7: [209.76, 297.64],
  a8: [147.4, 209.76],
  a9: [104.88, 147.4],
  a10: [73.7, 104.88],
  b0: [2834.65, 4008.19],
  b1: [2004.09, 2834.65],
  b2: [1417.32, 2004.09],
  b3: [1000.63, 1417.32],
  b4: [708.66, 1000.63],
  b5: [498.9, 708.66],
  b6: [354.33, 498.9],
  b7: [249.45, 354.33],
  b8: [175.75, 249.45],
  b9: [124.72, 175.75],
  b10: [87.87, 124.72],
  c0: [2599.37, 3676.54],
  c1: [1836.85, 2599.37],
  c2: [1298.27, 1836.85],
  c3: [918.43, 1298.27],
  c4: [649.13, 918.43],
  c5: [459.21, 649.13],
  c6: [323.15, 459.21],
  c7: [229.61, 323.15],
  c8: [161.57, 229.61],
  c9: [113.39, 161.57],
  c10: [79.37, 113.39],
  dl: [311.81, 623.62],
  letter: [612, 792],
  'government-letter': [576, 756],
  legal: [612, 1008],
  'junior-legal': [576, 360],
  ledger: [1224, 792],
  tabloid: [792, 1224],
  'credit-card': [153, 243],
};

export type PageFomat = keyof typeof PageFormats;

export function computePageDimensions(format: PageFomat): [number, number] {
  return PageFormats[format] as [number, number];
}

function isOverlap(x1: number, y1: number, x2: number, y2: number) {
  return Math.max(x1, x2) <= Math.min(y1, y2);
}

function computeLineBoxs(el: Element, excludeElements: string[]) {
  const range = document.createRange();
  if (!excludeElements.length) {
    range.selectNodeContents(el);
  } else {
    el.childNodes.forEach((node) => {
      if (!excludeElements.includes(node.nodeName.toLowerCase())) {
        range.selectNode(node);
      }
    });
  }
  const rects = range.getClientRects();
  return rects;
}

export function splitPages(context: PipelineContext<WorkerContext>): Promise<SplitPagesResult> {
  context.notifier.notify('splitPages', 0);
  const pageHeight = context.finalPageSized.splitPageHeight;
  const sourceHeight = context.finalPageSized.sourceHeight;
  const els = Array.from(context.el.querySelectorAll('*'));
  const breakOpt = ['always', 'page'];
  const avoidOpt = ['avoid', 'avoid-page'];
  const containerRect = context.el.getBoundingClientRect();
  let breakPoints: number[] = [];
  let avoidRegions: [number, number][] = [];
  context.finalPageSized.removeIgnoreElements();
  const joinAvoidRegion = function joinAvoidRegion(start: number, end: number) {
    if (end > sourceHeight || start > sourceHeight) {
      return;
    }
    const before: [number, number][] = [];
    const overlap: [number, number][] = [[start, end]];
    const after: [number, number][] = [];
    avoidRegions.forEach((region) => {
      // 重叠
      if (isOverlap(start, end, region[0], region[1])) {
        overlap.push(region);
      } else if (region[1] < start) {
        before.push(region);
      } else {
        after.push(region);
      }
    });
    // 更新 regions
    avoidRegions = [
      ...before,
      [Math.min(...overlap.map((region) => region[0])), Math.max(...overlap.map((region) => region[1]))],
      ...after,
    ];
  };
  els.forEach((el) => {
    const styles = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (context.pageBreak?.computeAvoidRegions) {
      const regions = context.pageBreak.computeAvoidRegions(el, context.el);
      if (regions) {
        regions.forEach((region) => {
          joinAvoidRegion(region[0], region[1]);
        });
        return;
      }
    }
    if (context.pageBreak.avoidBreakBlockElements?.includes(el.tagName.toLowerCase())) {
      const block = el as HTMLImageElement;
      if (el.tagName.toLowerCase() === 'img' && block.complete) {
        joinAvoidRegion(rect.top - containerRect.top, rect.bottom - containerRect.top);
      } else {
        joinAvoidRegion(rect.top - containerRect.top, rect.bottom - containerRect.top);
      }
    } else if (context.pageBreak.avoidBreakTextElements?.includes(el.tagName.toLocaleLowerCase())) {
      const lineBoxs = computeLineBoxs(el, context.pageBreak.avoidBreakBlockElements ?? []);
      Array.from(lineBoxs).forEach((lineBox) => {
        joinAvoidRegion(lineBox.top - containerRect.top, lineBox.bottom - containerRect.top);
      });
    }
    if (context.pageBreak.avoidBreakStyle) {
      if (breakOpt.includes(styles.breakBefore)) {
        const offsetTop = rect.top - containerRect.top;
        if (!breakPoints.includes(offsetTop)) {
          breakPoints.push(offsetTop);
        }
      } else if (avoidOpt.includes(styles.breakBefore)) {
        const prev = el.previousElementSibling;
        if (prev) {
          const prevRect = prev.getBoundingClientRect();
          joinAvoidRegion(prevRect.top - containerRect.top, rect.bottom - containerRect.top);
        }
      }
      if (breakOpt.includes(styles.breakAfter)) {
        if (breakPoints.includes(rect.bottom)) {
          breakPoints.push(rect.bottom);
        }
      } else if (avoidOpt.includes(styles.breakAfter)) {
        const after = el.nextElementSibling;
        if (after) {
          const afterRect = after.getBoundingClientRect();
          joinAvoidRegion(afterRect.top - containerRect.top, afterRect.bottom - containerRect.top);
        }
      }
    }
  });
  // 消除一些落在avoidRegion的breakPoint, avoidRegion优先级更高
  breakPoints = breakPoints.filter((point) => {
    return !avoidRegions.some((region) => {
      if (region[0] <= point && point <= region[1]) {
        return true;
      }
      return false;
    });
  });
  let offset = 0;
  let pages: PageBounds[] = [];
  while (offset < sourceHeight) {
    const pageStart = offset;
    let estimateEnd = Math.min(offset + pageHeight, sourceHeight);
    if (breakPoints.length && estimateEnd > breakPoints[0]) {
      estimateEnd = breakPoints[0];
      breakPoints.shift();
      offset = estimateEnd;
      pages.push({
        height: estimateEnd - pageStart,
      });
      continue;
    }
    while (avoidRegions.length) {
      // 如果页面区域不在avoid区域跳出
      if (estimateEnd < avoidRegions[0][0]) {
        break;
        // 如果页面区域刚好在avoid区域，则页面大小取这个区域的开始的值，避免分割
        // 1. 如果avoid区域小于page区域，则取avoid区域start作为页面分割
        // 2. 如果avoid区域大于page区域，则可以选择强行分割或者缩放处理
        // TODO 暂时先不处理第2种情况
      } else if (estimateEnd < avoidRegions[0][1]) {
        // 这个avoid区域怎么都大于pageHeight
        if (avoidRegions[0][1] - avoidRegions[0][0] > pageHeight) {
          // auto就认为可以直接强行截断
          // if (context.sizeMismatchStrategy === 'auto') {
          avoidRegions.shift();
          // scale就代表缩放
          // } else if (context.sizeMismatchStrategy === 'scale') {
          //   if (pageStart === avoidRegions[0][0]) {
          //     estimateEnd = avoidRegions[0][1];
          //   } else {
          //     estimateEnd = avoidRegions[0][0];
          //   }
          // }
        } else {
          estimateEnd = avoidRegions[0][0];
        }
        break;
        // 如果页面覆盖avoid区域则移出
      } else {
        avoidRegions.shift();
        continue;
      }
    }
    offset = estimateEnd;
    pages.push({
      height: estimateEnd - pageStart,
    });
  }
  pages = pages.filter((page) => {
    return page.height !== 0;
  });
  context.notifier.notify('splitPages', 100);
  context.finalPageSized.restoreIgnoreElements();
  return Promise.resolve({
    meta: context.finalPageSized,
    pages,
  });
}
