import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import PresentationsPage from "./PresentationsPage";
import * as api from "../../services/presentationsApi";
import { rememberRecent } from "./presentModel";

const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => {
    const { useState } = jest.requireActual("react");
    return {
      useNavigate: () => mockNavigate,
      useSearchParams: () => {
        const [params, setParams] = useState(new URLSearchParams());
        return [params, (next) => setParams(new URLSearchParams(next))];
      },
    };
  },
  { virtual: true }
);
jest.mock("@clerk/clerk-react", () => ({ useUser: () => ({ user: { id: "u1" }, isLoaded: true }) }));
jest.mock("./presentHooks", () => ({
  loadCatalog: () => Promise.resolve({ stones: [{ sku: "T1", category: "Emerald", imageUrl: "https://x/t1.jpg" }], jewelry: [] }),
}));
jest.mock("../../services/presentationsApi");

const mine = {
  id: 7,
  name: "Dubai show",
  items: ["T1", "GONE"],
  settings: { prices: "off", interval: "12", brand: "eshed" },
  shared: false,
  sharedWith: [],
  mine: true,
  canDelete: true,
  createdByName: "Yarden",
  updatedAt: new Date().toISOString(),
};
const theirs = { ...mine, id: 8, name: "Bob's", shared: true, mine: false, canDelete: false, createdByName: "Bob" };

beforeEach(() => {
  localStorage.clear();
  api.fetchPresentations.mockResolvedValue([mine, theirs]);
  api.fetchPeople.mockResolvedValue([
    { id: 2, name: "Bob", email: "bob@x.com" },
    { id: 3, name: "Dana", email: "dana@x.com", pending: true },
  ]);
  api.updatePresentation.mockImplementation((id, changes) => Promise.resolve({ ...mine, ...changes }));
});

const renderPage = () => render(<PresentationsPage />);

test("lists presentations with who sees them, and filters mine from shared", async () => {
  renderPage();
  expect(await screen.findByText("Dubai show")).toBeInTheDocument();
  expect(screen.getByText("Bob's")).toBeInTheDocument();
  expect(await screen.findAllByText("1 piece is no longer in inventory", { exact: false })).toHaveLength(2);
  fireEvent.click(screen.getByRole("radio", { name: /Shared with me/ }));
  expect(screen.queryByText("Dubai show")).not.toBeInTheDocument();
  expect(screen.getByText("Bob's")).toBeInTheDocument();
});

test("renames and shares with specific people from the card menu", async () => {
  renderPage();
  await screen.findByText("Dubai show");

  fireEvent.click(screen.getByRole("button", { name: "More for Dubai show" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  const input = screen.getByDisplayValue("Dubai show");
  fireEvent.change(input, { target: { value: "  Dubai   2026 " } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Rename" })));
  expect(api.updatePresentation).toHaveBeenCalledWith(7, { name: "Dubai 2026" });

  fireEvent.click(await screen.findByRole("button", { name: "More for Dubai 2026" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("radio", { name: "Specific people" }));
  const save = within(dialog).getByRole("button", { name: "Save" });
  expect(save).toBeDisabled();
  fireEvent.click(await within(dialog).findByRole("checkbox", { name: /Bob/ }));
  expect(within(dialog).getByText(/invited, hasn't signed in yet/)).toBeInTheDocument();
  await act(async () => fireEvent.click(save));
  expect(api.updatePresentation).toHaveBeenLastCalledWith(7, { shared: false, sharedWith: [2] });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("someone else's presentation explains who controls sharing", async () => {
  renderPage();
  await screen.findByText("Bob's");
  fireEvent.click(screen.getByRole("button", { name: "More for Bob's" }));
  expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("menuitem", { name: "Share" }));
  expect(screen.getByText(/Only they can change who sees it/)).toBeInTheDocument();
});

test("presentations opened from Inventory show up to save", async () => {
  rememberRecent("T1,j:R9", [{ sku: "T1", imageUrl: "https://x/t1.jpg" }, { sku: "R9", jewelryType: "Ring" }]);
  api.createPresentation.mockImplementation((data) => Promise.resolve({ ...mine, id: 9, ...data }));
  renderPage();
  expect(await screen.findByText("Presented from Inventory on this device")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  fireEvent.change(screen.getByPlaceholderText(/Dubai show/), { target: { value: "Walk-in" } });
  await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" })));
  expect(api.createPresentation).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Walk-in", items: ["T1", "j:R9"], shared: true, sharedWith: [] })
  );
  await waitFor(() => expect(screen.queryByText("Presented from Inventory on this device")).not.toBeInTheDocument());
});
