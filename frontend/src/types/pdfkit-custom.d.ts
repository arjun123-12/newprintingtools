declare module 'pdfkit' {
  export class PDFDocument {
    constructor(options?: any);
    addPage(options?: any): this;
    on(event: string, fn: (...args: any[]) => void): this;
    font(src: any, size?: number): this;
    fontSize(size: number): this;
    text(text: string, x?: number, y?: number, options?: any): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color?: any): this;
    stroke(color?: any): this;
    save(): this;
    restore(): this;
    end(): void;
    [key: string]: any;
  }
  export default PDFDocument;
  export function registerStdFonts(...fontData: any[]): void;
  export function registerFile(name: string, data: any): void;
}

declare module 'pdfkit/standard-fonts/Courier' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/CourierBold' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/CourierBoldOblique' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/CourierOblique' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/Helvetica' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/HelveticaBold' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/HelveticaBoldOblique' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/HelveticaOblique' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/Symbol' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/TimesBold' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/TimesBoldItalic' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/TimesItalic' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/TimesRoman' {
  const font: any;
  export default font;
}

declare module 'pdfkit/standard-fonts/ZapfDingbats' {
  const font: any;
  export default font;
}

declare module 'pdfkit/output' {
  export function toBlob(doc: any): Promise<Blob>;
  export function toBytes(doc: any): Promise<Uint8Array>;
}
