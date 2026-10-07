import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { EASE_OUT } from "../../design/motion";
import { EXAMPLE_PAIR, EXAMPLE_STONE } from "./examples";

function Reveal({ children, className, as = "div" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 22 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.8, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

const MoreLink = ({ to, children }) => (
  <Link className="home-link" to={to}>
    {children}
    <ChevronRight className="home-link-chevron" size={17} strokeWidth={2} aria-hidden="true" />
  </Link>
);

function StoneLookup() {
  const navigate = useNavigate();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const sku = value.trim();
    if (!sku) {
      setError(true);
      return;
    }
    navigate(`/${encodeURIComponent(sku)}`);
  };

  return (
    <form className="home-lookup" onSubmit={submit} noValidate role="search" aria-label="Open a stone's DNA page">
      <label className="home-lookup-label" htmlFor={id}>
        Have a stone’s code?
      </label>
      <div className="home-lookup-row">
        <input
          id={id}
          className="home-input"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(false);
          }}
          placeholder={`e.g. ${EXAMPLE_STONE}`}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={error || undefined}
          aria-describedby={`${id}-hint`}
        />
        <button type="submit" className="home-btn home-btn--dark">
          Open
        </button>
      </div>
      <p id={`${id}-hint`} className="home-lookup-hint" role={error ? "alert" : undefined}>
        {error ? "Enter the code printed on the stone’s label." : "The code printed on the label, also called the stock number."}
      </p>
    </form>
  );
}

export default function Story() {
  return (
    <>
      <section className="home-section" aria-labelledby="home-address-title">
        <div className="home-container home-split">
          <Reveal>
            <p className="home-eyebrow">Identity</p>
            <h2 id="home-address-title" className="home-section-title">
              One stone. One address.
            </h2>
            <p className="home-section-lede">
              Every stone has its own Gems DNA page. The same address is printed as a QR code on the stone’s label, so
              whoever holds the stone can open its record — no app, no account.
            </p>
            <p className="home-address home-num" aria-label={`gems-dna.com/${EXAMPLE_STONE}`}>
              gems-dna.com/<b>{EXAMPLE_STONE}</b>
            </p>
            <StoneLookup />
          </Reveal>
          <Reveal className="home-pairing">
            <figure className="home-figure home-label">
              <img src="/home/label-qr.svg" width="164" height="164" alt={`QR code for gems-dna.com/${EXAMPLE_STONE}`} />
              <figcaption className="home-label-text home-num">{EXAMPLE_STONE}</figcaption>
            </figure>
            <figure className="home-figure">
              <div className="home-phone">
                <img
                  src="/home/dna-phone.webp"
                  width="780"
                  height="1600"
                  loading="lazy"
                  decoding="async"
                  alt={`The DNA page of stone ${EXAMPLE_STONE} on a phone: a 2.33 ct cushion-cut fancy intense yellow diamond, graded by GIA.`}
                />
              </div>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-verify-title">
        <div className="home-container home-split home-split--flip">
          <Reveal>
            <p className="home-eyebrow">Verification</p>
            <h2 id="home-verify-title" className="home-section-title">
              The report travels with the stone.
            </h2>
            <p className="home-section-lede">
              The laboratory report sits on the stone’s page — its number and the document itself. For GIA reports,
              one tap checks the grading on GIA’s own site.
            </p>
          </Reveal>
          <Reveal as="figure" className="home-figure">
            <img
              className="home-shot"
              src="/home/verify.webp"
              width="1536"
              height="479"
              loading="lazy"
              decoding="async"
              alt="The verification section of a DNA page: GIA report number 2245053478, with buttons to view the certificate and verify it with GIA."
            />
          </Reveal>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-pair-title">
        <div className="home-container home-split">
          <Reveal>
            <p className="home-eyebrow">Matched pairs</p>
            <h2 id="home-pair-title" className="home-section-title">
              Two stones, presented as one.
            </h2>
            <p className="home-section-lede">
              A matched pair shares one page that shows the stones side by side. Each stone still keeps its own
              record, report and label.
            </p>
            <div className="home-actions">
              <MoreLink to={`/${EXAMPLE_PAIR}`}>See a matched pair</MoreLink>
            </div>
          </Reveal>
          <Reveal as="figure" className="home-figure">
            <img
              className="home-shot"
              src="/home/pair.webp"
              width="1536"
              height="687"
              loading="lazy"
              decoding="async"
              alt="The DNA page of a matched pair of Zambian emeralds, 7.02 ct in total: two cushion-cut stones side by side, each linked to its own record."
            />
          </Reveal>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-workspace-title">
        <div className="home-container">
          <Reveal>
            <p className="home-eyebrow">Workspace</p>
            <h2 id="home-workspace-title" className="home-section-title">
              Behind every page, a working inventory.
            </h2>
            <p className="home-section-lede">
              The team that holds the stones keeps them in a private Gems DNA workspace — and every DNA page is
              published from it.
            </p>
          </Reveal>
          <Reveal as="ul" className="home-panel">
            {WORKSPACE.map(([title, copy]) => (
              <li key={title} className="home-panel-item">
                <h3 className="home-panel-title">{title}</h3>
                <p className="home-panel-copy">{copy}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>
    </>
  );
}

const WORKSPACE = [
  ["Inventory", "Diamonds, gemstones and jewelry in one searchable list, kept in step with the stock system."],
  ["Matched pairs", "A pair view that keeps matched stones together while you search and select."],
  ["Memos and catalogs", "Branded consignment memos, PDF catalogs and Excel exports from any selection."],
  ["Labels", "QR labels that open each stone’s DNA page, printed from the browser over Bluetooth."],
  ["Clients", "Contacts, stores and deals, with DNA links sent straight to WhatsApp."],
  ["Team", "Roles and section-by-section permissions for every member."],
];
