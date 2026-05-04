import React from "react";

/**
 * Shared placeholder for jewelry sub-pages we haven't designed yet.
 * Each sub-page renders this until the user sends the spec for it.
 */
const JewelryPagePlaceholder = ({ icon, title, description, accent = "emerald" }) => {
  const accentBg = {
    emerald: "from-emerald-500/10 to-emerald-500/0 ring-emerald-500/20 text-emerald-600",
    amber: "from-amber-500/10 to-amber-500/0 ring-amber-500/20 text-amber-600",
    sky: "from-sky-500/10 to-sky-500/0 ring-sky-500/20 text-sky-600",
    violet: "from-violet-500/10 to-violet-500/0 ring-violet-500/20 text-violet-600",
    rose: "from-rose-500/10 to-rose-500/0 ring-rose-500/20 text-rose-600",
    stone: "from-stone-500/10 to-stone-500/0 ring-stone-500/20 text-stone-600",
  }[accent] || "from-emerald-500/10 to-emerald-500/0 ring-emerald-500/20 text-emerald-600";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      </div>

      <div className={`relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br p-10 text-center ${accentBg.split(" ").slice(0, 2).join(" ")}`}>
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white ring-1 shadow-sm ${accentBg.split(" ").slice(2, 3)} ${accentBg.split(" ").slice(3, 4)}`}>
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-stone-800">Let's design this page together</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
          Send your spec — what data should appear, the layout, and any actions you want — and we'll build it out.
        </p>
      </div>
    </div>
  );
};

export default JewelryPagePlaceholder;
