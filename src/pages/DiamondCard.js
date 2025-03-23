import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
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

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this gem!',
          text: 'View the full DNA of this gemstone:',
          url,
        });
      } catch (error) {
        toast.error('Sharing canceled or failed.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy the link');
      }
    }
  };

  const handleShareVideo = async () => {
    const videoUrl = details?.video;

    if (!videoUrl) {
      toast.error('No video available to share.');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Gemstone Video',
          text: 'Check out this gemstone video:',
          url: videoUrl,
        });
      } catch (error) {
        toast.error('Sharing canceled or failed.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(videoUrl);
        toast.success('Video link copied to clipboard!');
      } catch (error) {
        toast.error('Failed to copy video link.');
      }
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  if (loading) return <p className="text-center">🔄 Loading..</p>;
  if (!details) return <p className="text-center text-red-600">❌ Stone not found.</p>;

  return (
    <>
      <div className="max-w-3xl mx-auto p-6 shadow-lg rounded-lg border bg-white border-gray-200 overflow-hidden">
        <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">Gemstone Details</h2>

        <div className="grid grid-cols-1 ml-24 sm:grid-cols-2 sm:text-lg md:text-base gap-x-10 gap-y-4 text-gray-700 overflow-x-auto sm:ml-10 md:ml-4">
          <p><span className="font-semibold">Stone ID:</span> <span className="text-green-600">{details.stone_id}</span></p>
          <p><span className="font-semibold">Shape:</span> <span className="text-green-600">{details.shape}</span></p>
          <p><span className="font-semibold">Carat:</span> <span className="text-green-600">{details.carat}</span></p>
          <p><span className="font-semibold">Clarity:</span> <span className="text-green-600">{details.clarity}</span></p>
          <p><span className="font-semibold">Lab:</span> <span className="text-green-600">{details.lab}</span></p>
          <p><span className="font-semibold">Origin:</span> <span className="text-green-600">{details.origin}</span></p>
          <p><span className="font-semibold">Measurements:</span>
            <span className="text-green-600 whitespace-nowrap"> {changeMeasurementsFormat(details.measurements1)}</span>
          </p>
          <p><span className="font-semibold">Ratio:</span> <span className="text-green-600">{details.ratio}</span></p>
          <p><span className="font-semibold">Certificate #: </span>
            <a href={`${barakURL}/${details?.certificate_number}.pdf`} className="text-green-600 underline">
              {details?.certificate_number}
            </a>
          </p>

          <SignedIn>
            <p><span className="font-semibold">Price C/T: </span>
              <span className="font-bold text-green-700">B{encryptPrice(details.price_per_carat)}</span>
            </p>
            <p className=" font-semibold text-xl text-green-700">
              Total Price: {encryptPrice(details.total_price)}
            </p>
          </SignedIn>
        </div>

        <SignedOut>
          <p className="text-base text-center font-bold text-red-500">
            <SignInButton className="text-base">
              <b style={{ cursor: "pointer" }}>Sign in to view pricing details.</b>
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
              <p className="text-gray-500">No Video Available</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 w-112/12 h-full md:grid-cols-2 gap-4 mt-8 text-center">
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
              <a href={`${barakURL}/${details?.certificate_number}.pdf`}>
                Certificate
              </a>
            </h3>
            {details.cert_pdf ? (
              <div className="relative w-full h-72 border border-gray-300 rounded-lg shadow-md overflow-hidden">
                <a
                  href={`${barakURL}/${details?.certificate_number}.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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

        <div className="flex mt-9 text-center justify-around">
          <Button variant="outlined" color="success" onClick={handleShare}>
            Share DNA
          </Button>
          <Button variant="outlined" color="success" onClick={handleShareVideo}>
            Share Video
          </Button>
        </div>
      </div>

    </>
  );
};

export default DiamondCard;
