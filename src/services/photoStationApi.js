const API_BASE = process.env.REACT_APP_API_URL || "https://gems-dna-be.onrender.com";
const BASE = `${API_BASE}/api/photo-station`;

const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
};

const post = (url, payload) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  }).then(json);

export const fetchStatus = (check = false) => fetch(`${BASE}/status${check ? "?check=1" : ""}`).then(json);

export const fetchQueue = (limit = 12) => fetch(`${BASE}/queue?limit=${limit}`).then(json);

export const fetchStone = (sku) => fetch(`${BASE}/stone/${encodeURIComponent(sku)}`).then(json);

export const uploadCapture = (sku, blob) => {
  const form = new FormData();
  form.append("sku", sku);
  form.append("photo", blob, `${sku}.jpg`);
  return fetch(`${BASE}/captures`, { method: "POST", body: form }).then(json);
};

export const fetchCaptures = (status = "pending") => fetch(`${BASE}/captures?status=${status}`).then(json);

export const approveCapture = (id, variant) => post(`${BASE}/captures/${id}/approve`, { variant });

export const rejectCapture = (id, reason) => post(`${BASE}/captures/${id}/reject`, { reason });

// Phones shoot 12-50MP. The server works at 3000px on the long side, so
// anything bigger is wasted upload time on the office wifi.
export const prepareShot = (file, maxSide = 3000, quality = 0.92) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * ratio);
      canvas.height = Math.round(img.naturalHeight * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not read the photo"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the photo"));
    };
    img.src = url;
  });
