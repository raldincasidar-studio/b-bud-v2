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
        <v-spacer></v-spacer>
        <v-text-field
          v-model="searchKey"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          color="primary"
          label="Search Households"
          placeholder="Search by Head's Name, Household No., Address..."
          clearable
          flat
          hide-details
          single-line
          class="mb-4"
        ></v-text-field>
        <!-- Print Data Button for Households -->
        <v-btn
          color="info"
          prepend-icon="mdi-printer"
          @click="openPrintDialog"
          :disabled="households.length === 0 && !loading"
          class="ml-4 mb-4"
          size="large"
        >
          Print Data
        </v-btn>
      </v-card-title>
      <v-divider></v-divider>

      <v-card-text>
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items="households"
          :items-length="totalItems"
          :loading="loading"
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

          <!-- Slot for Head Full Name -->
          <template v-slot:item.head_full_name="{ item }">
            {{ item.head_first_name }} {{ item.head_last_name }}
          </template>

          <!-- Slot for Number of Members -->
          <template v-slot:item.number_of_members="{ item }">
            <v-chip small :color="item.number_of_members > 0 ? 'blue' : 'grey'">
              {{ item.number_of_members }}
            </v-chip>
          </template>

          <!-- NEW Slot for Address -->
          <template v-slot:item.address="{ item }">
            {{ item.address }}
          </template>
          
          <!-- Slot for Unit/Room/Apartment Number -->
          <template v-slot:item.head_address_unit_room_apt_number="{ item }">
            {{ item.head_address_unit_room_apt_number || 'N/A' }}
          </template>

          <!-- Slot for Type of Household -->
          <template v-slot:item.head_type_of_household="{ item }">
            {{ item.head_type_of_household || 'N/A' }}
          </template>

          <!-- Slot for Date Approved -->
          <template v-slot:item.head_date_approved="{ item }">
            {{ formatDate(item.head_date_approved) }}
          </template>

          <!-- Slot for Date Updated -->
          <template v-slot:item.head_date_updated="{ item }">
            {{ formatDate(item.head_date_updated) }}
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

    <!-- Print Dialog -->
    <v-dialog v-model="printDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dense color="primary">
          <v-toolbar-title>Printable Households Report</v-toolbar-title>
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
            <!-- The content for printing is now generated dynamically in the printContent method -->
            <!-- The template section here will still be shown in the dialog, but printContent overrides it for the actual print -->
            <h3 class="text-h5 text-center mb-6">Households Report</h3>
            <p class="text-center text-grey-darken-1 mb-4">
                Report Date: {{ new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }}
                <span v-if="searchKey">
                    (Filtered by search: "{{ searchKey }}")
                </span>
                <span v-else>
                    (No specific search filter applied)
                </span>
            </p>
            <p class="text-center font-weight-bold mb-4">
                Total Count: {{ householdsForPrint.length }} Households
            </p>
            <table class="print-table">
              <thead>
                <tr>
                  <th v-for="header in printableHeaders" :key="header.key">{{ header.title }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in householdsForPrint" :key="item.household_id">
                  <td>{{ item.household_name }}</td>
                  <td>{{ item.household_number }}</td>
                  <td>{{ item.head_first_name }} {{ item.head_last_name }}</td>
                  <td>{{ item.number_of_members }}</td>
                  <td>{{ item.address }}</td>
                  <td>{{ item.head_address_unit_room_apt_number || 'N/A' }}</td>
                  <td>{{ item.head_type_of_household || 'N/A' }}</td>
                  <td>{{ formatDate(item.head_date_approved) }}</td>
                  <td>{{ formatDate(item.head_date_updated) }}</td>
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
import { useMyFetch } from '../composables/useMyFetch';
import { useNuxtApp } from '#app';
import logoImage from '~/assets/img/logo.png'; // Make sure this path is correct for your project

const { $toast } = useNuxtApp();

const searchKey = ref('');
const totalItems = ref(0);      
const households = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);   

// Ref to hold the current table options (pagination, sorting)
const currentTableOptions = ref({ page: 1, itemsPerPage: 10, sortBy: [] });

// --- Print functionality refs ---
const printDialog = ref(false);
const householdsForPrint = ref([]);

const headers = ref([
  { title: 'Household Name', key: 'household_name', sortable: false, align: 'start' }, 
  { title: 'Household No.', key: 'household_number', sortable: false },
  { title: 'Head of Household', key: 'head_full_name', sortable: false, value: item => `${item.head_first_name || ''} ${item.head_last_name || ''}`.trim() },
  { title: 'No. of Members', key: 'number_of_members', sortable: false, align: 'center' },
  { title: 'Address', key: 'address', sortable: false }, // NEW ADDRESS FIELD
  { title: 'Unit/Room/Apt No.', key: 'head_address_unit_room_apt_number', sortable: false },
  { title: 'Type of Household', key: 'head_type_of_household', sortable: false },
  { title: 'Date Approved', key: 'head_date_approved', sortable: true, value: item => formatDate(item.head_date_approved) },
  { title: 'Date Updated', key: 'head_date_updated', sortable: true, value: item => formatDate(item.head_date_updated) },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
]);

// Helper function to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch (e) {
    console.error("Error formatting date:", e);
    return 'Invalid Date';
  }
};

// Headers to be displayed in the print view (excluding 'Actions')
const printableHeaders = computed(() => {
  return headers.value.filter(header => header.key !== 'action');
});

// Debounce search
let searchDebounceTimer = null;
watch(searchKey, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    // Trigger table update by calling loadHouseholds with current options and reset page to 1
    loadHouseholds({ 
      page: 1, 
      itemsPerPage: itemsPerPage.value, 
      sortBy: currentTableOptions.value.sortBy, // Preserve current sort
    });
  }, 500); // 500ms debounce
});

async function loadHouseholds(options) {
  loading.value = true;
  // Merge new options with current table options, prioritizing new ones
  currentTableOptions.value = { ...currentTableOptions.value, ...options };

  const { page, itemsPerPage: rpp, sortBy } = currentTableOptions.value; 
  
  const queryParams = {
    search: searchKey.value, // Always use the latest searchKey from our ref
    page: page,
    itemsPerPage: rpp,
  };

  // Handle sorting (if your API supports it)
  if (sortBy && sortBy.length > 0) {
    queryParams.sortBy = sortBy[0].key;
    queryParams.sortOrder = sortBy[0].order;
  }

  // Clean up undefined/null/empty string query params
  Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

  try {
    const { data, error } = await useMyFetch('/api/households', {
      query: queryParams,
    });

    if (error.value) {
      console.error('Failed to load households:', error.value);
      $toast.fire({ title: error.value.data?.message || 'Failed to load households.', icon: 'error' });
      households.value = [];
      totalItems.value = 0;
    } else if (data.value) {
      households.value = data.value.households || []; 
      totalItems.value = data.value.total || 0;       
    }
  } catch (e) {
    console.error('Exception while loading households:', e);
    $toast.fire({ title: 'An unexpected error occurred while loading households.', icon: 'error' });
    households.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
}

// --- Print Functionality ---

async function fetchAllHouseholdsForPrint() {
    try {
        const queryParams = {
            search: searchKey.value,
            itemsPerPage: 999999 // Request a very high number of items to get all data
        };
        // Include current sorting for print data
        if (currentTableOptions.value.sortBy && currentTableOptions.value.sortBy.length > 0) {
          queryParams.sortBy = currentTableOptions.value.sortBy[0].key;
          queryParams.sortOrder = currentTableOptions.value.sortBy[0].order;
        }

        Object.keys(queryParams).forEach(key => (queryParams[key] === undefined || queryParams[key] === null || queryParams[key] === '') && delete queryParams[key]);

        const { data, error } = await useMyFetch('/api/households', { query: queryParams });

        if (error.value) throw new Error(error.value.data?.message || 'Failed to load all households for printing.');
        
        return data.value?.households || [];
    } catch (e) {
        $toast.fire({ title: e.message, icon: 'error' });
        return [];
    }
}


const openPrintDialog = async () => {
  loading.value = true;
  householdsForPrint.value = await fetchAllHouseholdsForPrint();
  loading.value = false;

  if (householdsForPrint.value.length > 0) {
      printDialog.value = true;
  } else {
      $toast.fire({ title: 'No data to print for the selected filters.', icon: 'info' });
  }
};

const printContent = () => {
  const printContentDiv = document.getElementById('print-area');
  if (printContentDiv) {
    const printWindow = window.open('', '_blank');

    // Get the current date for the report
    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const searchFilterText = searchKey.value ? `(Filtered by search: "${searchKey.value}")` : '(No specific search filter applied)';
    const totalCountText = `Total Count: ${householdsForPrint.value.length} Households`;

    // Construct the table rows dynamically for printing
    const tableRowsHtml = householdsForPrint.value.map(item => `
      <tr>
        <td>${item.household_name}</td>
        <td>${item.household_number}</td>
        <td>${item.head_first_name} ${item.head_last_name}</td>
        <td>${item.number_of_members}</td>
        <td>${item.address}</td>
        <td>${item.head_address_unit_room_apt_number || 'N/A'}</td>
        <td>${item.head_type_of_household || 'N/A'}</td>
        <td>${formatDate(item.head_date_approved)}</td>
        <td>${formatDate(item.head_date_updated)}</td>
      </tr>
    `).join('');

    // Construct the table headers dynamically for printing
    const tableHeadersHtml = printableHeaders.value.map(header => `<th>${header.title}</th>`).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Households Report</title>
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
            .report-info {
                text-align: center;
                margin-bottom: 15px;
                color: #555;
            }
            .total-count-display {
                text-align: center;
                font-weight: bold;
                margin-bottom: 15px;
                color: #333;
            }
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
          <h3 class="text-h5 text-center mb-6">Households Report</h3>
          <p class="report-info">
              Report Date: ${reportDate}
              ${searchFilterText}
          </p>
          <p class="total-count-display">${totalCountText}</p>
          <table class="print-table">
            <thead>
              <tr>
                ${tableHeadersHtml}
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          <p class="text-caption text-center mt-6">Generated by B-bud System.</p>
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
    loadHouseholds({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
});
</script>

<style scoped>
/* Optional: Add any specific styles here */
.v-card-title .v-icon {
  color: rgb(var(--v-theme-primary));
}

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