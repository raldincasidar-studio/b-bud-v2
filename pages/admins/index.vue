<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Admin Management</h2>
          <p class="text-grey-darken-1">Add, view, and search for system administrators.</p>
        </v-col>
        <v-col class="text-right">
          <v-btn to="/admins/new" color="primary" size="large" prepend-icon="mdi-account-plus">
            New Admin
          </v-btn>
        </v-col>
      </v-row>

      <!-- Content -->
      <v-card class="mt-6" flat border>
        <v-card-title class="d-flex align-center pe-2">
            <v-icon icon="mdi-account-search-outline" class="me-2"></v-icon>
            Search Admins
            <v-spacer></v-spacer>
            <v-text-field
                v-model="searchKey"
                
                label="Search by Username, Name, Role, etc..."
                prepend-inner-icon="mdi-magnify"
                variant="solo-filled"
                flat
                hide-details
                single-line
            ></v-text-field>
        </v-card-title>
        <v-divider></v-divider>
        
        <!-- Use v-data-table-server and provide explicit headers -->
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items-length="totalAdmins"
          :items="admins"
          :loading="loading"
          :search="searchKey"
          @update:options="updateTable"
          class="elevation-0"
          item-value="_id"
        >
          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" :to="`/admins/${item._id}`" size="small">
              View / Edit
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

        </v-data-table-server>
      </v-card>
  </v-container>
</template>

<script setup>
import { ref } from 'vue';

// Define headers for the data table for better control and presentation
const headers = [
  { title: 'Full Name', align: 'start', key: 'name', sortable: true },
  { title: 'Username', align: 'start', key: 'username', sortable: true },
  { title: 'Email Address', align: 'start', key: 'email', sortable: false },
  // { title: 'Contact Number', align: 'start', key: 'contact_number', sortable: false }, // Uncomment when backend sends this field
  { title: 'Role', align: 'start', key: 'role', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalAdmins = ref(0);
const admins = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10); // Default items per page

async function updateTable(options) {
  loading.value = true;
  
  // The 'options' object from v-data-table-server contains page, itemsPerPage, sortBy, and search
  const { page, itemsPerPage: newItemsPerPage, sortBy } = options;
  
  try {
    const { data, error } = await useMyFetch('/api/admins', {
      query: {
        search: searchKey.value, // Use the v-model from the text field for search
        page: page,
        itemsPerPage: newItemsPerPage,
        // You can add sorting logic here if the backend supports it
        // sortBy: sortBy.length ? sortBy[0].key : undefined,
        // sortOrder: sortBy.length ? sortBy[0].order : undefined,
      }
    });

    if (error.value) {
        // Handle error, e.g., show a toast notification
        console.error("Failed to fetch admins:", error.value);
        admins.value = [];
        totalAdmins.value = 0;
    } else {
        admins.value = data.value?.admins;
        totalAdmins.value = data.value?.totalAdmins;
    }

  } catch (err) {
      console.error("An exception occurred while fetching admins:", err);
  } finally {
      loading.value = false;
  }
}
</script>