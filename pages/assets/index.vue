<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Asset Management</h2>
        <p class="text-grey-darken-1">Manage all barangay assets and inventory.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/assets/new"
          prepend-icon="mdi-plus-box"
          color="primary"
        >
          New Asset
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-archive-search-outline" class="mr-2"></v-icon>
        Asset Inventory
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          
          label="Search by Name, Category..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat
          hide-details
          single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>
      
      <!-- REVISED: Dynamic Filter Chip Group -->
      <template v-if="!loadingCategories && categories.length > 0">
        <v-card-text>
          <v-chip-group
            v-model="categoryFilter"
            column
            color="primary"
          >
            <v-chip filter value="All">All</v-chip>
            <v-chip
              v-for="category in categories"
              :key="category"
              filter
              :value="category"
            >
              {{ category }}
            </v-chip>
          </v-chip-group>
        </v-card-text>
        <v-divider></v-divider>
      </template>

      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        :headers="headers"
        :items="assets"
        :items-length="totalAssets"
        :loading="loading"
        @update:options="loadAssets"
        item-value="_id"
      >
        <!-- The 'name' key now serves as the "Item Name / Description" -->
        <template v-slot:item.name="{ item }">
          <div>
            <div class="font-weight-bold">{{ item.name }}</div>
            <div class="text-caption text-grey-darken-1">{{ item.category }}</div>
          </div>
        </template>
        
        <template v-slot:item.action="{ item }">
          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            :to="`/assets/${item._id}`"
          >
            View/Edit
          </v-btn>
        </template>
        
        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No assets found matching your criteria.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const categoryFilter = ref('All');
const totalAssets = ref(0);
const assets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// --- NEW for Dynamic Categories ---
const categories = ref([]);
const loadingCategories = ref(true);
// ---

const headers = ref([
  { title: 'Item Name / Description', key: 'name', sortable: true, width: '45%' },
  { title: 'Available', key: 'available', sortable: false, align: 'center' },
  { title: 'Borrowed', key: 'borrowed', sortable: false, align: 'center' },
  { title: 'Total Quantity', key: 'total_quantity', sortable: false, align: 'center' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// --- WATCHERS for Search and Filter ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadAssets({ page: 1, itemsPerPage: itemsPerPage.value });
  }, 500);
});

watch(categoryFilter, () => {
  loadAssets({ page: 1, itemsPerPage: itemsPerPage.value });
});

// --- NEW Function to load categories ---
async function loadCategories() {
  loadingCategories.value = true;
  try {
    // This assumes an endpoint /api/assets/categories that returns { categories: ['Furniture', 'Medical', ...] }
    const { data, error } = await useMyFetch('/api/assets/categories');
    if (error.value) {
      throw new Error('Failed to load asset categories.');
    }
    categories.value = data.value?.categories || [];
  } catch (e) {
    console.error("Category loading error:", e);
    // Optionally show a toast, but gracefully hide the filter on error anyway
    $toast.fire({ title: e.message || 'Could not fetch categories.', icon: 'warning' });
    categories.value = []; // Ensure it's an empty array on failure
  } finally {
    loadingCategories.value = false;
  }
}

// --- DATA LOADING (REVISED FOR SIMPLICITY) ---
async function loadAssets(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp } = options;
  
  // Only one set of query parameters is needed now
  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    category: categoryFilter.value === 'All' ? '' : categoryFilter.value,
  };
  
  try {
    // Only ONE API call is needed!
    const { data, error } = await useMyFetch('/api/assets', { query: queryParams });

    if (error.value) {
      throw new Error('Failed to load assets list.');
    }

    // The data is already enriched by the server. No more client-side merging!
    assets.value = data.value?.assets || [];
    totalAssets.value = data.value?.totalAssets || 0;

  } catch (e) {
    console.error("Data loading error:", e);
    $toast.fire({ title: e.message || 'An unexpected error occurred.', icon: 'error' });
    assets.value = [];
    totalAssets.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- LIFECYCLE HOOK ---
// Fetch categories when the component is mounted
onMounted(() => {
  loadCategories();
});
</script>