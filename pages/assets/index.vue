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
          density="compact"
          label="Search by Name, Category..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat
          hide-details
          single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>
      
      <!-- Filter Chip Group -->
      <v-card-text>
        <v-chip-group
          v-model="categoryFilter"
          column
          color="primary"
        >
          <v-chip filter value="All">All</v-chip>
          <v-chip filter value="Furniture">Furniture</v-chip>
          <v-chip filter value="Medical">Medical</v-chip>
          <v-chip filter value="Office Supplies">Office Supplies</v-chip>
          <v-chip filter value="Equipment">Equipment</v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

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
import { ref, watch } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();

const searchKey = ref('');
const categoryFilter = ref('All');
const totalAssets = ref(0);
const assets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// REVISED: Updated headers to display new information
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

// --- DATA LOADING ---
// REVISED: Modified to fetch from both endpoints and merge the data
async function loadAssets(options) {
  loading.value = true;
  const { page, itemsPerPage: rpp } = options;
  
  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    category: categoryFilter.value === 'All' ? '' : categoryFilter.value,
  };
  
  try {
    // Step 1: Fetch the paginated/filtered list of assets to determine the current page's items
    const assetsPromise = useMyFetch('/api/assets', { query: queryParams });

    // Step 2: Fetch the full inventory status to get borrowed/available counts for all items
    const inventoryPromise = useMyFetch('/api/assets/inventory-status');

    // Await both promises concurrently for better performance
    const [assetsResponse, inventoryResponse] = await Promise.all([assetsPromise, inventoryPromise]);

    // Error handling for both requests
    if (assetsResponse.error.value) throw new Error('Failed to load assets list.');
    if (inventoryResponse.error.value) throw new Error('Failed to load inventory status.');

    const paginatedAssets = assetsResponse.data.value?.assets || [];
    const inventoryStatusList = inventoryResponse.data.value?.inventory || [];

    // Create a lookup map for efficient merging (Key: asset name, Value: { borrowed, available })
    const inventoryMap = new Map(
      inventoryStatusList.map(item => [item.name, { borrowed: item.borrowed, available: item.available }])
    );

    // Step 3: Merge the two datasets
    const enrichedAssets = paginatedAssets.map(asset => {
      const status = inventoryMap.get(asset.name);
      return {
        ...asset,
        // Use status data if available, otherwise fallback to prevent errors
        available: status ? status.available : asset.total_quantity,
        borrowed: status ? status.borrowed : 0,
      };
    });

    assets.value = enrichedAssets;
    totalAssets.value = assetsResponse.data.value?.totalAssets || 0;

  } catch (e) {
    console.error("Data loading error:", e);
    $toast.fire({ title: e.message || 'An unexpected error occurred.', icon: 'error' });
    assets.value = [];
    totalAssets.value = 0;
  } finally {
    loading.value = false;
  }
}
</script>