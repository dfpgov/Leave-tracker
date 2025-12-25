// test-upload-to-drive.js
// Run with: node test-upload-to-drive.js
// Requires: npm install node-fetch form-data (if you want multipart later)

const fetch = require('node-fetch'); // or use built-in fetch in Node 18+

async function testUpload() {
  console.log('Starting Google Drive upload test...');

  // Option 1: Use a small base64-encoded test image (1x1 pixel transparent PNG)
  const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApaUAAAAASUVORK5CYII=';

  // Option 2: Or use a real local file (uncomment if you prefer)
  // const fs = require('fs');
  // const path = require('path');
  // const filePath = path.join(__dirname, 'test-image.png');
  // const buffer = fs.readFileSync(filePath);
  // const testBase64 = buffer.toString('base64');

  const payload = {
    base64: testBase64,                    // or base64Data if your server still uses old name
    filename: 'test-upload-' + Date.now() + '.png',
    mimetype: 'image/png',
  };

  // If your server still expects old field names (base64Data, fileName, mimeType), use this instead:
  // const payload = {
  //   base64Data: testBase64,
  //   fileName: 'test-upload-' + Date.now() + '.png',
  //   mimeType: 'image/png',
  // };

  try {
    console.log('Sending request to /api/upload-image...');
    const response = await fetch('http://localhost:3000/api/upload-image', {  // Change to your deployed Vercel URL if testing live
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ SUCCESS! Upload worked:');
      console.log('File ID:', data.fileId);
      console.log('Direct URL:', data.directUrl);
      console.log('Preview URL:', data.previewUrl);
      console.log('Full response:', JSON.stringify(data, null, 2));
    } else {
      console.error('❌ Upload FAILED:');
      console.error('Status:', response.status);
      console.error('Error message:', data.error);
      console.error('Details:', data.details || 'No details');
    }
  } catch (error) {
    console.error('Network or fetch error:', error.message);
  }
}

testUpload();
