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

const headers = ref([
  { title: 'Asset Name', key: 'name', sortable: true },
  { title: 'Category', key: 'category', sortable: true },
  { title: 'Total Quantity', key: 'total_quantity', sortable: true, align: 'center' },
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
    const { data, error } = await useMyFetch('/api/assets', { query: queryParams });
    if (error.value) throw new Error('Failed to load assets.');
    
    assets.value = data.value?.assets || [];
    totalAssets.value = data.value?.totalAssets || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    assets.value = [];
    totalAssets.value = 0;
  } finally {
    loading.value = false;
  }
}
</script>