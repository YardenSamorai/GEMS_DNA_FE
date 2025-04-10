import React from "react";
import { SignedIn } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const SidebarMenu = () => {
  return (
    <SignedIn>
      <aside className="w-64 bg-gray-100 p-4 shadow-md">
        <h2 className="text-xl font-bold mb-6">Menu</h2>
        <nav className="flex flex-col gap-4">
          <Link to="dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <Link to="/settings" className="text-blue-600 hover:underline">Settings</Link>
        </nav>
      </aside>
    </SignedIn>
  );
};

export default SidebarMenu;
