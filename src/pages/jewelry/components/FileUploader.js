import React, { useCallback, useRef, useState } from "react";
import { uploadBlob } from "../../../services/jewelryApi";

const FileUploader = ({ onUploaded, accept = "image/*,video/*", multiple = true, folder = "jewelry" }) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      for (const file of files) {
        const ticket = { id: `${Date.now()}-${file.name}`, name: file.name, status: "uploading" };
        setUploads((u) => [...u, ticket]);
        try {
          const res = await uploadBlob(file, folder);
          setUploads((u) => u.map((x) => (x.id === ticket.id ? { ...x, status: "done" } : x)));
          if (onUploaded) {
            await onUploaded({
              url: res.url,
              filename: res.filename || file.name,
              mimeType: res.contentType || file.type,
              sizeBytes: res.size || file.size,
            });
          }
          setTimeout(() => {
            setUploads((u) => u.filter((x) => x.id !== ticket.id));
          }, 2000);
        } catch (err) {
          console.error("upload failed:", err);
          setUploads((u) =>
            u.map((x) => (x.id === ticket.id ? { ...x, status: "error", error: err.message } : x))
          );
        }
      }
    },
    [onUploaded, folder]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
          isDragging
            ? "border-emerald-500 bg-emerald-50"
            : "border-stone-300 bg-stone-50 hover:border-stone-400 hover:bg-stone-100"
        }`}
      >
        <svg className="mb-2 h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.9-1A5.5 5.5 0 0118 16h-1m-6-4l3-3m0 0l3 3m-3-3v9" />
        </svg>
        <div className="text-sm font-medium text-stone-700">Drop files here or click to upload</div>
        <div className="mt-1 text-xs text-stone-500">Images, videos, CAD files (max 50MB each)</div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {uploads.map((u) => (
            <li
              key={u.id}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${
                u.status === "error"
                  ? "bg-red-50 text-red-700"
                  : u.status === "done"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-stone-50 text-stone-700"
              }`}
            >
              <span className="truncate">{u.name}</span>
              <span className="ml-3 shrink-0 font-medium">
                {u.status === "uploading" && "Uploading..."}
                {u.status === "done" && "Uploaded"}
                {u.status === "error" && (u.error || "Failed")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileUploader;
