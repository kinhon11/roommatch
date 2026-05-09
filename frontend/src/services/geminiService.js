import apiClient from '../api/apiClient';

/**
 * Gọi backend AI để sinh mô tả phòng từ Gemini
 */
export const geminiService = {
  generateDescription: async ({ title, price, area, address, city, amenities }) => {
    const { data } = await apiClient.post('/ai/generate-description', {
      title, price, area, address, city, amenities,
    });
    return data.description;
  },
};
