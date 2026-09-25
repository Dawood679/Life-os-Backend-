// Serverless Node.js polyfills for pdf-parse
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
    }
  };
}
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {};
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {};
}

let PDFParseClass = null;
const getPDFParserClass = () => {
  if (!PDFParseClass) {
    try {
      const mod = require('pdf-parse');
      PDFParseClass = mod.PDFParse || mod.default || mod;
    } catch (err) {
      console.warn('pdf-parse module load warning:', err.message);
    }
  }
  return PDFParseClass;
};

/**
 * Extracts plain text from a PDF file buffer (in-memory, no disk write).
 * @param {Buffer} buffer - raw PDF bytes
 * @returns {Promise<{ text: string, numPages: number }>}
 */
const extractTextFromPDF = async (buffer) => {
  const Parser = getPDFParserClass();
  if (!Parser) {
    throw new Error('PDF Parser is not available in this environment.');
  }

  const parser = new Parser({ data: buffer });

  try {
    const result = await parser.getText();

    const cleanedText = (result.text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!cleanedText || cleanedText.length < 50) {
      throw new Error(
        'Could not extract readable text from this PDF. It may be a scanned image without a text layer.'
      );
    }

    return {
      text: cleanedText,
      numPages: result.total ?? result.numpages ?? 1
    };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
};

module.exports = { extractTextFromPDF };