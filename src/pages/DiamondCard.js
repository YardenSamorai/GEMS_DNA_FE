import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton,UserButton } from "@clerk/clerk-react";
import { encryptPrice, changeMeasurementsFormat } from "../utils/helper";
import { barakURL } from "../utils/const";
import { useUser } from "@clerk/clerk-react";
import Button from '@mui/material/Button';
import toast from 'react-hot-toast';

const DiamondCard = () => {
  const { stone_id } = useParams();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const URL = process.env.REACT_APP_API_URL;
  const { isSignedIn } = useUser();

  useEffect(() => {
    if (!stone_id) return;

    fetch(`${URL}/api/stones/${stone_id}`)
      .then((res) => res.json())
      .then((data) => {
        setDetails(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Error fetching stone:", err);
        setLoading(false);
      });
  }, [stone_id, isSignedIn]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Check out this gem!',
          text: 'View the full DNA of this gemstone:',
          url,
        });
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
        await navigator.share({
          title: 'Gemstone Video',
          text: 'Check out this gemstone video:',
          url: videoUrl,
        });
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

  if (loading) return <p className="text-center">🔄 Loading..</p>;
  if (!details) return <p className="text-center text-red-600">❌ Stone not found.</p>;

  return (
    <>
              <SignedIn>
            <UserButton />
          </SignedIn>
      <div className="max-w-3xl mx-auto p-6 shadow-lg rounded-lg border bg-white border-gray-200 overflow-hidden">
        <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">Gemstone Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm sm:text-base text-gray-700 px-4 sm:px-8">
          <div className="flex justify-between"><span className="font-semibold">Stone ID:</span><span className="text-green-600">{details.stone_id}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Shape:</span><span className="text-green-600">{details.shape}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Carat:</span><span className="text-green-600">{details.carat}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Clarity:</span><span className="text-green-600">{details.clarity}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Lab:</span><span className="text-green-600">{details.lab}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Origin:</span><span className="text-green-600">{details.origin}</span></div>
          <div className="flex justify-between col-span-1 sm:col-span-2"><span className="font-semibold">Measurements:</span><span className="text-green-600 whitespace-nowrap">{changeMeasurementsFormat(details.measurements1)}</span></div>
          <div className="flex justify-between col-span-1 sm:col-span-2"><span className="font-semibold">Certificate #:</span><a href={`${barakURL}/${details?.certificate_number}.pdf`} className="text-green-600 underline whitespace-nowrap">{details?.certificate_number}</a></div>
          <div className="flex justify-between"><span className="font-semibold">Ratio:</span><span className="text-green-600">{details.ratio}</span></div>
          <SignedIn>
            <div className="flex justify-between"><span className="font-semibold">Price C/T:</span><span className="font-bold text-green-700">B{encryptPrice(details.price_per_carat)}</span></div>
            <div className="flex justify-between col-span-1 sm:col-span-2 font-semibold text-xl text-green-700"><span>Total Price:</span><span>{encryptPrice(details.total_price)}</span></div>
          </SignedIn>
        </div>

        <SignedOut>
          <p className="text-base text-center font-bold text-red-500">
            <SignInButton className="text-base">
              <b className="text-xs" style={{ cursor: "pointer"}}></b>
            </SignInButton>
          </p>
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
              {/* <p className="text-gray-500">No Video Available</p> */}
              <img placeholder="No Video Available" className="max-h-96" src="https://app.barakdiamonds.com/Gemstones/Output/StoneImages/Eshed_no_image_2.jpg"/>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 w-112/12 h-full md:grid-cols-2 gap-4 mt-8 text-center">
          <div>
            <h3 className="font-semibold text-gray-700">Photo</h3>
            <img src={details?.picture} alt="Diamond" className="w-full h-72 rounded-lg shadow-md" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">
              <a href={`${barakURL}/${details?.certificate_number}.pdf`}>Certificate</a>
            </h3>
            {details.cert_pdf ? (
              <div className="relative w-full h-72 border border-gray-300 rounded-lg shadow-md overflow-hidden">
                <a href={`${barakURL}/${details?.certificate_number}.pdf`} target="_blank" rel="noopener noreferrer">
                  <embed
                    className="w-full h-72 rounded-lg shadow-md"
                    src={`${barakURL}/${details?.certificate_number}.pdf`}
                    type="application/pdf"
                  />
                </a>
              </div>
            ) : (
              <p className="text-gray-500">No Certificate Available</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row mt-9 text-center justify-around gap-4">
          <Button variant="outlined" color="success" onClick={handleShare}>Share DNA</Button>
          <Button variant="outlined" color="success" onClick={handleShareVideo}>Share Video</Button>
          <Button variant="contained" color="success" onClick={handleInterested}>I'm Interested</Button>
        </div>
      </div>
    </>
  );
};

export default DiamondCard;