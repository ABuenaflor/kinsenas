import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const engine = { signIn: vi.fn(async () => "Wrong email or password."), signUp: vi.fn(), syncNow: vi.fn(), signOut: vi.fn() };

vi.mock("@/sync/status", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/sync/status")>();
  return { ...real, syncConfig: { url: "https://x.supabase.co", key: "k" }, loadSync: () => Promise.resolve(engine) };
});

const { SyncEditor } = await import("@/features/settings/sections/SyncSection");
const { useSyncStatus } = await import("@/sync/status");

beforeEach(() => useSyncStatus.setState({ state: "signedOut", email: null, lastSyncedAt: null, error: null }));

describe("Sync settings", () => {
  it("signs in and shows the engine's error", async () => {
    render(<SyncEditor />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    });
    expect(engine.signIn).toHaveBeenCalledWith("me@example.com", "secret1");
    expect(screen.getByRole("alert").textContent).toBe("Wrong email or password.");
  });

  it("shows who is signed in and the sync state", () => {
    useSyncStatus.setState({ state: "offline", email: "me@example.com" });
    render(<SyncEditor />);
    expect(screen.getByText("me@example.com")).toBeTruthy();
    expect(screen.getByText(/Offline/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Sync now/ }));
  });
});
