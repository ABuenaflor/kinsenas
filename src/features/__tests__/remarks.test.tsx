import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Remarks } from "@/features/expenses/Remarks";
import { useStore } from "@/store/useStore";

beforeEach(() => useStore.getState().resetAll());

describe("Expenses remarks", () => {
  it("saves, cancels and edits a remark", () => {
    render(<Remarks />);
    const box = screen.getByLabelText("Remarks");
    const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    fireEvent.change(box, { target: { value: "  Lots of Grab rides  " } });
    save();
    expect(useStore.getState().remarks.map((r) => r.text)).toEqual(["Lots of Grab rides"]);
    expect(screen.getByText("Lots of Grab rides")).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe("");

    fireEvent.change(box, { target: { value: "never mind" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect((box as HTMLTextAreaElement).value).toBe("");
    expect(useStore.getState().remarks).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Edit remark" }));
    expect((box as HTMLTextAreaElement).value).toBe("Lots of Grab rides");
    fireEvent.change(box, { target: { value: "Grab + Angkas" } });
    save();
    expect(useStore.getState().remarks).toEqual([expect.objectContaining({ text: "Grab + Angkas", updatedAt: expect.any(String) })]);
  });

  it("won't save an empty remark", () => {
    render(<Remarks />);
    fireEvent.change(screen.getByLabelText("Remarks"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save" }).hasAttribute("disabled")).toBe(true);
  });
});
