const sharp = require('sharp');

async function optimizeImage(buffer) {
  try {
    // Process image with sharp
    const processed = await sharp(buffer)
      // Convert to JPEG format
      .jpeg({
        quality: 85,
        progressive: true
      })
      // Resize if larger than 2000px while maintaining aspect ratio
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true
      })
      // Remove EXIF data for privacy
      .rotate() // Auto-rotate based on EXIF orientation
      .toBuffer();

    return processed;
  } catch (error) {
    console.error('Error optimizing image:', error);
    throw new Error('Failed to process image');
  }
}

module.exports = {
  optimizeImage
};