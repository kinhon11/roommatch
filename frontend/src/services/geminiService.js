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

  analyzeListing: async ({ title, price, area, address, city, description, amenities, available_slots, image_count }) => {
    const { data } = await apiClient.post('/ai/analyze-listing', {
      title,
      price,
      area,
      address,
      city,
      description,
      amenities,
      available_slots,
      image_count,
    });
    return data.analysis;
  },

  summarizeReviews: async ({ room_title, address, city, price, average_rating, reviews }) => {
    const { data } = await apiClient.post('/ai/review-summary', {
      room_title,
      address,
      city,
      price,
      average_rating,
      reviews,
    });
    return data.summary;
  },

  assistantChat: async ({ message, conversation = [], context = {} }) => {
    const { data } = await apiClient.post('/ai/assistant', {
      message,
      conversation,
      context,
    });
    return data;
  },
};
