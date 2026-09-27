import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaydayPage from "@/features/payday/PaydayPage";
import { RulesEditor } from "@/features/settings/sections/BucketsRules";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { useStore } from "@/store/useStore";

beforeEach(() => {
  useStore.getState().resetAll();
  useStore.getState().setPeriod("2026-09-A");
});

describe("Payday receipt (§17 UI)", () => {
  afterEach(() => vi.useRealTimers());

  it("updates the receipt within 150ms of typing and announces Net via aria-live", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <PaydayPage />
      </MemoryRouter>,
    );
    const salary = screen.getByLabelText("Gross salary this cutoff");
    fireEvent.change(salary, { target: { value: "15000" } });
    expect(screen.queryByText("₱13,271.30")).toBeNull(); // debounced, not yet

    act(() => {
      vi.advanceTimersByTime(150);
    });
    const net = screen.getByText("₱13,271.30"); // 15,000 − 750 − 375 − 100 − 503.70
    expect(net.closest("[aria-live='polite']")).not.toBeNull();
    const receipt = screen.getByText("NET PAY").closest(".receipt") as HTMLElement;
    expect(within(receipt).getByText("₱6,635.65")).toBeInTheDocument(); // Savings 50%
    expect(within(receipt).getByText("Estimates only. Your employer's payroll is the official computation.")).toBeInTheDocument();
  });

  it("formats the salary as you type and accepts commas", () => {
    render(
      <MemoryRouter>
        <PaydayPage />
      </MemoryRouter>,
    );
    const salary = screen.getByLabelText("Gross salary this cutoff") as HTMLInputElement;
    fireEvent.change(salary, { target: { value: "25000.50" } });
    expect(salary.value).toBe("25,000.50");
    fireEvent.change(salary, { target: { value: "1,234.567" } });
    expect(salary.value).toBe("1,234.56");
  });
});

describe("Allocation editor (§17 UI)", () => {
  it("can't be saved unless percent shares total 100%", () => {
    render(<RulesEditor />);
    const save = screen.getByRole("button", { name: "Save rule" });
    const savings = screen.getByLabelText("Savings percent");
    const essentials = screen.getByLabelText("Essentials percent");

    fireEvent.change(savings, { target: { value: "49" } });
    expect(screen.getByText("1% left to assign")).toBeInTheDocument();
    expect(save).toBeDisabled();

    fireEvent.change(essentials, { target: { value: "31" } });
    expect(screen.getByText("100% allocated ✓")).toBeInTheDocument();
    expect(save).toBeEnabled();

    fireEvent.change(essentials, { target: { value: "40" } });
    expect(screen.getByText("9% over — trim a share")).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it("the split bar handles move by keyboard (±1%, Shift ±5%)", () => {
    render(<RulesEditor />);
    const handle = screen.getByRole("slider", { name: "Split between Savings and Essentials" });
    expect(handle).toHaveAttribute("aria-valuenow", "50");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle).toHaveAttribute("aria-valuenow", "51");
    fireEvent.keyDown(handle, { key: "ArrowLeft", shiftKey: true });
    expect(handle).toHaveAttribute("aria-valuenow", "46");
    expect(screen.getByText("100% allocated ✓")).toBeInTheDocument();
  });
});

describe("MonthPicker", () => {
  it("opens, moves focus with arrows, and picks a month", () => {
    const onChange = vi.fn();
    render(<MonthPicker label="Month" value="2026-09" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Month: Sep 2026" }));
    const sep = screen.getByRole("button", { name: "Sep 2026" });
    expect(sep).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(sep, { key: "ArrowDown" }); // one row down = +3 months
    const dec = screen.getByRole("button", { name: "Dec 2026" });
    expect(dec).toHaveFocus();
    fireEvent.click(dec);
    expect(onChange).toHaveBeenCalledWith("2026-12");
  });
});
