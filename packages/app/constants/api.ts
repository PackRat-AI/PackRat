import { API_URL } from '@packrat/config';
// const API_URL = import.meta.env.VITE_API_URL;

/**
 * The api url.
 * format: "{scheme}://{serverhost}:{port}/api"
 * e.g: "http://localhost:4200/api"
 */

// use this for android emulator
// export const api = 'http://10.0.2.2:8787/api';
export const api = API_URL;
