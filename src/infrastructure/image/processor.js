const sharp = require('sharp');

async function optimizeImage(buffer) {
  try {
    console.log('Optimizing image...');
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