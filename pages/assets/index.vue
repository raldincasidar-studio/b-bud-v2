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

      <!-- Date Range Selection & Actions for Assets -->
      <v-card-text>
        <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Date Range Selection & Actions</v-card-title>
          
        <v-row align="center" justify="center">
          <v-col cols="12" sm="6" md="3">
            <v-menu
              v-model="startDateMenu"
              :close-on-content-click="false"
              transition="scale-transition"
              offset-y
              min-width="auto"
            >
              <template v-slot:activator="{ props }">
                <v-text-field
                  v-model="formattedStartDate"
                  label="Start Date"
                  prepend-inner-icon="mdi-calendar"
                  readonly
                  variant="outlined"
                  density="compact"
                  v-bind="props"
                  clearable
                  @click:clear="clearDateRange(); applyDateFilters()"
                  class="mt-5 pr-2"
                ></v-text-field>
              </template>
              <v-date-picker
                v-model="startDate"
                @update:model-value="startDateMenu = false; applyDateFilters()"
                show-adjacent-months
                :max="endDate ? endDate.toISOString().split('T')[0] : undefined"
              ></v-date-picker>
            </v-menu>
          </v-col>

          <v-col cols="12" sm="6" md="3">
            <v-menu
              v-model="endDateMenu"
              :close-on-content-click="false"
              transition="scale-transition"
              offset-y
              min-width="auto"
            >
              <template v-slot:activator="{ props }">
                <v-text-field
                  v-model="formattedEndDate"
                  label="End Date"
                  prepend-inner-icon="mdi-calendar"
                  readonly
                  variant="outlined"
                  density="compact"
                  v-bind="props"
                  clearable
                  @click:clear="clearDateRange(); applyDateFilters()"
                  class="mt-5 pr-2"
                ></v-text-field>
              </template>
              <v-date-picker
                v-model="endDate"
                @update:model-value="endDateMenu = false; applyDateFilters()"
                :min="startDate ? startDate.toISOString().split('T')[0] : undefined"
                show-adjacent-months
              ></v-date-picker>
            </v-menu>
          </v-col>

          <v-col cols="12" md="6" class="d-flex align-center justify-center flex-wrap">
            <v-btn-toggle
              v-model="selectedDateFilterPreset"
              color="primary"
              variant="outlined"
              density="compact"
              group
              class="mr-4 flex-wrap mb-2 mb-md-0"
            >
              <v-btn value="day" @click="setDateRangePreset('day')">Day</v-btn>
              <v-btn value="week" @click="setDateRangePreset('week')">Week</v-btn>
              <v-btn value="month" @click="setDateRangePreset('month')">Month</v-btn>
              <v-btn value="year" @click="setDateRangePreset('year')">Year</v-btn>
            </v-btn-toggle>
            <v-btn
              color="info"
              prepend-icon="mdi-printer"
              @click="openPrintDialog"
              :disabled="assets.length === 0 && !loading"
              class="mb-2 mb-md-0"
            >
              Print Data
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <!-- End Date Range Selection & Actions -->

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

        <!-- New Slot for Pending -->
        <template v-slot:item.pending="{ item }">
          <div class="text-center">{{ item.pending || 0 }}</div>
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

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Asset Inventory</v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn icon dark @click="printDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-btn icon dark @click="printContent">
            <v-icon>mdi-printer</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-8">
          <div id="print-area">
            <h3 class="text-h5 text-center mb-6">Asset Management Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="startDate && endDate">
                    (Filtered from {{ formattedStartDate }} to {{ formattedEndDate }})
                </span>
                <span v-else-if="startDate">
                    (Filtered from {{ formattedStartDate }} onwards)
                </span>
                <span v-else-if="endDate">
                    (Filtered up to {{ formattedEndDate }})
                </span>
                <span v-else>
                    (No date filter applied)
                </span>
            </p>
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ assetsForPrint.length }} Assets/Inventory
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in assetsForPrint" :key="item._id">
                  <td>{{ item.name }}</td>
                  <td>{{ item.available || 0 }}</td>
                  <td>{{ item.pending || 0 }}</td>
                  <td>{{ item.borrowed || 0 }}</td>
                  <td>{{ item.total_quantity || 0 }}</td>
                </tr>
              </tbody>
            </table>
            <p class="text-caption text-center mt-6">Generated by B-bud System.</p>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';
import { useRoute } from 'vue-router';
import logoImage from '~/assets/img/logo.png'; // Import the logo image

const { $toast } = useNuxtApp();
const route = useRoute();

const searchKey = ref('');
const categoryFilter = ref('All');
const totalAssets = ref(0);
const assets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const currentTableOptions = ref({});

const categories = ref([]);
const loadingCategories = ref(true);

const startDate = ref(null);
const endDate = ref(null);
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null);
const printDialog = ref(false);
const assetsForPrint = ref([]);

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');


const headers = ref([
  { title: 'Item Name / Description', key: 'name', sortable: true, width: '35%' },
  { title: 'Available', key: 'available', sortable: false, align: 'center' },
  { title: 'Pending', key: 'pending', sortable: false, align: 'center' },
  { title: 'Borrowed', key: 'borrowed', sortable: false, align: 'center' },
  { title: 'Total Quantity', key: 'total_quantity', sortable: false, align: 'center' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});


let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadAssets({ ...currentTableOptions.value, page: 1 });
  }, 500);
});

watch(categoryFilter, () => {
  loadAssets({ ...currentTableOptions.value, page: 1 });
});

watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return; 
    const newCategory = route.query.category || 'All';
    if (newCategory !== categoryFilter.value) {
        categoryFilter.value = newCategory;
    } else {
        loadAssets({ ...currentTableOptions.value, page: 1 });
    }
}, { deep: true });


async function loadCategories() {
  loadingCategories.value = true;
  try {
    const { data, error } = await useMyFetch('/api/assets/categories');
    if (error.value) {
      throw new Error('Failed to load asset categories.');
    }
    categories.value = data.value?.categories || [];
  } catch (e) {
    console.error("Category loading error:", e);
    $toast.fire({ title: e.message || 'Could not fetch categories.', icon: 'warning' });
    categories.value = [];
  } finally {
    loadingCategories.value = false;
  }
}

async function loadAssets(options) {
  loading.value = true;
  currentTableOptions.value = options;
  const { page, itemsPerPage: rpp, sortBy } = options;

  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    category: categoryFilter.value === 'All' ? '' : categoryFilter.value,
    start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
    end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
  };

  if (sortBy && sortBy.length > 0) {
      queryParams.sortBy = sortBy[0].key;
      queryParams.sortOrder = sortBy[0].order;
  }
  
  Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);


  try {
    const { data, error } = await useMyFetch('/api/assets', { query: queryParams });

    if (error.value) {
      throw new Error('Failed to load assets list.');
    }

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

const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null;
};

const applyDateFilters = () => {
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null;
  }
  loadAssets({ ...currentTableOptions.value, page: 1 });
};

const setDateRangePreset = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let newStartDate = null;
  let newEndDate = null;

  switch (preset) {
    case 'day':
      newStartDate = new Date(today);
      newEndDate = new Date(today); 
      break;
    case 'week':
      newStartDate = new Date(today);
      newStartDate.setDate(today.getDate() - today.getDay());
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + 6);
      break;
    case 'month':
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'year':
      newStartDate = new Date(today.getFullYear(), 0, 1);
      newEndDate = new Date(today.getFullYear(), 11, 31);
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset;
  loadAssets({ ...currentTableOptions.value, page: 1 });
};


async function fetchAllAssetsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            category: categoryFilter.value === 'All' ? '' : categoryFilter.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999
        };
        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/assets', { query: queryParams });

        if (error.value) throw new Error('Failed to load all assets for printing.');
        
        return data.value?.assets || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true;
  assetsForPrint.value = await fetchAllAssetsForPrint();
  loading.value = false;

  if (assetsForPrint.value.length > 0) {
      printDialog.value = true;
  } else {
      $toast.fire({ title: 'No data to print for the selected filters.', icon: 'info' });
  }
};

const printContent = () => {
  const printContentDiv = document.getElementById('print-area');
  if (printContentDiv) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Asset Management Report</title>
          <style>
            /* Basic print styles */
            body { font-family: sans-serif; margin: 20px; color: #333; }
            .print-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .print-logo {
              max-width: 100px; /* Adjust size as needed */
              height: auto;
              display: block;
              margin: 0 auto 10px auto; /* Center with some bottom margin */
            }
            .print-app-name {
              font-size: 1.5em; /* Adjust size as needed */
              font-weight: bold;
              margin-bottom: 10px;
            }
            h3 { text-align: center; margin-bottom: 20px; color: #333; }
            p { text-align: center; margin-bottom: 15px; color: #555; }
            .print-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              page-break-inside: auto; /* Allow table to break across pages */
            }
            .print-table tr { page-break-inside: avoid; page-break-after: auto; }
            .print-table th, .print-table td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              font-size: 0.9em;
            }
            .print-table th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .text-caption {
              font-size: 0.75em;
              color: #777;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <img src="${logoImage}" alt="B-Bud Logo" class="print-logo" />
            <div class="print-app-name">B-Bud</div>
          </div>
          ${printContentDiv.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    // Set the onafterprint event handler BEFORE calling print()
    printWindow.onafterprint = () => {
      // Small delay to ensure browser print dialog fully closes before trying to close the window
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
        }
      }, 100); // 100ms delay
    };

    printWindow.print();
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};


onMounted(() => {
  loadCategories();
});
</script>

<style scoped>
.v-data-table-server {
  font-size: 0.9rem;
}
.text-capitalize {
  text-transform: capitalize;
}

/* Styles specific for printing the dialog content */
@media print {
  /* Hide all elements on the page except the active print dialog */
  body > *:not(.v-overlay-container) {
    display: none !important;
  }
  .v-overlay-container {
    display: block !important;
    position: static; /* Important for print to not be fixed */
    top: auto !important;
    left: auto !important;
    width: auto !important;
    height: auto !important;
    transform: none !important;
    overflow: visible !important;
  }

  /* Target the specific dialog for printing */
  .v-dialog--fullscreen.v-overlay__content {
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
    width: auto !important;
    max-width: none !important;
    min-width: none !important;
    position: static !important;
    display: block !important;
    overflow: visible !important;
  }

  .v-card {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    height: auto !important;
    width: auto !important;
  }
  
  .v-toolbar {
    display: none !important; /* Hide toolbar in print */
  }
  .v-card-text {
    padding: 0 !important;
  }
  #print-area {
    width: 100%;
    margin: 0;
    padding: 0;
  }
}
</style>