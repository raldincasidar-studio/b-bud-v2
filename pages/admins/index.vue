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
          <!-- This slot correctly targets 'item.createdAt' -->
          <template v-slot:item.createdAt="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>

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

// The headers array correctly uses the key 'createdAt'
const headers = [
  { title: 'Full Name', align: 'start', key: 'name', sortable: true },
  { title: 'Username', align: 'start', key: 'username', sortable: true },
  { title: 'Email Address', align: 'start', key: 'email', sortable: false },
  { title: 'Role', align: 'start', key: 'role', sortable: true },
  { title: 'Date Added', align: 'start', key: 'createdAt', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalAdmins = ref(0);
const admins = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10); 

async function updateTable(options) {
  loading.value = true;
  
  const { page, itemsPerPage: newItemsPerPage, sortBy } = options;
  
  try {
    const sortByKey = sortBy.length ? sortBy[0].key : 'createdAt'; 
    const sortOrder = sortBy.length ? sortBy[0].order : 'desc';   

    const { data, error } = await useMyFetch('/api/admins', {
      query: {
        search: searchKey.value, 
        page: page,
        itemsPerPage: newItemsPerPage,
        sortBy: sortByKey,
        sortOrder: sortOrder,
      }
    });

    if (error.value) {
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

// The formatDate function correctly handles the date string
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
</script>