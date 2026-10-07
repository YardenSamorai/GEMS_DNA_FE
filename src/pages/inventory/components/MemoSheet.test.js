import { fireEvent, render, screen } from "@testing-library/react";
import MemoSheet from "./MemoSheet";

const STONES = [
  { id: 1, sku: "TEST-001", category: "Emerald", weightCt: 3.07, pricePerCt: 2500, priceTotal: 7675 },
  { id: 2, sku: "TEST-002", category: "Diamond", weightCt: 1.8, pricePerCt: 0, priceTotal: 27900 },
];

const renderSheet = (props = {}) =>
  render(<MemoSheet open stones={STONES} onClose={() => {}} priceMode="neto" salesman="Test Rep" variant="side" {...props} />);

test("prefills prices from the inventory and totals them", () => {
  renderSheet();
  expect(screen.getByLabelText("Price per carat for TEST-001")).toHaveValue(2500);
  expect(screen.getByLabelText("Price per carat for TEST-002")).toHaveValue(15500);
  expect(screen.getByText("4.87")).toBeInTheDocument();
  expect(screen.getByText("$35,575.00")).toBeInTheDocument();
  expect(screen.getByDisplayValue("Test Rep")).toBeInTheDocument();
  expect(screen.getByText("Neto prices")).toBeInTheDocument();
});

test("needs a recipient and a price for every stone", () => {
  renderSheet();
  const create = screen.getByRole("button", { name: "Create memo" });
  expect(create).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Company / name"), { target: { value: "Example Jewels" } });
  expect(create).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Price per carat for TEST-001"), { target: { value: "" } });
  expect(create).toBeDisabled();
  expect(screen.getByText("1 stone needs a price per carat.")).toBeInTheDocument();
});

test("labels Bruto only when a gemstone is actually scaled", () => {
  renderSheet({ priceMode: "bruto" });
  expect(screen.getByText("Bruto prices")).toBeInTheDocument();
});
