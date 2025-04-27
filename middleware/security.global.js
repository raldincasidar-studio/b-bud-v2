export default defineNuxtRouteMiddleware((to) => {
  const userData = useCookie('userData');
  const token = userData.value?.token;

  // 🛡 If logged in and going to "/", redirect to /dashboard
  if (token && to.path === '/') {
    return navigateTo('/dashboard');
  }

  // 🚫 If NOT logged in and trying to access a protected route (not "/")
  if (!token && to.path !== '/') {
    return navigateTo('/');
  }

  // ✅ Otherwise allow navigation
});
