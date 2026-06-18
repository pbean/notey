import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Update } from "@tauri-apps/plugin-updater";
import { UpdateBanner } from "./UpdateBanner";
import { useUpdateStore } from "../store";

const relaunch = vi.fn();
vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => relaunch(),
}));

/** Build a fake Update whose downloadAndInstall is controllable per test. */
function fakeUpdate(downloadAndInstall = vi.fn().mockResolvedValue(undefined)): Update {
  return { available: true, version: "0.2.0", downloadAndInstall } as unknown as Update;
}

beforeEach(() => {
  relaunch.mockReset().mockResolvedValue(undefined);
});

describe("UpdateBanner", () => {
  it("renders nothing while idle", () => {
    render(<UpdateBanner />);
    expect(screen.queryByTestId("update-banner")).toBeNull();
  });

  it("shows the available version once an update is recorded", () => {
    useUpdateStore.getState().setAvailable(fakeUpdate());
    render(<UpdateBanner />);
    expect(screen.getByTestId("update-banner")).toHaveTextContent("Notey 0.2.0 is available");
  });

  it("installs then relaunches when the user confirms", async () => {
    const downloadAndInstall = vi.fn().mockResolvedValue(undefined);
    useUpdateStore.getState().setAvailable(fakeUpdate(downloadAndInstall));
    render(<UpdateBanner />);

    fireEvent.click(screen.getByTestId("update-install"));

    await waitFor(() => expect(downloadAndInstall).toHaveBeenCalledOnce());
    await waitFor(() => expect(relaunch).toHaveBeenCalledOnce());
  });

  it("surfaces an inline error and offers Retry when install fails", async () => {
    const downloadAndInstall = vi.fn().mockRejectedValue(new Error("network down"));
    useUpdateStore.getState().setAvailable(fakeUpdate(downloadAndInstall));
    render(<UpdateBanner />);

    fireEvent.click(screen.getByTestId("update-install"));

    await waitFor(() =>
      expect(screen.getByTestId("update-banner")).toHaveTextContent("Update failed: network down"),
    );
    expect(relaunch).not.toHaveBeenCalled();
    expect(screen.getByTestId("update-install")).toHaveTextContent("Retry");
  });

  it("dismiss hides the banner", () => {
    useUpdateStore.getState().setAvailable(fakeUpdate());
    render(<UpdateBanner />);

    fireEvent.click(screen.getByTestId("update-dismiss"));

    expect(screen.queryByTestId("update-banner")).toBeNull();
  });
});
