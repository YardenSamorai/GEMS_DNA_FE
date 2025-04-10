import React from "react";

const InfoCard = ({ icon, title, value, description }) => {
  return (
    <div className="flex items-center gap-4 bg-white shadow-sm border border-gray-200 rounded-xl p-4 w-full max-w-xs">
      {/* Icon */}
      <div className="p-3 bg-blue-100 text-blue-600 rounded-lg text-lg">
        {icon}
      </div>

      {/* Text */}
      <div>
        <h4 className="text-sm font-medium text-gray-500">{title}</h4>
        <p className="text-xl font-semibold text-gray-800">{value}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-1">{description}</p>
        )}
      </div>
    </div>
  );
};

export default InfoCard;