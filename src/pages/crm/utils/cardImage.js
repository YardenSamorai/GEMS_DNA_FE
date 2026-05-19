// Image helpers shared by the business-card flows.
//
// ScanCardModal originally defined these inline. They are now extracted so
// AttachCardModal (the retrofit flow for attaching a card to an *existing*
// contact) and any future card-related entry point can re-use the exact
// same downscale / thumbnail pipeline. Keeping a single implementation
// means thumbnails saved through either flow render identically in the
// contacts list.

export const downscaleImage = (file, maxSide = 1600, quality = 0.85) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });

// Generate a tiny thumbnail (~6KB) suitable for inline display in the
// contacts list. Same defaults the original scan flow used so existing
// thumbnails and new ones stay visually consistent.
export const makeThumbnail = (dataUrl, maxSide = 240, quality = 0.7) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
