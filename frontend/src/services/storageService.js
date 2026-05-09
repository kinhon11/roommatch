import { supabase } from './supabaseClient';

/**
 * Upload một file ảnh lên Supabase Storage
 * @param {File} file - File object từ input
 * @param {string} bucket - Tên bucket (default: 'room-images')
 * @returns {{ url: string }} Public URL của ảnh
 */
export const uploadImage = async (file, bucket = 'room-images') => {
  // Tạo tên file unique để tránh trùng
  const fileExt  = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  // Lấy public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return { url: data.publicUrl, path: filePath };
};

/**
 * Upload nhiều ảnh cùng lúc
 * @param {File[]} files
 * @param {string} bucket
 * @returns {{ url, path }[]}
 */
export const uploadMultipleImages = async (files, bucket = 'room-images') => {
  const results = await Promise.all(
    Array.from(files).map(file => uploadImage(file, bucket))
  );
  return results;
};

/**
 * Xóa ảnh khỏi Supabase Storage
 * @param {string} path - Đường dẫn file trong bucket
 * @param {string} bucket
 */
export const deleteImage = async (path, bucket = 'room-images') => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
};
