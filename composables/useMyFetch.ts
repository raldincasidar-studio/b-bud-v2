// composables\useMyFetch.ts
// composables/useApiFetch.ts
import type { UseFetchOptions } from 'nuxt/app';
const { $swal, $toast } = useNuxtApp();

export function useMyFetch<T>(url: string | (() => string), options: UseFetchOptions<T> = {}) {
  const config = useRuntimeConfig();
  return useFetch<T>(url, {
    baseURL: process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3001',
    ...options,

    onResponseError: (response) => {
      const res_data = response?.response?._data;
      console.log('GLOBAL ERROR:', res_data);
      // console.log($toast);
      $toast.fire({
        title: 'Something went wrong',
        icon: 'error'
      })
      return false;
    }
  });
}
