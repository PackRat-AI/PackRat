import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import * as ImagePicker from 'expo-image-picker';
import { nanoid } from 'nanoid/non-secure';
import { useState } from 'react';

export type SelectedImage = {
  uri: string;
  fileName: string;
  type: string;
};

export function useImageUpload() {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);

  // Pick image from gallery
  const pickImage = async (): Promise<void> => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access media library was denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;

        // Extract file info
        const uriParts = uri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
        const type = `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`;

        setSelectedImage({ uri, fileName, type });
      }
    } catch (err) {
      console.error('Error picking image:', err);
      throw err;
    }
  };

  // Take photo with camera
  const takePhoto = async (): Promise<void> => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Permission to access camera was denied');
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;

        // Create file info
        const fileName = `camera_${Date.now()}.jpg`;
        const type = 'image/jpeg';

        setSelectedImage({ uri, fileName, type });
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      throw err;
    }
  };

  // Function to image from device and R2
  const deleteImage = async (imageUrl: string): Promise<void> => {
    ImageCacheManager.clearImage(imageUrl);
  };

  // Permanently persist the image locally
  const permanentlyPersistImageLocally = async (): Promise<string | null> => {
    if (!selectedImage) return null;
    const imageUri = selectedImage?.uri;

    // Get file extension from the original uri or default to jpg
    const extension = selectedImage.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${nanoid()}.${extension}`;

    try {
      ImageCacheManager.cacheLocalTempImage(imageUri, fileName);
      return fileName;
    } catch (err) {
      console.error('Error saving image locally:', err);
      return null;
    }
  };

  return {
    selectedImage,
    pickImage,
    takePhoto,
    permanentlyPersistImageLocally,
    deleteImage,
    clearSelectedImage: () => setSelectedImage(null),
  };
}
