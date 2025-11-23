/* @vitest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, afterEach, describe, it, expect } from "vitest";
import CreateNegotiationForm from "@/components/CreateNegotiationForm";
import { apiRequest, queryClient } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => {
  const invalidateQueries = vi.fn();
  return {
    apiRequest: vi.fn(),
    queryClient: { invalidateQueries },
  };
});

const apiRequestMock = apiRequest as unknown as vi.Mock;
const invalidateQueriesMock = queryClient.invalidateQueries as unknown as vi.Mock;

const mockResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CreateNegotiationForm", () => {
  it("erfasst Daten durch den Assistenten und speichert eine neue Verhandlung", async () => {
    apiRequestMock.mockImplementation((method: string, url: string) => {
      if (method === "POST" && url === "/api/registrations") {
        return Promise.resolve(mockResponse({ id: "reg-1" }));
      }
      if (method === "POST" && url === "/api/registrations/reg-1/markets") {
        return Promise.resolve(mockResponse({ id: "market-1" }));
      }
      if (method === "POST" && url === "/api/registrations/reg-1/counterparts") {
        return Promise.resolve(mockResponse({ id: "counter-1" }));
      }
      if (method === "POST" && url === "/api/registrations/reg-1/products") {
        return Promise.resolve(mockResponse({ id: "product-1" }));
      }
      if (method === "POST" && url === "/api/negotiations") {
        return Promise.resolve(mockResponse({ id: "neg-1" }));
      }
      throw new Error(`Unexpected call ${method} ${url}`);
    });

    const onSuccess = vi.fn();

    const queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClientInstance}>
        <CreateNegotiationForm
          techniques={[{ id: "tech-1", name: "Technik A" }]}
          tactics={[{ id: "tactic-1", name: "Taktik A" }]}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Verhandlungstitel"), { target: { value: "Testfall" } });
    fireEvent.change(screen.getByLabelText("Organisation"), { target: { value: "Demo GmbH" } });
    fireEvent.change(screen.getByLabelText(/^Name$/), { target: { value: "Retailer AG" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    fireEvent.change(screen.getByLabelText("Produktname"), { target: { value: "Produkt A" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    fireEvent.change(screen.getByLabelText("Marktname"), { target: { value: "DACH" } });
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    const techniqueRow = screen.getByText("Technik A").closest("tr");
    expect(techniqueRow).not.toBeNull();
    fireEvent.click(within(techniqueRow as HTMLElement).getByRole("checkbox"));

    const tacticRow = screen.getByText("Taktik A").closest("tr");
    expect(tacticRow).not.toBeNull();
    fireEvent.click(within(tacticRow as HTMLElement).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    fireEvent.click(screen.getByRole("button", { name: /Verhandlung anlegen/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(apiRequestMock).toHaveBeenCalledTimes(5);
    expect(apiRequestMock.mock.calls[0][1]).toBe("/api/registrations");
    expect(apiRequestMock.mock.calls[4][1]).toBe("/api/negotiations");
    expect(invalidateQueriesMock).toHaveBeenCalled();
  });
});
