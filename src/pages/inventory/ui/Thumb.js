import React, { memo, useState } from "react";
import { Gem } from "lucide-react";
import ShapeIcon from "../components/ShapeIcon";
import { getDisplayShape } from "../helpers/constants";

/* Fixed-size photo tile. The box never changes size, so a missing or broken
 * image swaps to the shape outline without moving anything around it. */
const Thumb = ({ src, shape, jewelry, size = "md", alt = "", eager = false }) => {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  const cls = `inv-thumb${size === "lg" ? " inv-thumb--lg" : size === "fill" ? " inv-thumb--fill" : ""}${showImg ? " inv-thumb--photo" : ""}`;
  const iconSize = size === "fill" ? 56 : size === "lg" ? 34 : 26;
  return (
    <span className={cls} aria-hidden={showImg && alt ? undefined : "true"}>
      {showImg ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable="false"
          onError={() => setFailed(true)}
        />
      ) : jewelry || !shape ? (
        <Gem size={iconSize * 0.7} strokeWidth={1.25} aria-hidden="true" />
      ) : (
        <ShapeIcon shape={getDisplayShape(shape)} color="currentColor" size={iconSize} />
      )}
    </span>
  );
};

export default memo(Thumb);
