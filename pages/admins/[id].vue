<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-4">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Edit Admin</h2>
        <p class="text-grey-darken-1">Update administrator account details.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          v-if="form.role === 'Admin'"
          @click="deleteAdmin"
          color="error"
          variant="outlined"
          size="large"
          prepend-icon="mdi-delete"
          class="mr-4"
          :loading="loading"
        >
          Delete
        </v-btn>
        <v-btn
          @click="saveAdmin"
          color="primary"
          size="large"
          prepend-icon="mdi-content-save-edit"
          :loading="loading"
        >
          Save Update
        </v-btn>
      </v-col>
    </v-row>

    <v-card v-if="!dataLoaded" class="mt-6" flat border>
      <v-skeleton-loader type="card-avatar, article, actions"></v-skeleton-loader>
    </v-card>
    <v-card v-else class="mt-6" flat border>
      <v-card-text class="py-6">
        <v-row>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">First Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.firstname"
              label="First Name"
              variant="outlined"
              :error-messages="v$.firstname.$errors.map(e => e.$message)"
              @blur="v$.firstname.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Middle Name (Optional)</label>
            <v-text-field
              v-model="form.middlename"
              label="Middle Name"
              variant="outlined"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Last Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.lastname"
              label="Last Name"
              variant="outlined"
              :error-messages="v$.lastname.$errors.map(e => e.$message)"
              @blur="v$.lastname.$touch"
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Username <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.username"
              label="Username"
              variant="outlined"
              :error-messages="v$.username.$errors.map(e => e.$message)"
              @blur="v$.username.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Email Address <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.email"
              label="Email Address"
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
              label="Contact Number"
              variant="outlined"
              maxlength="11"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Role</label>
            <v-text-field
              v-model="form.role"
              label="Role"
              variant="outlined"
              readonly
            ></v-text-field>
          </v-col>

          <v-col cols="12"> <v-divider class="my-2"></v-divider> </v-col>

          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">New Password</label>
            <v-text-field
              v-model="form.password"
              label="New Password"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              hint="Leave blank to keep the current password. Minimum 8 characters, with lowercase, uppercase, numbers, and special characters. At least 3 types required if changed."
              persistent-hint
              :error-messages="v$.password.$errors.map(e => e.$message)"
              @blur="v$.password.$touch"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
            ></v-text-field>
            <!-- Password Validation Checklist UI -->
            <v-card class="mt-2" flat border>
              <v-card-text class="py-2">
                <p class="text-subtitle-2 mb-2">Your new password must contain:</p>
                <v-list density="compact" class="py-0">
                  <v-list-item class="px-0 py-1" :class="{ 'text-success': hasEightCharacters }">
                    <template v-slot:prepend>
                      <v-icon :color="hasEightCharacters ? 'success' : 'grey'" :icon="hasEightCharacters ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>At least 8 characters</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-0 py-1">
                    <template v-slot:prepend>
                      <v-icon :color="atLeastThreeTypesValid ? 'success' : 'grey'" :icon="atLeastThreeTypesValid ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>At least 3 of the following:</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-4 py-0" :class="{ 'text-success': hasLowercase }">
                    <template v-slot:prepend>
                      <v-icon :color="hasLowercase ? 'success' : 'grey'" :icon="hasLowercase ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>Lower case letters (a-z)</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-4 py-0" :class="{ 'text-success': hasUppercase }">
                    <template v-slot:prepend>
                      <v-icon :color="hasUppercase ? 'success' : 'grey'" :icon="hasUppercase ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>Upper case letters (A-Z)</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-4 py-0" :class="{ 'text-success': hasNumber }">
                    <template v-slot:prepend>
                      <v-icon :color="hasNumber ? 'success' : 'grey'" :icon="hasNumber ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>Numbers (0-9)</v-list-item-title>
                  </v-list-item>
                  <v-list-item class="px-4 py-0" :class="{ 'text-success': hasSpecial }">
                    <template v-slot:prepend>
                      <v-icon :color="hasSpecial ? 'success' : 'grey'" :icon="hasSpecial ? 'mdi-check-circle' : 'mdi-circle-outline'"></v-icon>
                    </template>
                    <v-list-item-title>Special characters (e.g. !@#$%^&*)</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Repeat New Password</label>
            <v-text-field
              v-model="form.repeat_password"
              label="Repeat New Password"
              :type="showRepeatPassword ? 'text' : 'password'"
              variant="outlined"
              :error-messages="v$.repeat_password.$errors.map(e => e.$message)"
              @blur="v$.repeat_password.$touch"
              :append-inner-icon="showRepeatPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showRepeatPassword = !showRepeatPassword"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, requiredIf, helpers } from '@vuelidate/validators';
import { useRouter, useRoute } from 'vue-router'; // Import useRouter and useRoute

const { $toast } = useNuxtApp();
const router = useRouter();
const route = useRoute();
const adminId = route.params.id;

const loading = ref(false);
const dataLoaded = ref(false);
const showPassword = ref(false);
const showRepeatPassword = ref(false);

const form = reactive({
  username: "",
  password: "",
  repeat_password: "",
  firstname: "",
  middlename: "",
  lastname: "",
  email: "",
  contact_number: "",
  role: "",
});

const passwordRef = computed(() => form.password);

// Computed properties for real-time password validation UI
const hasEightCharacters = computed(() => form.password.length >= 8);
const hasLowercase = computed(() => /(?=.*[a-z])/.test(form.password));
const hasUppercase = computed(() => /(?=.*[A-Z])/.test(form.password));
const hasNumber = computed(() => /(?=.*\d)/.test(form.password));
const hasSpecial = computed(() => /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(form.password));

const atLeastThreeTypesValid = computed(() => {
  // If no password is entered, this rule is considered valid (no complexity needed)
  if (!form.password) return true; 
  let count = 0;
  if (hasLowercase.value) count++;
  if (hasUppercase.value) count++;
  if (hasNumber.value) count++;
  if (hasSpecial.value) count++;
  return count >= 3;
});


const rules = {
  firstname: { required },
  lastname: { required },
  username: { required },
  email: { required, email },
  contact_number: { 
    required, 
    validPhoneNumber: helpers.withMessage(
        'Follow format of 09xxxxxxxxx.',
        helpers.regex(/^09\d{9}$/)
    )
  },
  password: { 
    // These validators will only run if 'password' has a value
    minLength: helpers.withMessage('Must be at least 8 characters long.', minLength(8)),
    hasLowercase: helpers.withMessage('Must contain at least one lowercase letter.', helpers.regex(/(?=.*[a-z])/)),
    hasUppercase: helpers.withMessage('Must contain at least one uppercase letter.', helpers.regex(/(?=.*[A-Z])/)),
    hasNumber: helpers.withMessage('Must contain at least one number (0-9).', helpers.regex(/(?=.*\d)/)),
    hasSpecial: helpers.withMessage('Must contain at least one special character (e.g., !@#$%^&*).', helpers.regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)),
    atLeastThreeTypes: helpers.withMessage('Must contain at least 3 of the 4 types (lowercase, uppercase, numbers, special characters).', (value) => {
        if (!value) return true; // Rule doesn't apply if password is empty
        let count = 0;
        if (/(?=.*[a-z])/.test(value)) count++;
        if (/(?=.*[A-Z])/.test(value)) count++;
        if (/(?=.*\d)/.test(value)) count++;
        if (/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) count++;
        return count >= 3;
    })
  },
  repeat_password: {
    requiredIf: helpers.withMessage('Repeat password is required if a new password is set.', requiredIf(passwordRef)),
    sameAs: helpers.withMessage('Passwords do not match.', sameAs(passwordRef))
  },
  role: { required },
};

const v$ = useVuelidate(rules, form);

onMounted(async () => {
  if (!adminId) {
    $toast.fire({ title: 'Invalid Admin ID.', icon: 'error' });
    router.push('/admins');
    return;
  }
  try {
    const { data, error } = await useMyFetch(`/api/admins/${adminId}`);
    if (error.value) throw new Error(error.value.data?.message || 'Error fetching data');
    const admin = data.value.admin;

    form.username = admin.username;
    form.firstname = admin.firstname || '';
    form.middlename = admin.middlename || '';
    form.lastname = admin.lastname || '';
    form.email = admin.email;
    form.role = admin.role;
    form.contact_number = admin.contact_number || '';

    dataLoaded.value = true;
  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
    router.push('/admins');
  }
});

const saveAdmin = async () => {
  const isFormCorrect = await v$.value.$validate();
  if (!isFormCorrect) {
    return $toast.fire({ title: 'Please correct the errors on the form.', icon: 'error' });
  }

  loading.value = true;

  const updateData = {
    username: form.username,
    firstname: form.firstname,
    middlename: form.middlename,
    lastname: form.lastname,
    email: form.email,
    contact_number: form.contact_number,
  };

  if (form.password) {
    updateData.password = form.password;
  }

  try {
    const { data, error } = await useMyFetch(`/api/admins/${adminId}`, {
      method: 'put',
      body: updateData,
    });

    if (error.value) throw new Error(error.value.data?.message || 'Error updating admin');

    $toast.fire({ title: 'Admin updated successfully', icon: 'success' });
    router.push('/admins');

  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
  } finally {
    loading.value = false;
  }
};

const deleteAdmin = async () => {
  const result = await $toast.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    showConfirmButton: true, // Explicitly ensure confirm button is shown
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'No, cancel',
    // Removed reverseButtons: true to use default button order
  });

  if (result.isConfirmed) {
    loading.value = true;
    try {
      const { error } = await useMyFetch(`/api/admins/${adminId}`, {
        method: 'delete',
      });

      if (error.value) throw new Error(error.value.data?.message || 'Error deleting admin');

      $toast.fire({ title: 'Deleted!', text: 'Admin has been deleted.', icon: 'success' });
      router.push('/admins');

    } catch (err) {
      $toast.fire({ title: err.message, icon: 'error' });
    } finally {
      loading.value = false;
    }
  } else if (result.dismiss === $toast.DismissReason.cancel) {
    $toast.fire({ title: 'Cancelled', text: 'Admin deletion was cancelled.', icon: 'info' });
  }
};
</script>

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
.v-list-item-title {
  font-size: 0.875rem !important; /* Adjust font size to fit */
  line-height: 1.2; /* Adjust line height for better spacing */
}
</style>