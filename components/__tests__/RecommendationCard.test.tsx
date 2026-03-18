import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RecommendationCard from "../RecommendationCard";
import type { RecommendationCard as CardType } from "@/lib/types";

// next/image needs mocking in test environment
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; sizes?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

const baseCard: CardType = {
  rank: 1,
  score: 9.0,
  why_recommended: "Perfect for a romantic evening",
  best_for: "Date nights",
  watch_out: "Book 3 days ahead",
  not_great_if: "You want a lively scene",
  estimated_total: "$80-100 for two",
  restaurant: {
    id: "rest-1",
    name: "Cafe Romantique",
    cuisine: "French",
    price: "$$$",
    rating: 4.7,
    review_count: 350,
    address: "123 Main St, Nashville, TN",
    is_closed: false,
  },
};

describe("RecommendationCard", () => {
  it("renders the restaurant name", () => {
    render(<RecommendationCard card={baseCard} index={0} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Cafe Romantique"
    );
  });

  it("renders the rank badge with index + 1", () => {
    render(<RecommendationCard card={baseCard} index={2} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the SVG placeholder when image_url is undefined", () => {
    const { container } = render(
      <RecommendationCard card={baseCard} index={0} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders an <img> when image_url is provided", () => {
    const cardWithImage: CardType = {
      ...baseCard,
      restaurant: {
        ...baseCard.restaurant,
        image_url: "https://places.googleapis.com/v1/photos/abc/media",
      },
    };
    const { container } = render(
      <RecommendationCard card={cardWithImage} index={0} />
    );
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("does not render the distance badge when nearLocationLabel is missing", () => {
    const cardWithDistance: CardType = {
      ...baseCard,
      restaurant: { ...baseCard.restaurant, distance: 500 },
    };
    render(<RecommendationCard card={cardWithDistance} index={0} />);
    expect(screen.queryByText(/mi from/i)).toBeNull();
  });

  it("renders the distance badge when both distance and nearLocationLabel are provided", () => {
    const cardWithDistance: CardType = {
      ...baseCard,
      restaurant: { ...baseCard.restaurant, distance: 1609 }, // ~1 mile
    };
    render(
      <RecommendationCard
        card={cardWithDistance}
        index={0}
        nearLocationLabel="Union Square"
      />
    );
    expect(screen.getByText(/mi from Union Square/i)).toBeInTheDocument();
  });

  it("shows 'Save to favorites' aria-label when not favorited", () => {
    const onToggle = vi.fn();
    render(
      <RecommendationCard
        card={baseCard}
        index={0}
        isFavorite={false}
        onToggleFavorite={onToggle}
      />
    );
    expect(
      screen.getByRole("button", { name: "Save to favorites" })
    ).toBeInTheDocument();
  });

  it("shows 'Remove from favorites' aria-label when favorited", () => {
    const onToggle = vi.fn();
    render(
      <RecommendationCard
        card={baseCard}
        index={0}
        isFavorite={true}
        onToggleFavorite={onToggle}
      />
    );
    expect(
      screen.getByRole("button", { name: "Remove from favorites" })
    ).toBeInTheDocument();
  });

  it("calls onToggleFavorite exactly once on click", () => {
    const onToggle = vi.fn();
    render(
      <RecommendationCard
        card={baseCard}
        index={0}
        isFavorite={false}
        onToggleFavorite={onToggle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not render the Watch out section when watch_out is empty", () => {
    const cardNoWatchOut: CardType = { ...baseCard, watch_out: "" };
    render(<RecommendationCard card={cardNoWatchOut} index={0} />);
    expect(screen.queryByText("Watch out")).toBeNull();
  });

  it("renders the Watch out section when watch_out has content", () => {
    render(<RecommendationCard card={baseCard} index={0} />);
    expect(screen.getByText("Watch out")).toBeInTheDocument();
    expect(screen.getByText("Book 3 days ahead")).toBeInTheDocument();
  });
});
