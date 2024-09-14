export type PageSizeResult = {
  targetWidth: number;
  targetHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  splitPageHeight: number;
  scale: number;
};

export interface PageBounds {
  height: number;
}

export interface SplitPagesResult {
  meta: PageSizeResult;
  pages: PageBounds[];
}
