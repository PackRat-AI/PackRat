import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from 'expo-app/lib/api/client';
import { nanoid } from 'nanoid/non-secure';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';

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

  // Function to get a presigned URL for uploading
  const getPresignedUrl = async (
    fileName: string,
    contentType: string
  ): Promise<{ url: string; publicUrl: string; objectKey: string }> => {
    try {
      const response = await axiosInstance.get(
        `/api/upload/presigned?fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`
      );
      return {
        url: response.data.url,
        publicUrl: response.data.publicUrl,
        objectKey: response.data.objectKey,
      };
    } catch (err) {
      console.error('Error getting presigned URL:', err);
      throw new Error('Failed to get upload URL');
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
