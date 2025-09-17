<template>
  <v-container class="my-10">
    <!-- Page Header -->
    <v-row justify="space-between" align="center" class="mb-5">
      <v-col>
        <h2 class="text-h4 font-weight-bold">Borrowed Assets Log</h2>
        <p class="text-grey-darken-1">Track and manage all asset borrowing requests and history.</p>
      </v-col>
      <v-col class="text-right">
        <v-btn
          size="large"
          to="/borrowed-assets/new"
          prepend-icon="mdi-plus-circle-outline"
          color="primary"
        >
          New Borrow Request
        </v-btn>
      </v-col>
    </v-row>

    <!-- Main Card -->
    <v-card elevation="2" border>
      <v-card-title class="d-flex align-center pa-4">
        <v-icon icon="mdi-archive-arrow-down-outline" class="mr-2"></v-icon>
        Transaction History
        <v-spacer></v-spacer>
        <!-- Search Field -->
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          label="Search by Ref #, Borrower, Item, or Status..."
          flat hide-details single-lines
        ></v-text-field>
      </v-card-title>
      <v-divider></v-divider>
      
      <v-card-text>
        <!-- Status Filter Chips -->
        <v-chip-group v-model="statusFilter" column multiple>
          <v-chip
            v-for="status in Object.keys(STATUS_CONFIG)"
            :key="status"
            filter
            :value="status"
            :color="getStatusColor(status)"
            :prepend-icon="getStatusIcon(status)"
            variant="tonal"
            class="ma-1"
          >
            {{ status }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
      <v-divider></v-divider>

      <!-- Date Range Selection & Actions for Borrowed Assets -->
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
              :disabled="transactions.length === 0 && !loading"
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
        :items="transactions"
        :items-length="totalItems"
        :loading="loading"
        @update:options="loadTransactions"
        class="elevation-1 mt-4"
        item-value="ref_no" 
      >
        <!-- NEW: Custom slot for Ref # -->
        <template v-slot:item.ref_no="{ item }">
          <span class="font-weight-medium text-caption">{{ item.ref_no }}</span>
        </template>

        <!-- Custom slots for dates -->
        <template v-slot:item.borrow_datetime="{ item }">
          {{ formatDate(item.borrow_datetime) }}
        </template>

        <template v-slot:item.expected_return_date="{ item }">
          {{ formatDate(item.expected_return_date, false) }}
        </template>

        <template v-slot:item.date_returned="{ item }">
          <span v-if="item.date_returned">{{ formatDate(item.date_returned) }}</span>
          <span v-else class="text-grey-darken-1">—</span>
        </template>

        <!-- Custom slot for Status -->
        <template v-slot:item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            :prepend-icon="getStatusIcon(item.status)"
            label
            size="small"
            class="font-weight-bold"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <!-- Custom slot for Actions -->
        <template v-slot:item.action="{ item }">
          <div class="d-flex justify-center align-center">
            <v-btn
              variant="tonal"
              color="primary"
              size="small"
              :to="`/borrowed-assets/${item.ref_no}`" 
              class="me-2 text-capitalize"
            >
              Manage
            </v-btn>
          </div>
        </template>

        <!-- No Data Template -->
         <template v-slot:no-data>
          <v-alert type="info" class="ma-3" border="start" prominent>
              No borrowing transactions found for the selected filters.
          </v-alert>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Borrowed Assets Log</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Borrowed Assets Log Report</h3>
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
                <tr v-for="item in transactionsForPrint" :key="item.ref_no">
                  <td>{{ item.ref_no }}</td>
                  <td>{{ item.borrower_name || 'N/A' }}</td>
                  <td>{{ item.item_borrowed }}</td>
                  <td>{{ formatDate(item.borrow_datetime) }}</td>
                  <td>{{ formatDate(item.expected_return_date, false) }}</td>
                  <td>{{ item.date_returned ? formatDate(item.date_returned) : '—' }}</td>
                  <td>{{ item.status }}</td>
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
import { ref, watch, computed } from 'vue'; // Added 'computed'
import { useRoute } from 'vue-router';
import { useMyFetch } from '../../composables/useMyFetch';
import { useNuxtApp } from '#app';

// --- Composables ---
const { $toast } = useNuxtApp();
const route = useRoute();

// --- State Definitions ---
const searchKey = ref('');
const statusFilter = ref(route.query.status ? String(route.query.status).split(',') : []);
const totalItems = ref(0);
const transactions = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);
const updatingStatusFor = ref(null);
const currentTableOptions = ref({}); // To store current table options for reloading

// Print functionality refs and methods
const startDate = ref(null); // Will store Date objects
const endDate = ref(null);   // Will store Date objects
const startDateMenu = ref(false);
const endDateMenu = ref(false);
const selectedDateFilterPreset = ref(null); // 'day', 'week', 'month', 'year'
const printDialog = ref(false);
const transactionsForPrint = ref([]); // Holds all data for printing

const formattedStartDate = computed(() => startDate.value ? new Date(startDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formattedEndDate = computed(() => endDate.value ? new Date(endDate.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '');


// --- Table and UI Configuration ---
// MODIFIED: Added 'Ref #' column and adjusted widths
const headers = ref([
  { title: 'Ref #', key: 'ref_no', sortable: true, width: '10%' },
  { title: 'Borrower', key: 'borrower_name', sortable: true, width: '15%' },
  { title: 'Item', key: 'item_borrowed', sortable: true, width: '15%' },
  { title: 'Date Borrowed', key: 'borrow_datetime', sortable: true, width: '15%' },
  { title: 'Expected Return', key: 'expected_return_date', sortable: true, width: '15%' },
  { title: 'Actual Return', key: 'date_returned', sortable: true, width: '10%' },
  { title: 'Status', key: 'status', sortable: true, align: 'center', width: '10%' },
  { title: 'Actions', key: 'action', sortable: false, align: 'center', width: '10%' },
]);

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});


const STATUS_CONFIG = {
  All:        { color: 'primary', icon: 'mdi-filter-variant' },
  Pending:    { color: 'blue-grey', icon: 'mdi-clock-outline' },
  Processing: { color: 'blue', icon: 'mdi-cogs' },
  Approved:   { color: 'orange', icon: 'mdi-check-circle-outline' },
  Returned:   { color: 'green-darken-1', icon: 'mdi-check-all' },
  Overdue:    { color: 'red-darken-2', icon: 'mdi-alert-octagon-outline' },
  Lost:       { color: 'black', icon: 'mdi-help-rhombus-outline' },
  Damaged:    { color: 'amber-darken-4', icon: 'mdi-alert-decagram-outline' },
  Resolved:   { color: 'teal', icon: 'mdi-handshake-outline' },
  Rejected:   { color: 'red-lighten-1', icon: 'mdi-close-octagon-outline' },
};

// --- Data Loading Function ---
async function loadTransactions(options) {
  loading.value = true;
  currentTableOptions.value = options; // Store current options
  const { page, itemsPerPage: rpp, sortBy } = options;
  
  const queryParams = {
    search: searchKey.value,
    page: page,
    itemsPerPage: rpp,
    // Add date filters
    start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
    end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
  };

  if (statusFilter.value && statusFilter.value.length > 0) {
    queryParams.status = statusFilter.value.join(',');
  }
  
  if (sortBy && sortBy.length > 0) {
    queryParams.sortBy = sortBy[0].key;
    queryParams.sortOrder = sortBy[0].order;
  }

  // Clean up undefined/null/empty string query params
  Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);


  try {
    const { data, error } = await useMyFetch('/api/borrowed-assets', { query: queryParams });
    if (error.value) throw new Error(error.value.data?.message || 'Failed to load transactions.');
    
    transactions.value = data.value.transactions || [];
    totalItems.value = data.value.total || 0;
  } catch (e) {
    $toast.fire({ title: e.message, icon: 'error'});
    transactions.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Watchers for UI Filters and URL Changes ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadTransactions({ ...currentTableOptions.value, page: 1 });
  }, 500);
});

watch(statusFilter, () => {
  loadTransactions({ ...currentTableOptions.value, page: 1 });
}, { deep: true });

watch(() => route.fullPath, (newPath, oldPath) => {
    if (newPath === oldPath) return;
    statusFilter.value = route.query.status ? String(route.query.status).split(',') : [];
    // Ensure that if the route changes, the transactions are reloaded with the correct page and existing filters
    loadTransactions({ ...currentTableOptions.value, page: 1 });
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
  loadTransactions({ ...currentTableOptions.value, page: 1 });
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
  loadTransactions({ ...currentTableOptions.value, page: 1 });
};


// Function to fetch all transactions matching current filters for printing
async function fetchAllTransactionsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            status: statusFilter.value && statusFilter.value.length > 0 ? statusFilter.value.join(',') : undefined,
            start_date: startDate.value ? new Date(startDate.value.setHours(0, 0, 0, 0)).toISOString() : undefined,
            end_date: endDate.value ? new Date(endDate.value.setHours(23, 59, 59, 999)).toISOString() : undefined,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/borrowed-assets', { query: queryParams });

        if (error.value) throw new Error('Failed to load all borrowed assets for printing.');
        
        return data.value?.transactions || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true; // Show loading while fetching all data
  transactionsForPrint.value = await fetchAllTransactionsForPrint();
  loading.value = false;

  if (transactionsForPrint.value.length > 0) {
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
          <title>Borrowed Assets Log Report</title>
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


// --- Helper and Action Functions ---
const getStatusColor = (status) => STATUS_CONFIG[status]?.color || 'grey';
const getStatusIcon = (status) => STATUS_CONFIG[status]?.icon || 'mdi-help-circle-outline';

const getAvailableActions = (currentStatus) => {
  // This function might be used on the detail page, leaving it as is.
  const actions = [];
  switch (currentStatus) {
    case 'Pending':
      actions.push({ status: 'Processing', title: 'Start Processing', icon: 'mdi-cogs', color: 'blue' });
      actions.push({ status: 'Rejected', title: 'Reject Request', icon: 'mdi-cancel', color: 'red' });
      break;
    case 'Processing':
      actions.push({ status: 'Approved', title: 'Approve & Release Item', icon: 'mdi-check-circle', color: 'green' });
      actions.push({ status: 'Pending', title: 'Return to Pending', icon: 'mdi-arrow-left', color: 'blue-grey' });
      break;
    case 'Approved':
    case 'Overdue':
      actions.push({ status: 'Damaged', title: 'Mark as Damaged', icon: getStatusIcon('Damaged'), color: getStatusColor('Damaged'), prompt: true });
      actions.push({ status: 'Lost', title: 'Mark as Lost', icon: getStatusIcon('Lost'), color: getStatusColor('Lost'), prompt: true });
      break;
    case 'Lost':
    case 'Damaged':
      actions.push({ status: 'Resolved', title: 'Mark as Resolved', icon: getStatusIcon('Resolved'), color: getStatusColor('Resolved'), prompt: true });
      break;
  }
  return actions;
};

// MODIFIED: This function now uses ref_no for consistency
async function updateTransactionStatus(transactionItem, newStatus, prompt = false) {
  if (prompt) {
    const result = await $toast.fire({
      title: `Confirm Action: ${newStatus}`,
      html: `This will mark item <b>${transactionItem.item_borrowed}</b> as <b>${newStatus}</b>.<br/>This may deactivate the resident's account. Are you sure?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, confirm!',
    });
    if (!result.isConfirmed) return;
  }
  
  updatingStatusFor.value = transactionItem.ref_no; // Use ref_no to track which item is updating
  try {
    // API call now uses the ref_no
    const { data, error } = await useMyFetch(`/api/borrowed-assets/${transactionItem.ref_no}/status`, {
      method: 'PATCH',
      body: { status: newStatus },
    });

    if (error.value) throw new Error(error.value.data?.message || 'API error.');

    $toast.fire({ title: data.value?.message || 'Status updated!', icon: 'success' });
    
    // Find and update the item in the local array using ref_no
    const index = transactions.value.findIndex(t => t.ref_no === transactionItem.ref_no);
    if (index !== -1) {
      transactions.value[index].status = newStatus;
    }
  } catch (e) {
    $toast.fire({ title: e.message || 'Failed to update status.', icon: 'error' });
  } finally {
    updatingStatusFor.value = null;
  }
}

const formatDate = (dateString, includeTime = true) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.hour12 = true;
    }
    return date.toLocaleString('en-US', options);
  } catch (e) {
    return dateString;
  }
};

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