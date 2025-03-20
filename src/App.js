import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";

function App() {
  return (
    <Router>
      <div className="App">
        <header>
          <SignedOut>
            <SignInButton className="text-base" />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>
        <Routes>
        <Route path="/:stone_id" element={<DiamondCard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
