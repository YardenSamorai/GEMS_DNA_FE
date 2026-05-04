import React from "react";
import JewelryPagePlaceholder from "./components/JewelryPagePlaceholder";

const Designs = () => (
  <JewelryPagePlaceholder
    title="Designs / CAD Library"
    description="Reusable design templates, sketches and CAD files."
    accent="rose"
    icon={
      <svg className="h-7 w-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    }
  />
);

export default Designs;
