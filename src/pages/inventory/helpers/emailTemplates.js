import { getDisplayShape } from "./constants";

/* ---------------- Email Helpers ---------------- */
export const createEmailText = (stone) => `Stone Details

SKU: ${stone.sku}
Shape: ${getDisplayShape(stone.shape)}
Weight: ${stone.weightCt} ct
Measurements: ${stone.measurements || 'N/A'}
Clarity: ${stone.clarity || 'N/A'}
Treatment: ${stone.treatment || 'N/A'}
Lab: ${stone.lab || 'N/A'}
Origin: ${stone.origin || 'N/A'}

Photo: ${stone.imageUrl || 'N/A'}
Video: ${stone.videoUrl || 'N/A'}
Certificate: ${stone.certificateUrl || 'N/A'}

Best regards,
Gemstar`;

export const createEmailHtml = (stone) => `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f5f5f4; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e7e5e4;">
<div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; text-align: center;">
<h1 style="color: white; margin: 0; font-size: 24px;">Stone Details</h1>
</div>
<div style="padding: 24px;">
${stone.imageUrl ? `<img src="${stone.imageUrl}" style="width: 200px; height: 200px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto 20px;" />` : ''}
<table style="width: 100%; border-collapse: collapse;">
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>SKU:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.sku}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Shape:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${getDisplayShape(stone.shape)}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Weight:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.weightCt} ct</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Measurements:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.measurements || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;"><strong>Treatment:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">${stone.treatment || 'N/A'}</td></tr>
<tr><td style="padding: 8px 0;"><strong>Origin:</strong></td><td style="padding: 8px 0;">${stone.origin || 'N/A'}</td></tr>
</table>
<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e7e5e4; text-align: center;">
${stone.videoUrl ? `<a href="${stone.videoUrl}" style="color: #10b981; margin-right: 16px;">View Video</a>` : ''}
${stone.certificateUrl ? `<a href="${stone.certificateUrl}" style="color: #10b981;">View Certificate</a>` : ''}
</div>
</div>
<div style="background: #f5f5f4; padding: 16px; text-align: center; font-size: 12px; color: #78716c;">
Best regards, Gemstar
</div>
</div>
</body>
</html>`;
