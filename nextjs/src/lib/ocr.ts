import axios from 'axios';

export async function callOcrService(imageUrl: string): Promise<string> {
  try {
    const response = await axios.post(`${process.env.OCR_SERVICE_URL}/ocr/tesseract/url`, {
      url: imageUrl,
    });
    
    return response.data.text || '';
  } catch (error) {
    console.error('OCR service error:', error);
    return '';
  }
}
