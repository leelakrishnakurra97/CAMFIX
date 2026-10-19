const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateQrImage(assetId, assetName, category) {
  const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'qrcodes');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filename = `${assetId.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  const filePath = path.join(uploadsDir, filename);

  const payload = JSON.stringify({
    asset_id: assetId,
    name: assetName,
    category: category,
    scanned_at: new Date().toISOString()
  });

  await QRCode.toFile(filePath, payload, {
    width: 400,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });

  return `/uploads/qrcodes/${filename}`;
}

module.exports = {
  generateQrImage
};
