// Cloudinary 核心配置
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/dzu3jwkve/auto/upload`;
const CLOUDINARY_PRESET = "cu5yy0rl"; 

/**
 * 通用文件上传服务
 * @param {File} file - 要上传的文件对象
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export const uploadToCloudinary = async (file) => {
  if (!file) return { success: false, error: '未选择文件' };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_PRESET);

  try {
    const res = await fetch(CLOUDINARY_URL, { 
      method: 'POST', 
      body: formData 
    });
    const data = await res.json();

    if (data.secure_url) {
      return { success: true, url: data.secure_url };
    } else {
      return { success: false, error: data.error?.message || '云端接口拒绝响应' };
    }
  } catch (error) {
    console.error('Cloudinary 神经链路断开:', error);
    return { success: false, error: error.message };
  }
};