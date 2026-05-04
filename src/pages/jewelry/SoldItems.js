import React from "react";
import JewelryPagePlaceholder from "./components/JewelryPagePlaceholder";

const SoldItems = () => (
  <JewelryPagePlaceholder
    title="Sold Items"
    description="History of every piece you've sold, with buyer and deal links."
    accent="violet"
    icon={
      <svg className="h-7 w-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 13l4 4L19 7" />
      </svg>
    }
  />
);

export default SoldItems;
