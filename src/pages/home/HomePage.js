import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTeam } from "../../context/TeamContext";
import { firstAllowedLanding } from "../../utils/permissions";
import PublicHeader from "./PublicHeader";
import Journey from "./Journey";
import Story from "./Story";
import { AccessAction } from "./AccessAction";
import "./home.css";

const TITLE = "Gems DNA — The digital identity of every gemstone";
const DESCRIPTION =
  "Every stone gets one permanent page — photographs, 360° video, laboratory report and specifications — opened from the QR code on its label.";

function useDocumentMeta() {
  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    const prev = { title: document.title, description: meta?.getAttribute("content") };
    document.title = TITLE;
    meta?.setAttribute("content", DESCRIPTION);
    // The page is light by design; keep overscroll and the status bar on the same ground.
    const html = document.documentElement;
    const prevBg = html.style.backgroundColor;
    html.style.backgroundColor = "#f5f5f7";
    return () => {
      document.title = prev.title;
      if (meta && prev.description != null) meta.setAttribute("content", prev.description);
      html.style.backgroundColor = prevBg;
    };
  }, []);
}

export default function HomePage() {
  const team = useTeam();
  useDocumentMeta();

  // Unchanged from the previous landing: members without admin rights skip
  // the public page and land on the first section they're allowed to open.
  if (team?.ready && !team?.isAdmin && !team?.isStoreUser) {
    return <Navigate to={firstAllowedLanding(team.can) || "/dashboard"} replace />;
  }

  return (
    <div className="home">
      <a className="home-skip" href="#home-main">
        Skip to content
      </a>
      <PublicHeader />
      <main id="home-main">
        <Journey />
        <Story />
        <section className="home-closing" aria-labelledby="home-access-title">
          <div className="home-container">
            <div className="home-closing-inner">
              <h2 id="home-access-title" className="home-section-title">
                Workspaces open by invitation.
              </h2>
              <p className="home-section-lede">
                A team administrator invites each member. If you’ve received an invitation, sign in to continue.
              </p>
              <div className="home-actions">
                <AccessAction />
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <div className="home-container">
          <div className="home-footer-inner">
            <span className="home-brand">
              <span className="home-brand-dot" aria-hidden="true" />
              Gems DNA
            </span>
            <p>© {new Date().getFullYear()} Gemstar</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
