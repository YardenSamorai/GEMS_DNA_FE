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
          <Routes>
            <Route 
              path="/dashboard" 
              element={
                <>
                  <SignedIn>
                    <HomePage />
                  </SignedIn>
                  <SignedOut>
                    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                      <p className="text-lg">Please sign in to access the dashboard</p>
                      <SignInButton mode="modal" />
                    </div>
                  </SignedOut>
                </>
              } 
            />

            <Route path="/:stone_id" element={<DiamondCard />} />
          </Routes>

          <footer className="items-center flex justify-center text-sm p-4">
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