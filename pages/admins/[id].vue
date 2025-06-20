<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-4">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Edit Admin</h2>
        <p class="text-grey-darken-1">Update administrator account details.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          v-if="form.role == 'Admin'"
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
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.name"
              label="Full Name"
              variant="outlined"
              :error-messages="v$.name.$errors.map(e => e.$message)"
              @blur="v$.name.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.username"
              label="Username"
              variant="outlined"
              :error-messages="v$.username.$errors.map(e => e.$message)"
              @blur="v$.username.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
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
            <v-text-field
              v-model="form.contact_number"
              label="Contact Number"
              variant="outlined"
              maxlength="11"
              :error-messages="v$.contact_number.$errors.map(e => e.$message)"
              @blur="v$.contact_number.$touch"
            ></v-text-field>
          </v-col>
          <v-col cols="12"> <v-divider class="my-2"></v-divider> </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="form.password"
              label="New Password"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              hint="Leave blank to keep the current password."
              persistent-hint
              :error-messages="v$.password.$errors.map(e => e.$message)"
              @blur="v$.password.$touch"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
            ></v-text-field>
          </v-col>
          <v-col cols="12" md="6">
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
          <v-col cols="12"> <v-divider class="my-2"></v-divider> </v-col>
          <v-col cols="12" md="6">
            <v-select
              readonly
              v-model="form.role"
              :items="['Admin', 'Technical Admin']"
              label="Role"
              variant="outlined"
              :error-messages="v$.role.$errors.map(e => e.$message)"
              @blur="v$.role.$touch"
            ></v-select>
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
import { required, email, minLength, sameAs, requiredIf } from '@vuelidate/validators';

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
  name: "",
  email: "",
  contact_number: "",
  role: "",
});

const passwordRef = computed(() => form.password);

// Validation rules for editing
const rules = {
  name: { required },
  username: { required },
  email: { required, email },
  contact_number: { required },
  // Password is only validated if the user types in it
  password: { minLength: minLength(6) },
  // Repeat password is only required if the main password field is not empty
  repeat_password: { 
    requiredIf: requiredIf(passwordRef), 
    sameAs: sameAs(passwordRef) 
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
    // Populate the form with fetched data
    form.username = admin.username;
    form.name = admin.name;
    form.email = admin.email;
    form.role = admin.role;
    form.contact_number = admin.contact_number || ''; // Set to empty string if null/undefined

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
  
  // Build the payload with only the fields that can be updated.
  const updateData = {
    username: form.username,
    name: form.name,
    email: form.email,
    role: form.role,
    contact_number: form.contact_number,
  };

  // Only include the password in the payload if the user has entered a new one.
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
  // A better confirmation dialog can be used here (e.g., a v-dialog)
  if (!confirm('Are you sure you want to permanently delete this admin? This action cannot be undone.')) {
    return;
  }

  loading.value = true;
  try {
    const { error } = await useMyFetch(`/api/admins/${adminId}`, {
      method: 'delete',
    });

    if (error.value) throw new Error(error.value.data?.message || 'Error deleting admin');

    $toast.fire({ title: 'Admin deleted successfully', icon: 'success' });
    router.push('/admins');

  } catch (err) {
    $toast.fire({ title: err.message, icon: 'error' });
  } finally {
    loading.value = false;
  }
};
</script>