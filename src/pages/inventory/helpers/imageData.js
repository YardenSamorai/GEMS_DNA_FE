

/* ---------------- SVG to PNG Helper for Excel Logo ---------------- */
export const svgToPngBase64 = (svgUrl, width = 600, height = 340) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(width / img.width, height / img.height) * 0.85;
      const x = (width - img.width * scale) / 2;
      const y = (height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = svgUrl;
  });
};

export const imageToBase64 = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};
