import apiClient from '../api/apiClient';

/**
 * Gọi backend AI để sinh mô tả phòng từ Gemini
 */
export const geminiService = {
  generateDescription: async (payload) => {
    const { data } = await apiClient.post('/ai/generate-description', {
      ...payload,
    });
    return data.description;
  },

  analyzeListing: async (payload) => {
    const { data } = await apiClient.post('/ai/analyze-listing', {
      ...payload,
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
