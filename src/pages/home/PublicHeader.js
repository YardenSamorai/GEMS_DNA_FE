import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SignedIn, UserButton } from "@clerk/clerk-react";
import { AccessAction } from "./AccessAction";

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header className={`home-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="home-container home-nav-inner">
        <Link to="/" className="home-brand" aria-label="Gems DNA home">
          <span className="home-brand-dot" aria-hidden="true" />
          Gems DNA
        </Link>
        <nav className="home-nav-end" aria-label="Account">
          {/* The header's sheet is the page's only invitation handler. */}
          <AccessAction variant="quiet" detectInvite />
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
