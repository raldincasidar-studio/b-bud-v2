<template>
  <v-container class="my-10">
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Document Requests</h2>
        <p class="text-grey-darken-1">Manage and process all resident document requests.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/document-requests/new"
          prepend-icon="mdi-file-document-plus-outline"
          color="primary"
        >
          New Request
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="mt-4" flat border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-text-box-search-outline" class="mr-2"></v-icon>
        Request History
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          
          label="Search by type, requestor, etc..."
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat hide-details single-line
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>

      <v-card-text>
        <v-chip-group v-model="statusFilter" column>
          <v-chip filter value="All" color="primary" prepend-icon="mdi-filter-variant">All</v-chip>
          <!-- CORRECTED: Comment is now outside the tag -->
          <v-chip
            v-for="status in statusFilters"
            :key="status.name"
            filter
            variant="tonal" 
            :value="status.name"
            :color="status.color"
            :prepend-icon="status.icon"
          >
            {{ status.name }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <!-- Date Range Selection & Actions for Document Requests -->
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
              :disabled="requests.length === 0 && !loading"
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
        :items="requests"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadRequests"
        item-value="ref_no"
        :sort-by="initialSortBy"
      >
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption">{{ item.ref_no }}</span>
        </template>
        
        <template v-slot:item.requestor_name="{ item }">{{ item.requestor_name || 'N/A' }}</template>

        <!-- UPDATED: Use item.created_at for date display -->
        <template v-slot:item.created_at="{ item }">{{ formatDateTime(item.created_at) }}</template>
        
        <template v-slot:item.purpose_of_request="{ item }">
          <div class="text-truncate" style="max-width: 250px;" :title="item.purpose_of_request">
            {{ item.purpose }} <!-- Assuming purpose field from backend, not purpose_of_request -->
          </div>
        </template>

        <template v-slot:item.document_status="{ item }">
          <v-chip
            :color="getStatusInfo(item.document_status).color"
            :prepend-icon="getStatusInfo(item.document_status).icon"
            label
            size="small"
            class="font-weight-medium"
          >
            {{ item.document_status }}
          </v-chip>
        </template>
        
        <template v-slot:item.action="{ item }">
          <v-btn variant="tonal" color="primary" size="small" :to="`/document-requests/${item.ref_no}`">
            View / Manage
          </v-btn>
        </template>

        <template v-slot:no-data>
          <v-alert type="info" class="ma-3">No document requests found for the selected filters.</v-alert>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Document Requests</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Document Requests Report</h3>
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
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in requestsForPrint" :key="item.ref_no">
                  <td>{{ item.ref_no }}</td>
                  <td>{{ item.request_type }}</td>
                  <td>{{ item.requestor_name || 'N/A' }}</td>
                  <td>{{ formatDateTime(item.created_at) }}</td>
                  <td>{{ item.document_status }}</td>
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
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router'; 
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

const { $toast } = useNuxtApp();
const route = useRoute();

// --- State Definitions ---
const searchKey = ref('');
const statusFilter = ref(route.query.status || 'All');
const totalItems = ref(0);
const requests = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const currentTableOptions = ref({}); // To store current table options for reloading

// UPDATED: initialSortBy to use 'created_at'
const initialSortBy = ref([{ key: 'created_at', order: 'desc' }]);

// Print functionality refs and methods
const startDate = ref(null); // Will store Date objects
const endDate = ref(null);   // Will store Date objects
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null); // 'day', 'week', 'month', 'year'
const printDialog = ref(false);
const requestsForPrint = ref([]); // Holds all data for printing

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');


const statusFilters = ref([
  { name: 'Pending', color: 'orange-darken-1', icon: 'mdi-clock-outline' },
  // { name: 'Follow up', color: 'blue-darken-1', icon: 'mdi-account-voice' },
  { name: 'Processing', color: 'blue-darken-1', icon: 'mdi-cogs' },
  { name: 'Approved', color: 'cyan-darken-1', icon: 'mdi-check-circle-outline' },
  { name: 'Ready for Pickup', color: 'teal-darken-1', icon: 'mdi-package-variant-closed' },
  { name: 'Released', color: 'green-darken-1', icon: 'mdi-check-decagram-outline' },
  { name: 'Declined', color: 'red-darken-2', icon: 'mdi-close-octagon-outline' }
]);

// UPDATED: Header for date to use 'created_at' as key
const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: false, width: '150px' },
  { title: 'Request Type', key: 'request_type', sortable: true },
  { title: 'Requestor', key: 'requestor_name', sortable: true },
  { title: 'Date of Request', key: 'created_at', sortable: true }, // Changed key to 'created_at'
  { title: 'Status', key: 'document_status', sortable: true, align: 'center' },
  { title: 'Details', key: 'action', sortable: false, align: 'center' },
]);

// Headers to be displayed in the print view (excluding 'Action')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});


// --- Data Loading Function ---
async function loadRequests(options) {
  loading.value = true;
  currentTableOptions.value = options; // Store current options
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryFromUrl = { ...route.query };

  const queryFromUi = {
    search: searchKey.value,
    page,
    itemsPerPage: rpp,
    status: statusFilter.value === 'All' ? undefined : statusFilter.value,
    // Add date filters
    start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
    end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
  };
  
  if (sortBy && sortBy.length > 0) {
    queryFromUi.sortBy = sortBy[0].key;
    queryFromUi.sortOrder = sortBy[0].order;
  }
  
  const finalQuery = { ...queryFromUrl, ...queryFromUi };
  
  Object.keys(finalQuery).forEach(key => (finalQuery[key] === undefined || finalQuery[key] === null || finalQuery[key] === '') && delete finalQuery[key]);

  try {
    const { data, error } = await useMyFetch('/api/document-requests', { query: finalQuery });
    if (error.value) throw new Error('Failed to load requests.');
    requests.value = data.value?.requests || [];
    totalItems.value = data.value?.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error' });
    requests.value = []; 
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Watchers ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadRequests({ ...currentTableOptions.value, page: 1 }); // Use stored options, reset page to 1
  }, 500);
});

watch(statusFilter, () => {
  loadRequests({ ...currentTableOptions.value, page: 1 }); // Use stored options, reset page to 1
});

// Watch for route changes to update filters if they come from URL
watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return; 
    const newStatus = route.query.status || 'All';
    if (newStatus !== statusFilter.value) {
        statusFilter.value = newStatus;
    } else {
        loadRequests({ ...currentTableOptions.value, page: 1 }); // Use stored options, reset page to 1
    }
}, { deep: true });

// --- Date Filter Functions ---
const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; // Clear preset when dates are cleared
};

const applyDateFilters = () => {
  // If manual dates are set or cleared, clear any active preset selection
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; // Also clear if both are null
  }
  loadRequests({ ...currentTableOptions.value, page: 1 });
};

const setDateRangePreset = (preset) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let newStartDate = null;
  let newEndDate = null;

  switch (preset) {
    case 'day':
      newStartDate = new Date(today);
      newEndDate = new Date(today); 
      break;
    case 'week':
      // Start of the current week (Sunday)
      newStartDate = new Date(today);
      newStartDate.setDate(today.getDate() - today.getDay());
      // End of the current week (Saturday)
      newEndDate = new Date(newStartDate);
      newEndDate.setDate(newStartDate.getDate() + 6);
      break;
    case 'month':
      // Start of the current month
      newStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
      // End of the current month
      newEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Last day of current month
      break;
    case 'year':
      // Start of the current year
      newStartDate = new Date(today.getFullYear(), 0, 1);
      // End of the current year
      newEndDate = new Date(today.getFullYear(), 11, 31);
      break;
  }
  startDate.value = newStartDate;
  endDate.value = newEndDate;
  selectedDateFilterPreset.value = preset; // Keep preset active
  loadRequests({ ...currentTableOptions.value, page: 1 });
};


// Function to fetch all requests matching current filters for printing
async function fetchAllRequestsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            status: statusFilter.value === 'All' ? undefined : statusFilter.value,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/document-requests', { query: queryParams });

        if (error.value) throw new Error('Failed to load all document requests for printing.');
        
        return data.value?.requests || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true; // Show loading while fetching all data
  requestsForPrint.value = await fetchAllRequestsForPrint();
  loading.value = false;

  if (requestsForPrint.value.length > 0) {
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
          <title>Document Requests Report</title>
          <style>
            /* Basic print styles */
            body { font-family: sans-serif; margin: 20px; color: #333; }
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
          ${printContentDiv.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } else {
    $toast.fire({ title: 'Print area not found.', icon: 'error' });
  }
};

// Renamed from formatTimestamp for consistency with the household management component
const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) { return dateString; }
};

const getStatusInfo = (status) => {
  const foundStatus = statusFilters.value.find(s => s.name === status);
  return foundStatus || { color: 'grey', icon: 'mdi-help-circle-outline' };
};
</script>

<style scoped>
.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
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