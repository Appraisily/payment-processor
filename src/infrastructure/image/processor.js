const sharp = require('sharp');
const heicConvert = require('heic-convert');

async function convertHeicToJpeg(buffer) {
  try {
    console.log('Converting HEIC/HEIF to JPEG...');
    const jpegBuffer = await heicConvert({
      buffer: buffer,
      format: 'JPEG',
      quality: 0.85
    });
    console.log('HEIC/HEIF conversion successful');
    return jpegBuffer;
  } catch (error) {
    console.error('Error converting HEIC/HEIF:', error);
    throw new Error('Failed to convert HEIC/HEIF image');
  }
}

async function optimizeImage(buffer) {
  try {
    console.log('Optimizing image...');
    
    // Check if the buffer is from a HEIC/HEIF image
    const isHeic = buffer.toString('hex', 4, 8).toLowerCase() === '66747970';
    if (isHeic) {
      buffer = await convertHeicToJpeg(buffer);
    }
    
    return await sharp(buffer)
      .jpeg({
        quality: 85,
        progressive: true
      })
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .rotate()
      .toBuffer();
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to process image');
  }
}

async function optimizeImages(files) {
  console.log('Processing images:', Object.keys(files));
  const processedImages = {};
  for (const [key, fileArray] of Object.entries(files)) {
    if (fileArray && fileArray[0]) {
      console.log(`Processing ${key} image...`);
      processedImages[key] = await optimizeImage(fileArray[0].buffer);
      console.log(`${key} image processed successfully`);
    }
  }
  return processedImages;
}

module.exports = {
  optimizeImage,
  optimizeImages
};