<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-4">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Add New Admin</h2>
        <p class="text-grey-darken-1">Create a new administrator account.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          @click="saveAdmin"
          color="primary"
          size="large"
          prepend-icon="mdi-content-save"
          :loading="loading"
          :disabled="loading"
        >
          Save Admin
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-6" flat border>
      <v-card-text class="py-6">
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">First Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.firstname"
              label="Juan"
              variant="outlined"
              :error-messages="v$.firstname.$errors.map(e => e.$message)"
              @blur="v$.firstname.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Middle Name (Optional)</label>
            <v-text-field
              v-model="form.middlename"
              label="Reyes"
              variant="outlined"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Last Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.lastname"
              label="Dela Cruz"
              variant="outlined"
              :error-messages="v$.lastname.$errors.map(e => e.$message)"
              @blur="v$.lastname.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Username <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.username"
              label="Juan123"
              variant="outlined"
              :error-messages="v$.username.$errors.map(e => e.$message)"
              @blur="v$.username.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Email Address <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.email"
              label="juanluna@gmail.com"
              type="email"
              variant="outlined"
              :error-messages="v$.email.$errors.map(e => e.$message)"
              @blur="v$.email.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Contact Number <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.contact_number"
              label="09356770642"
              variant="outlined"
              maxlength="11"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Password <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.password"
              label="Password"
              type="password"
              variant="outlined"
              hint="Must be at least 6 characters long."
              persistent-hint
              :error-messages="v$.password.$errors.map(e => e.$message)"
              @blur="v$.password.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Repeat Password <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.repeat_password"
              label="Repeat Password"
              type="password"
              variant="outlined"
              :error-messages="v$.repeat_password.$errors.map(e => e.$message)"
              @blur="v$.repeat_password.$touch"
            ></v-text-field>
          </v-col>
          
          <!-- UPDATED: Role dropdown replaced with a readonly input field -->
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Role</label>
            <v-text-field
              v-model="form.role"
              variant="outlined"
              readonly
              :error-messages="v$.role.$errors.map(e => e.$message)"
              @blur="v$.role.$touch"
            ></v-text-field>
          </v-col>
          <!-- END OF UPDATE -->

        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref, computed } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs } from '@vuelidate/validators';

const { $toast } = useNuxtApp();
const router = useRouter();
const loading = ref(false);

const form = reactive({
  username: "",
  password: "",
  repeat_password: "",
  firstname: "",
  middlename: "",
  lastname: "",
  email: "",
  contact_number: "",
  role: "Admin", // The default value is still set here
});

const passwordRef = computed(() => form.password);

const rules = {
  firstname: { required },
  lastname: { required },
  username: { required },
  email: { required, email },
  contact_number: { required },
  password: { required, minLength: minLength(6) },
  repeat_password: { 
    required, 
    sameAs: sameAs(passwordRef)
  },
  role: { required }, // The validation rule still ensures a role is present
};

const v$ = useVuelidate(rules, form);

const saveAdmin = async () => {
  const isFormCorrect = await v$.value.$validate();

  if (!isFormCorrect) {
    return $toast.fire({
      title: 'Please correct the errors on the form.',
      icon: 'error',
    });
  }

  loading.value = true;
  try {
    const { data, error } = await useMyFetch("/api/admins", {
      method: 'post',
      body: form,
    });

    if (error.value || data?.value?.error) {
      return $toast.fire({
        title: data?.value?.error || 'Something went wrong while adding admin',
        icon: 'error',
      });
    }

    $toast.fire({
      title: data?.value?.message || 'Admin added successfully',
      icon: 'success',
    });

    router.push('/admins');

  } catch (err) {
    console.error(err);
    $toast.fire({
      title: 'An unexpected error occurred.',
      icon: 'error',
    });
  } finally {
    loading.value = false;
  }
};
</script>