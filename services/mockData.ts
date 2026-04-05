export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'restaurant';
  address: string;
  isApproved: boolean;
  restaurantName?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageKey: string;
  isAvailable: boolean;
  isPopular: boolean;
  category: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface Restaurant {
  id: string;
  name: string;
  imageKey: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  address: string;
  isOpen: boolean;
  isFeatured: boolean;
  description: string;
  categories: MenuCategory[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImageKey: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  createdAt: string;
  estimatedDelivery: string;
  deliveryAddress: string;
  customerName?: string;
  customerPhone?: string;
}

export interface FoodCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const foodCategories: FoodCategory[] = [
  { id: 'all', name: 'All', icon: 'restaurant', color: '#FF6B00' },
  { id: 'nigerian', name: 'Nigerian', icon: 'local-dining', color: '#E05500' },
  { id: 'grilled', name: 'Grilled', icon: 'outdoor-grill', color: '#DC2626' },
  { id: 'rice', name: 'Rice', icon: 'rice-bowl', color: '#F59E0B' },
  { id: 'soups', name: 'Soups', icon: 'soup-kitchen', color: '#10B981' },
  { id: 'snacks', name: 'Snacks', icon: 'fastfood', color: '#8B5CF6' },
  { id: 'drinks', name: 'Drinks', icon: 'local-cafe', color: '#3B82F6' },
];

export const restaurants: Restaurant[] = [
  {
    id: '1',
    name: "Mama Nkechi's Kitchen",
    imageKey: 'foodEgusi',
    cuisine: 'Traditional Nigerian',
    rating: 4.8,
    reviewCount: 342,
    deliveryTime: '25-35 min',
    deliveryFee: 1200,
    minOrder: 2000,
    address: '12 Awolowo Rd, Ikoyi, Lagos',
    isOpen: true,
    isFeatured: true,
    description: 'Authentic Nigerian home-cooked meals with a modern twist. Fresh ingredients, bold flavours.',
    categories: [
      {
        id: 'c1-1', name: 'Popular',
        items: [
          { id: 'm1-1', name: 'Jollof Rice & Chicken', description: 'Smoky party jollof rice served with tender grilled chicken and coleslaw', price: 3500, imageKey: 'heroJollof', isAvailable: true, isPopular: true, category: 'rice' },
          { id: 'm1-2', name: 'Pounded Yam & Egusi', description: 'Smooth pounded yam served with rich melon seed soup, assorted meat and fish', price: 4500, imageKey: 'foodEgusi', isAvailable: true, isPopular: true, category: 'soups' },
          { id: 'm1-3', name: 'Pepper Soup (Catfish)', description: 'Spicy aromatic catfish pepper soup with utazi leaves', price: 3800, imageKey: 'foodPepperSoup', isAvailable: true, isPopular: true, category: 'soups' },
        ],
      },
      {
        id: 'c1-2', name: 'Rice Dishes',
        items: [
          { id: 'm1-4', name: 'Fried Rice & Turkey', description: 'Nigerian-style fried rice with mixed vegetables and fried turkey', price: 3800, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'rice' },
          { id: 'm1-5', name: 'Coconut Rice', description: 'Fragrant coconut-infused rice with grilled fish', price: 3200, imageKey: 'heroJollof', isAvailable: true, isPopular: false, category: 'rice' },
          { id: 'm1-6', name: 'Ofada Rice & Sauce', description: 'Local ofada rice with spicy designer sauce and assorted meat', price: 3500, imageKey: 'heroJollof', isAvailable: false, isPopular: false, category: 'rice' },
        ],
      },
      {
        id: 'c1-3', name: 'Soups & Swallow',
        items: [
          { id: 'm1-7', name: 'Amala & Ewedu', description: 'Smooth yam flour swallow with ewedu and gbegiri, stewed beef', price: 3000, imageKey: 'foodAmala', isAvailable: true, isPopular: false, category: 'soups' },
          { id: 'm1-8', name: 'Eba & Ogbono Soup', description: 'Garri swallow with draw soup, stockfish and ponmo', price: 3200, imageKey: 'foodEgusi', isAvailable: true, isPopular: false, category: 'soups' },
        ],
      },
      {
        id: 'c1-4', name: 'Sides & Extras',
        items: [
          { id: 'm1-9', name: 'Moi Moi', description: 'Steamed bean pudding with eggs and mackerel', price: 800, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'snacks' },
          { id: 'm1-10', name: 'Plantain (Dodo)', description: 'Sweet fried plantain slices', price: 600, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'snacks' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'Suya Republic',
    imageKey: 'foodSuya',
    cuisine: 'Grilled & BBQ',
    rating: 4.6,
    reviewCount: 518,
    deliveryTime: '20-30 min',
    deliveryFee: 1000,
    minOrder: 1500,
    address: '5 Admiralty Way, Lekki, Lagos',
    isOpen: true,
    isFeatured: true,
    description: 'The king of suya! Perfectly spiced grilled meats and more.',
    categories: [
      {
        id: 'c2-1', name: 'Suya Specials',
        items: [
          { id: 'm2-1', name: 'Beef Suya (Full)', description: 'Generous portion of thinly sliced spicy beef suya with onions and tomatoes', price: 3000, imageKey: 'foodSuya', isAvailable: true, isPopular: true, category: 'grilled' },
          { id: 'm2-2', name: 'Chicken Suya', description: 'Tender chicken strips marinated in suya spice and grilled to perfection', price: 2800, imageKey: 'foodSuya', isAvailable: true, isPopular: true, category: 'grilled' },
          { id: 'm2-3', name: 'Ram Suya', description: 'Premium ram meat suya, smoky and richly spiced', price: 3500, imageKey: 'foodSuya', isAvailable: true, isPopular: false, category: 'grilled' },
          { id: 'm2-4', name: 'Kidney Suya', description: 'Grilled beef kidney suya with yaji seasoning', price: 2500, imageKey: 'foodSuya', isAvailable: true, isPopular: false, category: 'grilled' },
        ],
      },
      {
        id: 'c2-2', name: 'Combos',
        items: [
          { id: 'm2-5', name: 'Suya & Jollof Combo', description: 'Beef suya served with party jollof rice and plantain', price: 4200, imageKey: 'heroJollof', isAvailable: true, isPopular: true, category: 'grilled' },
          { id: 'm2-6', name: 'Mixed Grill Platter', description: 'Assorted grilled meats — beef, chicken, croaker fish', price: 5500, imageKey: 'foodSuya', isAvailable: true, isPopular: false, category: 'grilled' },
        ],
      },
      {
        id: 'c2-3', name: 'Drinks',
        items: [
          { id: 'm2-7', name: 'Chapman', description: 'Classic Nigerian cocktail with Fanta, Sprite, grenadine and cucumber', price: 1200, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'drinks' },
          { id: 'm2-8', name: 'Zobo Drink', description: 'Chilled hibiscus drink sweetened with pineapple and ginger', price: 800, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'drinks' },
        ],
      },
    ],
  },
  {
    id: '3',
    name: 'The Jollof Pot',
    imageKey: 'heroJollof',
    cuisine: 'Nigerian Rice',
    rating: 4.9,
    reviewCount: 621,
    deliveryTime: '30-40 min',
    deliveryFee: 1500,
    minOrder: 2500,
    address: '22 Adeola Odeku St, Victoria Island, Lagos',
    isOpen: true,
    isFeatured: true,
    description: 'Award-winning jollof rice. Lagos\' favourite rice destination.',
    categories: [
      {
        id: 'c3-1', name: 'Signature Jollof',
        items: [
          { id: 'm3-1', name: 'Signature Party Jollof', description: 'Our famous smoky jollof with perfectly charred bottom', price: 3000, imageKey: 'heroJollof', isAvailable: true, isPopular: true, category: 'rice' },
          { id: 'm3-2', name: 'Jollof & Grilled Chicken', description: 'Signature jollof with flame-grilled chicken and salad', price: 4000, imageKey: 'heroJollof', isAvailable: true, isPopular: true, category: 'rice' },
          { id: 'm3-3', name: 'Jollof & Peppered Turkey', description: 'Signature jollof rice with spicy peppered turkey', price: 4500, imageKey: 'heroJollof', isAvailable: true, isPopular: true, category: 'rice' },
        ],
      },
      {
        id: 'c3-2', name: 'Other Rice',
        items: [
          { id: 'm3-4', name: 'Native Jollof', description: 'Palm oil jollof rice with smoked fish and locust beans', price: 3500, imageKey: 'heroJollof', isAvailable: true, isPopular: false, category: 'rice' },
          { id: 'm3-5', name: 'Fried Rice Supreme', description: 'Loaded fried rice with prawns, liver, and mixed veg', price: 4000, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'rice' },
        ],
      },
      {
        id: 'c3-3', name: 'Sides',
        items: [
          { id: 'm3-6', name: 'Coleslaw', description: 'Fresh creamy coleslaw salad', price: 500, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'snacks' },
          { id: 'm3-7', name: 'Fried Plantain', description: 'Golden sweet fried plantain', price: 600, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'snacks' },
          { id: 'm3-8', name: 'Peppered Snail', description: 'Spicy peppered snail in rich sauce', price: 2500, imageKey: 'foodPepperSoup', isAvailable: true, isPopular: false, category: 'snacks' },
        ],
      },
    ],
  },
  {
    id: '4',
    name: "Iya Basira's Place",
    imageKey: 'foodAmala',
    cuisine: 'Yoruba Cuisine',
    rating: 4.7,
    reviewCount: 289,
    deliveryTime: '20-30 min',
    deliveryFee: 800,
    minOrder: 1500,
    address: '8 Herbert Macaulay Way, Yaba, Lagos',
    isOpen: true,
    isFeatured: false,
    description: 'Authentic Yoruba food prepared with traditional recipes passed down through generations.',
    categories: [
      {
        id: 'c4-1', name: 'Swallow & Soup',
        items: [
          { id: 'm4-1', name: 'Amala & Ewedu/Gbegiri', description: 'Classic amala with ewedu, gbegiri, and assorted meat', price: 2500, imageKey: 'foodAmala', isAvailable: true, isPopular: true, category: 'soups' },
          { id: 'm4-2', name: 'Iyan & Efo Riro', description: 'Pounded yam with spinach stew, beef and stockfish', price: 3000, imageKey: 'foodEgusi', isAvailable: true, isPopular: true, category: 'soups' },
          { id: 'm4-3', name: 'Eba & Okra Soup', description: 'Garri with fresh okra soup and assorted protein', price: 2800, imageKey: 'foodEgusi', isAvailable: true, isPopular: false, category: 'soups' },
        ],
      },
      {
        id: 'c4-2', name: 'Specials',
        items: [
          { id: 'm4-4', name: 'Ofada Rice Complete', description: 'Ofada rice with ayamase sauce, dodo and assorted meat', price: 3500, imageKey: 'heroJollof', isAvailable: true, isPopular: false, category: 'rice' },
          { id: 'm4-5', name: 'Asun (Peppered Goat)', description: 'Spicy grilled goat meat with onions and peppers', price: 3200, imageKey: 'foodSuya', isAvailable: true, isPopular: true, category: 'grilled' },
        ],
      },
    ],
  },
  {
    id: '5',
    name: 'Calabar Kitchen',
    imageKey: 'foodPepperSoup',
    cuisine: 'Cross River',
    rating: 4.5,
    reviewCount: 178,
    deliveryTime: '35-45 min',
    deliveryFee: 1500,
    minOrder: 2500,
    address: '15 Bourdillon Rd, Ikoyi, Lagos',
    isOpen: true,
    isFeatured: false,
    description: 'Calabar delicacies — from afang to edikang ikong. Taste the South-South.',
    categories: [
      {
        id: 'c5-1', name: 'Calabar Soups',
        items: [
          { id: 'm5-1', name: 'Afang Soup & Pounded Yam', description: 'Rich afang soup with waterleaf and assorted bushmeat', price: 5000, imageKey: 'foodEgusi', isAvailable: true, isPopular: true, category: 'soups' },
          { id: 'm5-2', name: 'Edikang Ikong & Eba', description: 'Premium vegetable soup with waterleaf, periwinkle and stockfish', price: 4800, imageKey: 'foodEgusi', isAvailable: true, isPopular: true, category: 'soups' },
          { id: 'm5-3', name: 'Fisherman Soup', description: 'Fresh fish pepper soup, Calabar style with yam', price: 4200, imageKey: 'foodPepperSoup', isAvailable: true, isPopular: false, category: 'soups' },
        ],
      },
      {
        id: 'c5-2', name: 'Sides',
        items: [
          { id: 'm5-4', name: 'Ekpang Nkukwo', description: 'Grated cocoyam wrapped in cocoyam leaves', price: 3500, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'nigerian' },
          { id: 'm5-5', name: 'Afia Efere', description: 'White soup with goat meat', price: 3800, imageKey: 'foodPepperSoup', isAvailable: true, isPopular: false, category: 'soups' },
        ],
      },
    ],
  },
  {
    id: '6',
    name: 'Lagos Grill House',
    imageKey: 'foodSuya',
    cuisine: 'Grilled & Continental',
    rating: 4.4,
    reviewCount: 412,
    deliveryTime: '25-35 min',
    deliveryFee: 1200,
    minOrder: 3000,
    address: '3 Ozumba Mbadiwe Ave, Victoria Island, Lagos',
    isOpen: true,
    isFeatured: false,
    description: 'Premium grilled meats, burgers and continental dishes with a Nigerian twist.',
    categories: [
      {
        id: 'c6-1', name: 'Grills',
        items: [
          { id: 'm6-1', name: 'Grilled Whole Chicken', description: 'Flame-grilled whole chicken marinated in special spices', price: 5500, imageKey: 'foodSuya', isAvailable: true, isPopular: true, category: 'grilled' },
          { id: 'm6-2', name: 'Grilled Croaker Fish', description: 'Whole croaker fish grilled with pepper sauce', price: 4500, imageKey: 'foodPepperSoup', isAvailable: true, isPopular: true, category: 'grilled' },
          { id: 'm6-3', name: 'Beef Steak', description: 'Tender beef steak with pepper sauce and fries', price: 6000, imageKey: 'foodSuya', isAvailable: true, isPopular: false, category: 'grilled' },
        ],
      },
      {
        id: 'c6-2', name: 'Combos',
        items: [
          { id: 'm6-4', name: 'Grill Platter for 2', description: 'Mixed grill — chicken, beef, sausage, with jollof rice', price: 8500, imageKey: 'foodSuya', isAvailable: true, isPopular: false, category: 'grilled' },
          { id: 'm6-5', name: 'Chicken & Chips', description: 'Grilled chicken breast with seasoned french fries', price: 3500, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'grilled' },
        ],
      },
    ],
  },
  {
    id: '7',
    name: 'Green Leaf Bistro',
    imageKey: 'foodMoimoi',
    cuisine: 'Healthy Nigerian',
    rating: 4.3,
    reviewCount: 156,
    deliveryTime: '30-40 min',
    deliveryFee: 1000,
    minOrder: 2000,
    address: '10 Sanusi Fafunwa St, Victoria Island, Lagos',
    isOpen: false,
    isFeatured: false,
    description: 'Healthy Nigerian meals — low oil, fresh vegetables, balanced nutrition.',
    categories: [
      {
        id: 'c7-1', name: 'Healthy Bowls',
        items: [
          { id: 'm7-1', name: 'Grilled Fish Bowl', description: 'Grilled tilapia with brown rice, steamed veg and light pepper sauce', price: 3800, imageKey: 'foodFriedRice', isAvailable: true, isPopular: true, category: 'nigerian' },
          { id: 'm7-2', name: 'Moi Moi Platter', description: 'Steamed bean pudding with boiled egg, served with pap', price: 1800, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'snacks' },
        ],
      },
    ],
  },
  {
    id: '8',
    name: 'Shawarma Hub',
    imageKey: 'foodFriedRice',
    cuisine: 'Fast Food',
    rating: 4.2,
    reviewCount: 834,
    deliveryTime: '15-25 min',
    deliveryFee: 800,
    minOrder: 1000,
    address: '1 Allen Ave, Ikeja, Lagos',
    isOpen: true,
    isFeatured: false,
    description: 'Lagos\' favourite shawarma spot. Quick, tasty, affordable.',
    categories: [
      {
        id: 'c8-1', name: 'Shawarma',
        items: [
          { id: 'm8-1', name: 'Chicken Shawarma (Regular)', description: 'Grilled chicken in warm flatbread with veggies and garlic sauce', price: 2000, imageKey: 'foodFriedRice', isAvailable: true, isPopular: true, category: 'snacks' },
          { id: 'm8-2', name: 'Beef Shawarma (Large)', description: 'Loaded beef shawarma with extra meat and cheese', price: 3500, imageKey: 'foodSuya', isAvailable: true, isPopular: true, category: 'snacks' },
          { id: 'm8-3', name: 'Combo Meal', description: 'Shawarma + fries + drink combo', price: 4000, imageKey: 'foodFriedRice', isAvailable: true, isPopular: false, category: 'snacks' },
        ],
      },
      {
        id: 'c8-2', name: 'Drinks',
        items: [
          { id: 'm8-4', name: 'Smoothie', description: 'Fresh fruit smoothie — mango, banana, strawberry', price: 1500, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'drinks' },
          { id: 'm8-5', name: 'Milkshake', description: 'Thick creamy milkshake — chocolate or vanilla', price: 1800, imageKey: 'foodMoimoi', isAvailable: true, isPopular: false, category: 'drinks' },
        ],
      },
    ],
  },
];

export const sampleCustomerOrders: Order[] = [
  {
    id: 'ORD-20240115-001',
    restaurantId: '1',
    restaurantName: "Mama Nkechi's Kitchen",
    restaurantImageKey: 'foodEgusi',
    items: [
      { name: 'Jollof Rice & Chicken', quantity: 2, price: 3500 },
      { name: 'Moi Moi', quantity: 1, price: 800 },
    ],
    subtotal: 7800,
    deliveryFee: 1200,
    serviceFee: 200,
    total: 9200,
    status: 'delivered',
    createdAt: '2024-01-15T14:30:00Z',
    estimatedDelivery: '30 min',
    deliveryAddress: '5 Adeola Hopewell St, Victoria Island',
  },
  {
    id: 'ORD-20240118-002',
    restaurantId: '2',
    restaurantName: 'Suya Republic',
    restaurantImageKey: 'foodSuya',
    items: [
      { name: 'Beef Suya (Full)', quantity: 1, price: 3000 },
      { name: 'Chapman', quantity: 2, price: 1200 },
    ],
    subtotal: 5400,
    deliveryFee: 1000,
    serviceFee: 200,
    total: 6600,
    status: 'delivered',
    createdAt: '2024-01-18T19:15:00Z',
    estimatedDelivery: '25 min',
    deliveryAddress: '12 Ligali Ayorinde, Victoria Island',
  },
];

export const sampleRestaurantOrders: Order[] = [
  {
    id: 'ORD-20240120-010',
    restaurantId: '1',
    restaurantName: "Mama Nkechi's Kitchen",
    restaurantImageKey: 'foodEgusi',
    items: [
      { name: 'Pounded Yam & Egusi', quantity: 1, price: 4500 },
      { name: 'Jollof Rice & Chicken', quantity: 1, price: 3500 },
    ],
    subtotal: 8000,
    deliveryFee: 1200,
    serviceFee: 200,
    total: 9400,
    status: 'pending',
    createdAt: new Date().toISOString(),
    estimatedDelivery: '30 min',
    deliveryAddress: '24 Kingsway Rd, Ikoyi',
    customerName: 'Amara Okafor',
    customerPhone: '+234 803 456 7890',
  },
  {
    id: 'ORD-20240120-011',
    restaurantId: '1',
    restaurantName: "Mama Nkechi's Kitchen",
    restaurantImageKey: 'foodEgusi',
    items: [
      { name: 'Amala & Ewedu', quantity: 2, price: 3000 },
      { name: 'Pepper Soup (Catfish)', quantity: 1, price: 3800 },
    ],
    subtotal: 9800,
    deliveryFee: 1200,
    serviceFee: 200,
    total: 11200,
    status: 'preparing',
    createdAt: new Date(Date.now() - 1200000).toISOString(),
    estimatedDelivery: '25 min',
    deliveryAddress: '7 Bourdillon Rd, Ikoyi',
    customerName: 'Chidi Eze',
    customerPhone: '+234 806 789 0123',
  },
  {
    id: 'ORD-20240120-012',
    restaurantId: '1',
    restaurantName: "Mama Nkechi's Kitchen",
    restaurantImageKey: 'foodEgusi',
    items: [
      { name: 'Fried Rice & Turkey', quantity: 3, price: 3800 },
    ],
    subtotal: 11400,
    deliveryFee: 1200,
    serviceFee: 200,
    total: 12800,
    status: 'confirmed',
    createdAt: new Date(Date.now() - 600000).toISOString(),
    estimatedDelivery: '35 min',
    deliveryAddress: '15 Adetokunbo Ademola, VI',
    customerName: 'Folake Adeyemi',
    customerPhone: '+234 810 234 5678',
  },
  {
    id: 'ORD-20240119-013',
    restaurantId: '1',
    restaurantName: "Mama Nkechi's Kitchen",
    restaurantImageKey: 'foodEgusi',
    items: [
      { name: 'Jollof Rice & Chicken', quantity: 2, price: 3500 },
      { name: 'Moi Moi', quantity: 2, price: 800 },
    ],
    subtotal: 8600,
    deliveryFee: 1200,
    serviceFee: 200,
    total: 10000,
    status: 'delivered',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    estimatedDelivery: '30 min',
    deliveryAddress: '3 Ozumba Mbadiwe, VI',
    customerName: 'Tunde Bakare',
    customerPhone: '+234 812 345 6789',
  },
];
