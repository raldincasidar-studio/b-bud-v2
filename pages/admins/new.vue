<script setup>
import { ref } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

const username = ref("");
const password = ref("");
const repeat_password = ref("");
const name = ref("");
const email = ref("");
const role = ref("");

const saveAdmin = async () => {
  const adminData = {
    username: username.value,
    password: password.value,
    name: name.value,
    email: email.value,
    role: role.value,
  };

  if (password.value && (password.value !== repeat_password.value)) {
    return $toast.fire({
      title: 'Passwords do not match',
      icon: 'error',
    })
  }

  try {
    const { data, error } = await useMyFetch("/api/admins", {
      method: 'post',
      body: adminData,
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
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: 'Something went wrong while adding admin',
      icon: 'error',
    });
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between" class="mb-10">
      <v-col><h2>Add New Admin</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveAdmin"
          prepend-icon="mdi-account-plus"
          color="primary"
        >
          Add Admin
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-account-key" title="Admin Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="name" label="Full Name" required></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="username" label="Username" required></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="password" label="Password" type="password" required></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="repeat_password" label="Repeat Password" type="password" required></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="email" label="Email Address" type="email" required></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="role"
              :items="['Admin', 'Superadmin']"
              label="Role"
              required
            ></v-select>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>
