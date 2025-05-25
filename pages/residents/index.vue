<template>
  <v-container class="my-10">
    <v-row justify="space-between" class="mb-5">
      <v-col><h2>Residents</h2></v-col>
      <v-col class="text-right">
        <v-btn
          rounded
          size="large"
          variant="tonal"
          to="/residents/new"
          prepend-icon="mdi-account-plus"
          color="primary"
        >
          New Resident
        </v-btn>
      </v-col>
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-account-search-outline" class="mr-2"></v-icon>
        Find Residents
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Residents"
          placeholder="Search by name, email, contact, address..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="residents"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey"
          @update:options="loadResidents"
          item-value="_id"
        >
          <template v-slot:item.full_name="{ item }">
            {{ item.first_name }} {{ item.middle_name ? item.middle_name + ' ' : '' }}{{ item.last_name }}
          </template>

          <template v-slot:item.address="{ item }">
            <div class="text-truncate" style="max-width: 250px;">
              {{ item.address_house_number }} {{ item.address_street }}, {{ item.address_subdivision_zone }}, {{ item.address_city_municipality }}
            </div>
          </template>

          <template v-slot:item.is_household_head="{ item }">
            <v-chip :color="item.is_household_head ? 'green' : 'grey'" small>
              {{ item.is_household_head ? 'Yes' : 'No' }}
            </v-chip>
          </template>

          <template v-slot:item.created_at="{ item }">
            {{ formatDate(item.created_at) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              :to="`/residents/${item._id}`"
              prepend-icon="mdi-eye-outline"
            >
              View
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

           <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">
                No residents found matching your criteria or no residents have been added yet.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../composables/useMyFetch'; // Assuming this is your composable

// Navigation items (seems unrelated to this specific view, but kept from original)
// const navItems = [
//     { to: '/dashboard', text: 'Dashboard', icon: 'mdi-speedometer' },
//     { to: '/customers', text: 'Customers', icon: 'mdi-account-group' },
//     // ... other items
// ];

const searchKey = ref('');
const totalItems = ref(0);
const residents = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10); // Default items per page

const headers = ref([
  { title: 'Full Name', key: 'full_name', sortable: false, align: 'start', value: item => `${item.first_name} ${item.middle_name || ''} ${item.last_name}` },
  { title: 'Email', key: 'email', sortable: true },
  { title: 'Contact No.', key: 'contact_number', sortable: false },
  { title: 'Address', key: 'address', sortable: false, width: '300px' },
  { title: 'Household Head', key: 'is_household_head', sortable: true, align: 'center' },
  { title: 'Date Added', key: 'created_at', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// Debounce search
let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // Trigger table update, v-data-table-server's @update:options will pick up the new searchKey
    // Or, if you need to manually trigger:
    loadResidents({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [], search: newValue });
  }, 500); // 500ms debounce
});


async function loadResidents(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp, sortBy, search } = options;

  // Handle sorting (if your API supports it)
  let sortKey = null;
  let sortOrder = null;
  if (sortBy && sortBy.length > 0) {
    sortKey = sortBy[0].key;
    sortOrder = sortBy[0].order; // 'asc' or 'desc'
  }

  try {
    const { data, error } = await useMyFetch('/api/residents', {
      query: {
        search: search || searchKey.value, // Use the search from options if provided, else from ref
        page: page,
        itemsPerPage: rpp,
        // sortBy: sortKey, // Add if API supports
        // sortOrder: sortOrder, // Add if API supports
      },
    });

    if (error.value) {
      console.error('Failed to load residents:', error.value);
      // Handle error (e.g., show a toast message)
      residents.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      residents.value = data.value.residents || [];
      totalItems.value = data.value.total || 0;
    }
  } catch (e) {
    console.error('Exception while loading residents:', e);
    residents.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    return dateString; // Fallback to original string if parsing fails
  }
};

// Initial load is handled by v-data-table-server's @update:options
</script>

<style scoped>
/* Optional: Add any specific styles here */
.v-card-title .v-icon {
  color: rgb(var(--v-theme-primary)); /* Match icon color to primary theme */
}
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>