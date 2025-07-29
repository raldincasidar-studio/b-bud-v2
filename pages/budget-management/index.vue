<template>
  <v-container class="my-10">
      <v-row justify="space-between" align="center" class="mb-4">
        <v-col>
          <h2 class="text-h4 font-weight-bold">Budget Management</h2>
          <p class="text-grey-darken-1">Manage budget entries and view financial records.</p>
        </v-col>
        <v-col class="text-right">
          <!-- Updated Button to "Add Budget" -->
          <v-btn to="/budget-management/new" color="primary" size="large" prepend-icon="mdi-plus">
            Add Budget
          </v-btn>
        </v-col>
      </v-row>

      <!-- Content -->
      <v-card class="mt-6" flat border>
        <v-card-title class="d-flex align-center pe-2">
            <!-- Updated Search Title and Icon -->
            <v-icon icon="mdi-cash-search" class="me-2"></v-icon>
            Search Budget
            <v-spacer></v-spacer>
            <!-- Updated Search Label -->
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
          <!-- Slot for formatting the date -->
          <template v-slot:item.date="{ item }">
            {{ formatDate(item.date) }}
          </template>

          <!-- Slot for the Edit action button -->
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
import { ref } from 'vue';

// Updated headers for the Budget Management table
const headers = [
  { title: 'Budget Name', align: 'start', key: 'budgetName', sortable: true },
  { title: 'Category', align: 'start', key: 'category', sortable: true },
  { title: 'Amount', align: 'start', key: 'amount', sortable: false },
  { title: 'Date', align: 'start', key: 'date', sortable: true },
  { title: 'Actions', key: 'action', sortable: false, align: 'center' },
];

const searchKey = ref('');
const totalBudgets = ref(0); // Renamed from totalAdmins
const budgets = ref([]); // Renamed from admins
const loading = ref(true);
const itemsPerPage = ref(10); 

// Updated function to fetch budget data
async function updateTable(options) {
  loading.value = true;
  
  const { page, itemsPerPage: newItemsPerPage, sortBy } = options;
  
  try {
    const sortByKey = sortBy.length ? sortBy[0].key : 'date'; 
    const sortOrder = sortBy.length ? sortBy[0].order : 'desc';   

    // Changed API endpoint to fetch budgets
    const { data, error } = await useMyFetch('/api/budgets', {
      query: {
        search: searchKey.value, 
        page: page,
        itemsPerPage: newItemsPerPage,
        sortBy: sortByKey,
        sortOrder: sortOrder,
      }
    });

    if (error.value) {
        console.error("Failed to fetch budgets:", error.value);
        budgets.value = [];
        totalBudgets.value = 0;
    } else {
        // Updated to handle budget data response
        budgets.value = data.value?.budgets;
        totalBudgets.value = data.value?.totalBudgets;
    }

  } catch (err) {
      console.error("An exception occurred while fetching budgets:", err);
  } finally {
      loading.value = false;
  }
}

// Updated date format to match DD/MM/YYYY
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
};
</script>