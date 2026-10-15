import React, { Suspense, lazy } from "react";

// SpinningGem renders with three.js; loading it on demand keeps the 3D
// engine out of the main bundle the loaders themselves wait on.
const SpinningGem = lazy(() => import("./SpinningGem"));

export default function LoadingGem({ size = 64 }) {
  return (
    <Suspense fallback={<div style={{ width: size, height: size }} aria-hidden />}>
      <SpinningGem size={size} />
    </Suspense>
  );
}
