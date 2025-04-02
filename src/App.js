import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import { Toaster } from 'react-hot-toast';
import HomePage from "./pages/HomePage";

function App() {
  return (
    <>
    <Toaster position="bottom-center" />
    <Router>
      <div className="App">
        <header>
        </header>
        <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/:stone_id" element={<DiamondCard />} />
        </Routes>

        <footer className="items-center flex justify-center text-sm">       
          <SignedOut>
            <SignInButton className="text-base text-green-600" />
          </SignedOut>
          </footer>
      </div>
    </Router>
  </>
  );
}

export default App;
