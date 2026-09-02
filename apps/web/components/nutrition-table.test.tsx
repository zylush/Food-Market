import { render, screen } from "@testing-library/react";
import { NutritionTable } from "./NutritionTable";

describe("NutritionTable", () => {
  it("uses localized labels and explicit unavailable values", () => {
    render(<NutritionTable locale="en" nutrition={{
      basis: "100g",
      servingSize: null,
      energyKj: 1800,
      energyKcal: null,
      fatG: 12.345,
      saturatedFatG: null,
      carbohydratesG: null,
      sugarsG: 4,
      fibreG: null,
      proteinG: null,
      saltG: null,
      sodiumG: null,
    }} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Energy (kJ)")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(1);
    expect(screen.getByText("12.35")).toBeInTheDocument();
    expect(screen.getAllByText("100g").length).toBeGreaterThan(1);
  });
});
