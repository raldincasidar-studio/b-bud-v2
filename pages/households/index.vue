<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col><h2>Households</h2></v-col>
      <!-- The "New Household" button might not be directly applicable if households are implicitly created when a resident is marked as a head.
           If you have a separate flow for creating a household entity, you can uncomment this.
      <v-col class="text-right">
        <v-btn rounded size="large" variant="tonal" to="/households/new" prepend-icon="mdi-home-plus" color="primary">New Household</v-btn>
      </v-col>
      -->
    </v-row>

    <v-card elevation="2">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-home-search-outline" class="mr-2"></v-icon>
        Find Households
      </v-card-title>
      <v-card-text>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Households"
          placeholder="Search by Head's Name, Household No..."
          clearable
          density="compact"
          class="mb-4"
        ></v-text-field>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="households"
          :items-length="totalItems"
          :loading="loading"
          :search="searchKey" 
          @update:options="loadHouseholds"
          item-value="household_id"
        >
          <!-- Slot for Household Name -->
          <template v-slot:item.household_name="{ item }">
            <strong>{{ item.household_name }}</strong>
          </template>

          <!-- Slot for Household Number -->
          <template v-slot:item.household_number="{ item }">
            {{ item.household_number }}
          </template>

          <!-- Slot for Number of Members -->
          <template v-slot:item.number_of_members="{ item }">
            <v-chip small :color="item.number_of_members > 0 ? 'blue' : 'grey'">
              {{ item.number_of_members }}
            </v-chip>
          </template>
          
          <!-- Slot for Head Full Name -->
          <template v-slot:item.head_full_name="{ item }">
            {{ item.head_first_name }} {{ item.head_last_name }}
          </template>

          <!-- Slot for Actions -->
          <template v-slot:item.action="{ item }">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              :to="`/residents/${item.household_id}`" 
              prepend-icon="mdi-account-details-outline"
              title="View Household Head Details"
            >
              View Head
            </v-btn>
            <!-- You could add another button to view household members if you have such a page -->
            <!--
            <v-btn
              variant="tonal"
              color="secondary"
              size="small"
              :to="`/households/${item.household_id}/members`" 
              prepend-icon="mdi-account-group-outline"
              class="ml-2"
              title="View Household Members"
            >
              Members
            </v-btn>
            -->
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" prominent border="start" class="ma-4">
                No households found matching your criteria.
            </v-alert>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useMyFetch } from '../composables/useMyFetch'; // Ensure this path is correct

// Navigation items (from original, kept for context if needed elsewhere, but not used in this table directly)
// const navItems = [
//     { to: '/dashboard', text: 'Dashboard', icon: 'mdi-speedometer' },
//     // ... other items
// ];

const searchKey = ref('');
const totalItems = ref(0);      // Renamed from totalHouseholds to match Vuetify prop
const households = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);   // Default items per page for v-data-table-server

const headers = ref([
  { title: 'Household Name', key: 'household_name', sortable: false, align: 'start' }, // API will sort by head's name
  { title: 'Household No.', key: 'household_number', sortable: false },
  { title: 'Head of Household', key: 'head_full_name', sortable: false, value: item => `${item.head_first_name || ''} ${item.head_last_name || ''}`.trim() },
  { title: 'No. of Members', key: 'number_of_members', sortable: false, align: 'center' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// Debounce search
let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // Trigger table update by calling loadHouseholds with current options
    // The v-data-table-server's @update:options will also pass its current state,
    // but we ensure our searchKey is used.
    loadHouseholds({ 
      page: 1, // Reset to page 1 on new search
      itemsPerPage: itemsPerPage.value, 
      sortBy: [], // API handles sorting, or pass if API supports dynamic sort
      search: newValue 
    });
  }, 500); // 500ms debounce
});

async function loadHouseholds(options) {
  loading.value = true;
  // Destructure options from v-data-table-server. 'search' from options might be outdated if searchKey changed rapidly.
  const { page, itemsPerPage: rpp, sortBy } = options; 
  
  // Use the latest searchKey from our ref for the API call
  const currentSearchTerm = searchKey.value; 

  // Handle sorting (if your API supports it, otherwise API default is used)
  // let sortKey = null;
  // let sortOrder = null;
  // if (sortBy && sortBy.length > 0) {
  //   sortKey = sortBy[0].key;
  //   sortOrder = sortBy[0].order;
  // }

  try {
    const { data, error } = await useMyFetch('/api/households', {
      query: {
        search: currentSearchTerm, // Use our debounced searchKey
        page: page,
        itemsPerPage: rpp,
        // sortBy: sortKey,    // Pass if API supports dynamic sorting
        // sortOrder: sortOrder, // Pass if API supports dynamic sorting
      },
    });

    if (error.value) {
      console.error('Failed to load households:', error.value);
      // Handle error (e.g., show a toast message)
      households.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      households.value = data.value.households || []; // API returns { households: [...] }
      totalItems.value = data.value.total || 0;       // API returns { total: ... }
    }
  } catch (e) {
    console.error('Exception while loading households:', e);
    households.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// Initial load is handled by v-data-table-server's @update:options event
</script>

<style scoped>
/* Optional: Add any specific styles here */
.v-card-title .v-icon {
  color: rgb(var(--v-theme-primary));
}
</style>