import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SignedIn } from "@clerk/clerk-react";

const GemstoneDetails = ({ data }) => {
  const {
    model_number, stock_number, jewelry_type, style, collection,
    price, video_link, all_pictures_link, certificate_link, certificate_number,
    title, description, jewelry_weight, total_carat, stone_type,
    center_stone_carat, center_stone_shape, center_stone_color, center_stone_clarity,
    metal_type, currency, availability, shipping_from, category,
    full_description, jewelry_size, instructions_main
  } = data;

  const images = all_pictures_link?.split(';').map((img) => img.trim()).filter(Boolean);
  const [mainImage, setMainImage] = useState(images?.[0]);
  const [zoom, setZoom] = useState(false);

  return (
    <div className="w-full min-h-screen bg-gray-50 py-12 px-4 sm:px-8 lg:px-24">
      <div className="max-w-7xl mx-auto md:flex gap-10 bg-white p-8 rounded-3xl shadow-xl">
        {/* Images Section */}
        <div className="md:w-1/2 w-full">
          <div className="rounded-2xl overflow-hidden shadow-lg cursor-zoom-in" onClick={() => setZoom(true)}>
            <AnimatePresence mode="wait">
              <motion.img
                key={mainImage}
                src={mainImage}
                alt="Main product"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full aspect-square object-cover rounded-2xl"
              />
            </AnimatePresence>
          </div>
          <div className="flex gap-3 mt-4 overflow-x-auto">
            {images?.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`thumb-${index}`}
                className={`h-20 w-20 rounded-lg object-cover border cursor-pointer transition-all duration-200 ${mainImage === img ? 'ring-2 ring-green-600' : 'hover:ring-1 ring-gray-400'}`}
                onClick={() => setMainImage(img)}
              />
            ))}
          </div>

          {zoom && (
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setZoom(false)}>
              <img src={mainImage} alt="Zoomed" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" />
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="md:w-1/2 w-full mt-6 md:mt-0">
          <p className="text-xs text-green-600 uppercase tracking-wider font-semibold mb-1">{jewelry_type}</p>
          <h1 className="text-3xl font-bold mb-4 text-gray-800">{title}</h1>

          <div className="text-sm mb-6">
            <h2 className="font-semibold text-gray-700 mb-1">Description</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{full_description}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-8">
            <Info label="Model #" value={model_number} />
            <Info label="Collection" value={collection} />
            <Info label="Category" value={category} />
            <Info label="Style" value={style} />
            <Info label="Metal" value={metal_type} />
            <Info label="Weight" value={`${jewelry_weight}g`} />
            <Info label="Center Stone Ct" value={center_stone_carat} />
            <Info label="Shape" value={center_stone_shape} />
            <Info label="Color" value={center_stone_color} />
            <Info label="Clarity" value={center_stone_clarity} />
            <Info label="Total Carat" value={total_carat} />
            <Info label="Certificate:" value={certificate_number} />
          </div>

          <SignedIn>
            <div className="text-base font-semibold text-gray-800 border-t pt-4">
              Stone Price: <span className="text-green-700 font-bold ml-1">{(description.match(/\bB[A-Z]+\b/) || [])[0] || "N/A"}</span>
            </div>
          </SignedIn>

          {certificate_link && (
            <div className="mt-8">
              <h2 className="font-semibold text-gray-700 mb-2">Certificate</h2>
              <iframe
                src={certificate_link}
                title="Certificate"
                className="w-full h-60 border rounded-xl shadow-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="flex justify-between text-gray-700">
    <span className="font-medium text-gray-600">{label}:</span>
    <span className="ml-2 text-right">{value}</span>
  </div>
);

export default GemstoneDetails;
