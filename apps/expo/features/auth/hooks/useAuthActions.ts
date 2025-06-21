import { useAtomValue, useSetAtom } from "jotai";
import { Href, router } from "expo-router";
import {
	GoogleSignin,
	statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
import {
	tokenAtom,
	refreshTokenAtom,
	isLoadingAtom,
	redirectToAtom,
} from "../atoms/authAtoms";
import { packItemsSyncState, packsSyncState } from "~/features/packs/store";
import { isAuthed, userStore, userSyncState } from "~/features/auth/store";
import ImageCacheManager from "~/lib/utils/ImageCacheManager";
import { packWeigthHistorySyncState } from "~/features/packs/store/packWeightHistory";
import axiosInstance from "~/lib/api/client";

function redirect(route: string) {
	try {
		const parsedRoute: Href = JSON.parse(route);
		return router.replace(parsedRoute);
	} catch {
		router.replace(route as Href);
	}
}

export function useAuthActions() {
	const setToken = useSetAtom(tokenAtom);
	const setRefreshToken = useSetAtom(refreshTokenAtom);
	const setIsLoading = useSetAtom(isLoadingAtom);
	const redirectTo = useAtomValue(redirectToAtom);

	const clearLocalData = async () => {
		// Clear tokens from secure storage
		await SecureStore.deleteItemAsync("access_token");
		await SecureStore.deleteItemAsync("refresh_token");

		// Clear state
		await setToken(null);
		await setRefreshToken(null);
		packsSyncState.clearPersist();
		packItemsSyncState.clearPersist();
		userSyncState.clearPersist();
		packWeigthHistorySyncState.clearPersist();
		isAuthed.set(false);
		ImageCacheManager.clearCache();
	};

	const signIn = async (email: string, password: string) => {
		setIsLoading(true);
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/login`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, password }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to sign in");
			}

			console.log(data.accessToken, data.refreshToken);
			// Store both tokens
			await SecureStore.setItemAsync("access_token", data.accessToken);
			await SecureStore.setItemAsync("refresh_token", data.refreshToken);

			await setToken(data.accessToken);
			await setRefreshToken(data.refreshToken);
			userStore.set(data.user);
			redirect(redirectTo);
		} catch (error) {
			console.error("Sign in error:", error);
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const signInWithGoogle = async () => {
		try {
			setIsLoading(true);

			// Check if user is already signed in to Google
			await GoogleSignin.hasPlayServices();

			// Sign in with Google
			const userInfo = await GoogleSignin.signIn();

			// Get the ID token
			const { idToken } = await GoogleSignin.getTokens();

			if (!idToken) {
				throw new Error("No ID token received from Google");
			}

			// Send the token to backend
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/google`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ idToken }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to sign in with Google");
			}

			// Store both tokens
			await SecureStore.setItemAsync("access_token", data.accessToken);
			await SecureStore.setItemAsync("refresh_token", data.refreshToken);

			await setToken(data.accessToken);
			await setRefreshToken(data.refreshToken);
			userStore.set(data.user);
			redirect(redirectTo);
		} catch (error: any) {
			setIsLoading(false);

			if (error.code === statusCodes.SIGN_IN_CANCELLED) {
				console.log("User cancelled the login flow");
			} else if (error.code === statusCodes.IN_PROGRESS) {
				console.log("Sign in is in progress");
			} else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
				console.log("Play services not available");
			} else {
				console.error("Google sign in error:", error);
			}

			throw error;
		}
	};

	const signInWithApple = async () => {
		try {
			setIsLoading(true);
			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL,
				],
			});

			// Send the identity token to your backend
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/apple`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						identityToken: credential.identityToken,
						authorizationCode: credential.authorizationCode,
					}),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to sign in with Apple");
			}

			// Store both tokens
			await SecureStore.setItemAsync("access_token", data.accessToken);
			await SecureStore.setItemAsync("refresh_token", data.refreshToken);

			await setToken(data.accessToken);
			await setRefreshToken(data.refreshToken);
			userStore.set(data.user);
			redirect(redirectTo);
		} catch (error) {
			console.error("Apple sign in error:", error);
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const signUp = async (
		email: string,
		password: string,
		firstName?: string,
		lastName?: string,
	) => {
		setIsLoading(true);
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/register`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, password, firstName, lastName }),
				},
			);

			const responseData = await response.json();

			if (!response.ok) {
				throw new Error(responseData.error || "Registration failed");
			}
		} catch (error: any) {
			console.error("Registration error:", error.message);
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		setIsLoading(true);
		try {
			// Sign out from Google if signed in
			const isSignedIn = GoogleSignin.hasPreviousSignIn();
			if (isSignedIn) {
				await GoogleSignin.signOut();
			}

			// Get the refresh token
			const refreshToken = await SecureStore.getItemAsync("refresh_token");

			if (refreshToken) {
				// Call the logout endpoint to revoke the refresh token
				await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/logout`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ refreshToken }),
				});
			}

			clearLocalData();
			router.replace("/");
		} catch (error) {
			console.error("Sign out error:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const forgotPassword = async (email: string) => {
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/forgot-password`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to process request");
			}

			return data;
		} catch (error) {
			console.error("Forgot password error:", error);
			throw error;
		}
	};

	const resetPassword = async (
		email: string,
		code: string,
		newPassword: string,
	) => {
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/reset-password`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, code, newPassword }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to reset password");
			}

			return data;
		} catch (error) {
			console.error("Reset password error:", error);
			throw error;
		}
	};

	const verifyEmail = async (email: string, code: string) => {
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/verify-email`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email, code }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to verify email");
			}

			// If verification is successful, set the user and tokens
			if (data.accessToken && data.refreshToken && data.user) {
				await SecureStore.setItemAsync("access_token", data.accessToken);
				await SecureStore.setItemAsync("refresh_token", data.refreshToken);

				await setToken(data.accessToken);
				await setRefreshToken(data.refreshToken);
				userStore.set(data.user);
				redirect(redirectTo);
			}

			return data;
		} catch (error) {
			console.error("Email verification error:", error);
			throw error;
		}
	};

	const resendVerificationEmail = async (email: string) => {
		try {
			const response = await fetch(
				`${process.env.EXPO_PUBLIC_API_URL}/api/auth/resend-verification`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ email }),
				},
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to resend verification email");
			}

			return data;
		} catch (error) {
			console.error("Resend verification email error:", error);
			throw error;
		}
	};

	const deleteAccount = async () => {
		setIsLoading(true);
		try {
			const response = await axiosInstance.delete("/api/auth");

			if (response.status !== 200) {
				throw new Error(response.data?.error || "Failed to delete account");
			}

			// Clear tokens and user data
			await clearLocalData();
			router.replace("/");
		} catch (error) {
			console.error("Delete account error:", error);
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	return {
		signIn,
		signInWithGoogle,
		signInWithApple,
		signUp,
		signOut,
		forgotPassword,
		resetPassword,
		verifyEmail,
		resendVerificationEmail,
		deleteAccount,
	};
}
