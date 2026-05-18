import React, { useState } from "react";
import { FILE_KINDS } from "../../../services/jewelryApi";

const KIND_LABEL = Object.fromEntries(FILE_KINDS.map((k) => [k.value, k.label]));

const isImage = (file) => {
  if (file.mime_type) return file.mime_type.startsWith("image/");
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.url || "");
};

const isVideo = (file) => {
  if (file.mime_type) return file.mime_type.startsWith("video/");
  return /\.(mp4|mov|webm|m4v)$/i.test(file.url || "");
};

const FilesGallery = ({ files = [], onDelete, onSetCover, coverUrl }) => {
  const [lightbox, setLightbox] = useState(null);

  if (!files.length) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
        No files yet. Upload sketches, CAD files, progress photos and the final piece.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {files.map((file) => {
          const isCover = coverUrl && file.url === coverUrl;
          return (
            <div
              key={file.id}
              className={`group relative overflow-hidden rounded-xl glass-surface transition hover:bg-app-surface/80 ${
                isCover ? "ring-2 ring-brand-emerald/60" : ""
              }`}
            >
              <div
                className="aspect-square w-full cursor-pointer bg-stone-100"
                onClick={() => isImage(file) && setLightbox(file)}
              >
                {isImage(file) ? (
                  <img
                    src={file.url}
                    alt={file.filename || "file"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : isVideo(file) ? (
                  <video src={file.url} className="h-full w-full object-cover" controls />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center text-xs text-stone-500">
                    <svg className="mb-2 h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate w-full">{file.filename || "file"}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                <span className="truncate text-stone-600">
                  {file.kind ? KIND_LABEL[file.kind] || file.kind : "File"}
                </span>
                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  {isImage(file) && onSetCover && !isCover && (
                    <button
                      onClick={() => onSetCover(file)}
                      className="rounded px-1.5 py-0.5 text-stone-500 hover:bg-emerald-50 hover:text-emerald-700"
                      title="Set as cover"
                    >
                      Cover
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => {
                        if (window.confirm("Delete this file?")) onDelete(file);
                      }}
                      className="rounded px-1.5 py-0.5 text-stone-500 hover:bg-red-50 hover:text-red-700"
                      title="Delete file"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {isCover && (
                <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt={lightbox.filename || "preview"}
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

export default FilesGallery;
