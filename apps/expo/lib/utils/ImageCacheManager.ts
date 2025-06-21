import * as FileSystem from "expo-file-system";
import { IMAGES_DIR } from "../constants";

export class ImageCacheManager {
	private static instance: ImageCacheManager;
	public cacheDirectory: string;

	private constructor() {
		this.cacheDirectory = IMAGES_DIR;
	}

	public static getInstance(): ImageCacheManager {
		if (!ImageCacheManager.instance) {
			ImageCacheManager.instance = new ImageCacheManager();
		}
		return ImageCacheManager.instance;
	}

	/**
	 * Initialize the cache directory
	 */
	public async initCacheDirectory(): Promise<void> {
		const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
		if (!dirInfo.exists) {
			await FileSystem.makeDirectoryAsync(this.cacheDirectory, {
				intermediates: true,
			});
		}
	}

	/**
	 * Get the local URI for an image if it exists
	 */
	public async getCachedImageUri(fileName: string): Promise<string | null> {
		const localUri = `${this.cacheDirectory}${fileName}`;

		const fileInfo = await FileSystem.getInfoAsync(localUri);
		return fileInfo.exists ? localUri : null;
	}

	/**
	 * Download and cache an image
	 */
	public async cacheRemoteImage(
		fileName: string,
		remoteUrl: string,
	): Promise<string> {
		await this.initCacheDirectory();

		const localUri = `${this.cacheDirectory}${fileName}`;

		const fileInfo = await FileSystem.getInfoAsync(localUri);

		if (!fileInfo.exists) {
			const downloadOptions = {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
					Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
				},
			};
			const downloadResult = await FileSystem.downloadAsync(
				remoteUrl,
				localUri,
				downloadOptions,
			);

			if (downloadResult.status !== 200) {
				throw new Error(`Failed to download image: ${downloadResult.status}`);
			}
		}

		return localUri;
	}

	public async cacheLocalTempImage(
		tempImageUri: string,
		fileName: string,
	): Promise<void> {
		await this.initCacheDirectory();

		const localUri = `${this.cacheDirectory}${fileName}`;

		await FileSystem.moveAsync({
			from: tempImageUri,
			to: localUri,
		});
	}

	/**
	 * Clear a specific cached image
	 */
	public async clearImage(fileName: string): Promise<void> {
		const localUri = `${this.cacheDirectory}${fileName}`;

		const fileInfo = await FileSystem.getInfoAsync(localUri);
		if (fileInfo.exists) {
			await FileSystem.deleteAsync(localUri);
		}
	}

	/**
	 * Clear all cached images
	 */
	public async clearCache(): Promise<void> {
		const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
		if (dirInfo.exists) {
			await FileSystem.deleteAsync(this.cacheDirectory);
			await this.initCacheDirectory();
		}
	}

	/**
	 * Get cache info including size and file count
	 */
	public async getCacheInfo(): Promise<{ size: number; count: number }> {
		const dirInfo = await FileSystem.getInfoAsync(this.cacheDirectory);
		if (!dirInfo.exists) {
			return { size: 0, count: 0 };
		}

		const files = await FileSystem.readDirectoryAsync(this.cacheDirectory);
		let totalSize = 0;

		for (const file of files) {
			const fileInfo = await FileSystem.getInfoAsync(
				`${this.cacheDirectory}${file}`,
			);
			if (fileInfo.exists && fileInfo.size) {
				totalSize += fileInfo.size;
			}
		}

		return {
			size: totalSize,
			count: files.length,
		};
	}
}

export default ImageCacheManager.getInstance();
