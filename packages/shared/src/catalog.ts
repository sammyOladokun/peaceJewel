export type ProductCategory =
  | "engagement"
  | "necklaces"
  | "earrings"
  | "bracelets";

export type ProductVariant = {
  id: string;
  label: string;
  sku: string;
  priceCents: number;
  inStock: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  featured: boolean;
  variants: ProductVariant[];
};

export const featuredProducts: Product[] = [
  {
    id: "prod_001",
    slug: "aurora-solitaire-ring",
    name: "Aurora Solitaire Ring",
    category: "engagement",
    description:
      "A refined solitaire ring designed to highlight the brilliance of a single center stone.",
    imageUrl:
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    variants: [
      {
        id: "var_001",
        label: "18K Yellow Gold / 1.0ct",
        sku: "AUR-SOL-18Y-10",
        priceCents: 420000,
        inStock: true
      },
      {
        id: "var_002",
        label: "18K White Gold / 1.5ct",
        sku: "AUR-SOL-18W-15",
        priceCents: 580000,
        inStock: true
      }
    ]
  },
  {
    id: "prod_002",
    slug: "luna-pearl-necklace",
    name: "Luna Pearl Necklace",
    category: "necklaces",
    description:
      "An elegant pearl necklace for timeless styling, crafted for everyday luxury.",
    imageUrl:
      "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    variants: [
      {
        id: "var_003",
        label: "Standard Length",
        sku: "LUN-PRL-STD",
        priceCents: 210000,
        inStock: true
      }
    ]
  },
  {
    id: "prod_003",
    slug: "celeste-hoop-earrings",
    name: "Celeste Hoop Earrings",
    category: "earrings",
    description:
      "Clean hoop earrings with a polished finish and a lightweight feel.",
    imageUrl:
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    variants: [
      {
        id: "var_004",
        label: "Small",
        sku: "CEL-HOP-S",
        priceCents: 125000,
        inStock: true
      },
      {
        id: "var_005",
        label: "Medium",
        sku: "CEL-HOP-M",
        priceCents: 145000,
        inStock: false
      }
    ]
  }
];

export const categories: { id: ProductCategory; label: string }[] = [
  { id: "engagement", label: "Engagement Rings" },
  { id: "necklaces", label: "Necklaces" },
  { id: "earrings", label: "Earrings" },
  { id: "bracelets", label: "Bracelets" }
];
