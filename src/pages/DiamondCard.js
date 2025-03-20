import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

// 🔐 פונקציה להצפנת מחיר
const encryptPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return "N/A"; // ✅ בדיקה למקרה שאין מחיר

  const mapping = {
    "000": "Z",
    "00": "Y",
    "0": "I",
    "1": "H",
    "2": "A",
    "3": "R",
    "4": "E",
    "5": "L",
    "6": "O",
    "7": "V",
    "8": "S",
    "9": "K",
  };

  let strPrice = price.toString();
  let encrypted = "";
  let i = 0;

  while (i < strPrice.length) {
    if (i + 2 < strPrice.length && strPrice[i] === "0" && strPrice[i + 1] === "0" && strPrice[i + 2] === "0") {
      encrypted += mapping["000"];
      i += 3;
    } else if (i + 1 < strPrice.length && strPrice[i] === "0" && strPrice[i + 1] === "0") {
      encrypted += mapping["00"];
      i += 2;
    } else {
      encrypted += mapping[strPrice[i]];
      i += 1;
    }
  }

  return encrypted;
};

const DiamondCard = () => {
  const { stone_id } = useParams(); // 📌 שליפה של ה-stone_id מה-URL
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stone_id) return;

    fetch(`http://localhost:3000/api/stones/${stone_id}`) // 📌 קריאה ל-API
      .then((res) => res.json())
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error fetching stone:", err);
        setLoading(false);
      });
  }, [stone_id]);

  if (loading) return <p className="text-center">🔄 Loading..</p>;
  if (!details) return <p className="text-center text-red-600">❌ לא נמצא מידע על האבן</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 shadow-lg rounded-lg border bg-gradient-to-t bg-green- border-gray-200 bg-white overflow-hidden">
      <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">Diamond Details</h2>
      <div className="grid grid-cols-1 ml-24 sm:grid-cols-2 sm:text-lg md:text-base gap-x-10 gap-y-4 text-gray-700 overflow-x-auto sm:ml-10 md:ml-4">
        <p><span className="font-semibold">Stone ID:</span> <span className="text-green-600">{details.stone_id}</span></p>
        <p><span className="font-semibold">Shape:</span> <span className="text-green-600">{details.shape}</span></p>
        <p><span className="font-semibold">Carat:</span> <span className="text-green-600">{details.carat}</span></p>
        <p><span className="font-semibold">Clarity:</span> <span className="text-green-600">{details.clarity}</span></p>
        <p><span className="font-semibold">Lab:</span> <span className="text-green-600">{details.lab}</span></p>
        <p><span className="font-semibold">Origin:</span> <span className="text-green-600">{details.origin}</span></p>
        <p><span className="font-semibold">Measurements:</span>
          <span className="text-green-600 whitespace-nowrap">{details.measurements1}</span>
        </p>
        <p><span className="font-semibold">Ratio:</span> <span className="text-green-600">{details.ratio}</span></p>
        <p><span className="font-semibold">Certificate #:</span> 
          <a href={`https://app.barakdiamonds.com/Gemstones/Output/Certificates/${details?.certificate_number}.pdf`} 
             className="text-green-600 underline">
            {details.certificate_number}
          </a>
        </p>

        <SignedIn>
          <p><span className="font-semibold">Price C/T:</span> 
            <span className="font-bold text-green-700">B-{encryptPrice(details.price_per_carat)}</span>
          </p>
          <p className="text-center font-semibold text-xl text-green-700 mt-4">
            Total Price: {encryptPrice(details.total_price)}
          </p>
        </SignedIn>
      </div>

      <SignedOut>
        <p className="text-base text-center font-bold text-red-500"><b>Sign in to view pricing details.</b></p>
      </SignedOut>

      <div className="mt-6 text-center overflow-hidden">
        {details.video ? (
          <iframe
            className="w-full rounded-lg overflow-hidden"
            src={details?.video}
            title="Video Preview"
            frameBorder="0"
            allowFullScreen
            style={{ height: details?.video.includes('segoma') ? '600px' : '300px' }}
          ></iframe>
        ) : (
          <div className="w-full h-32 bg-gray-200 flex items-center justify-center rounded-lg">
            <p className="text-gray-500">No Video Available</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 w-112/12 h-96 md:grid-cols-2 gap-4 mt-8 text-center">
        <div>
          <h3 className="font-semibold text-gray-700">Photo</h3>
          <img
            src={details?.picture}
            alt="Diamond"
            className="w-full h-72 rounded-lg shadow-md"
          />
        </div>
        <div>
          <h3 className="font-semibold text-gray-700">
            <a href={`https://app.barakdiamonds.com/Gemstones/Output/Certificates/${details?.certificate_number}.pdf`}>
              Certificate
            </a>
          </h3>
          {details.cert_pdf ? (
            <div className="relative w-full h-72 border border-gray-300 rounded-lg shadow-md overflow-hidden">
              <a href={`https://app.barakdiamonds.com/Gemstones/Output/Certificates/${details?.certificate_number}.pdf`}
                target="_blank"
                rel="noopener noreferrer">
                <embed
                  className="w-full h-72 rounded-lg shadow-md"
                  src={`https://app.barakdiamonds.com/Gemstones/Output/Certificates/${details?.certificate_number}.pdf`}
                  type="application/pdf"
                />
              </a>
            </div>
          ) : (
            <p className="text-gray-500">No Certificate Available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiamondCard;
