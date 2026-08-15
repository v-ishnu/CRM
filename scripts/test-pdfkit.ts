import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

function runTest() {
  console.log('Starting isolated PDFKit test...');
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const outputDir = path.join(process.cwd(), 'public', 'invoices');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'test-isolated.pdf');
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    doc.fontSize(20).text('Isolated PDFKit Test Success');
    doc.end();

    writeStream.on('finish', () => {
      console.log('Isolated PDF successfully generated at:', outputPath);
      const exists = fs.existsSync(outputPath);
      const size = exists ? fs.statSync(outputPath).size : 0;
      console.log(`File Exists: ${exists}, Size: ${size} bytes`);
      if (exists && size > 0) {
        console.log('SUCCESS: pdfkit font resolution is working perfectly!');
      } else {
        console.error('FAILURE: Generated file is empty or missing!');
      }
    });

    writeStream.on('error', (err) => {
      console.error('Stream error during isolated PDF generation:', err);
    });
  } catch (error) {
    console.error('FATAL: Isolated PDFKit creation crashed:', error);
  }
}

runTest();
