import React from "react";
import { Link } from "react-router-dom";
import { orderPair } from "../../components/PairDnaView";

// Same three destinations as the shared PairSwitcher, in the DNA page's own skin.
const DnaPairSwitch = ({ a, b, current }) => {
  const [first, second] = orderPair(a, b);
  const tabs = [
    { key: "pair", label: "Pair", to: `/${first.stone_id}` },
    { key: first.stone_id, label: first.stone_id, to: `/${first.stone_id}?single=1` },
    { key: second.stone_id, label: second.stone_id, to: `/${second.stone_id}?single=1` },
  ];

  return (
    <nav className="dna-pair" aria-label="Matched pair">
      <div className="dna-seg dna-seg--block">
        {tabs.map((tab) =>
          tab.key === current ? (
            <span key={tab.key} className="dna-seg-btn is-active dna-num" aria-current="page">
              <span className="dna-seg-pill" />
              <span className="dna-seg-label">{tab.label}</span>
            </span>
          ) : (
            <Link key={tab.key} to={tab.to} className="dna-seg-btn dna-num">
              <span className="dna-seg-label">{tab.label}</span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
};

export default DnaPairSwitch;
