export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
export const appUrl = (path = '') => `${basePath}/${path}`;
