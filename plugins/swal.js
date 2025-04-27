import Swal from "sweetalert2";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.provide("swal", Swal);
  nuxtApp.provide(
    "toast",
    Swal.mixin({
      toast: true,
      position: "top",
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
      },
    })
  );
});
