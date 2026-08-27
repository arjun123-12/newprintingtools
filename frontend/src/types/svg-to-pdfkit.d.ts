declare module 'svg-to-pdfkit' {
  interface SVGtoPDFOptions {
    width?: number;
    height?: number;
    useCSS?: boolean;
    assumePt?: boolean;
    precision?: number;
    preserveAspectRatio?: string;
    imageCallback?: (src: string) => string | HTMLImageElement | HTMLCanvasElement;
    documentCallback?: (file: string) => any;
    colorCallback?: (color: any) => any;
    warningCallback?: (warning: string) => void;
    fontCallback?: (family: string, bold: boolean, italic: boolean, fontOptions: any) => string;
    [key: string]: any;
  }

  function SVGtoPDF(
    doc: any,
    svg: string | SVGElement,
    x?: number,
    y?: number,
    options?: SVGtoPDFOptions
  ): void;

  export = SVGtoPDF;
}
