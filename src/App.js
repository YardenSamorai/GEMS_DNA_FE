import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import DiamondCard from "./pages/DiamondCard";
import HomePage from "./pages/HomePage";
import JewelryPage from "./pages/JewelryPage";
import { Toaster } from "react-hot-toast";
import Inventory from "./pages/Inventory";

const Header = () => {
  const location = useLocation(); // 👈 current route
  const currentPath = location.pathname;

  return (
    <div className="w-full p-4 flex justify-end bg-white border-b shadow-sm">
      <SignedOut>
        <SignInButton className="text-base text-green-600 border px-4 py-1 rounded-md border-green-600 hover:bg-green-100" />
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl={currentPath} />
      </SignedIn>
    </div>
  );
};

function App() {
  return (
    <>
      <Toaster position="bottom-center" />
      <Router>
        <Header />
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

            {/* ✅ Inventory רק למשתמש מחובר */}
            <Route
              path="/inventory"
              element={
                <>
                  <SignedIn>
                    <Inventory />
                  </SignedIn>
                  <SignedOut>
                    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                      <p className="text-lg">Please sign in to access the inventory</p>
                      <SignInButton mode="modal" />
                    </div>
                  </SignedOut>
                </>
              }
            />

            {/* דפים ציבוריים */}
            <Route path="/jewelry/:modelNumber" element={<JewelryPage />} />
            <Route path="/:stone_id" element={<DiamondCard />} />
          </Routes>
        </div>
      </Router>
    </>
  );
}

export default App;
