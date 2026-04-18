export type Variables = {
  user: {
    userId: number;
    role: 'USER' | 'ADMIN';
    /** Populated when the request is authenticated via an OAuth access token. */
    scope?: string;
  };
};
