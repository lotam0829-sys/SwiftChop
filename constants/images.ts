const imageMap: Record<string, any> = {
  heroJollof: require('../assets/images/hero-jollof.jpg'),
  foodSuya: require('../assets/images/food-suya.jpg'),
  foodEgusi: require('../assets/images/food-egusi.jpg'),
  foodFriedRice: require('../assets/images/food-friedrice.jpg'),
  restaurantInterior: require('../assets/images/restaurant-interior.jpg'),
  foodPepperSoup: require('../assets/images/food-pepper-soup.jpg'),
  foodAmala: require('../assets/images/food-amala.jpg'),
  foodMoimoi: require('../assets/images/food-moimoi.jpg'),
  emptyOrders: require('../assets/images/empty-orders.jpg'),
  pendingApproval: require('../assets/images/pending-approval.jpg'),
  logo: require('../assets/images/logo.jpeg'),
};

export const getImage = (key: string): any => imageMap[key] || imageMap.heroJollof;
export default imageMap;
