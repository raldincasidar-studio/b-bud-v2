<template>
  <v-container class="my-10">
    <!-- Page Header -->
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Audit Log</h2>
        <p class="text-grey-darken-1">Track and review all system and user activities.</p>
      </v-col>
    </v-row>

    <!-- Audit Log Table -->
    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-history" class="mr-2"></v-icon>
        Log History
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          
          label="Search logs by description, user, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <!-- NEW: Date Range Selection & Actions for Audit Logs -->
      <v-card-text>
        <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Log Date Range Selection & Actions</v-card-title>
          
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
                  @click:clear="clearDateRange(); loadLogs()"
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
                  @click:clear="clearDateRange(); loadLogs()"
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
            
            <v-btn
              color="info"
              prepend-icon="mdi-printer"
              @click="openPrintDialog"
              :disabled="logs.length === 0 && !loading"
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
        :items="logs"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadLogs"
        item-value="ref_no"
      >
        <!-- Custom slot for Ref # -->
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption text-black-darken-1">{{ item.ref_no }}</span>
        </template>
        
        <!-- Custom slot for User Name -->
        <template v-slot:item.user_name="{ item }">
          <div class="font-weight-medium">{{ item.user_name }}</div>
        </template>

        <!-- Custom slot for Description -->
        <template v-slot:item.description="{ item }">
          <div class="text-body-2">{{ item.description }}</div>
        </template>

        <!-- Custom slot for Date -->
        <template v-slot:item.date="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <!-- Custom slot for Time -->
        <template v-slot:item.time="{ item }">
          {{ formatTime(item.createdAt) }}
        </template>

        <!-- No Data Template -->
        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No audit logs found.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Audit Log Report</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Audit Log Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="startDate && endDate">
                    (Logs from {{ formattedStartDate }} to {{ formattedEndDate }})
                </span>
                <span v-else-if="startDate">
                    (Logs from {{ formattedStartDate }} onwards)
                </span>
                <span v-else-if="endDate">
                    (Logs up to {{ formattedEndDate }})
                </span>
                <span v-else>
                    (No specific date filter applied)
                </span>
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in logsForPrint" :key="item.ref_no">
                  <td>{{ item.ref_no }}</td>
                  <td>{{ item.user_name }}</td>
                  <td>{{ item.description }}</td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                  <td>{{ formatTime(item.createdAt) }}</td>
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
import { useMyFetch } from '../../composables/useMyFetch'; 
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Make sure this path is correct for your project

const { $toast } = useNuxtApp();

// --- STATE ---
const searchKey = ref('');
const totalItems = ref(0);
const logs = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// Ref to hold the current table options (pagination, sorting)
const currentTableOptions = ref({ page: 1, itemsPerPage: 10, sortBy: [] });

// --- NEW Date Range Selection ---
const startDate = ref(null); 
const endDate = ref(null);   
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null);

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');

// --- Print functionality refs ---
const printDialog = ref(false);
const logsForPrint = ref([]);


// --- TABLE HEADERS ---
const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: false, width: '10%' },
  { title: 'User', key: 'user_name', sortable: true, width: '20%' },
  { title: 'Description', key: 'description', sortable: true, width: '45%' },
  { title: 'Date', key: 'date', sortable: true, width: '12%' },
  { title: 'Time', key: 'time', sortable: false, align: 'end', width: '10%' },
]);

// Headers to be displayed in the print view (all headers are printable in this case)
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action'); // Assuming 'action' might be added later
});


// --- DEBOUNCED SEARCH ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadLogs({ page: 1 }); // Reset page to 1 when search changes
  }, 500);
});

// --- DATA FETCHING ---
async function loadLogs(options) {
  loading.value = true;
  // Merge new options with current table options, prioritizing new ones
  currentTableOptions.value = { ...currentTableOptions.value, ...options };

  const { page, itemsPerPage: rpp, sortBy } = currentTableOptions.value;
  
  const queryParams = { 
    search: searchKey.value, 
    page: page, 
    itemsPerPage: rpp,
    sortBy: sortBy.length > 0 ? sortBy[0].key : 'createdAt', // Default sort
    sortOrder: sortBy.length > 0 ? sortBy[0].order : 'desc',
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

  try {
    const { data, error } = await useMyFetch('/api/audit-logs', { query: queryParams });

    if (error.value) throw new Error(error.value.data?.message || 'Failed to load audit logs.');
    
    logs.value = data.value?.logs || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    logs.value = []; 
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Date Filter Functions ---
const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; 
  loadLogs({ page: 1 }); // Reload data with cleared date filters
};

const applyDateFilters = () => {
  // If manual dates are set or cleared, clear any active preset selection
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; 
  }
  loadLogs({ page: 1 }); // Reset page to 1 when date filters are applied
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
  loadLogs({ page: 1 }); // Reset page to 1 when preset is applied
};


// --- HELPER FUNCTIONS ---
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// --- Print Functionality ---

async function fetchAllLogsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        // Include current sorting for print data
        if (currentTableOptions.value.sortBy && currentTableOptions.value.sortBy.length > 0) {
          queryParams.sortBy = currentTableOptions.value.sortBy[0].key;
          queryParams.sortOrder = currentTableOptions.value.sortBy[0].order;
        }

        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/audit-logs', { query: queryParams });

        if (error.value) throw new Error(error.value.data?.message || 'Failed to load all audit logs for printing.');
        
        return data.value?.logs || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true;
  logsForPrint.value = await fetchAllLogsForPrint();
  loading.value = false;

  if (logsForPrint.value.length > 0) {
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
          <title>Audit Log Report</title>
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

    printWindow.onafterprint = () => {
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
        }
      }, 100);
    };

    printWindow.print();
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};


// Initial load of the table data
onMounted(() => {
    loadLogs({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});
</script>

<style scoped>
/* You can add specific styles here if needed */

/* Styles specific for printing the dialog content */
@media print {
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