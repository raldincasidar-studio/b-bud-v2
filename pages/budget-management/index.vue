<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Budget Management</h2>
          <p class="text-grey-darken-1">Manage budget entries and view financial records.</p>
        </v-col>
        <v-col class="text-right">
          <v-btn to="/budget-management/new" color="primary" size="large" prepend-icon="mdi-plus" class="mr-2">
            Add Budget
          </v-btn>
        </v-col>
      </v-row>

      <v-card class="mt-6" flat border>
        <v-card-title class="d-flex align-center pe-2">
            <v-icon icon="mdi-cash-search" class="me-2"></v-icon>
            Search Budget
            <v-spacer></v-spacer>
            <v-text-field
                v-model="searchKey"
                label="Search by Budget Name, Category, etc..."
                prepend-inner-icon="mdi-magnify"
                variant="solo-filled"
                flat
                hide-details
                single-line
            ></v-text-field>
        </v-card-title>
        <v-divider></v-divider>
        
        <!-- REVISED: Date Range Selection & Actions for Budgets -->
        <v-card-text>
          <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Date Range Selection & Actions</v-card-title>
            
          <!-- First row for Start Date, End Date, Presets, and Print Button -->
          <v-row align="center" justify="center" >
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
                    @click:clear="clearDateRange(); loadBudgets()"
                    class="mt-5 pb-0 mb-0 pr-2"
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
                    @click:clear="clearDateRange(); loadBudgets()"
                    class="mt-5 pb-0 mb-0 pr-2"
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

            <v-col cols="12" md="6" class="d-flex align-center justify-end flex-wrap">
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
              
              <!-- Print Data Button, now opens the dialog -->
              <v-btn
                color="info"
                prepend-icon="mdi-printer"
                @click="openPrintDialog"
                :disabled="budgets.length === 0 && !loading"
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
          :items-length="totalBudgets"
          :items="budgets"
          :loading="loading"
          @update:options="loadBudgets"
          class="elevation-0"
          item-value="_id"
        >
          <template v-slot:item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" :to="`/budget-management/${item._id}`" size="small">
              EDIT / DELETE
            </v-btn>
          </template>

          <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No budget entries found matching your criteria.</v-alert>
          </template>

        </v-data-table-server>
      </v-card>

    <!-- Print Dialog (similar to inventory) -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Budget Report</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Budget Management Report</h3>
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
                    (No specific date filter applied)
                </span>
            </p>
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ budgetsForPrint.length }} Budgets
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in budgetsForPrint" :key="item._id">
                  <td>{{ item.budgetName }}</td>
                  <td>{{ item.category }}</td>
                  <td class="text-right">{{ formatCurrency(item.amount) }}</td>
                  <td>{{ formatDate(item.date) }}</td>
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
import { ref, watch, computed, onMounted } from 'vue';
import { useMyFetch } from '@/composables/useMyFetch';
import { useNuxtApp } from '#app'; 
import logoImage from '~/assets/img/logo.png'; // Import the logo image

const { $toast } = useNuxtApp();

const headers = [
  { title: 'Budget Name', align: 'start', key: 'budgetName', sortable: true },
  { title: 'Category', align: 'start', key: 'category', sortable: true },
  { title: 'Amount', align: 'end', key: 'amount', sortable: false }, // Align to end for currency
  { title: 'Date', align: 'start', key: 'date', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.filter(header => header.key !== 'action');
});


const searchKey = ref('');
const totalBudgets = ref(0);
const budgets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const currentTableOptions = ref({}); // To store current table options for reloading


// --- NEW Date Range Selection ---
const startDate = ref(null); // Will store Date objects
const endDate = ref(null);   // Will store Date objects
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null); // 'day', 'week', 'month', 'year'

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// --- Print functionality refs and methods ---
const printDialog = ref(false);
const budgetsForPrint = ref([]); // Holds all data for printing


// --- WATCHERS for Search and Filters ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadBudgets({ ...currentTableOptions.value, page: 1 });
  }, 500);
});


// --- DATA LOADING (REVISED) ---
async function loadBudgets(options) {
  loading.value = true;
  if (options) { 
    currentTableOptions.value = options; 
  } else { 
    options = currentTableOptions.value;
  }

  const { page, itemsPerPage: rpp, sortBy } = options; 
  
  try {
    const sortByKey = sortBy && sortBy.length ? sortBy[0].key : 'date'; 
    const sortOrder = sortBy && sortBy.length ? sortBy[0].order : 'desc';   

    const queryParams = {
      search: searchKey.value, 
      page: page,
      itemsPerPage: rpp,
      sortBy: sortByKey,
      sortOrder: sortOrder,
    };

    // Apply date range filter if available
    if (startDate.value) {
      queryParams.start_date = new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString();
    }
    if (endDate.value) {
      queryParams.end_date = new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString();
    }

    // Clean up undefined/null/empty string query params
    Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

    const { data, error } = await useMyFetch('/api/budgets', {
      query: queryParams
    });

    if (error.value) {
        console.error("Failed to fetch budgets:", error.value);
        budgets.value = [];
        totalBudgets.value = 0;
    } else {
        budgets.value = data.value?.budgets;
        totalBudgets.value = data.value?.totalBudgets;
    }

  } catch (err) {
      console.error("An exception occurred while fetching budgets:", err);
      $toast.fire({ title: 'An unexpected error occurred while loading budgets.', icon: 'error' });
  } finally {
      loading.value = false;
  }
}

// --- Date Filter Functions (from Inventory code) ---
const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; 
};

const applyDateFilters = () => {
  // If manual dates are set or cleared, clear any active preset selection
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; 
  }
  loadBudgets({ ...currentTableOptions.value, page: 1 });
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
      const targetYear = today.getFullYear(); 
      newStartDate = new Date(targetYear, 0, 1); 
      newEndDate = new Date(targetYear, 11, 31); 
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset; 
  loadBudgets({ ...currentTableOptions.value, page: 1 });
};


const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
};


// --- REVISED Print Functionality ---

// Function to fetch all assets matching current filters for printing
async function fetchAllBudgetsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        // If no date filters are set, default to current year for report
        if (!queryParams.start_date && !queryParams.end_date) {
            queryParams.filterYear = new Date().getFullYear();
        }

        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/budgets', { query: queryParams });

        if (error.value) throw new Error('Failed to load all budgets for printing.');
        
        return data.value?.budgets || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true; // Show loading while fetching all data
  budgetsForPrint.value = await fetchAllBudgetsForPrint();
  loading.value = false;

  if (budgetsForPrint.value.length > 0) {
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
          <title>Budget Management Report</title>
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
            .text-right {
                text-align: right;
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


// Initial load of the table data
onMounted(async () => {
    loadBudgets({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});
</script>

<style scoped>
.v-data-table-server {
  font-size: 0.9rem;
}
.text-capitalize {
  text-transform: capitalize;
}

/* Styles specific for printing the dialog content (from inventory) */
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