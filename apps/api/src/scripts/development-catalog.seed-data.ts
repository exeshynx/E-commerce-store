export type DevelopmentSeedProduct = {
  description: string;
  name: string;
  price: string;
  sku: string;
  slug: string;
};
export type DevelopmentSeedCategory = {
  description: string;
  name: string;
  products: readonly DevelopmentSeedProduct[];
  slug: string;
};

export const developmentPlaceholderPath = '/uploads/products/development-placeholder.svg';

export const developmentSeedCatalog = [
  {
    description: 'Relaxed tees, shirts, hoodies, and layers made for everyday rotation.',
    name: 'Men',
    slug: 'men',
    products: [
      {
        name: 'Heavyweight Boxy Tee',
        slug: 'heavyweight-boxy-tee',
        sku: 'AUR-MEN-001',
        price: '3490.00',
        description:
          'A heavyweight cotton tee with a relaxed boxy cut, dropped shoulders, and a clean crew neckline.',
      },
      {
        name: 'Utility Overshirt',
        slug: 'utility-overshirt',
        sku: 'AUR-MEN-002',
        price: '7490.00',
        description:
          'A structured twill overshirt with utility pockets and an easy fit for year-round layering.',
      },
      {
        name: 'Relaxed Cargo Trouser',
        slug: 'relaxed-cargo-trouser',
        sku: 'AUR-MEN-003',
        price: '6490.00',
        description:
          'Straight-leg cargo trousers with adjustable hems, practical pockets, and a comfortable mid rise.',
      },
      {
        name: 'Essential Zip Hoodie',
        slug: 'essential-zip-hoodie',
        sku: 'AUR-MEN-004',
        price: '6990.00',
        description:
          'A brushed fleece zip hoodie finished with minimal branding and a relaxed everyday silhouette.',
      },
    ],
  },
  {
    description: 'Modern separates, soft tailoring, denim, and expressive seasonal silhouettes.',
    name: 'Women',
    slug: 'women',
    products: [
      {
        name: 'Cropped Denim Jacket',
        slug: 'cropped-denim-jacket',
        sku: 'AUR-WMN-001',
        price: '7990.00',
        description:
          'A structured cropped jacket in washed denim with dropped shoulders and matte metal hardware.',
      },
      {
        name: 'Wide Leg Tailored Trouser',
        slug: 'wide-leg-tailored-trouser',
        sku: 'AUR-WMN-002',
        price: '5990.00',
        description:
          'Fluid wide-leg trousers with front pleats, side pockets, and a clean tailored waistband.',
      },
      {
        name: 'Ribbed Column Dress',
        slug: 'ribbed-column-dress',
        sku: 'AUR-WMN-003',
        price: '5490.00',
        description: 'A soft rib-knit midi dress with a clean column shape and subtle side slit.',
      },
      {
        name: 'Oversized Graphic Sweatshirt',
        slug: 'oversized-graphic-sweatshirt',
        sku: 'AUR-WMN-004',
        price: '6290.00',
        description:
          'An oversized brushed sweatshirt with original seasonal artwork and ribbed trims.',
      },
    ],
  },
  {
    description: 'Easy, durable pieces for smaller wardrobes and bigger adventures.',
    name: 'Kids',
    slug: 'kids',
    products: [
      {
        name: 'Mini Colorblock Hoodie',
        slug: 'mini-colorblock-hoodie',
        sku: 'AUR-KID-001',
        price: '3990.00',
        description: 'A cheerful colorblock hoodie in soft fleece with a roomy kangaroo pocket.',
      },
      {
        name: 'Everyday Denim',
        slug: 'kids-everyday-denim',
        sku: 'AUR-KID-002',
        price: '3490.00',
        description: 'Comfort-stretch denim with an adjustable waist and a relaxed straight leg.',
      },
      {
        name: 'Weekend Jersey Set',
        slug: 'weekend-jersey-set',
        sku: 'AUR-KID-003',
        price: '4490.00',
        description:
          'A coordinated cotton jersey tee and short set designed for comfortable all-day play.',
      },
      {
        name: 'Lightweight Puffer Vest',
        slug: 'lightweight-puffer-vest',
        sku: 'AUR-KID-004',
        price: '4990.00',
        description: 'A lightweight quilted vest with a high collar and secure zip pockets.',
      },
    ],
  },
  {
    description: 'Caps, bags, socks, and finishing touches for every look.',
    name: 'Accessories',
    slug: 'accessories',
    products: [
      {
        name: 'Canvas Crossbody Bag',
        slug: 'canvas-crossbody-bag',
        sku: 'AUR-ACC-001',
        price: '3990.00',
        description:
          'A compact canvas crossbody with an adjustable webbing strap and organized interior pockets.',
      },
      {
        name: 'Embroidered Panel Cap',
        slug: 'embroidered-panel-cap',
        sku: 'AUR-ACC-002',
        price: '2490.00',
        description: 'A six-panel cotton cap with tonal embroidery and an adjustable metal clasp.',
      },
      {
        name: 'Everyday Crew Socks · 3 Pack',
        slug: 'everyday-crew-socks-three-pack',
        sku: 'AUR-ACC-003',
        price: '1890.00',
        description: 'Three pairs of breathable ribbed crew socks with reinforced heels and toes.',
      },
      {
        name: 'Structured Weekender',
        slug: 'structured-weekender',
        sku: 'AUR-ACC-004',
        price: '8990.00',
        description:
          'A roomy weekender bag with a structured base, internal organization, and detachable shoulder strap.',
      },
    ],
  },
] as const satisfies readonly DevelopmentSeedCategory[];
