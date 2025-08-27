<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Budget Management</h2>
          <p class="text-grey-darken-1">Manage budget entries and view financial records.</p>
        </v-col>
        <v-col class="text-right">
          <v-btn to="/budget-management/new" color="primary" size="large" prepend-icon="mdi-plus">
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
        
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-select
                v-model="filterBy"
                :items="filterOptions"
                label="Filter by"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
            <v-col v-if="filterBy === 'day'" cols="12" md="4">
              <v-menu
                v-model="showDayPicker"
                :close-on-content-click="false"
                :nudge-right="40"
                transition="scale-transition"
                offset-y
                min-width="auto"
              >
                <template v-slot:activator="{ props }">
                  <v-text-field
                    v-model="formattedSelectedDay"
                    label="Select Day"
                    prepend-icon="mdi-calendar"
                    readonly
                    v-bind="props"
                    variant="outlined"
                    hide-details
                  ></v-text-field>
                </template>
                <v-date-picker
                  v-model="selectedDay"
                  @update:model-value="applyFilter"
                  no-title
                  scrollable
                ></v-date-picker>
              </v-menu>
            </v-col>
            <v-col v-if="filterBy === 'month'" cols="12" md="4">
              <v-select
                v-model="selectedMonth"
                :items="months"
                item-title="name"
                item-value="value"
                label="Select Month"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
            <v-col v-if="filterBy === 'year'" cols="12" md="4">
              <v-select
                v-model="selectedYear"
                :items="years"
                label="Select Year"
                variant="outlined"
                hide-details
                @update:model-value="applyFilter"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>

        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          :headers="headers"
          :items-length="totalBudgets"
          :items="budgets"
          :loading="loading"
          :search="searchKey"
          @update:options="updateTable"
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

          <template v-slot:loading>
            <v-skeleton-loader type="table-row@5"></v-skeleton-loader>
          </template>

        </v-data-table-server>
      </v-card>
  </v-container>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useMyFetch } from '@/composables/useMyFetch'; // Assuming useMyFetch is correctly imported from your composables

const headers = [
  { title: 'Budget Name', align: 'start', key: 'budgetName', sortable: true },
  { title: 'Category', align: 'start', key: 'category', sortable: true },
  { title: 'Amount', align: 'start', key: 'amount', sortable: false },
  { title: 'Date', align: 'start', key: 'date', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalBudgets = ref(0);
const budgets = ref([]);
const loading = ref(true);
const itemsPerPage = ref(10);

// Filter States
const filterBy = ref(''); // Can be 'day', 'month', 'year', or '' for no filter
const filterOptions = [
  { title: 'No Filter', value: '' },
  { title: 'Filter by Day', value: 'day' },
  { title: 'Filter by Month', value: 'month' },
  { title: 'Filter by Year', value: 'year' },
];

const showDayPicker = ref(false);
const selectedDay = ref(null); // Date object for day filter
const selectedMonth = ref(null); // 1-12 for month filter
const selectedYear = ref(null); // Year for year filter

const months = Array.from({ length: 12 }, (_, i) => {
  const date = new Date(null, i + 1, null);
  return { name: date.toLocaleString('en-US', { month: 'long' }), value: i + 1 };
});
const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i); // Last 10 years

const formattedSelectedDay = computed(() => {
  return selectedDay.value ? new Date(selectedDay.value).toLocaleDateString('en-GB') : '';
});

// Watch for changes in filterBy and reset other filters
watch(filterBy, (newVal) => {
  if (newVal === 'day') {
    selectedMonth.value = null;
    selectedYear.value = null;
  } else if (newVal === 'month') {
    selectedDay.value = null;
    selectedYear.value = null; // Reset year as well, to be chosen separately or default
  } else if (newVal === 'year') {
    selectedDay.value = null;
    selectedMonth.value = null;
  } else {
    selectedDay.value = null;
    selectedMonth.value = null;
    selectedYear.value = null;
  }
  applyFilter(); // Apply filter when filter type changes
});

async function updateTable(options) {
  loading.value = true;
  
  const { page, itemsPerPage: newItemsPerPage, sortBy } = options;
  
  try {
    const sortByKey = sortBy.length ? sortBy[0].key : 'date'; 
    const sortOrder = sortBy.length ? sortBy[0].order : 'desc';   

    const queryParams = {
      search: searchKey.value, 
      page: page,
      itemsPerPage: newItemsPerPage,
      sortBy: sortByKey,
      sortOrder: sortOrder,
    };

    if (filterBy.value === 'day' && selectedDay.value) {
      // Ensure selectedDay is a valid Date object before formatting
      const date = new Date(selectedDay.value);
      if (!isNaN(date)) {
        queryParams.filterDay = date.toISOString().split('T')[0]; // YYYY-MM-DD
      }
    } else if (filterBy.value === 'month' && selectedMonth.value) {
      queryParams.filterMonth = selectedMonth.value;
      queryParams.filterYear = selectedYear.value || new Date().getFullYear(); // Default to current year if only month is selected
    } else if (filterBy.value === 'year' && selectedYear.value) {
      queryParams.filterYear = selectedYear.value;
    }

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
  } finally {
      loading.value = false;
  }
}

const applyFilter = () => {
  // When a filter is applied or changed, we should ideally reset the pagination
  // and trigger the table update.
  updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
  showDayPicker.value = false; // Close date picker after selection
};

// Updated date format to match DD/MM/YYYY
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
};

const formatDateToISO = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
};

// Initial load of the table data
updateTable({ page: 1, itemsPerPage: itemsPerPage.value, sortBy: [] });
</script>