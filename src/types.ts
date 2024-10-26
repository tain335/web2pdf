export type PageSizedResult = {
  targetWidth: number;
  targetHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  splitPageHeight: number;
  scale: number;
  removeIgnoreElements: () => void;
  restoreIgnoreElements: () => void;
};

export interface PageBounds {
  height: number;
}

export interface SplitPagesResult {
  meta: PageSizedResult;
  pages: PageBounds[];
}
