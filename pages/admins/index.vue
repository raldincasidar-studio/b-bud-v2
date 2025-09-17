<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Admin Management</h2>
          <p class="text-grey-darken-1">Add, view, and search for system administrators.</p>
        </v-col>
        <v-col class="text-right">
          <v-btn to="/admins/new" color="primary" size="large" prepend-icon="mdi-account-plus">
            New Admin
          </v-btn>
        </v-col>
      </v-row>

      <!-- Content -->
      <v-card class="mt-6" flat border>
        <v-card-title class="d-flex align-center pe-2">
            <v-icon icon="mdi-account-search-outline" class="me-2"></v-icon>
            Search Admins
            <v-spacer></v-spacer>
            <v-text-field
                v-model="searchKey"
                label="Search by Username, Name, Role, etc..."
                prepend-inner-icon="mdi-magnify"
                variant="solo-filled"
                flat
                hide-details
                single-line
            ></v-text-field>
        </v-card-title>
        <v-divider></v-divider>

        <!-- NEW: Date Range Selection & Actions for Admins -->
        <v-card-text>
          <v-card-title class="font-size-15 text-left pb-0 pl-0 mr-0">Date Added Range Selection & Actions</v-card-title>
            
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
                    label="Start Date (Added)"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    variant="outlined"
                    density="compact"
                    v-bind="props"
                    clearable
                    @click:clear="clearDateRange(); updateTable()"
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
                    label="End Date (Added)"
                    prepend-inner-icon="mdi-calendar"
                    readonly
                    variant="outlined"
                    density="compact"
                    v-bind="props"
                    clearable
                    @click:clear="clearDateRange(); updateTable()"
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
                :disabled="admins.length === 0 && !loading"
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
          :items-length="totalAdmins"
          :items="admins"
          :loading="loading"
          @update:options="updateTable"
          class="elevation-0"
          item-value="_id"
        >
          <!-- This slot correctly targets 'item.createdAt' and displays the formatted date and time -->
          <template v-slot:item.createdAt="{ item }">
            {{ formatDateTime(item.createdAt) }}
          </template>

          <template v-slot:item.action="{ item }">
            <v-btn variant="tonal" color="primary" :to="`/admins/${item._id}`" size="small">
              View / Edit
            </v-btn>
          </template>

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>
           <template v-slot:no-data>
            <v-alert type="info" class="ma-3">No administrators found matching your criteria.</v-alert>
          </template>

        </v-data-table-server>
      </v-card>

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Admin Report</v-toolbar-title>
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
            <h3 class="text-h5 text-center mb-6">Administrator Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="startDate && endDate">
                    (Added from {{ formattedStartDate }} to {{ formattedEndDate }})
                </span>
                <span v-else-if="startDate">
                    (Added from {{ formattedStartDate }} onwards)
                </span>
                <span v-else-if="endDate">
                    (Added up to {{ formattedEndDate }})
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
                <tr v-for="item in adminsForPrint" :key="item._id">
                  <td>{{ item.name }}</td>
                  <td>{{ item.username }}</td>
                  <td>{{ item.email }}</td>
                  <td>{{ item.role }}</td>
                  <td>{{ formatDateTime(item.createdAt) }}</td>
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
import { useMyFetch } from '../../composables/useMyFetch'; // Adjust path if needed
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Make sure this path is correct for your project

const { $toast } = useNuxtApp();

const headers = [
  { title: 'Full Name', align: 'start', key: 'name', sortable: true },
  { title: 'Username', align: 'start', key: 'username', sortable: true },
  { title: 'Email Address', align: 'start', key: 'email', sortable: false },
  { title: 'Role', align: 'start', key: 'role', sortable: true },
  { title: 'Date & Time Added', align: 'start', key: 'createdAt', sortable: true }, // Changed title
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalAdmins = ref(0);
const admins = ref([]);
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
const adminsForPrint = ref([]);

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.filter(header => header.key !== 'action');
});


// --- WATCHERS for Search ---
let searchDebounceTimer = null;
watch(searchKey, () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    updateTable({ page: 1 }); // Reset page to 1 when search changes
  }, 500);
});


async function updateTable(options) {
  loading.value = true;
  
  // Merge new options with current table options, prioritizing new ones
  currentTableOptions.value = { ...currentTableOptions.value, ...options };

  const { page, itemsPerPage: rpp, sortBy } = currentTableOptions.value;
  
  try {
    const sortByKey = sortBy.length ? sortBy[0].key : 'createdAt'; 
    const sortOrder = sortBy.length ? sortBy[0].order : 'desc';   

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

    const { data, error } = await useMyFetch('/api/admins', {
      query: queryParams
    });

    if (error.value) {
        console.error("Failed to fetch admins:", error.value);
        admins.value = [];
        totalAdmins.value = 0;
    } else {
        admins.value = data.value?.admins;
        totalAdmins.value = data.value?.totalAdmins;
    }

  } catch (err) {
      console.error("An exception occurred while fetching admins:", err);
      $toast.fire({ title: 'An unexpected error occurred while loading administrators.', icon: 'error' });
  } finally {
      loading.value = false;
  }
}

// --- Date Filter Functions ---
const clearDateRange = () => {
  startDate.value = null;
  endDate.value = null;
  selectedDateFilterPreset.value = null; 
  updateTable({ page: 1 }); // Reload data with cleared date filters
};

const applyDateFilters = () => {
  // If manual dates are set or cleared, clear any active preset selection
  if ((startDate.value !== null || endDate.value !== null) && selectedDateFilterPreset.value !== null) {
      selectedDateFilterPreset.value = null;
  } else if (startDate.value === null && endDate.value === null) {
      selectedDateFilterPreset.value = null; 
  }
  updateTable({ page: 1 }); // Reset page to 1 when date filters are applied
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
  updateTable({ page: 1 }); // Reset page to 1 when preset is applied
};


// Function updated to format both date and time.
const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    };
    return new Date(dateString).toLocaleString('en-US', options);
};

// --- Print Functionality ---

async function fetchAllAdminsForPrint() {
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

        const { data, error } = await useMyFetch('/api/admins', { query: queryParams });

        if (error.value) throw new Error(error.value.data?.message || 'Failed to load all administrators for printing.');
        
        return data.value?.admins || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true;
  adminsForPrint.value = await fetchAllAdminsForPrint();
  loading.value = false;

  if (adminsForPrint.value.length > 0) {
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
          <title>Admin Report</title>
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
    updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});
</script>

<style scoped>
/* Styles specific for printing the dialog content (from inventory) */
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