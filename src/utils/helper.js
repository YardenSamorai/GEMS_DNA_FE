import { mapping } from "./const";

export const encryptPrice = (price) => {
  if (!price) return "N/A";

  const strPrice = price.toString(); // מוודא שגם string יעבוד
  const trailingEncrypted = [];
  let encrypted = "";
  let i = 0;

  while (i < strPrice.length) {
    if (strPrice[i] === "0") {
      let zeroCount = 0;

      // סופרים כמה אפסים ברצף
      while (strPrice[i + zeroCount] === "0") {
        zeroCount++;
      }

      let encryptedZeros = "";
      let originalZeroCount = zeroCount; // נשמור כמה אפסים ראינו
      let tempI = i;

      if (zeroCount >= 3) {
        encryptedZeros += mapping["000"];
        zeroCount -= 3;
        tempI += 3;
      }

      if (zeroCount >= 2) {
        encryptedZeros += mapping["00"];
        zeroCount -= 2;
        tempI += 2;
      }

      if (zeroCount === 1) {
        encryptedZeros += mapping["0"];
        tempI += 1;
      }

      // אם כל האפסים שראינו היו בסוף המספר – נאחסן את ההצפנה לסוף
      if (tempI >= strPrice.length) {
        trailingEncrypted.push(...encryptedZeros);
        i = tempI;
      } else {
        encrypted += encryptedZeros;
        i = tempI;
      }

      continue;
    }

    encrypted += mapping[strPrice[i]];
    i += 1;
  }

  // סידור אפסים בסוף לפי הסדר I → Y → Z
  const orderedTrailing = [
    ...trailingEncrypted.filter(c => c === "I"),
    ...trailingEncrypted.filter(c => c === "Y"),
    ...trailingEncrypted.filter(c => c === "Z"),
  ];

  return encrypted + orderedTrailing.join('');
};


export const changeMeasurementsFormat = (measurements) => {
  if (measurements === null || measurements === undefined) return "N/A"; // ✅ בדיקה למקרה שאין מידות

  return measurements.replace(/-/g, " x ");
}