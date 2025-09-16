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
              label="(e.g., Juan)"
              variant="outlined"
              :error-messages="v$.firstname.$errors.map(e => e.$message)"
              @blur="v$.firstname.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Middle Name (Optional)</label>
            <v-text-field
              v-model="form.middlename"
              label="(e.g., Reyes)"
              variant="outlined"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="4">
            <label class="v-label mb-3 font-weight-bold text-black">Last Name <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.lastname"
              label="(e.g., Dela Cruz)"
              variant="outlined"
              :error-messages="v$.lastname.$errors.map(e => e.$message)"
              @blur="v$.lastname.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Username <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.username"
              label="(e.g., Juan123)"
              variant="outlined"
              :error-messages="v$.username.$errors.map(e => e.$message)"
              @blur="v$.username.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Email Address <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.email"
              label="(e.g., juanluna@gmail.com)"
              type="email"
              variant="outlined"
              :error-messages="v$.email.$errors.map(e => e.$message)"
              @blur="v$.email.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Contact Number <span class="text-red">*</span></label>
            <v-text-field
              v-model.trim="form.contact_number"
              label="(e.g., 09184489973)"
              variant="outlined"
              maxlength="11"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
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

          <v-col cols="12" md="6">
            <label class="v-label mb-3 font-weight-bold text-black">Password <span class="text-red">*</span></label>
            <v-text-field
              v-model="form.password"
              label="Password"
              type="password"
              variant="outlined"
              hint="Minimum 8 characters, with lowercase, uppercase, numbers, and special characters. At least 3 types required."
              persistent-hint
              :error-messages="v$.password.$errors.map(e => e.$message)"
              @blur="v$.password.$touch"
            ></v-text-field>
             <!-- Password Validation Checklist UI -->
            <v-card class="mt-2" flat border>
              <v-card-text class="py-2">
                <p class="text-subtitle-2 mb-2">Your password must contain:</p>
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
          
          

        </v-row>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { reactive, ref, computed } from "vue";
import { useMyFetch } from "~/composables/useMyFetch";
import { useVuelidate } from '@vuelidate/core';
import { required, email, minLength, sameAs, helpers } from '@vuelidate/validators';
import { useRouter } from 'vue-router'; // Import useRouter

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

// Computed properties for real-time password validation UI
const hasEightCharacters = computed(() => form.password.length >= 8);
const hasLowercase = computed(() => /(?=.*[a-z])/.test(form.password));
const hasUppercase = computed(() => /(?=.*[A-Z])/.test(form.password));
const hasNumber = computed(() => /(?=.*\d)/.test(form.password));
const hasSpecial = computed(() => /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(form.password));

const atLeastThreeTypesValid = computed(() => {
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
        helpers.regex(/^09\d{9}$/) // This matches 09 followed by 9 more digits
    )
  },
  password: { 
    required, 
    minLength: helpers.withMessage('Must be at least 8 characters long.', minLength(8)),
    hasLowercase: helpers.withMessage('Must contain at least one lowercase letter.', helpers.regex(/(?=.*[a-z])/)),
    hasUppercase: helpers.withMessage('Must contain at least one uppercase letter.', helpers.regex(/(?=.*[A-Z])/)),
    hasNumber: helpers.withMessage('Must contain at least one number (0-9).', helpers.regex(/(?=.*\d)/)),
    hasSpecial: helpers.withMessage('Must contain at least one special character (e.g., !@#$%^&*).', helpers.regex(/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/)),
    atLeastThreeTypes: helpers.withMessage('Must contain at least 3 of the 4 types (lowercase, uppercase, numbers, special characters).', (value) => {
        let count = 0;
        if (/(?=.*[a-z])/.test(value)) count++;
        if (/(?=.*[A-Z])/.test(value)) count++;
        if (/(?=.*\d)/.test(value)) count++;
        if (/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) count++;
        return count >= 3;
    })
  },
  repeat_password: { 
    required, 
    sameAs: helpers.withMessage('Passwords do not match.', sameAs(passwordRef))
  },
  role: { required }, 
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

<style scoped>
.v-label { opacity: 1; font-size: 0.875rem; color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity)); display: block; margin-bottom: 4px; font-weight: 500; }
.v-list-item-title {
  font-size: 0.875rem !important; /* Adjust font size to fit */
  line-height: 1.2; /* Adjust line height for better spacing */
}
</style>