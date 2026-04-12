import { getDisplayShape, getDisplayColor } from './constants';

export const shareToWhatsApp = (stone, includePrice = false) => {
  const dnaUrl = `https://gems-dna.com/${stone.sku}`;
  
  let message = `💎 *${getDisplayShape(stone.shape) || 'Gemstone'}* - ${stone.weightCt || '?'}ct\n\n`;
  message += `📋 *Details:*\n`;
  message += `• SKU: ${stone.sku}\n`;
  message += `• Color: ${getDisplayColor(stone) || 'N/A'}\n`;
  message += `• Clarity: ${stone.clarity || 'N/A'}\n`;
  message += `• Treatment: ${stone.treatment || 'N/A'}\n`;
  message += `• Origin: ${stone.origin || 'N/A'}\n`;
  message += `• Lab: ${stone.lab || 'N/A'}\n`;
  if (stone.measurements) {
    message += `• Size: ${stone.measurements}\n`;
  }
  
  if (includePrice && stone.priceTotal) {
    message += `\n💰 *Price: $${stone.priceTotal.toLocaleString()}*\n`;
  }
  
  message += `\n🔗 View DNA: ${dnaUrl}`;
  
  if (stone.imageUrl) {
    message += `\n\n📸 Image: ${stone.imageUrl}`;
  }
  
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
};

export const shareMultipleToWhatsApp = (selectedStonesArray) => {
  if (!selectedStonesArray || selectedStonesArray.length === 0) return;

  let message = `*${selectedStonesArray.length} Stones - DNA Links*\n\n`;

  selectedStonesArray.forEach((stone, idx) => {
    const dnaUrl = `https://gems-dna.com/${stone.sku}`;
    message += `${idx + 1}. *${getDisplayShape(stone.shape) || 'Gemstone'}* ${stone.weightCt || '?'}ct`;
    if (getDisplayColor(stone)) message += ` | ${getDisplayColor(stone)}`;
    message += ` — SKU: ${stone.sku}\n`;
    message += `   ${dnaUrl}\n\n`;
  });

  const encodedMessage = encodeURIComponent(message.trim());
  window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
};
