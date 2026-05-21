import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Read a file as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Load PDF document from a File object.
 * @param {File} file 
 * @returns {Promise<pdfjsLib.PDFDocumentProxy>}
 */
export async function loadPdfDoc(file) {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    return pdfDoc;
  } catch (error) {
    console.error("Error loading PDF document:", error);
    throw new Error("Invalid or corrupted PDF file.");
  }
}

/**
 * Render a PDF page onto a canvas element.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc 
 * @param {number} pageNum 
 * @param {HTMLCanvasElement} canvas 
 * @param {number} scale 
 */
export async function renderPageToCanvas(pdfDoc, pageNum, canvas, scale = 1.0) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
  } catch (error) {
    console.error(`Error rendering page ${pageNum} to canvas:`, error);
    throw error;
  }
}

/**
 * Extract text content from a PDF page.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc 
 * @param {number} pageNum 
 * @returns {Promise<string>}
 */
export async function getPageText(pdfDoc, pageNum) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const textItems = textContent.items.map(item => item.str);
    
    // Attempt to reconstruct lines based on item positions if necessary,
    // but for simple LLM parsing, joining with space/newline is very effective.
    return textItems.join(" ");
  } catch (error) {
    console.error(`Error extracting text from page ${pageNum}:`, error);
    return "";
  }
}

/**
 * Generate a PNG Data URL (base64) of a PDF page.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc 
 * @param {number} pageNum 
 * @param {number} scale - Higher scale for better OCR accuracy by Gemini
 * @returns {Promise<string>} PNG base64 Data URL
 */
export async function getPageDataUrl(pdfDoc, pageNum, scale = 1.5) {
  try {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const context = canvas.getContext('2d');
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error(`Error rendering page ${pageNum} to image data url:`, error);
    throw error;
  }
}
