import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
    <Toaster position="bottom-center" />
    <Router>
      <div className="App">
        <header>
          <SignedOut>
            <SignInButton className="text-base text-green-600" />
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
  </>
  );
}

export default App;
