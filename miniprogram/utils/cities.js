const PRIORITY_CITIES = [
  "布拉格",
  "布尔诺",
  "奥洛穆茨",
  "俄斯特拉发"
];

const CITY_FILTER_OPTIONS = [
  {
    key: "",
    label: "全部城市"
  }
].concat(PRIORITY_CITIES.map((city) => ({
  key: city,
  label: city
})));

module.exports = {
  PRIORITY_CITIES,
  CITY_FILTER_OPTIONS
};
