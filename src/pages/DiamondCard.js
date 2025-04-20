import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { decryptPrice } from "../utils/decrypt";
import { changeMeasurementsFormat } from "../utils/helper";
import { barakURL } from "../utils/const";
import Button from '@mui/material/Button';
import toast from 'react-hot-toast';

const DiamondCard = () => {
  const { stone_id } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const URL = process.env.REACT_APP_API_URL;
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!stone_id) return;

    fetch(`https://gems-dna-be.onrender.com/api/stones/${stone_id}`)
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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Check out this gem!', text: 'View the full DNA of this gemstone:', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  const handleShareVideo = async () => {
    const videoUrl = details?.video;
    if (!videoUrl) return toast.error('No video available to share.');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Gemstone Video', text: 'Check out this gemstone video:', url: videoUrl });
      } else {
        await navigator.clipboard.writeText(videoUrl);
        toast.success('Video link copied to clipboard!');
      }
    } catch (error) {
      toast.error('Sharing canceled or failed.');
    }
  };

  const handleInterested = () => {
    const stoneId = details?.stone_id || "Unknown";
    const message = `Hi, I'm interested in stone ${stoneId}. Can you provide more details?`;
    const phoneNumber = "972585555778";
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
  };

  if (loading) return <p className="text-center">🔄 Loading...</p>;
  if (!details) return <p className="text-center text-red-600">❌ Stone not found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 sm:p-10 bg-white rounded-2xl shadow-md border border-gray-200">
      <h2 className="text-2xl sm:text-xl font-bold text-center text-gray-800 mb-8 border-b pb-2 border-gray-300">{details.shape} {details.carat} {details.lab} {details.clarity}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-10 text-sm sm:text-base text-gray-700">
        <Info label="Stone ID" value={details.stone_id} />
        <Info label="Shape" value={details.shape} />
        <Info label="Carat" value={details.carat} />
        <Info label="Clarity" value={details.clarity} />
        <Info label="Lab" value={details.lab} />
        <Info label="Origin" value={details.origin} />
        <Info label="Ratio" value={details.ratio} />
        <Info label="Measurements" value={changeMeasurementsFormat(details.measurements1)} wide />
        <Info label="Certificate #" value={<a href={`${barakURL}/${details.certificate_number}.pdf`} className="text-green-600 underline">{details.certificate_number}</a>} wide />

        {isSignedIn && (
          <>
            <Info label="Price C/T" value={`B${decryptPrice(details.price_per_carat).toLocaleString()}`} />
            <div className="flex justify-between col-span-1 sm:col-span-2 text-xl font-semibold text-green-700">
              <span>Total Price:</span>
              <span>{decryptPrice(details.total_price).toLocaleString()}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
        {details.video ? (
          <iframe className="w-full h-[300px] sm:h-[500px]" src={details.video} title="Video Preview" allowFullScreen></iframe>
        ) : (
          <div className="w-full h-64 flex items-center justify-center">
            <img src="https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg" className="h-full object-contain" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">Photo</h3>
          <img src={details.picture} alt="Diamond" className="w-full h-72 object-contain border rounded-lg" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-700 mb-2">Certificate</h3>
          {details.cert_pdf ? (
            <a href={`${barakURL}/${details.certificate_number}.pdf`} target="_blank" rel="noopener noreferrer">
              <embed src={`${barakURL}/${details.certificate_number}.pdf`} className="w-full h-72 border rounded-lg" type="application/pdf" />
            </a>
          ) : (
            <p className="text-gray-500">No Certificate Available</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-4 mt-10">
        <Button variant="outlined" color="success" onClick={handleShare}>Share DNA</Button>
        <Button variant="outlined" color="success" onClick={handleShareVideo}>Share Video</Button>
        <Button variant="contained" color="success" onClick={handleInterested}>I'm Interested</Button>
      </div>
    </div>
  );
};

const Info = ({ label, value, wide }) => (
  <div className={`flex justify-between ${wide ? 'col-span-1 sm:col-span-2' : ''}`}>
    <span className="font-medium text-gray-600">{label}:</span>
    <span className="text-green-700 font-semibold text-right ml-2">{value}</span>
  </div>
);

export default DiamondCard;
