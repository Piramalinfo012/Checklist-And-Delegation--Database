// Two stable sizes keep avatar variants reusable across pages and browser caches.
export const getOptimizedPhotoUrl = (url, size = 96) => {
  if (typeof url !== 'string') return url;
  const width = size === 512 ? 512 : 96;
  // Leave signed, already transformed, and non-Cloudinary URLs untouched.
  return url.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/)/,
    `$1c_limit,w_${width},h_${width}/q_auto/f_auto/$2`
  );
};

const prepareProfilePhoto = async (file) => {
  // Keep animated GIFs intact; unsupported image decoders retain the original.
  if (file.type === 'image/gif') return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File([blob], `profile.${extension}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const uploadImageToCloudinary = async (file, { profilePhoto = false } = {}) => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'mieiuhpi';
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'Checklist';
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append('file', profilePhoto ? await prepareProfilePhoto(file) : file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw error;
  }
};
