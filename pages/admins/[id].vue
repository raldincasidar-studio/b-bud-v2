<script setup>
import { ref, onMounted } from "vue";
import { useMyFetch } from "../composables/useMyFetch";
const { $toast } = useNuxtApp();
const router = useRouter();

const route = useRoute();
const adminId = ref(null);

const username = ref("");
const password = ref("");
const repeat_password = ref("");
const name = ref("");
const email = ref("");
const role = ref("");

onMounted(async () => {
  adminId.value = route.params.id;
  if (adminId.value) {
    try {
      const { data, error } = await useMyFetch(`/api/admins/${adminId.value}`);
      if (error.value || data?.value?.error) {
        return $toast.fire({
          title: data?.value?.error || 'Error fetching admin data',
          icon: 'error',
        });
      }

      const admin = data.value.admin;
      username.value = admin.username;
      password.value = admin.password;
      name.value = admin.name;
      email.value = admin.email;
      role.value = admin.role;
    } catch (error) {
      console.error("Error fetching admin:", error);
      $toast.fire({
        title: 'Error fetching admin data',
        icon: 'error',
      });
    }
  }
});

const saveAdmin = async () => {
  const apiUrl = adminId.value ? `/api/admins/${adminId.value}` : "/api/admins";
  const method = adminId.value ? 'put' : 'post';

  const adminData = {
    username: username.value,
    name: name.value,
    email: email.value,
    role: role.value,
  };

  if (password.value) adminData.password = password.value;

  if (password.value && (password.value !== repeat_password.value)) {
    return $toast.fire({
      title: 'Passwords do not match',
      icon: 'error',
    })
  }

  try {
    const { data, error } = await useMyFetch(apiUrl, {
      method: method,
      body: adminData,
    });

    if (error.value || data?.value?.error) return $toast.fire({
      title: data?.value?.error || `Something went wrong ${adminId.value ? 'updating' : 'adding'} admin`,
      icon: 'error',
    });

    $toast.fire({
      title: data?.value?.message || `Admin ${adminId.value ? 'updated' : 'added'} successfully`,
      icon: 'success',
    });
    router.push('/admins'); // Assuming you have an admins list page
  } catch (error) {
    console.error(error);
    $toast.fire({
      title: `Something went wrong ${adminId.value ? 'updating' : 'adding'} admin`,
      icon: 'error',
    });
  }
};

const deleteAdmin = async () => {
  if (!adminId.value) return;

  if (confirm('Are you sure you want to delete this admin?')) {
    try {
      const { data, error } = await useMyFetch(`/api/admins/${adminId.value}`, {
        method: 'delete',
      });

      if (error.value || data?.value?.error) return $toast.fire({
        title: data?.value?.error || 'Something went wrong while deleting admin',
        icon: 'error',
      });

      $toast.fire({
        title: data?.value?.message || 'Admin deleted successfully',
        icon: 'success',
      });
      router.push('/admins'); // Redirect after successful deletion
    } catch (error) {
      console.error("Error deleting admin:", error);
      $toast.fire({
        title: 'Something went wrong while deleting admin',
        icon: 'error',
      });
    }
  }
};
</script>

<template>
  <v-container class="my-10">
    <v-row justify="space-between mb-10">
      <v-col><h2>{{ adminId ? 'Update Admin' : 'Add New Admin' }}</h2></v-col>
      <v-col class="text-right">
        <v-btn
          v-if="adminId"
          rounded
          size="large"
          variant="tonal"
          color="error"
          prepend-icon="mdi-delete"
          class="mr-2"
          @click="deleteAdmin"
        >
          Delete Admin
        </v-btn>
        <v-btn
          rounded
          size="large"
          variant="tonal"
          @click="saveAdmin"
          :prepend-icon="adminId ? 'mdi-content-save-edit' : 'mdi-account-plus'"
          color="primary"
        >
          {{ adminId ? 'Save Update' : 'Add Admin' }}
        </v-btn>
      </v-col>
    </v-row>

    <v-card prepend-icon="mdi-account-circle" title="Admin Information">
      <v-card-item>
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="username" label="Username"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="password" label="New Password" type="password"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="repeat_password" label="Repeat Password" type="password"></v-text-field>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="name" label="Name"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="email" label="Email Address"></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="role"
              :items="['Admin', 'Superadmin']"
              label="Role"
            ></v-select>
          </v-col>
        </v-row>
      </v-card-item>
    </v-card>
  </v-container>
</template>
