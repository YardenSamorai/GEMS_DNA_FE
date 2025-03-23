import { mapping } from "./const";

export const encryptPrice = (price) => {
  if (price === null || price === undefined || isNaN(price)) return "N/A"; // ✅ בדיקה למקרה שאין מחיר

  let strPrice = price.toString();
  let encrypted = "";
  let i = 0;

  while (i < strPrice.length) {
    if (i + 2 < strPrice.length && strPrice[i] === "0" && strPrice[i + 1] === "0" && strPrice[i + 2] === "0") {
      encrypted += mapping["000"];
      i += 3;
    } else if (i + 1 < strPrice.length && strPrice[i] === "0" && strPrice[i + 1] === "0") {
      encrypted += mapping["00"];
      i += 2;
    } else {
      encrypted += mapping[strPrice[i]];
      i += 1;
    }
  }

  return encrypted;
};

export const changeMeasurementsFormat = (measurements) => {
  if (measurements === null || measurements === undefined) return "N/A"; // ✅ בדיקה למקרה שאין מידות

  return measurements.replace(/-/g, " x ");
}